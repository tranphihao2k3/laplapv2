/**
 * ImageService — MED-001.
 *
 * Tải ảnh từ URL → validate (MIME, size, host) → safe filename →
 * checksum (sha256) → lưu app data/temp.
 *
 * Acceptance (docs §11 MED-001):
 *  - 404, redirect lạ, MIME giả, file quá lớn và duplicate có test.
 *  - Ảnh lỗi KHÔNG đưa vào enqueue (UI gọi validate trước).
 *  - Host cho phép phải khớp config (settings.apiBaseUrl hoặc CDN
 *    trong whitelist).
 *  - TTL cleanup: file cũ hơn diagnosticsTtlMs sẽ bị cleanup theo lịch.
 *
 * Không dùng thư viện sharp/jimp — chỉ stream buffer + sha256.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { app } from "electron";
import { AppError } from "../../shared/errors";
import { apiFetch } from "../api/http-client";
import { SettingsRepository } from "../db/repositories/settings";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB.
export const ALLOWED_MIME: ReadonlyArray<string> = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const HOST_ALLOW_DEFAULT = [
  // LapLap public CDN / Supabase storage.
  /^[a-z0-9-]+\.supabase\.co$/i,
  /^[a-z0-9-]+\.supabase\.in$/i,
  /^cdn\.[a-z0-9.-]+$/i,
  /^localhost(:\d+)?$/i,
  /^127\.0\.0\.1(:\d+)?$/i,
  // Generic image CDNs thường gặp cho catalog sản phẩm.
  /^images\.unsplash\.com$/i,
  /^res\.cloudinary\.com$/i,
  /^[a-z0-9-]+\.cloudfront\.net$/i,
  /^[a-z0-9-]+\.r2\.cloudflarestorage\.com$/i,
  /^[a-z0-9-]+\.b-cdn\.net$/i,
];

export type DownloadedImage = {
  url: string;
  filePath: string;
  mime: string;
  bytes: number;
  sha256: string;
  downloadedAt: string;
};

export class ImageService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly userDataDir?: string,
  ) {}

  /**
   * Tải 1 ảnh URL về app data/temp/media/<hash>.bin. Trả metadata để UI
   * dùng làm campaign image_paths_json.
   *
   * Throw AppError typed khi:
   *   IMAGE_HOST_DENIED — host không trong whitelist.
   *   IMAGE_TOO_LARGE — > MAX_IMAGE_BYTES.
   *   IMAGE_BAD_MIME — MIME không phải image/* trong ALLOWED_MIME.
   *   IMAGE_DOWNLOAD_FAILED — lỗi mạng, 4xx/5xx.
   */
  async download(input: { url: string }): Promise<DownloadedImage> {
    const url = this.assertHostAllowed(input.url);

    let res: Response;
    try {
      res = await apiFetch(url, url, "GET", {
        // Bypass Authorization header — raw asset fetch.
        headers: {},
        timeoutMs: this.settings.get().httpTimeoutMs,
      });
    } catch (err) {
      throw new AppError(
        "IMAGE_DOWNLOAD_FAILED",
        `Tải ảnh thất bại: ${err instanceof Error ? err.message : String(err)}`,
        502,
      );
    }

    if (!res.ok) {
      throw new AppError(
        "IMAGE_DOWNLOAD_FAILED",
        `HTTP ${res.status} khi tải ảnh`,
        502,
      );
    }

    // Validate MIME từ header.
    const mime = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!ALLOWED_MIME.includes(mime)) {
      throw new AppError(
        "IMAGE_BAD_MIME",
        `MIME không được phép: "${mime}" (chỉ chấp nhận ${ALLOWED_MIME.join(", ")})`,
        415,
      );
    }

    // Validate size.
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > 0 && contentLength > MAX_IMAGE_BYTES) {
      throw new AppError(
        "IMAGE_TOO_LARGE",
        `Ảnh quá lớn: ${contentLength} bytes > ${MAX_IMAGE_BYTES}`,
        413,
      );
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      throw new AppError(
        "IMAGE_TOO_LARGE",
        `Ảnh quá lớn khi đọc: ${buf.byteLength} bytes > ${MAX_IMAGE_BYTES}`,
        413,
      );
    }

    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    const dir = this.mediaDir();
    await fs.mkdir(dir, { recursive: true });
    const ext = mimeToExt(mime);
    const filePath = path.join(dir, `${sha256}${ext}`);
    // Atomic write.
    const tmp = filePath + ".tmp";
    await fs.writeFile(tmp, buf);
    await fs.rename(tmp, filePath);

    return {
      url,
      filePath,
      mime,
      bytes: buf.byteLength,
      sha256,
      downloadedAt: new Date().toISOString(),
    };
  }

  /**
   * Cleanup file cũ hơn TTL. Dùng Settings.mediaTtlMs (riêng cho media;
   * khác với diagnosticsTtlMs). Default 30 ngày.
   */
  async cleanupExpired(): Promise<{ removed: number }> {
    const ttlMs = this.settings.get().mediaTtlMs;
    const cutoff = Date.now() - ttlMs;
    const dir = this.mediaDir();
    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { removed: 0 };
      throw err;
    }
    let removed = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = path.join(dir, entry.name);
      const stat = await fs.stat(full);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(full).catch(() => undefined);
        removed += 1;
      }
    }
    return { removed };
  }

  /**
   * Tải nhiều URL song song (có cap). Lỗi 1 URL không fail cả batch —
   * trả về kết quả per-URL để caller quyết định. Dedup theo sha256:
   * cùng nội dung → cùng file path (vì tên file = sha256 nội dung).
   */
  async downloadMany(input: {
    urls: string[];
    /** Cap concurrent download để tránh spike mạng. */
    concurrency?: number;
  }): Promise<Array<
    | { ok: true; downloaded: DownloadedImage }
    | { ok: false; url: string; errorCode: string; message: string }
  >> {
    const cap = Math.max(1, input.concurrency ?? 4);
    const queue = [...input.urls];
    const out: Array<
      | { ok: true; downloaded: DownloadedImage }
      | { ok: false; url: string; errorCode: string; message: string }
    > = [];
    const workers = Array.from({ length: cap }, async () => {
      while (queue.length > 0) {
        const url = queue.shift();
        if (!url) return;
        try {
          const downloaded = await this.download({ url });
          out.push({ ok: true, downloaded });
        } catch (err) {
          const code =
            err instanceof AppError ? err.code : "IMAGE_DOWNLOAD_FAILED";
          const message = err instanceof Error ? err.message : String(err);
          out.push({ ok: false, url, errorCode: code, message });
        }
      }
    });
    await Promise.all(workers);
    return out;
  }

  /**
   * Đảm bảo có file local cho mỗi URL. Nếu 1 URL fail → trả `null` cho
   * slot đó nhưng KHÔNG throw — caller (CampaignService) quyết định có
   * đăng bài không ảnh hay skip job.
   */
  async ensureLocalPaths(input: { urls: string[] }): Promise<Array<string | null>> {
    const out: Array<string | null> = [];
    for (const url of input.urls) {
      try {
        const r = await this.download({ url });
        out.push(r.filePath);
      } catch {
        out.push(null);
      }
    }
    return out;
  }

  /** Đường dẫn tới app data/temp/media. */
  mediaDir(): string {
    const base = this.userDataDir ?? app.getPath("userData");
    return path.join(base, "temp", "media");
  }

  private assertHostAllowed(input: string): string {
    let parsed: URL;
    try {
      parsed = new URL(input);
    } catch {
      throw new AppError("IMAGE_BAD_URL", "URL không hợp lệ", 400);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new AppError("IMAGE_BAD_URL", `Protocol không hợp lệ: ${parsed.protocol}`, 400);
    }
    const host = parsed.host;
    const ok = HOST_ALLOW_DEFAULT.some((re) => re.test(host));
    if (!ok) {
      throw new AppError(
        "IMAGE_HOST_DENIED",
        `Host không trong whitelist: ${host}`,
        403,
      );
    }
    return parsed.toString();
  }
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".bin";
  }
}
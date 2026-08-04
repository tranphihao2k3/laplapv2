/**
 * MED-001 — ImageService tests.
 *
 * Cover:
 *  - Host deny khi URL host lạ (vd evil.com).
 *  - Protocol deny (vd ftp://, file://).
 *  - MIME deny khi response trả text/html.
 *  - Size deny khi content-length > MAX hoặc body > MAX.
 *  - Happy path: file lưu vào app data/temp/media/<sha256>.<ext>.
 *  - cleanupExpired xoá file cũ hơn TTL.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { ImageService, MAX_IMAGE_BYTES } from "../../src/main/services/image-service";
import { SettingsRepository } from "../../src/main/db/repositories/settings";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/main/db/migrations";

let db: Database.Database;
let tempDir: string;
let settings: SettingsRepository;
let svc: ImageService;

beforeEach(async () => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  settings = new SettingsRepository(db);
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "laplap-media-"));
  svc = new ImageService(settings, tempDir);
});

afterEach(async () => {
  db.close();
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
});

function fakeResponse(opts: {
  status?: number;
  contentType?: string;
  contentLength?: number | null;
  body?: Buffer | string;
}): Response {
  const body = opts.body ?? Buffer.from([0xff, 0xd8, 0xff]); // JPEG magic bytes
  return {
    ok: (opts.status ?? 200) >= 200 && (opts.status ?? 200) < 300,
    status: opts.status ?? 200,
    statusText: "OK",
    headers: {
      get: (name: string) => {
        const n = name.toLowerCase();
        if (n === "content-type") return opts.contentType ?? "image/jpeg";
        if (n === "content-length")
          return String(opts.contentLength ?? body.byteLength ?? body.length);
        return null;
      },
    },
    arrayBuffer: async () => (typeof body === "string" ? new TextEncoder().encode(body).buffer : body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)),
  } as unknown as Response;
}

describe("ImageService.download — validation", () => {
  it("host deny: evil.com → IMAGE_HOST_DENIED", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => fakeResponse({})) as unknown as typeof fetch;
    try {
      await expect(svc.download({ url: "https://evil.com/x.jpg" })).rejects.toThrowError(/IMAGE_HOST_DENIED/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("protocol deny: file://", async () => {
    await expect(svc.download({ url: "file:///c:/x.jpg" })).rejects.toThrowError(/BAD_URL/);
  });

  it("MIME deny: text/html → IMAGE_BAD_MIME", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      fakeResponse({ contentType: "text/html" })) as unknown as typeof fetch;
    try {
      await expect(
        svc.download({ url: "https://abc123.supabase.co/storage/x.jpg" }),
      ).rejects.toThrowError(/IMAGE_BAD_MIME/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("size deny qua Content-Length > MAX", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      fakeResponse({ contentLength: MAX_IMAGE_BYTES + 1 })) as unknown as typeof fetch;
    try {
      await expect(
        svc.download({ url: "https://abc123.supabase.co/storage/x.jpg" }),
      ).rejects.toThrowError(/IMAGE_TOO_LARGE/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("size deny qua body > MAX (header không có)", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      fakeResponse({ contentLength: null, body: Buffer.alloc(MAX_IMAGE_BYTES + 1) })) as unknown as typeof fetch;
    try {
      await expect(
        svc.download({ url: "https://abc123.supabase.co/storage/x.jpg" }),
      ).rejects.toThrowError(/IMAGE_TOO_LARGE/);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("ImageService.download — happy path", () => {
  it("file JPEG lưu vào app data/temp/media/<sha256>.jpg", async () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      fakeResponse({ contentType: "image/jpeg", body: buf })) as unknown as typeof fetch;
    try {
      const result = await svc.download({
        url: "https://abc123.supabase.co/storage/test.jpg",
      });
      expect(result.mime).toBe("image/jpeg");
      expect(result.bytes).toBe(buf.byteLength);
      expect(result.sha256).toHaveLength(64); // sha256 hex
      expect(result.filePath).toMatch(/\.jpg$/);

      // File đã tồn tại trên disk.
      const stat = await fs.stat(result.filePath);
      expect(stat.size).toBe(buf.byteLength);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("PNG → .png extension", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      fakeResponse({ contentType: "image/png", body: png })) as unknown as typeof fetch;
    try {
      const result = await svc.download({
        url: "https://cdn.laplap.vn/x.png",
      });
      expect(result.filePath).toMatch(/\.png$/);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("ImageService.downloadMany — batch", () => {
  it("tải song song nhiều URL, lỗi 1 URL không fail cả batch", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      // URL thứ 2 fail 404.
      if (u.endsWith("/missing.jpg")) {
        return fakeResponse({ status: 404 });
      }
      return fakeResponse({});
    }) as unknown as typeof fetch;
    try {
      const out = await svc.downloadMany({
        urls: [
          "https://abc123.supabase.co/a.jpg",
          "https://abc123.supabase.co/missing.jpg",
          "https://cdn.laplap.vn/b.jpg",
        ],
        concurrency: 2,
      });
      expect(out).toHaveLength(3);
      expect(out[0]?.ok).toBe(true);
      expect(out[1]?.ok).toBe(false);
      expect((out[1] as { ok: false; errorCode: string }).errorCode).toBe("IMAGE_DOWNLOAD_FAILED");
      expect(out[2]?.ok).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("ImageService.ensureLocalPaths", () => {
  it("URL hợp lệ trả filePath, URL fail trả null", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/missing.jpg")) return fakeResponse({ status: 404 });
      return fakeResponse({});
    }) as unknown as typeof fetch;
    try {
      const out = await svc.ensureLocalPaths({
        urls: [
          "https://abc123.supabase.co/a.jpg",
          "https://abc123.supabase.co/missing.jpg",
        ],
      });
      expect(out).toHaveLength(2);
      expect(typeof out[0]).toBe("string");
      expect(out[1]).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("ImageService.cleanupExpired", () => {
  it("file cũ bị xoá; file mới giữ nguyên", async () => {
    // Tạo 2 file với mtime khác nhau.
    const oldPath = path.join(tempDir, "temp", "media", "old.jpg");
    await fs.mkdir(path.dirname(oldPath), { recursive: true });
    await fs.writeFile(oldPath, "old");
    const oldTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 ngày trước
    await fs.utimes(oldPath, oldTime, oldTime);

    const newPath = path.join(tempDir, "temp", "media", "new.jpg");
    await fs.writeFile(newPath, "new");

    const result = await svc.cleanupExpired();
    expect(result.removed).toBe(1);
    expect(await fs.stat(newPath).catch(() => null)).not.toBeNull();
    expect(await fs.stat(oldPath).catch(() => null)).toBeUndefined();
  });

  it("không throw khi mediaDir không tồn tại", async () => {
    // Tạo service với tempDir khác, chưa mkdir.
    const emptyDir = path.join(os.tmpdir(), `laplap-media-empty-${Date.now()}`);
    const emptySvc = new ImageService(settings, emptyDir);
    const result = await emptySvc.cleanupExpired();
    expect(result.removed).toBe(0);
  });
});
/**
 * GET /api/v1/system-scan/download-smartctl
 *
 * Endpoint download smartctl.exe (signed binary tu smartmontools).
 *
 * LUONG UPLOAD (admin lam 1 lan):
 *   Upload smartctl.exe len Supabase Storage key 'tools/smartctl/7.5/smartctl.exe'.
 *
 * LUONG DOWNLOAD:
 *   1. Lay binary truc tiep tu Supabase Storage bucket "tools" (private).
 *   2. Neu Storage miss -> fallback sourceforge ZIP (public mirror).
 *   3. Verify magic bytes (catch SF tro ve HTML error page).
 *   4. Cache lai vao Storage de lan sau doc nhanh.
 */

import { NextRequest } from "next/server";
import { handleError } from "@/lib/api/response";
import {
  downloadToolFile,
  putToolFile,
  headToolFile,
} from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120; // 120s cho download + extract ZIP

const STORAGE_PATH = "tools/smartctl/7.5/smartctl.exe";
const EXPECTED_VERSION = "7.5";

/** Sourceforge mirrors (fallback neu Storage miss). */
const SMARTCTL_FALLBACK_URLS: Array<{
  url: string;
  mirror: string;
  userAgent?: string;
}> = [
  {
    url: "https://downloads.sourceforge.net/project/smartmontools/smartmontools/7.4/smartmontools-7.4-1.win-x64.zip",
    mirror: "sourceforge-7.4-zip",
    userAgent: "Mozilla/5.0",
  },
  {
    url: "https://master.dl.sourceforge.net/project/smartmontools/smartmontools/7.4/smartmontools-7.4-1.win-x64.zip",
    mirror: "sourceforge-7.4-zip-master",
    userAgent: "Mozilla/5.0",
  },
];

async function fetchWithUA(url: string, userAgent?: string): Promise<Response> {
  return fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 LapLapScanner/1.0",
      "Accept": "*/*",
    },
  });
}

/**
 * Kiem tra file co phai Windows PE executable khong.
 * MZ header (0x4D 0x5A) o byte 0.
 */
function isWindowsExe(data: ArrayBuffer): boolean {
  if (data.byteLength < 64) return false;
  const view = new Uint8Array(data.slice(0, 2));
  return view[0] === 0x4d && view[1] === 0x5a;
}

/**
 * Extract smartctl.exe tu ZIP.
 * ZIP format: local file header (PK\x03\x04) + data + central directory o cuoi.
 * Quét tu đầu đến cuối, tìm file có tên kết thúc bằng "smartctl.exe".
 */
function extractExeFromZip(zipBuffer: ArrayBuffer): ArrayBuffer | null {
  try {
    const bytes = new Uint8Array(zipBuffer);
    let offset = 0;
    while (offset < bytes.length - 30) {
      if (
        bytes[offset] === 0x50 &&
        bytes[offset + 1] === 0x4b &&
        bytes[offset + 2] === 0x03 &&
        bytes[offset + 3] === 0x04
      ) {
        const compressedSize =
          bytes[offset + 18] |
          (bytes[offset + 19] << 8) |
          (bytes[offset + 20] << 16) |
          (bytes[offset + 21] << 24);
        const filenameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
        const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);
        const compressionMethod = bytes[offset + 8] | (bytes[offset + 9] << 8);

        const nameBytes = bytes.slice(offset + 30, offset + 30 + filenameLen);
        const name = new TextDecoder("utf-8").decode(nameBytes);

        // Windows path dùng "\" => chuyển sang "/"
        const normalizedName = name.replace(/\\/g, "/").toLowerCase();

        if (normalizedName.endsWith("smartctl.exe")) {
          const dataStart = offset + 30 + filenameLen + extraLen;
          if (compressionMethod === 0) {
            // Stored (không nén) - chiếm phần lớn release smartmontools.
            return zipBuffer.slice(dataStart, dataStart + compressedSize);
          }
          // Method 8 = deflate. Sourceforge ZIP thường dùng stored; nếu gặp deflate
          // thì bỏ qua (sẽ retry mirror khác).
          return null;
        }
        // Bỏ qua entry này và tới entry kế tiếp.
        offset += 30 + filenameLen + extraLen + compressedSize;
      } else {
        offset++;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token")?.trim() || "anon";

    // ===== PATH 1: Supabase Storage (primary - nhanh nhat) =====
    try {
      const head = await headToolFile(STORAGE_PATH);
      if (head && head.size > 0) {
        const buffer = await downloadToolFile(STORAGE_PATH);
        if (isWindowsExe(buffer)) {
          console.log(`[smartctl] Storage hit for ${token}: ${buffer.byteLength} bytes`);
          return new Response(buffer, {
            headers: {
              "Content-Type": "application/x-msdownload",
              "Content-Length": String(buffer.byteLength),
              "Content-Disposition": `attachment; filename="smartctl.exe"`,
              "X-Smartctl-Source": "supabase-storage",
              "X-Smartctl-Version": EXPECTED_VERSION,
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
        console.warn(`[smartctl] Storage object not a valid EXE (${buffer.byteLength} bytes)`);
      }
    } catch (e) {
      console.warn("[smartctl] Storage read failed:", e);
    }

    // ===== PATH 2: Fallback tu SourceForge ZIP =====
    let exeBuffer: ArrayBuffer | null = null;
    let lastError: string | null = null;
    for (const mirror of SMARTCTL_FALLBACK_URLS) {
      try {
        console.log(`[smartctl] Trying fallback ${mirror.mirror}`);
        const res = await fetchWithUA(mirror.url, mirror.userAgent);
        if (!res.ok) {
          lastError = `${mirror.mirror}: HTTP ${res.status}`;
          continue;
        }
        const ab = await res.arrayBuffer();
        const magic = new Uint8Array(ab.slice(0, 4));
        const isZip =
          magic[0] === 0x50 &&
          magic[1] === 0x4b &&
          magic[2] === 0x03 &&
          magic[3] === 0x04;
        if (!isZip) {
          lastError = `${mirror.mirror}: not a ZIP (magic=${magic[0].toString(16)}${magic[1].toString(16)})`;
          console.warn(`[smartctl] ${lastError}`);
          continue;
        }
        if (ab.byteLength < 1_000_000) {
          lastError = `${mirror.mirror}: ZIP too small (${ab.byteLength} bytes)`;
          continue;
        }
        const exe = extractExeFromZip(ab);
        if (exe && isWindowsExe(exe)) {
          exeBuffer = exe;
          console.log(`[smartctl] Extracted ${exe.byteLength} bytes from ${mirror.mirror}`);
          break;
        }
        lastError = `${mirror.mirror}: smartctl.exe not found in ZIP`;
      } catch (e) {
        lastError = `${mirror.mirror}: ${(e as Error).message}`;
        console.warn(`[smartctl] ${lastError}`);
      }
    }

    if (!exeBuffer) {
      console.error(`[smartctl] All paths failed: ${lastError}`);
      return Response.json(
        {
          error: "Cannot fetch smartctl from Storage or any mirror",
          lastError,
          hint: "Scanner will fall back to WMI SMART data. Ask admin to upload smartctl.exe to Supabase Storage key 'tools/smartctl/7.5/smartctl.exe'.",
        },
        { status: 502 },
      );
    }

    // ===== PATH 3: Cache vao Supabase Storage de lan sau =====
    try {
      await putToolFile(STORAGE_PATH, exeBuffer, "application/x-msdownload");
      console.log(`[smartctl] Cached ${exeBuffer.byteLength} bytes to Supabase Storage`);
    } catch (e) {
      console.warn("[smartctl] Storage cache write failed:", e);
    }

    const hash = await sha256Hex(exeBuffer);
    console.log(`[smartctl] SHA256: ${hash}`);

    return new Response(exeBuffer, {
      headers: {
        "Content-Type": "application/x-msdownload",
        "Content-Length": String(exeBuffer.byteLength),
        "Content-Disposition": `attachment; filename="smartctl.exe"`,
        "X-Smartctl-Sha256": hash,
        "X-Smartctl-Source": "fallback",
        "X-Smartctl-Version": "7.4",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

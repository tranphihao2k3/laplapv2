/**
 * GET /api/v1/audio/[...key]
 *
 * Stream file audio từ local volume. Tương đương public URL của Supabase
 * Storage nhưng đi qua Next.js — đổi `publicUrl` trong DB thành URL này
 * khi upload từ local.
 *
 * Hỗ trợ Range requests (HTTP 206) để tua nhạc trong trình phát.
 */
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { audioFileExistsLocal } from "@/lib/storage/local";

export const dynamic = "force-dynamic";

const AUDIO_DIR = process.env.AUDIO_DIR ?? "/data/audio";

function safeJoin(key: string): string | null {
  if (!/^[a-z0-9/_-]+(\.[a-z0-9]+)?$/i.test(key)) return null;
  if (key.includes("..")) return null;
  const full = path.normalize(path.join(AUDIO_DIR, key));
  if (!full.startsWith(AUDIO_DIR)) return null;
  return full;
}

function contentTypeFor(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase();
  return {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    aac: "audio/aac",
    m4a: "audio/x-m4a",
  }[ext ?? ""] ?? "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: parts } = await params;
  const key = parts.join("/");
  const fullPath = safeJoin(key);
  if (!fullPath) {
    return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Invalid key" } }, { status: 400 });
  }
  if (!(await audioFileExistsLocal(key))) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }

  const stat = await fs.stat(fullPath);
  const size = stat.size;
  const contentType = contentTypeFor(fullPath);
  const range = req.headers.get("range");

  if (range) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : size - 1;
      if (start <= end && end < size) {
        const fh = await fs.open(fullPath, "r");
        try {
          const buf = Buffer.alloc(end - start + 1);
          await fh.read(buf, 0, buf.length, start);
          return new NextResponse(buf, {
            status: 206,
            headers: {
              "Content-Type": contentType,
              "Content-Length": String(buf.length),
              "Content-Range": `bytes ${start}-${end}/${size}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } finally {
          await fh.close();
        }
      }
    }
  }

  const buf = await fs.readFile(fullPath);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buf.length),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

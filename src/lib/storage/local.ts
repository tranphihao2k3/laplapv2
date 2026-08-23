/**
 * Local disk storage — dùng khi muốn upload file vào volume gắn trên máy Fly
 * thay vì Supabase Storage.
 *
 * Use case: lưu vài file audio demo/test, không muốn phụ thuộc quota Supabase.
 *
 * Layout trên volume (mount tại AUDIO_DIR):
 *   /data/audio/
 *     speaker-songs/<timestamp>-<uuid>.mp3
 *
 * Phát nhạc qua Next.js route /api/v1/audio/[...key] (audio-stream/route.ts).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface LocalUploadResult {
  path: string;        // key trong volume, vd "speaker-songs/xxx.mp3"
  size: number;
  publicUrl: string;   // URL Next.js route để browser fetch
}

const AUDIO_DIR = process.env.AUDIO_DIR ?? "/data/audio";
const PUBLIC_PREFIX = "/api/v1/audio";

function safeKey(input: string): string {
  // Chỉ cho phép [a-z0-9/_-] + phần mở rộng đơn giản — chặn path traversal.
  if (!/^[a-z0-9/_-]+(\.[a-z0-9]+)?$/i.test(input)) {
    throw new Error(`Invalid storage key: ${input}`);
  }
  if (input.includes("..")) throw new Error(`Invalid storage key: ${input}`);
  return input.replace(/^\//, "");
}

export async function putAudioFileLocal(
  relativePath: string,
  body: ArrayBuffer | Uint8Array | Blob,
): Promise<LocalUploadResult> {
  const key = safeKey(relativePath);
  const fullPath = path.join(AUDIO_DIR, key);

  // Tạo thư mục cha nếu chưa có.
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  const buffer =
    body instanceof ArrayBuffer
      ? Buffer.from(body)
      : body instanceof Uint8Array
        ? Buffer.from(body)
        : Buffer.from(await (body as Blob).arrayBuffer());

  await fs.writeFile(fullPath, buffer, { flag: "wx" }); // fail nếu trùng

  return {
    path: key,
    size: buffer.byteLength,
    publicUrl: `${PUBLIC_PREFIX}/${key}`,
  };
}

export async function readAudioFileLocal(relativePath: string): Promise<Buffer> {
  const key = safeKey(relativePath);
  const fullPath = path.join(AUDIO_DIR, key);
  return await fs.readFile(fullPath);
}

export async function audioFileExistsLocal(relativePath: string): Promise<boolean> {
  const key = safeKey(relativePath);
  const fullPath = path.join(AUDIO_DIR, key);
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/** Xoá file audio trên volume (best-effort, không ném nếu không tồn tại). */
export async function deleteAudioFileLocal(relativePath: string): Promise<void> {
  const key = safeKey(relativePath);
  const fullPath = path.join(AUDIO_DIR, key);
  await fs.rm(fullPath, { force: true });
}

export function buildAudioKey(originalName: string): string {
  const ext = (originalName.split(".").pop() ?? "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `speaker-songs/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext || "mp3"}`;
}

/**
 * Speaker audio URL helpers.
 *
 * Storage: ghi trực tiếp lên Fly Volume (mount /data/audio). File được phục vụ
 * qua Next.js route /api/v1/audio/[...key] — không còn đụng Supabase Storage.
 *
 * Base URL dựng từ NEXT_PUBLIC_APP_URL; nếu thiếu/sai (placeholder
 * `replace_me`, dev local,...) thì fallback theo host của request hiện tại
 * (x-forwarded-proto/host → origin). Nhờ đó máy nào có env khác nhau vẫn
 * phát được nhạc, không rơi về URL rác cũ trong DB (R2 / Supabase cũ).
 */
import type { NextRequest } from "next/server";

/** Lay base URL cho audio stream (Next.js). */
export async function getAudioBaseUrl(req?: NextRequest): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const fromEnv = envUrl && !envUrl.includes("replace_me")
    ? envUrl.replace(/\/$/, "")
    : "";
  if (fromEnv) return `${fromEnv}/api/v1/audio`;

  // Fallback: dựng từ request host (khi chạy route handler). Khi gọi từ
  // server-only context (script/CLI) không có req thì trả "" — caller phải
  // tự quyết định.
  if (req) return `${resolveOrigin(req)}/api/v1/audio`;
  return "";
}

/** Dựng origin từ NextRequest (ưu tiên x-forwarded-proto/host). */
function resolveOrigin(req: NextRequest): string {
  const fwdProto = req.headers.get("x-forwarded-proto");
  const fwdHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = fwdProto?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(":", "");
  const host = fwdHost?.split(",")[0]?.trim() || req.nextUrl.host;
  if (!host) return "";
  return `${proto}://${host}`;
}

/**
 * Dựng URL phát nhạc từ file_key + base URL hiện tại.
 *
 * @param fileKey  Key trên Fly Volume (vd "speaker-songs/xxx.mp3").
 * @param baseUrl  Base URL lấy từ getAudioBaseUrl().
 * @param fallback file_url đã lưu — chỉ dùng khi thiếu key/base.
 */
export function buildAudioUrl(
  fileKey: string | null | undefined,
  baseUrl: string,
  fallback?: string | null,
): string {
  const key = fileKey?.trim().replace(/^\//, "");
  if (key && baseUrl) return `${baseUrl}/${key}`;
  return fallback?.trim() ?? "";
}

/** Áp URL đã dựng lại lên danh sách bài hát đọc từ DB. */
export function withResolvedAudioUrl<T extends { file_key?: string | null; file_url?: string | null }>(
  rows: T[],
  baseUrl: string,
): T[] {
  return rows.map((row) => ({
    ...row,
    file_url: buildAudioUrl(row.file_key, baseUrl, row.file_url),
  }));
}
/**
 * Speaker audio URL helpers.
 *
 * Storage: Supabase Storage bucket "speaker-audio" (public read).
 * URL format: `${SUPABASE_URL}/storage/v1/object/public/speaker-audio/<file_key>`
 */

/**
 * Lay base URL cho speaker audio (public Supabase Storage bucket).
 * URL format: https://<project>.supabase.co/storage/v1/object/public/speaker-audio
 */
export async function getAudioBaseUrl(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url || url.includes("replace_me")) return "";
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/speaker-audio`;
}

/**
 * Dựng URL phát nhạc từ file_key + base URL hiện tại.
 *
 * Vì sao không dùng thẳng `file_url` đã lưu trong DB: URL đó được ghi cứng lúc
 * upload, nên khi đổi domain Supabase (hoặc lúc upload base URL còn là placeholder)
 * thì mọi bản ghi cũ trỏ sai vĩnh viễn. Dựng lại từ file_key khiến dữ liệu cũ
 * tự đúng mà không cần migrate.
 *
 * @param fileKey  Key trong Supabase Storage bucket (nguồn sự thật).
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

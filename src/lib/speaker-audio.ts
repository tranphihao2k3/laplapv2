import { getCloudflareContext } from "@opennextjs/cloudflare";

// Cloudflare Workers: vars nằm trong env object, KHÔNG đọc được qua process.env
// (chỉ NEXT_PUBLIC_* được OpenNext inject).
type CfEnv = { AUDIO_BASE_URL?: string };

/**
 * Lấy URL gốc public của R2 bucket chứa file nhạc (từ wrangler.jsonc vars).
 * Trả về "" nếu chưa cấu hình hoặc còn là placeholder.
 */
export async function getAudioBaseUrl(): Promise<string> {
  try {
    const { env } = await getCloudflareContext();
    const base = ((env as unknown as CfEnv).AUDIO_BASE_URL ?? "").trim().replace(/\/$/, "");
    // "replace_me" là placeholder trong wrangler.jsonc — coi như chưa cấu hình.
    if (!base || base.includes("replace_me")) return "";
    return base;
  } catch {
    return "";
  }
}

/**
 * Dựng URL phát nhạc từ file_key + base URL hiện tại.
 *
 * Vì sao không dùng thẳng `file_url` đã lưu trong DB: URL đó được ghi cứng lúc
 * upload, nên khi đổi domain R2 (hoặc lúc upload base URL còn là placeholder)
 * thì mọi bản ghi cũ trỏ sai vĩnh viễn. Dựng lại từ file_key khiến dữ liệu cũ
 * tự đúng mà không cần migrate.
 *
 * @param fileKey  Key trong R2 bucket (nguồn sự thật).
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

/**
 * POST /api/v1/speaker-songs/upload
 *
 * Upload file âm thanh lên Cloudflare R2 bucket (AUDIO_BUCKET binding).
 * Yêu cầu đăng nhập và thuộc tổ chức (requireOrg).
 *
 * Body: multipart/form-data
 *   - file: File (audio/mpeg, audio/wav, audio/ogg, audio/flac, audio/aac — tối đa 30MB)
 *   - title: string
 *   - artist?: string
 *
 * Response: { file_url, file_key, file_size_bytes, original_name }
 */
import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireOrg } from "@/lib/api/guard";
import { ok, fail, handleError } from "@/lib/api/response";
import { buildAudioUrl, getAudioBaseUrl } from "@/lib/speaker-audio";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/x-m4a",
  "audio/mp4",
]);

const MAX_SIZE = 30 * 1024 * 1024; // 30 MB

// Cloudflare Workers: vars và bindings đều nằm trong env object,
// KHÔNG accessible qua process.env (chỉ NEXT_PUBLIC_* được OpenNext inject).
type CfEnv = {
  AUDIO_BUCKET: R2Bucket;
};

export async function POST(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────
    const { user } = await requireOrg();

    // ── Parse multipart ──────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null)?.trim();

    if (!file) return fail("VALIDATION_ERROR", "Thiếu file âm thanh", 422);
    if (!title) return fail("VALIDATION_ERROR", "Thiếu tên bài hát (title)", 422);

    if (!ALLOWED_MIME.has(file.type)) {
      return fail(
        "INVALID_FILE_TYPE",
        `Định dạng không hỗ trợ: ${file.type}. Chấp nhận: MP3, WAV, OGG, FLAC, AAC`,
        422,
      );
    }

    if (file.size > MAX_SIZE) {
      return fail("FILE_TOO_LARGE", "File quá lớn (tối đa 30MB)", 422);
    }

    // ── Lấy env từ Cloudflare context ────────────────────────────
    // vars (AUDIO_BASE_URL) và bindings (AUDIO_BUCKET) đều nằm ở đây
    const { env } = await getCloudflareContext();
    const cfEnv = env as unknown as CfEnv;

    const bucket = cfEnv.AUDIO_BUCKET;
    if (!bucket) {
      return fail("CONFIG_ERROR", "R2 bucket AUDIO_BUCKET chưa được bind trong wrangler.jsonc", 500);
    }

    // Base URL chỉ dùng để dựng file_url tiện lợi cho client. KHÔNG chặn upload
    // nếu thiếu: file_key mới là nguồn sự thật, URL luôn được dựng lại lúc đọc.
    const audioBaseUrl = await getAudioBaseUrl();

    // ── Upload ───────────────────────────────────────────────────
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
    const fileKey = `speaker-songs/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    await bucket.put(fileKey, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: "public, max-age=31536000",
      },
      customMetadata: {
        originalName: file.name,
        uploadedBy: user.id,
        title,
      },
    });

    return ok({
      file_url: buildAudioUrl(fileKey, audioBaseUrl),
      file_key: fileKey,
      file_size_bytes: file.size,
      original_name: file.name,
    });
  } catch (e) {
    return handleError(e);
  }
}

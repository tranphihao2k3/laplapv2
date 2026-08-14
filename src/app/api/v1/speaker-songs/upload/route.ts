/**
 * POST /api/v1/speaker-songs/upload
 *
 * Upload file âm thanh lên Supabase Storage bucket "speaker-audio" (public).
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
import { requireOrg } from "@/lib/api/guard";
import { ok, fail, handleError } from "@/lib/api/response";
import { putAudioFile, getAudioBaseUrl } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s cho upload 30MB

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

    // ── Upload lên Supabase Storage ──────────────────────────────
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
    const fileKey = `speaker-songs/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const result = await putAudioFile(fileKey, arrayBuffer, file.type);

    const audioBaseUrl = await getAudioBaseUrl();
    const fileUrl = result.publicUrl ?? `${audioBaseUrl}/${fileKey}`;

    return ok({
      file_url: fileUrl,
      file_key: fileKey,
      file_size_bytes: result.size,
      original_name: file.name,
      uploaded_by: user.id,
    });
  } catch (e) {
    return handleError(e);
  }
}

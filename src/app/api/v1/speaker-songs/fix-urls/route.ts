/**
 * POST /api/v1/speaker-songs/fix-urls
 * Fix tất cả bài hát có file_url sai (R2 URL cũ → Supabase Storage URL).
 * Xoá file này sau khi dùng xong.
 */
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ok, handleError } from "@/lib/api/response";
import { getAudioBaseUrl } from "@/lib/speaker-audio";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const realBase = await getAudioBaseUrl();
    if (!realBase) {
      return ok({ fixed: 0, message: "NEXT_PUBLIC_SUPABASE_URL chưa cấu hình" });
    }

    const db = createSupabaseServiceClient();

    // Lấy tất cả bài hát có file_url dạng r2.dev (URL cũ) để migrate.
    const { data: bad, error: fetchErr } = await db
      .from("speaker_songs")
      .select("id, file_url, file_key")
      .or("file_url.like.%r2.dev%,file_url.like.%replace_me%");

    if (fetchErr) throw fetchErr;
    if (!bad || bad.length === 0) {
      return ok({ fixed: 0, message: "Không có bài hát nào cần fix." });
    }

    // Sửa từng bài: build lại URL từ file_key
    const fixes = bad.map((s) => ({
      id: s.id,
      file_url: `${realBase}/${s.file_key}`,
    }));

    for (const fix of fixes) {
      const { error } = await db
        .from("speaker_songs")
        .update({ file_url: fix.file_url })
        .eq("id", fix.id);
      if (error) throw error;
    }

    return ok({
      fixed: fixes.length,
      realBase,
      updated: fixes,
    });
  } catch (e) {
    return handleError(e);
  }
}

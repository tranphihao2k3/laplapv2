/**
 * POST /api/v1/speaker-songs/fix-urls
 * Fix tất cả bài hát có file_url sai (pub-replace_me.r2.dev → URL thật).
 * Xoá file này sau khi dùng xong.
 */
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ok, handleError } from "@/lib/api/response";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type CfEnv = { AUDIO_BASE_URL: string };

export async function POST() {
  try {
    // Lấy URL thật từ Cloudflare env
    const { env } = await getCloudflareContext();
    const realBase = ((env as unknown as CfEnv).AUDIO_BASE_URL ?? "").trim().replace(/\/$/, "");

    if (!realBase || realBase.includes("replace_me")) {
      return ok({ fixed: 0, message: "AUDIO_BASE_URL chưa đúng: " + realBase });
    }

    const db = createSupabaseServiceClient();

    // Lấy tất cả bài hát bị sai URL
    const { data: bad, error: fetchErr } = await db
      .from("speaker_songs")
      .select("id, file_url, file_key")
      .like("file_url", "%replace_me%");

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

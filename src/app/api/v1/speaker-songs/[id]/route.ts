/**
 * PATCH  /api/v1/speaker-songs/:id  — Cập nhật metadata bài hát (admin)
 * DELETE /api/v1/speaker-songs/:id  — Xoá bài hát + file R2 (admin)
 */
import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireOrg } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { getAudioBaseUrl, withResolvedAudioUrl } from "@/lib/speaker-audio";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  artist: z.string().max(255).nullable().optional(),
  file_url: z.string().url().optional(),
  duration_seconds: z.coerce.number().int().nonnegative().nullable().optional(),
  position: z.coerce.number().int().nonnegative().optional(),
  is_active: z.boolean().optional(),
});

// ── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOrg();
    const { id } = await params;
    const body = updateSchema.parse(await req.json());

    const serviceClient = createSupabaseServiceClient();
    const { data, error } = await serviceClient
      .from("speaker_songs")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    // Trả về URL dựng lại từ file_key để client luôn nhận link phát được.
    const baseUrl = await getAudioBaseUrl();
    return ok(withResolvedAudioUrl([data], baseUrl)[0]);
  } catch (e) {
    return handleError(e);
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOrg();
    const { id } = await params;

    const serviceClient = createSupabaseServiceClient();

    // Lấy file_key trước để cleanup R2
    const { data: song, error: fetchErr } = await serviceClient
      .from("speaker_songs")
      .select("file_key")
      .eq("id", id)
      .single();

    if (fetchErr) throw fetchErr;

    // Xoá record
    const { error: delErr } = await serviceClient
      .from("speaker_songs")
      .delete()
      .eq("id", id);

    if (delErr) throw delErr;

    // Xoá file trên R2 (best-effort)
    if (song?.file_key) {
      try {
        const { env } = await getCloudflareContext();
        const bucket = (env as unknown as { AUDIO_BUCKET: R2Bucket }).AUDIO_BUCKET;
        if (bucket) await bucket.delete(song.file_key);
      } catch {
        console.warn("[speaker-songs] Không thể xoá file R2:", song.file_key);
      }
    }

    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}

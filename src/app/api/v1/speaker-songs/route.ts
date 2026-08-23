/**
 * GET  /api/v1/speaker-songs        — Danh sách bài nhạc (public)
 * POST /api/v1/speaker-songs        — Tạo record sau khi upload (admin)
 */
import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/api/guard";
import { ok, handleError, paginated, rangeOf } from "@/lib/api/response";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { buildAudioUrl, getAudioBaseUrl, withResolvedAudioUrl } from "@/lib/speaker-audio";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  artist: z.string().max(255).optional().nullable(),
  // file_key là nguồn sự thật; file_url chỉ để tương thích (cột NOT NULL trong
  // DB) và luôn được dựng lại từ file_key khi đọc — xem @/lib/speaker-audio.
  // Khi upload local-volume, upload route trả về relative path "/api/v1/audio/..."
  // — đó là URL nội bộ do Next.js stream, không phải absolute URL.
  file_url: z.string().optional(),
  file_key: z.string().min(1),
  file_size_bytes: z.coerce.number().int().nonnegative().optional().nullable(),
  duration_seconds: z.coerce.number().int().nonnegative().optional().nullable(),
  position: z.coerce.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true),
});

// ── GET: public list ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const search = searchParams.get("search")?.trim() ?? "";
    const activeOnly = searchParams.get("active_only") !== "false";

    const supabase = await createClient();
    const { from, to } = rangeOf(page, pageSize);

    let query = supabase
      .from("speaker_songs")
      .select("*", { count: "exact" })
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, to);

    if (activeOnly) query = query.eq("is_active", true);
    if (search) {
      query = query.or(`title.ilike.%${search}%,artist.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Dựng lại file_url từ file_key + AUDIO_BASE_URL hiện tại thay vì tin URL
    // đã ghi cứng trong DB — nhờ đó các bản ghi upload lúc base URL còn sai
    // (pub-replace_me…) vẫn phát được, và đổi domain R2 không làm hỏng dữ liệu.
    const baseUrl = await getAudioBaseUrl(req);
    const items = withResolvedAudioUrl(data ?? [], baseUrl);

    return ok(paginated(items, count ?? 0, page, pageSize));
  } catch (e) {
    return handleError(e);
  }
}

// ── POST: tạo record (admin) ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await requireOrg();

    const body = createSchema.parse(await req.json());

    // Cột file_url là NOT NULL: nếu client không gửi thì tự dựng từ file_key.
    // Giá trị này chỉ mang tính lưu trữ — khi đọc luôn dựng lại từ file_key.
    const baseUrl = await getAudioBaseUrl(req);
    const row = {
      ...body,
      file_url: buildAudioUrl(body.file_key, baseUrl, body.file_url) || body.file_url || "",
    };

    const serviceClient = createSupabaseServiceClient();
    const { data, error } = await serviceClient
      .from("speaker_songs")
      .insert([row])
      .select()
      .single();

    if (error) throw error;
    return ok(withResolvedAudioUrl([data], baseUrl)[0], { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

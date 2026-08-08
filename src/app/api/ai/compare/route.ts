import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  analyzeComparison,
  aiCompareSchema,
  mapScoresToProducts,
  type AiCompareResult,
} from "@/lib/ai/compare-analyzer";
import { GEMINI_MODEL } from "@/lib/ai/gemini-client";
import { buildFingerprint, sha256Hex, COMPARE_PROMPT_VERSION } from "@/lib/compare/cache-key";
import { getCompareProducts, MAX_COMPARE } from "@/lib/compare/fetch-products";
import type { CompareAiPayload } from "@/lib/compare/types";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(2).max(MAX_COMPARE),
  provider: z.enum(["gemini", "openai"]).default("gemini"),
});

/** Tối đa bao nhiêu lần gọi AI mới trong 1 giờ (toàn hệ thống). */
const MAX_NEW_ANALYSES_PER_HOUR = 60;

/**
 * POST /api/ai/compare
 * Body: { ids: string[], provider?: "gemini" | "openai" }
 *
 * Route này CÔNG KHAI (khách không cần đăng nhập) nên phải tự chống lạm dụng.
 * Bốn lớp, không cần thêm binding hay bảng nào:
 *   1. Cache-first — đa số request lặp lại đều không tốn quota.
 *   2. Chỉ nhận id sản phẩm THẬT và đang bán → payload rác không đốt được quota.
 *   3. Rate limit toàn cục đếm qua chính bảng cache (không dùng Map in-memory vì
 *      Worker có nhiều isolate, biến trong RAM hoàn toàn vô dụng).
 *   4. Kiểm tra Origin khớp domain khi chạy production.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: "Dữ liệu không hợp lệ",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }
    const { ids, provider } = parsed.data;

    // --- Lớp 4: chặn script cào từ domain khác (chỉ ở production) ---
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.NODE_ENV === "production" && appUrl) {
      const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
      if (origin && !origin.startsWith(appUrl)) {
        return NextResponse.json(
          { ok: false, error: { message: "Yêu cầu không được phép" } },
          { status: 403 },
        );
      }
    }

    // --- Lớp 2: chỉ nhận sản phẩm thật, đang bán ---
    const products = await getCompareProducts(ids);
    if (products.length < 2) {
      return NextResponse.json(
        { ok: false, error: { message: "Cần ít nhất 2 máy còn bán để phân tích" } },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const fingerprint = buildFingerprint(products, GEMINI_MODEL);
    const cacheKey = await sha256Hex(fingerprint);

    // --- Lớp 1: cache-first ---
    // Nếu migration 022 chưa chạy thì cacheReady = false: tính năng vẫn hoạt
    // động bình thường, chỉ là không cache (mỗi lần bấm đều gọi AI).
    const { data: cached, error: cacheReadError } = await supabase
      .from("ai_compare_cache")
      .select("payload,hit_count")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    const cacheReady = !isMissingTable(cacheReadError);
    if (!cacheReady) {
      console.warn(
        "[ai/compare] Bảng ai_compare_cache chưa tồn tại — chạy migration 022 để bật cache.",
      );
    }

    if (cached?.payload) {
      const revalidated = aiCompareSchema.safeParse(cached.payload);
      if (revalidated.success) {
        // Đếm số lần dùng lại để đo hiệu quả cache. Lỗi ở đây không được làm
        // hỏng response nên không await.
        void supabase
          .from("ai_compare_cache")
          .update({ hit_count: (cached.hit_count ?? 0) + 1 })
          .eq("cache_key", cacheKey);

        return NextResponse.json({
          ok: true,
          data: buildResponse(revalidated.data, products),
          cached: true,
        });
      }
      // Cache hỏng shape (đổi schema mà quên tăng version) → sinh lại.
    }

    // --- Lớp 3: rate limit toàn cục ---
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = cacheReady
      ? await supabase
          .from("ai_compare_cache")
          .select("cache_key", { count: "exact", head: true })
          .gte("created_at", oneHourAgo)
      : { count: 0 };

    if ((count ?? 0) >= MAX_NEW_ANALYSES_PER_HOUR) {
      return NextResponse.json(
        {
          ok: false,
          error: { message: "Hệ thống đang bận, bạn thử lại sau ít phút nhé." },
        },
        { status: 429 },
      );
    }

    const result = await analyzeComparison(products, provider);

    // Ghi cache. Upsert để ghi đè hàng đã hết hạn.
    if (cacheReady) {
      const { error: upsertError } = await supabase.from("ai_compare_cache").upsert(
        {
          cache_key: cacheKey,
          fingerprint,
          product_ids: [...products.map((p) => p.id)].sort(),
          model: GEMINI_MODEL,
          prompt_version: COMPARE_PROMPT_VERSION,
          payload: result,
          hit_count: 0,
          expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        },
        { onConflict: "cache_key" },
      );
      // Ghi cache lỗi thì vẫn trả kết quả cho khách — chỉ là lần sau không có cache.
      if (upsertError) {
        console.error("[ai/compare] Ghi cache thất bại:", upsertError.message);
      }
    }

    return NextResponse.json({
      ok: true,
      data: buildResponse(result, products),
      cached: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ ok: false, error: { message } }, { status: 500 });
  }
}

/**
 * Phân biệt "bảng chưa tồn tại" với các lỗi DB khác.
 * PostgREST trả code 42P01 (undefined_table) hoặc PGRST205 (không thấy trong schema cache).
 */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /Could not find the table/i.test(error.message ?? "")
  );
}

/** Gắn điểm AI vào product id để client dựng bảng xếp hạng. */
function buildResponse(
  result: AiCompareResult,
  products: Awaited<ReturnType<typeof getCompareProducts>>,
): CompareAiPayload {
  return {
    scores: mapScoresToProducts(result, products),
    machines: result.machines,
    verdict: result.verdict,
    needNotes: result.need_notes,
  };
}

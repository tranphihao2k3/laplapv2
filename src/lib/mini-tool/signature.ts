/**
 * HMAC signature + replay protection + rate-limit cho Mini Tool upload.
 *
 * Plan tham chiếu: MINI_TOOL_PLAN.md §7.2 + §7.4.
 *
 * ⚠ Rate-limit là per-process in-memory Map. KHÔNG đồng bộ giữa các instance
 * (multi-region Fly.io replicas) → có thể bị double-count qua ngưỡng. Phase 2
 * nên chuyển sang Redis/Upstash.
 */
import { createHmac, randomBytes } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ApiError } from "@/lib/api/response";

/**
 * DEV-ONLY fallback secret khi MINI_TOOL_SHARED_SECRET chưa set.
 * Đặt cố định để môi trường dev có thể POST payload mà không phải cấu hình
 * env. Production PHẢI set MINI_TOOL_SHARED_SECRET qua biến môi trường — khi
 * đó warning sẽ tắt.
 *
 * GIÁ TRỊ NÀY KHÔNG CÓ TÍNH BẢO MẬT — chỉ để flow không vỡ khi dev.
 */
export const DEV_FALLBACK_SHARED_SECRET = "laplap-mini-tool-dev-secret-DO-NOT-USE-IN-PROD";

/** Đọc secret: env → fallback dev. Log 1 lần khi fallback. */
let warnedDevFallback = false;
function getSharedSecret(): string {
  const fromEnv = process.env.MINI_TOOL_SHARED_SECRET;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (!warnedDevFallback && typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
    console.warn(
      "[mini-tool/signature] MINI_TOOL_SHARED_SECRET chưa set — dùng placeholder DEV-ONLY. " +
        "Production PHẢI set env để chống giả mạo payload.",
    );
    warnedDevFallback = true;
  }
  return DEV_FALLBACK_SHARED_SECRET;
}

/**
 * Stable stringify: sort keys recursively, không thêm whitespace.
 *
 * Dùng cho HMAC input — cả client và server phải gọi hàm này để có cùng
 * canonical string. KHÔNG phải JSON.stringify(value, replacer) thông thường
 * vì replacer của JSON.stringify chỉ sort ở top-level, không recursive.
 */
export function canonicalJson(value: unknown): string {
  return canonicalize(value);
}

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite number not allowed");
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalize(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const k of keys) {
      const v = obj[k];
      if (v === undefined) continue; // JSON không có undefined
      parts.push(JSON.stringify(k) + ":" + canonicalize(v));
    }
    return "{" + parts.join(",") + "}";
  }
  throw new Error(`Unsupported value type: ${typeof value}`);
}

/** Tính HMAC-SHA256 hex của payload đã canonicalize. */
function computeSignature(payload: unknown, secret: string): string {
  return createHmac("sha256", secret).update(canonicalJson(payload)).digest("hex");
}

/**
 * So sánh HMAC của `payload` (đã bỏ `signature` field) với `providedSig`.
 *
 * Throw INVALID_SIGNATURE (401) nếu không khớp.
 * Dùng timing-safe equal để chống timing attack.
 */
export function verifySignature(payload: unknown, providedSig: string): void {
  if (typeof providedSig !== "string" || providedSig.length === 0) {
    throw new ApiError("INVALID_SIGNATURE", "Thiếu chữ ký HMAC", 401);
  }
  const secret = getSharedSecret();
  const expected = computeSignature(payload, secret);

  // timingSafeEqual yêu cầu cùng độ dài — nếu khác thì fail ngay.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(providedSig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError("INVALID_SIGNATURE", "Chữ ký HMAC không khớp", 401);
  }
}

// re-export timingSafeEqual từ crypto (Node runtime).
import { timingSafeEqual } from "crypto";

/** Nonce 16 hex chars cho replay-protection. */
export function makeNonce(): string {
  return randomBytes(8).toString("hex");
}

/**
 * Check nonce chưa từng xuất hiện trong 24h gần nhất (replay protection).
 *
 * Throw NONCE_REPLAYED (409) nếu trùng.
 */
export async function checkNonceReplay(nonce: string): Promise<void> {
  if (typeof nonce !== "string" || nonce.length === 0) return;
  const supabase = createSupabaseServiceClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // payload là jsonb; query ->>'nonce' lấy field ở top-level.
  const { data, error } = await supabase
    .from("mini_tool_uploads")
    .select("id")
    .eq("payload->>nonce", nonce)
    .gt("created_at", cutoff)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    throw new ApiError(
      "NONCE_REPLAYED",
      "Nonce đã được sử dụng trong 24 giờ qua — payload có thể bị replay",
      409,
    );
  }
}

// ── Rate-limit (per-sid, in-memory) ────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

type BucketEntry = { count: number; windowStart: number };
const rateLimitBuckets = new Map<string, BucketEntry>();

/** Test helper — KHÔNG gọi từ app code. */
export function _resetRateLimitBucketsForTests() {
  rateLimitBuckets.clear();
}

/**
 * Per-sid rate limit: tối đa 5 request / 5 phút. Cửa sổ trượt đơn giản
 * (reset count khi windowStart hết hạn) — đủ cho MVP, không chính xác bằng
 * sliding-window log.
 *
 * ⚠ Lưu ý: map này PER-INSTANCE. Multi-replica sẽ cho phép tổng lượng lớn
 * hơn. Phase 2: chuyển sang Redis/Upstash.
 */
export function rateLimitUpload(sessionId: string): void {
  const now = Date.now();
  const entry = rateLimitBuckets.get(sessionId);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(sessionId, { count: 1, windowStart: now });
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    throw new ApiError(
      "RATE_LIMITED",
      `Quá nhiều request cho session này (tối đa ${RATE_LIMIT_MAX} / ${RATE_LIMIT_WINDOW_MS / 60000} phút)`,
      429,
    );
  }

  entry.count += 1;
}
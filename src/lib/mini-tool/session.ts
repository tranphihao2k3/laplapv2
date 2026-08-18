/**
 * Helpers quản lý mini_tool_sessions.
 *
 * Session token = 32 hex chars từ crypto.randomBytes(16) → 128-bit entropy.
 * TTL mặc định 2 giờ (theo MINI_TOOL_PLAN.md §5.2.1).
 *
 * KHÔNG check signature ở đây — đó là việc của signature.ts. Layer này chỉ
 * lo CRUD + trạng thái TTL/consumed.
 */
import { randomBytes } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ApiError } from "@/lib/api/response";

export const MINI_TOOL_SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 giờ

export function generateSessionId(): string {
  return randomBytes(16).toString("hex"); // 32 chars
}

export type CreateSessionInput = {
  redirectAfterUpload?: string;
  context?: Record<string, unknown>;
};

export type CreateSessionResult = {
  sessionId: string;
  uploadUrl: string;
  webUrl: string;
  verifyUrl: string;
  expiresAt: string;
  ttlSeconds: number;
};

/**
 * Sinh session mới + URL tuyệt đối tới các endpoint tương ứng.
 *
 * Caller truyền vào `origin` (vd: 'https://laplapcantho.store') để tool có
 * URL sẵn để GET/POST. Không cần truyền — fallback sang env.NEXT_PUBLIC_APP_URL.
 */
export async function createSession(
  input: CreateSessionInput = {},
  origin?: string,
): Promise<CreateSessionResult> {
  const sessionId = generateSessionId();
  const ttlSeconds = MINI_TOOL_SESSION_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("mini_tool_sessions").insert({
    session_id: sessionId,
    context: input.context ?? {},
    expires_at: expiresAt,
    // laptop_id: chưa có vì session được tạo trước khi tool upload
  });
  if (error) throw error;

  const base =
    origin?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  return {
    sessionId,
    expiresAt,
    ttlSeconds,
    uploadUrl: `${base}/api/v1/mini-tool/upload?sid=${sessionId}`,
    webUrl: `${base}/api/v1/mini-tool/receive?sid=${sessionId}`,
    verifyUrl: `${base}/api/v1/mini-tool/session?sid=${sessionId}`,
  };
}

export type VerifySessionResult = {
  valid: boolean;
  consumed: boolean;
  expiresAt: string;
  laptopId: string | null;
  context: Record<string, unknown>;
  requiredFields: string[];
};

/**
 * Verify session token.
 *
 * Throw ApiError:
 *  - SESSION_NOT_FOUND (404)
 *  - SESSION_EXPIRED  (410)
 *  - SESSION_CONSUMED (409)
 */
export async function verifySession(sessionId: string): Promise<VerifySessionResult> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("mini_tool_sessions")
    .select("expires_at, consumed_at, laptop_id, context")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new ApiError("SESSION_NOT_FOUND", "Session không tồn tại", 404);
  }

  const expiresAt = data.expires_at as string;
  const consumedAt = data.consumed_at as string | null;

  if (consumedAt) {
    throw new ApiError("SESSION_CONSUMED", "Session đã được sử dụng", 409);
  }

  if (new Date(expiresAt).getTime() < Date.now()) {
    throw new ApiError("SESSION_EXPIRED", "Session đã hết hạn", 410);
  }

  const ctx = (data.context ?? {}) as Record<string, unknown>;
  const requiredRaw = ctx.require;
  const requiredFields = Array.isArray(requiredRaw)
    ? requiredRaw.filter((x): x is string => typeof x === "string")
    : [];

  return {
    valid: true,
    consumed: false,
    expiresAt,
    laptopId: (data.laptop_id as string | null) ?? null,
    context: ctx,
    requiredFields,
  };
}

/** Đánh dấu session đã được dùng (sau khi /upload xử lý xong). */
export async function markSessionConsumed(
  sessionId: string,
  opts?: { laptopId?: string | null },
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const patch: Record<string, unknown> = { consumed_at: new Date().toISOString() };
  if (opts?.laptopId !== undefined) {
    patch.laptop_id = opts.laptopId;
  }
  const { error } = await supabase
    .from("mini_tool_sessions")
    .update(patch)
    .eq("session_id", sessionId);
  if (error) throw error;
}
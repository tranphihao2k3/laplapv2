import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    fields?: Record<string, string[] | undefined>;
    requestId: string;
    timestamp: string;
  };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init);
}

function makeRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
  fields?: Record<string, string[] | undefined>,
) {
  return NextResponse.json<ApiFailure>(
    {
      ok: false,
      error: {
        code,
        message,
        details,
        fields,
        requestId: makeRequestId(),
        timestamp: new Date().toISOString(),
      },
    },
    { status },
  );
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const Errors = {
  unauthorized: (msg = "Chưa đăng nhập") => new ApiError("UNAUTHORIZED", msg, 401),
  forbidden: (msg = "Không đủ quyền truy cập") => new ApiError("FORBIDDEN", msg, 403),
  notFound: (resource = "Tài nguyên") => new ApiError("NOT_FOUND", `${resource} không tồn tại`, 404),
  conflict: (msg = "Xung đột dữ liệu") => new ApiError("CONFLICT", msg, 409),
  badRequest: (msg = "Yêu cầu không hợp lệ") => new ApiError("BAD_REQUEST", msg, 400),
};

/** Pagination range helper cho Supabase .range(from, to). */
export function rangeOf(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function isPostgrestError(e: unknown): e is PostgrestLikeError {
  return (
    typeof e === "object" &&
    e !== null &&
    ("code" in e || "details" in e || "hint" in e) &&
    "message" in e
  );
}

function parseInsufficientStock(message: string) {
  const match = /INSUFFICIENT_STOCK:\s*variant=([0-9a-f-]+)\s+qty=(\d+)\s+have=(\d+)/i.exec(message);
  if (!match) return null;
  return {
    variant_id: match[1],
    requested_qty: Number(match[2]),
    available_qty: Number(match[3]),
  };
}

/** Chuyển exception bất kỳ thành response JSON chuẩn. */
export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    const flat = err.flatten();
    return fail("VALIDATION_ERROR", "Dữ liệu không hợp lệ", 422, flat, flat.fieldErrors);
  }
  if (err instanceof ApiError) {
    return fail(err.code, err.message, err.status, undefined);
  }
  if (isPostgrestError(err)) {
    const rawMessage = err.message ?? "Lỗi database";
    const stock = parseInsufficientStock(rawMessage);
    if (stock) {
      return fail(
        "INSUFFICIENT_STOCK",
        "Không đủ tồn kho cho sản phẩm trong đơn",
        409,
        {
          ...stock,
          technical_message: rawMessage,
        },
      );
    }

    const code = err.code ?? "DB_ERROR";
    const status =
      code === "23505" ? 409 :
      code === "23503" ? 400 :
      code === "42501" ? 403 :
      400;
    return fail(`PG_${code}`, rawMessage, status, {
      details: err.details,
      hint: err.hint,
    });
  }
  console.error("[API]", err);
  const message = err instanceof Error ? err.message : "Lỗi không xác định";
  return fail("INTERNAL_ERROR", message, 500);
}

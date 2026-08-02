/**
 * Proxy `/auth/v1/*` → Supabase GoTrue.
 *
 * Lý do tồn tại: app desktop (apps/facebook-publisher) chỉ cấu hình MỘT
 * `apiBaseUrl` duy nhất và gọi `<apiBaseUrl>/auth/v1/...` cho auth, đồng thời
 * `<apiBaseUrl>/api/v1/...` cho catalog. Route này khép kín phần auth để:
 *
 *  - Desktop KHÔNG cần biết Supabase URL và KHÔNG cần nhúng anon key.
 *    Header `apikey` được inject ở server — thiếu nó GoTrue trả 401
 *    "No API key found in request".
 *  - Giữ đúng wire format của Supabase: body + status code được trả nguyên
 *    vẹn, nhờ vậy `SupabaseAuthClient.normalizeError()` bên desktop vẫn map
 *    được `invalid_grant` / 400 / 401 như khi gọi thẳng Supabase.
 *
 * KHÔNG dùng `@/lib/api/response` ở đây: helper đó bọc payload vào
 * `{ ok, data }`, còn desktop parse thẳng `{ access_token, refresh_token, ... }`.
 *
 * See: docs/FB-PUBLISHER-TASKS.md → APP-005 (login email + password).
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Chỉ những endpoint GoTrue mà desktop thực sự dùng. Whitelist thay vì mở
 * toàn bộ `/auth/v1/*` để không vô tình expose `/admin/*` (endpoint đó nhận
 * service-role key và có thể liệt kê/xoá user).
 */
const ALLOWED_PATHS = new Set(["token", "logout", "user", "recover"]);

/** Header từ client được phép đi tiếp lên GoTrue. */
const FORWARDED_REQUEST_HEADERS = ["authorization", "content-type", "accept"];

/** Header từ GoTrue được phép trả về client. */
const FORWARDED_RESPONSE_HEADERS = ["content-type", "www-authenticate"];

function supabaseAuthOrigin(): string {
  return `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/auth/v1`;
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const subPath = path.join("/");

  if (!ALLOWED_PATHS.has(path[0] ?? "")) {
    return NextResponse.json(
      { error: "not_found", message: `Endpoint /auth/v1/${subPath} không được hỗ trợ` },
      { status: 404 },
    );
  }

  const target = new URL(`${supabaseAuthOrigin()}/${subPath}`);
  // `?grant_type=password` / `?grant_type=refresh_token` nằm ở query string.
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  // apikey luôn bắt buộc với GoTrue, kể cả khi đã có Authorization.
  headers.set("apikey", env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  // /token chưa có access token nên client không gửi Authorization — GoTrue
  // vẫn yêu cầu Bearer, dùng anon key. /logout và /user thì client gửi access
  // token thật, giữ nguyên header của họ.
  if (!headers.has("authorization")) {
    headers.set("authorization", `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);
  }

  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers, body, cache: "no-store" });
  } catch (e) {
    // Desktop map status 0/5xx → AUTH_PROVIDER_UNAVAILABLE.
    return NextResponse.json(
      {
        error: "provider_unavailable",
        message: `Không liên lạc được Supabase Auth: ${e instanceof Error ? e.message : "unknown"}`,
      },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  // Token response không bao giờ được cache ở proxy/CDN trung gian.
  responseHeaders.set("Cache-Control", "no-store");

  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

// Auth luôn phải chạy động — không prerender, không cache.
export const dynamic = "force-dynamic";

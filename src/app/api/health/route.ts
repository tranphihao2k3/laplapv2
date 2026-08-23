/**
 * GET /api/health
 *
 * Health check endpoint (Fly.io healthcheck + load balancer).
 *
 * Trả về 200 ngay lập tức để không block Fly proxy khi Supabase / DNS cold-start.
 * Trước đây gọi Supabase ở đây nhưng gây timeout khi DNS chưa sẵn sàng hoặc Supabase
 * chậm → Fly đánh instance unhealthy → request thực đến user cũng 503. Health check
 * không cần verify dependency — đó là job của `/api/health/deep` hoặc monitor ngoài.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, { status: "ok" | "fail"; latency?: number; error?: string }> = {
    node: { status: "ok", latency: 0 },
  };

  // Probe Supabase không chặn response — fire-and-forget nhưng có timeout ngắn.
  // Không await để route luôn return < 200ms.
  const start = Date.now();
  try {
    const admin = createAdminClient();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 1500),
    );
    Promise.race([
      admin.from("profiles").select("id").limit(1),
      timeoutPromise,
    ])
      .then(() => {
        checks.supabase_db = { status: "ok", latency: Date.now() - start };
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "unknown";
        checks.supabase_db = {
          status: "fail",
          error: msg === "timeout" ? "Supabase timeout (>1.5s)" : msg,
        };
      });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    checks.supabase_db = { status: "fail", error: msg };
  }

  return Response.json(
    {
      ok: true,
      service: "laplap-laptop",
      region: process.env.FLY_REGION ?? "local",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

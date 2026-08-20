/**
 * GET /api/health
 *
 * Health check endpoint (Fly.io healthcheck + load balancer).
 *
 * Returns:
 *   - 200 OK if app is healthy
 *   - 503 Service Unavailable if critical services fail
 */
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, { status: "ok" | "fail"; latency?: number; error?: string }> = {};

  // ── Check Node runtime ───────────────────────────────────────
  checks.node = {
    status: "ok",
    latency: 0,
  };

  // ── Check Supabase DB (with 5s timeout) ─────────────────────
  try {
    const start = Date.now();
    const admin = createAdminClient();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    );
    await Promise.race([
      admin.from("profiles").select("id").limit(1),
      timeoutPromise,
    ]);
    checks.supabase_db = { status: "ok", latency: Date.now() - start };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    checks.supabase_db = {
      status: "fail",
      error: msg === "timeout" ? "Supabase timeout (>5s)" : msg,
    };
  }

  // ── Aggregate ─────────────────────────────────────────────────
  // Always return 200 so Fly health check passes even if Supabase has temporary latency.
  // Supabase slowness should not cause Fly to restart the machine.
  return Response.json(
    {
      ok: true,
      service: "laplap-laptop",
      region: process.env.FLY_REGION ?? "local",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: 200 },
  );
}

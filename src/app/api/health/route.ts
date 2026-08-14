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

  // ── Check Supabase DB ────────────────────────────────────────
  try {
    const start = Date.now();
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").select("id").limit(1);
    if (error) throw error;
    checks.supabase_db = { status: "ok", latency: Date.now() - start };
  } catch (e) {
    checks.supabase_db = {
      status: "fail",
      error: e instanceof Error ? e.message : "unknown",
    };
  }

  // ── Check Node runtime ───────────────────────────────────────
  checks.node = {
    status: "ok",
    latency: 0,
  };

  // ── Aggregate ─────────────────────────────────────────────────
  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return Response.json(
    {
      ok: allOk,
      service: "laplap-laptop",
      region: process.env.FLY_REGION ?? "local",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 },
  );
}

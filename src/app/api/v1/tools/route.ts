/**
 * GET /api/v1/tools — Trả về danh sách tools (DB-backed, admin-managed).
 *
 * Source of truth: table `tools` (Supabase).
 * Read: public (user can browse).
 *
 * Response: { ok: true, data: ToolWithMeta[] }
 */

import { NextResponse } from "next/server";
import { listActiveTools, formatBytes, verifyModeOf } from "@/lib/tools/repository";

export const runtime = "nodejs";

export async function GET() {
  const tools = await listActiveTools();

  const data = tools.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    icon: t.icon,
    sizeBytes: t.size_bytes,
    sizeLabel: formatBytes(t.size_bytes),
    sha256: t.sha256,
    exec: t.exec_name,
    extract: t.extract,
    launchArgs: t.launch_args,
    requiresAdmin: t.requires_admin,
    version: t.version,
    vendor: t.vendor,
    verifyMode: verifyModeOf(t.sha256),
    // URL download qua server proxy (khong lo R2 URL).
    downloadEndpoint: `/api/v1/tools/download?toolId=${encodeURIComponent(t.id)}`,
    // CMD launch endpoint (can token scan).
    launchEndpoint: `/api/v1/system-scan/command`,
  }));

  return NextResponse.json({ ok: true, data });
}

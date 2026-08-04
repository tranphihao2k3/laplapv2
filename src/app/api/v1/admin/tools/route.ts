/**
 * GET /api/v1/admin/tools — list all tools (admin only).
 * POST /api/v1/admin/tools — insert/update tool metadata (khong upload file).
 *
 * Upload file qua /api/v1/admin/tools/upload (multipart).
 */

import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requirePermission } from "@/lib/api/guard";
import { listAllTools, insertTool, formatBytes, verifyModeOf } from "@/lib/tools/repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requirePermission("admin.manage_tools");
    const tools = await listAllTools();
    return ok({
      data: tools.map((t) => ({
        ...t,
        sizeLabel: formatBytes(t.size_bytes),
        verifyMode: verifyModeOf(t.sha256),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return fail("INTERNAL", msg, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requirePermission("admin.manage_tools");
    const body = await req.json();

    const id = String(body.id ?? "").trim();
    if (!/^[a-z0-9-]{2,64}$/.test(id)) {
      return fail("INVALID_ID", "ID must be lowercase alphanumeric/dash (2-64 chars)", 400);
    }
    const r2Key = String(body.r2_key ?? "").trim();
    if (!r2Key) return fail("INVALID_R2_KEY", "r2_key required", 400);
    const execName = String(body.exec_name ?? "").trim();
    if (!execName) return fail("INVALID_EXEC", "exec_name required", 400);

    const tool = await insertTool(
      {
        id,
        name: String(body.name ?? id),
        description: body.description ?? "",
        category: body.category ?? "utility",
        icon: body.icon ?? "🔧",
        r2_key: r2Key,
        sha256: body.sha256 ?? "VERIFY_REQUIRED",
        exec_name: execName,
        extract: body.extract ?? true,
        launch_args: Array.isArray(body.launch_args) ? body.launch_args : [],
        requires_admin: body.requires_admin ?? false,
        size_bytes: Number(body.size_bytes ?? 0),
        version: body.version ?? null,
        vendor: body.vendor ?? null,
        status: body.status ?? "active",
        sort_order: Number(body.sort_order ?? 100),
      },
      user.id,
    );

    return ok({ data: tool }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return fail("INTERNAL", msg, 500);
  }
}

/**
 * PATCH /api/v1/admin/tools/[id] — update metadata (khong doi file).
 * DELETE /api/v1/admin/tools/[id] — delete tool + R2 file.
 */

import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requirePermission } from "@/lib/api/guard";
import { updateTool, deleteTool, findToolById } from "@/lib/tools/repository";
import { deleteToolFile } from "@/lib/tools/r2";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("admin.manage_tools");
    const { id } = await params;
    const body = await req.json();

    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.description === "string") patch.description = body.description;
    if (typeof body.category === "string") patch.category = body.category;
    if (typeof body.icon === "string") patch.icon = body.icon;
    if (typeof body.sha256 === "string") patch.sha256 = body.sha256;
    if (typeof body.exec_name === "string") patch.exec_name = body.exec_name;
    if (typeof body.extract === "boolean") patch.extract = body.extract;
    if (Array.isArray(body.launch_args)) patch.launch_args = body.launch_args;
    if (typeof body.requires_admin === "boolean") patch.requires_admin = body.requires_admin;
    if (typeof body.size_bytes === "number") patch.size_bytes = body.size_bytes;
    if (typeof body.version !== "undefined") patch.version = body.version;
    if (typeof body.vendor !== "undefined") patch.vendor = body.vendor;
    if (typeof body.status === "string") patch.status = body.status;
    if (typeof body.sort_order === "number") patch.sort_order = body.sort_order;

    const tool = await updateTool(id, patch);
    return ok(tool);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return fail("INTERNAL", msg, 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("admin.manage_tools");
    const { id } = await params;

    // Lay r2_key truoc khi xoa row DB (sau khi xoa thi khong con tra cuu duoc).
    const tool = await findToolById(id);
    if (!tool) return fail("NOT_FOUND", "Tool not found", 404);
    const r2Key = tool.r2_key;

    // Xoa R2 file (ignore neu 404).
    try {
      await deleteToolFile(r2Key);
    } catch (e) {
      console.warn(`[tools/delete] R2 delete failed for ${id}:`, e);
    }

    await deleteTool(id);
    return ok({ deleted: true, id, r2Key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return fail("INTERNAL", msg, 500);
  }
}

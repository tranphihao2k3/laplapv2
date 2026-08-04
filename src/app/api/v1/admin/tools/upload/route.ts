/**
 * POST /api/v1/admin/tools/upload (multipart/form-data)
 *
 * Form fields:
 *   - file        : file (.exe / .zip)
 *   - id          : tool id (lowercase, dash)
 *   - name        : display name
 *   - version     : version (optional)
 *   - exec_name   : exe chinh (vd "cpuz_x64.exe")
 *   - extract     : "true" | "false"
 *   - category    : diagnostic | stress | benchmark | utility
 *   - icon        : emoji
 *   - sha256      : optional hash (placeholder VERIFY_REQUIRED neu khong biet)
 *   - launch_args : JSON array string (optional)
 *   - requires_admin : boolean
 *   - vendor      : optional vendor name
 *   - description : optional
 *   - sort_order  : optional number
 *
 * LUONG:
 * 1. Auth: requirePermission('admin.manage_tools').
 * 2. Parse formData.
 * 3. Put file vao R2 'tools/<id>/<version>/<file>'.
 * 4. Compute SHA256 (real hash).
 * 5. Insert row vao table `tools`.
 * 6. Return tool metadata.
 */

import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requirePermission } from "@/lib/api/guard";
import {
  putToolFile,
  computeSha256,
  isValidR2Key,
  buildToolKey,
} from "@/lib/tools/r2";
import { insertTool } from "@/lib/tools/repository";

export const runtime = "nodejs";

const MAX_SIZE = 200 * 1024 * 1024; // 200MB

export async function POST(req: NextRequest) {
  try {
    const { user } = await requirePermission("admin.manage_tools");

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return fail("INVALID_CONTENT_TYPE", "multipart/form-data required", 400);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail("MISSING_FILE", "file field required", 400);
    }
    if (file.size > MAX_SIZE) {
      return fail(
        "FILE_TOO_LARGE",
        `File > 200MB. Got ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        413,
      );
    }

    const id = String(formData.get("id") ?? "").trim();
    if (!/^[a-z0-9-]{2,64}$/.test(id)) {
      return fail("INVALID_ID", "id must be lowercase alphanumeric/dash (2-64)", 400);
    }
    const execName = String(formData.get("exec_name") ?? "").trim();
    if (!execName) return fail("INVALID_EXEC", "exec_name required", 400);

    const version = String(formData.get("version") ?? "").trim() || null;
    const fileName = (file as File).name || `${id}.bin`;
    const extracted = String(formData.get("extract") ?? "true").toLowerCase() === "true";
    const r2Key = buildToolKey(id, version, fileName);

    if (!isValidR2Key(r2Key)) {
      return fail("INVALID_R2_KEY", `Invalid r2_key: ${r2Key}`, 400);
    }

    // Doc file thanh ArrayBuffer (compute hash + upload).
    const arrayBuffer = await (file as File).arrayBuffer();

    // Compute SHA256.
    let sha256: string;
    try {
      sha256 = await computeSha256(arrayBuffer);
    } catch (e) {
      console.error("[tools/upload] sha256 failed:", e);
      return fail("HASH_FAILED", "Cannot compute SHA256", 500);
    }

    // Allow override: neu admin truyen sha256 form field → su dung (verify).
    const overrideSha = String(formData.get("sha256") ?? "").trim();
    const finalSha = overrideSha && overrideSha !== "VERIFY_REQUIRED"
      ? overrideSha
      : sha256;

    // Upload R2.
    try {
      await putToolFile(r2Key, arrayBuffer, file.type || "application/octet-stream");
    } catch (e) {
      console.error("[tools/upload] R2 put failed:", e);
      return fail("UPLOAD_FAILED", "R2 upload failed", 500);
    }

    const launchArgsStr = String(formData.get("launch_args") ?? "[]").trim();
    let launchArgs: string[] = [];
    try {
      const parsed = JSON.parse(launchArgsStr);
      if (Array.isArray(parsed)) launchArgs = parsed.map(String);
    } catch {
      // ignore
    }

    // Insert metadata.
    const tool = await insertTool(
      {
        id,
        name: String(formData.get("name") ?? id),
        description: String(formData.get("description") ?? ""),
        category: String(formData.get("category") ?? "utility"),
        icon: String(formData.get("icon") ?? "🔧"),
        r2_key: r2Key,
        sha256: finalSha,
        exec_name: execName,
        extract: extracted,
        launch_args: launchArgs,
        requires_admin: String(formData.get("requires_admin") ?? "false").toLowerCase() === "true",
        size_bytes: arrayBuffer.byteLength,
        version: version ?? undefined,
        vendor: String(formData.get("vendor") ?? "") || undefined,
        status: "active",
        sort_order: Number(formData.get("sort_order") ?? 100),
      },
      user.id,
    );

    return ok({ data: tool }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("permission") || msg.includes("quyền")) return fail("FORBIDDEN", msg, 403);
    if (msg.includes("Unauthorized")) return fail("UNAUTHORIZED", msg, 401);
    console.error("[tools/upload] error:", e);
    return fail("INTERNAL", msg, 500);
  }
}

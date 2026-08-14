/**
 * GET /api/v1/tools/download?toolId=cpu-z
 *
 * Server proxy stream file tool tu Supabase Storage ve client.
 *
 * LUONG:
 * 1. Validate toolId.
 * 2. Query DB `tools` -> lay r2_key, sha256, exec_name, extract.
 * 3. Download tu Supabase Storage bucket "tools" (private).
 * 4. Stream body ve client kem metadata headers.
 *
 * Metadata headers (PS1 can de verify SHA256 / extract / launch):
 *   - X-Tool-Id
 *   - X-Tool-Sha256         (placeholder 'VERIFY_REQUIRED' = can compute runtime)
 *   - X-Tool-Verify-Mode    'verified' | 'required' | 'skip'
 *   - X-Tool-Extract        'true' | 'false'
 *   - X-Tool-Exec           ten file exe chinh
 *   - X-Tool-Args           JSON array string args
 *   - Content-Disposition   filename goc
 *   - Content-Length        size bytes
 */

import { NextRequest, NextResponse } from "next/server";
import { findToolById, verifyModeOf } from "@/lib/tools/repository";
import { downloadToolFile } from "@/lib/storage/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const toolId = searchParams.get("toolId");

  if (!toolId) {
    return NextResponse.json(
      { ok: false, error: "Missing toolId" },
      { status: 400 },
    );
  }

  const tool = await findToolById(toolId);
  if (!tool) {
    return NextResponse.json(
      { ok: false, error: `Tool not found: ${toolId}` },
      { status: 404 },
    );
  }

  if (tool.status === "disabled") {
    return NextResponse.json(
      { ok: false, error: "Tool disabled" },
      { status: 403 },
    );
  }

  // Lay file tu Supabase Storage.
  let buffer: ArrayBuffer;
  try {
    buffer = await downloadToolFile(tool.r2_key);
  } catch (e) {
    console.error(`[tools/download] Storage get failed for ${toolId}:`, e);
    return NextResponse.json(
      { ok: false, error: "Storage unavailable" },
      { status: 502 },
    );
  }

  if (!buffer || buffer.byteLength === 0) {
    return NextResponse.json(
      { ok: false, error: "File missing in Storage" },
      { status: 404 },
    );
  }

  // Lay filename tu r2_key (vd tools/cpu-z/2.20.2/cpu-z_2.20.2-en.zip ->
  // cpu-z_2.20.2-en.zip).
  const filename = tool.r2_key.split("/").pop() || `${tool.id}.zip`;

  // Build headers.
  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "X-Tool-Id": tool.id,
    "X-Tool-Sha256": tool.sha256,
    "X-Tool-Verify-Mode": verifyModeOf(tool.sha256),
    "X-Tool-Extract": String(tool.extract),
    "X-Tool-Exec": tool.exec_name,
    "X-Tool-Args": JSON.stringify(tool.launch_args),
    "X-Tool-Requires-Admin": String(tool.requires_admin),
    "Content-Length": String(buffer.byteLength),
    "Cache-Control": "public, max-age=300",
  });

  // Return buffer as Response.
  return new Response(buffer, {
    status: 200,
    headers,
  });
}

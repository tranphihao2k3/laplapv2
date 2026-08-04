/**
 * GET /api/v1/tools — Trả về danh sách tools có thể tải.
 * Response: { ok: true, data: ToolEntry[] }
 */

import { NextResponse } from "next/server";
import { TOOL_CATALOG, formatBytes } from "@/lib/tools/catalog";

export const runtime = "nodejs";

export async function GET() {
  const tools = TOOL_CATALOG.map((t) => ({
    ...t,
    sizeLabel: formatBytes(t.sizeBytes),
    // Xac dinh verify mode cho UI:
    // - "verified"  : catalog co hash that (khac VERIFY_REQUIRED).
    // - "required"  : catalog co placeholder -> can verify runtime.
    // - "skip"      : admin set placeholder "VERIFY_SKIP".
    verifyMode:
      t.sha256 === "VERIFY_REQUIRED"
        ? "required"
        : t.sha256 === "VERIFY_SKIP"
          ? "skip"
          : "verified",
    // KHONG tra cdnUrl/r2Url truc tiep - client phai qua /tools/download
    // de server proxy (tranh bi block, redirect, hoac expose URL private).
    // Client chi can POST /tools/download voi toolId, server se stream file.
    downloadEndpoint: `/api/v1/tools/download?toolId=${t.id}`,
  }));

  return NextResponse.json({
    ok: true,
    data: tools,
  });
}
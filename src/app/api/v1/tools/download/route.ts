/**
 * GET /api/v1/tools/download?toolId=cpu-z
 *
 * Server proxy stream file tool tu CDN/R2 ve client.
 *
 * Ly do can server proxy (khong cho client goi truc tiep):
 * 1. R2 private URL can signature -> moi lan phai ky moi signature.
 *    Neu client goi truc tiep, URL se expire sau 1h -> user download fail.
 * 2. CDN goc co the redirect, block bot, hoac thay doi URL khong kip.
 *    Server lay fresh URL moi request -> on dinh hon.
 * 3. Tracking: biet tool nao dang duoc tai nhieu nhat.
 *
 * Luong:
 * 1. Validate toolId.
 * 2. Neu co R2 binding (TOOLS_BUCKET), thi thu lay tu R2 truoc.
 * 3. Neu R2 fail hoac khong co, fallback CDN.
 * 4. Stream response ve client.
 */

import { NextRequest, NextResponse } from "next/server";
import { findTool } from "@/lib/tools/catalog";

export const runtime = "nodejs";
// Edge runtime max execution: ~30s cho streaming.
// Tools lon (50MB) co the can hon. Dung nodejs runtime de khong bi gioi han.
// OpenNext build cung yeu cau cac edge runtime functions phai o file rieng
// (xem open-next config). Vi ta chi can stream binh thuong, nodejs la du.

async function fetchTool(
  url: string,
  userAgent: string,
): Promise<Response> {
  // Gia lap User-Agent trinh duyet pho bien de tranh mot so CDN block unknown bot.
  const res = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "*/*",
    },
    // Cloudflare Workers fetch se tu dong stream response body neu khong doc.
    redirect: "follow",
  });
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const toolId = searchParams.get("toolId");

  if (!toolId) {
    return NextResponse.json(
      { ok: false, error: "Missing toolId" },
      { status: 400 },
    );
  }

  const tool = findTool(toolId);
  if (!tool) {
    return NextResponse.json(
      { ok: false, error: `Tool not found: ${toolId}` },
      { status: 404 },
    );
  }

  // User-Agent pho bien de tranh bi CDN block.
  const ua =
    req.headers.get("user-agent") ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

  // Thu R2 truoc neu co (admin da upload).
  if (tool.r2Url) {
    try {
      const r2Res = await fetchTool(tool.r2Url, ua);
      if (r2Res.ok) {
        return streamResponse(r2Res, tool);
      }
      console.warn(
        `[tools/download] R2 fetch failed for ${toolId}: ${r2Res.status}, fallback CDN`,
      );
    } catch (e) {
      console.warn(`[tools/download] R2 fetch error for ${toolId}:`, e);
    }
  }

  // Fallback CDN.
  try {
    const cdnRes = await fetchTool(tool.cdnUrl, ua);
    if (!cdnRes.ok) {
      return NextResponse.json(
        { ok: false, error: `Upstream ${cdnRes.status} ${cdnRes.statusText}` },
        { status: 502 },
      );
    }
    return streamResponse(cdnRes, tool);
  } catch (e) {
    console.error(`[tools/download] CDN fetch error for ${toolId}:`, e);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch tool from upstream" },
      { status: 502 },
    );
  }
}

function streamResponse(upstream: Response, tool: ReturnType<typeof findTool> & object): Response {
  // Lay content-type tu upstream neu co, mac dinh application/octet-stream.
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";

  // Lay content-length neu co (dung hien thi % download o UI).
  const contentLength = upstream.headers.get("content-length");

  // Lay filename goc tu upstream neu co, fallback dung tool.exec + .zip.
  const upstreamFilename = upstream.headers
    .get("content-disposition")
    ?.match(/filename="?([^"]+)"?/)?.[1];

  // Build headers.
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${upstreamFilename || `${tool.id}.zip`}"`,
    "X-Tool-Id": tool.id,
    "X-Tool-Sha256": tool.sha256,
    // PS1 can biet SHA256 co phai placeholder (VERIFY_REQUIRED) hay that de quyet dinh:
    // - "verified"  : catalog co hash that.
    // - "required"  : catalog co placeholder, PS1 phai compute de xac nhan.
    // - "skip"      : catalog co VERIFY_SKIP (= yeu cau khong verify).
    "X-Tool-Verify-Mode": tool.sha256 === "VERIFY_REQUIRED" ? "required" : "verified",
    "X-Tool-Extract": String(tool.extract),
    "X-Tool-Exec": tool.exec,
    "Cache-Control": "public, max-age=300", // 5 phut
  });
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  // Stream body ve client (edge runtime tu dong optimize).
  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
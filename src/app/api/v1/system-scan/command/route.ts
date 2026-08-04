/**
 * POST /api/v1/system-scan/command?token=X
 * Body: { action: "launch-tool" | "stop-tool", toolId: "cpu-z" }
 *
 * Server luu command vao memory (key: token, value: command pending).
 * Scanner se poll command moi 3s qua /api/v1/system-scan/command-poll.
 * Sau khi scanner nhan command, no se ack va server xoa khoi queue.
 *
 * Memory-based (khong luu DB) vi command chi song trong 1 phien scan.
 * Khi user reset scan hoac token het han (>30p), command queue bi clear.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { findTool } from "@/lib/tools/catalog";

export const runtime = "edge";

const Body = z.object({
  action: z.enum(["launch-tool", "stop-tool"]),
  toolId: z.string().min(1).max(64),
});

// In-memory command queue. Ton tai trong edge instance memory.
// Moi edge worker co instance rieng -> nen queue se khong share giua cac
// worker. Tuy nhien may thuc te cua user chi truy cap qua 1 edge worker
// (Cloudflare route by colo), nen trong 99% se on dinh.
// Production-grade hon thi phai dung Durable Objects / KV, nhung MVP thi du.
const commandQueue = new Map<string, unknown>();

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return fail("MISSING_TOKEN", "Missing token", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return fail("INVALID_BODY", "Invalid body", 400);
  }

  const { action, toolId } = parsed.data;
  const tool = findTool(toolId);
  if (!tool) {
    return fail("TOOL_NOT_FOUND", `Tool not found: ${toolId}`, 404);
  }

  // Set command vao queue.
  // Neu da co command pending, ghi de (latest wins).
  commandQueue.set(token, {
    action,
    toolId,
    toolName: tool.name,
    exec: tool.exec,
    args: tool.launchArgs ?? [],
    extract: tool.extract,
    issuedAt: Date.now(),
  });

  return ok({ queued: true, action, toolId });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return fail("MISSING_TOKEN", "Missing token", 400);

  commandQueue.delete(token);
  return ok({ cleared: true });
}

// Cleanup: tu xoa command cu hon 30 phut (token het han).
// Edge runtime khong co setInterval -> can cron trigger de cleanup.
// Trong MVP: command tu xoa sau khi scanner nhan (atomic get+delete o command-poll).

// Export de command-poll route co the truy cap queue.
export { commandQueue };
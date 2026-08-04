/**
 * POST /api/v1/system-scan/command?token=X
 * Body: { action: "launch-tool" | "stop-tool", toolId: "cpu-z" }
 *
 * Server luu command vao shared queue (xem lib/tools/command-queue).
 * Scanner se poll command moi 3s qua /api/v1/system-scan/command-poll.
 * Sau khi scanner nhan command, no se ack va server xoa khoi queue.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { findTool } from "@/lib/tools/catalog";
import { commandQueue } from "@/lib/tools/command-queue";

export const runtime = "nodejs";

const Body = z.object({
  action: z.enum(["launch-tool", "stop-tool"]),
  toolId: z.string().min(1).max(64),
});

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

  // Set command vao shared queue (latest wins).
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
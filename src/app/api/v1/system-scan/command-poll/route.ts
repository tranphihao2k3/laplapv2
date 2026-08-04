/**
 * GET /api/v1/system-scan/command-poll?token=X
 *
 * Scanner goi moi 3s de lay command pending tu server.
 * Neu co command -> tra ve va xoa khoi queue.
 * Neu khong co -> tra 204 No Content (giong long-poll ngan).
 */

import { NextRequest, NextResponse } from "next/server";
import { ok } from "@/lib/api/response";
import { commandQueue } from "../command/route";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Missing token" },
      { status: 400 },
    );
  }

  const cmd = commandQueue.get(token);
  if (!cmd) {
    // 204 = khong co command, scanner poll tiep.
    return new Response(null, { status: 204 });
  }

  // Atomic get+delete: tra command va xoa trong cung mot request.
  commandQueue.delete(token);

  return ok({ command: cmd });
}
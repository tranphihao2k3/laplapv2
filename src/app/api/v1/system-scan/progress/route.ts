/**
 * POST /api/v1/system-scan/progress?token=X
 * Body: { toolId, stage, percent?, message? }
 *
 * Scanner PS1 gui progress trong luc download/extract/launch tool.
 * Server luu vao in-memory queue (theo token) cho UI poll.
 *
 * UI goi GET /api/v1/system-scan/progress?token=X de lay progress moi nhat.
 *
 * Luu y: stage co cac gia tri sau:
 *   - "downloading" (voi percent 0-100)
 *   - "verifying"
 *   - "extracting"
 *   - "launching"
 *   - "done"
 *   - "error"
 *
 * Chi luu gia tri moi nhat (overwrite), vi UI chi can real-time progress.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";

export const runtime = "edge";

const Body = z.object({
  toolId: z.string().min(1).max(64),
  stage: z.enum([
    "downloading",
    "verifying",
    "extracting",
    "launching",
    "done",
    "error",
  ]),
  percent: z.number().int().min(0).max(100).optional(),
  message: z.string().max(500).optional(),
  // SHA256 thuc te cua file sau khi verify (de UI audit).
  actualSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  // Verify status: "ok" | "mismatch" | "skipped" | "unverified"
  verifyStatus: z.enum(["ok", "mismatch", "skipped", "unverified"]).optional(),
});

export interface ProgressEntry {
  toolId: string;
  stage: string;
  percent: number;
  message: string;
  actualSha256?: string;
  verifyStatus?: string;
  issuedAt: number;
}

// In-memory queue. Moi token co 1 entry progress moi nhat.
const progressQueue = new Map<string, ProgressEntry>();

// Giu lai logs cuoi cung (max 50) de UI xem log stream.
const progressHistory = new Map<string, ProgressEntry[]>();
const MAX_HISTORY = 50;

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return fail("MISSING_TOKEN", "Missing token", 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return fail("INVALID_BODY", parsed.error.message, 400);
  }

  const entry: ProgressEntry = {
    toolId: parsed.data.toolId,
    stage: parsed.data.stage,
    percent: parsed.data.percent ?? 0,
    message: parsed.data.message ?? "",
    actualSha256: parsed.data.actualSha256,
    verifyStatus: parsed.data.verifyStatus,
    issuedAt: Date.now(),
  };

  // Set vao queue (latest wins).
  progressQueue.set(token, entry);

  // Append vao history.
  const hist = progressHistory.get(token) || [];
  hist.push(entry);
  if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY);
  progressHistory.set(token, hist);

  return ok({ recorded: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return fail("MISSING_TOKEN", "Missing token", 400);

  const current = progressQueue.get(token);
  const history = progressHistory.get(token) || [];

  return ok({
    current: current ?? null,
    history,
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return fail("MISSING_TOKEN", "Missing token", 400);

  progressQueue.delete(token);
  progressHistory.delete(token);
  return ok({ cleared: true });
}

// Export de cac route khac co the reference (testing).
export { progressQueue, progressHistory };
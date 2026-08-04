/**
 * Shared in-memory command queue (theo token).
 *
 * Tach rieng khoi route handler de tranh Next.js build error:
 *   "commandQueue is not a valid Route export field"
 *
 * Moi edge worker co instance rieng -> queue khong share giua cac worker.
 * Trade-off chap nhan duoc voi MVP.
 */

import type { z } from "zod";

export interface CommandEntry {
  action: string;
  toolId: string;
  toolName: string;
  exec: string;
  args: string[];
  extract: boolean;
  issuedAt: number;
}

export const commandQueue = new Map<string, CommandEntry>();

// Cleanup queue cu (hon 30 phut) khi instance khoi dong.
// Edge runtime khong co setInterval, nen chi chay 1 lan luc init.
const TTL_MS = 30 * 60 * 1000;
function cleanupStale() {
  const now = Date.now();
  for (const [token, entry] of commandQueue) {
    if (now - entry.issuedAt > TTL_MS) {
      commandQueue.delete(token);
    }
  }
}
cleanupStale();
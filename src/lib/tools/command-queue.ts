/**
 * Shared in-memory command queue (theo token).
 *
 * Tach rieng khoi route handler de tranh Next.js build error:
 *   "commandQueue is not a valid Route export field"
 *
 * Moi invoke nodejs co instance rieng -> queue khong share giua cac isolate.
 * Trade-off chap nhan duoc voi MVP (user chi can 1 scanner session).
 */

export interface CommandEntry {
  action: "launch-tool" | "stop-tool" | "rescan";
  toolId: string;
  toolName: string;
  /** URL download (server proxy R2). Scanner GET file tu URL nay. */
  downloadUrl: string;
  /** SHA256 mong doi (hoac 'VERIFY_REQUIRED' de scanner compute). */
  sha256: string;
  /** Ten file exe chinh. */
  exec: string;
  /** Args mac dinh. */
  args: string[];
  /** Co extract zip khong? */
  extract: boolean;
  /** Co can quyen admin khong? */
  requiresAdmin: boolean;
  issuedAt: number;
}

export const commandQueue = new Map<string, CommandEntry>();

// Cleanup queue cu (hon 30 phut) khi instance khoi dong.
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

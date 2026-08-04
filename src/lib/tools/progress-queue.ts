/**
 * Shared in-memory progress queue (theo token).
 *
 * Tach rieng khoi route handler de tranh Next.js build error:
 *   "progressQueue is not a valid Route export field"
 */

export interface ProgressEntry {
  toolId: string;
  stage: string;
  percent: number;
  message: string;
  actualSha256?: string;
  verifyStatus?: string;
  issuedAt: number;
}

export const progressQueue = new Map<string, ProgressEntry>();

// History (50 logs moi nhat) moi token.
export const progressHistory = new Map<string, ProgressEntry[]>();
export const MAX_HISTORY = 50;
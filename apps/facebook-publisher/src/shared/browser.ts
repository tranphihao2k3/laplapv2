/**
 * Shared browser/playwright types — M4.
 */
export type BrowserSessionStatus =
  | { kind: "unknown" }
  | { kind: "running" }
  | { kind: "not_running" }
  | { kind: "missing_binary" }
  | { kind: "lock_held" };

export type SessionHealth =
  | { kind: "unknown" }
  | { kind: "checking" }
  | { kind: "logged_in"; cookies: string[] }
  | { kind: "logged_out" }
  | { kind: "checkpoint"; reason: string }
  | { kind: "two_fa_required" }
  | { kind: "needs_captcha" }
  | { kind: "blocked" }
  | { kind: "page_error"; message: string };

export type AutoSubmitDecision =
  | { kind: "allowed" }
  | { kind: "blocked"; reason: string };

export type SavedScreenshot = {
  filePath: string;
  bytes: number;
  savedAt: string;
};
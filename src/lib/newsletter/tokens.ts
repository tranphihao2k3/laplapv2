/**
 * Helpers cho newsletter tokens + email normalization.
 *
 * - normalizeEmail: lower-case + trim. Gmail/Outlook bo dau cham alias se duoc
 *   xu ly sau (hien tai chi normalize co ban).
 * - randomToken: URL-safe random string (32 bytes hex -> 64 chars).
 */

/** Lower-case trim email. Khoi tao nho de tranh sai chinh ta khi query DB. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Random token URL-safe, 32 bytes = 256 bit entropy.
 * Dung crypto.randomBytes (server-only). Su dung trong confirm_token va unsubscribe_token.
 */
import { randomBytes } from "crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Fingerprint chống trùng job (CMP-003).
 *
 * Công thức (docs §11 CMP-003):
 *   SHA-256(group_id | variant_id | normalize(rendered_text) | sorted(sha256s))
 *
 * - normalize: NFC Unicode, strip nhiều whitespace, lowercase.
 * - joined với '\u001F' (ASCII Unit Separator) để chống collision do
 *   concatenation.
 * - SHA-256 → hex.
 */
import crypto from "node:crypto";

const UNIT_SEP = "\u001F";

export type FingerprintInput = {
  groupId: string;
  variantId: string;
  renderedText: string;
  imageSha256s: string[];
};

export function computeFingerprint(input: FingerprintInput): string {
  const normalized = normalizeText(input.renderedText);
  const sortedHashes = [...input.imageSha256s].sort();
  const payload = [
    input.groupId,
    input.variantId,
    normalized,
    ...sortedHashes,
  ].join(UNIT_SEP);
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

/** Normalize: NFC Unicode, strip control chars, collapse whitespace, lowercase. */
export function normalizeText(input: string): string {
  if (!input) return "";
  // NFC Unicode normalization.
  let s = input.normalize("NFC");
  // Strip control chars (giữ newline).
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();
  return s.toLowerCase();
}
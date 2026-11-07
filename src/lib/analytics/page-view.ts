/**
 * Helper normalize / validate path cho site analytics.
 * Path chỉ giữ pathname (bỏ query/hash), bắt đầu bằng `/`.
 */

const MAX_PATH_LEN = 200;

/** Prefix / pattern không đếm (admin, API, asset). */
const SKIP_PREFIXES = [
  "/quanly",
  "/dashboard",
  "/api",
  "/_next",
  "/auth",
  "/login",
  "/signup",
];

const SKIP_EXT = /\.(ico|png|jpe?g|gif|webp|svg|css|js|map|txt|xml|json|webmanifest|woff2?)$/i;

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|wget|curl|python-requests|headless/i;

export function normalizePagePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let path = String(raw).trim();
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      path = new URL(path).pathname;
    }
  } catch {
    return null;
  }
  const q = path.indexOf("?");
  if (q >= 0) path = path.slice(0, q);
  const h = path.indexOf("#");
  if (h >= 0) path = path.slice(0, h);
  if (!path.startsWith("/")) path = `/${path}`;
  // Gộp slash kép, bỏ trailing slash (trừ root)
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  path = path.slice(0, MAX_PATH_LEN);
  if (!/^\/[\w\-./%]*$/i.test(path)) return null;
  return path;
}

export function shouldSkipPagePath(path: string): boolean {
  if (path === "/favicon.ico") return true;
  if (SKIP_EXT.test(path)) return true;
  return SKIP_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return BOT_UA.test(ua);
}

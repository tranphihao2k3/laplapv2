/**
 * Lightweight HTTP client cho desktop app.
 *
 * Phạm vi:
 *  - Tạo request với base URL (lấy từ AppSettings.apiBaseUrl).
 *  - Timeout configurable.
 *  - User-Agent đặc thù app.
 *  - KHÔNG kèm theo user-agent chứa token/PII.
 *
 * KHÔNG dùng thư viện (axios/got) để giữ bundle nhỏ và không bị lock-in.
 *   - Supabase endpoint dùng fetch chuẩn (Node 18+ / Chromium đều có).
 *   - Repo root web đã có `fetch` wrapper riêng — không dùng chung vì
 *     desktop main process không có Next.js runtime.
 */
import { env } from "../env";

const APP_USER_AGENT = "LapLap-FB-Publisher/0.1 (+desktop; electron)";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type FetchOptions = {
  /** AbortSignal để cancel khi timeout quá. */
  signal?: AbortSignal;
  /** Additional headers. */
  headers?: Record<string, string>;
  /** Body JSON nếu có. */
  body?: unknown;
  /** Override default timeout (ms). */
  timeoutMs?: number;
};

/** Build absolute URL từ path; chấp nhận path tương đối bắt đầu '/'. */
export function resolveUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const b = baseUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * Fetch chuẩn + timeout + error mapping. Trả JSON nếu response có
 * Content-Type application/json, ngược lại trả text.
 */
export async function apiFetch<T = unknown>(
  baseUrl: string,
  path: string,
  method: string,
  opts: FetchOptions = {},
): Promise<T> {
  const url = resolveUrl(baseUrl, path);
  const timeoutMs = opts.timeoutMs ?? env.defaultHttpTimeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (opts.signal) {
    // Caller muốn cancel riêng — combine signal.
    opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": APP_USER_AGENT,
      ...opts.headers,
    };
    let body: string | undefined;
    if (opts.body !== undefined) {
      body = JSON.stringify(opts.body);
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, { method, headers, body, signal: controller.signal });
    const raw = await res.text();

    if (!res.ok) {
      throw new HttpError(
        res.status,
        `HTTP_${res.status}`,
        `Request failed: ${res.status} ${res.statusText}`,
        // Cố gắng parse JSON error body — Supabase trả { message, code }.
        safeJsonParse(raw),
      );
    }

    if (!raw) return undefined as unknown as T;
    return (raw.startsWith("{") || raw.startsWith("[") ? JSON.parse(raw) : raw) as T;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if ((err as { name?: string }).name === "AbortError") {
      throw new HttpError(0, "TIMEOUT", `Request timeout after ${timeoutMs}ms`);
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new HttpError(0, "NETWORK", msg);
  } finally {
    clearTimeout(timeout);
  }
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

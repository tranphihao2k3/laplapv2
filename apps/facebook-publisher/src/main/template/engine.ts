/**
 * Template engine — TPL-001.
 *
 * Quy tắc an toàn (docs §11 TPL-001):
 *  - Allowlist biến (vd {{product.name}}, {{variant.price}}); KHÔNG eval.
 *  - Biến cho phép: product.*, variant.*, group.*, post.*.
 *  - Nếu body tham chiếu biến ngoài allowlist → throw + vị trí lỗi.
 *  - Biến unknown khi render → giữ nguyên {{var}} hoặc "" tuỳ config;
 *    ở đây chọn "" để không spam nội dung rác.
 *  - Format số: tiền Việt Nam (1000 → "1.000 ₫"); null → "—".
 *  - Format ngày: ISO → dd/MM/yyyy.
 *  - Test phải cover Unicode tiếng Việt, ký tự đặc biệt, null field, unknown
 *    variable, nội dung dài.
 *
 * Lưu ý: Engine KHÔNG dùng regex quá phức tạp — duyệt token {{...}} để
 * tránh ReDoS. Bộ test sẽ kiểm tra nội dung rất dài.
 */

export type VariableResolver = {
  get(name: string): unknown;
};

export type RenderOptions = {
  /** Khi biến không có giá trị, thay bằng chuỗi này. Mặc định "". */
  unknownFallback?: string;
  /** Locale cho format số/ngày. Mặc định "vi-VN". */
  locale?: string;
};

export const ALLOWED_VARIABLE_PREFIXES = [
  "product.",
  "variant.",
  "group.",
  "post.",
] as const;

/** Phát hiện tất cả tham chiếu {{...}} trong body. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  let i = 0;
  while (i < body.length) {
    const start = body.indexOf("{{", i);
    if (start === -1) break;
    const end = body.indexOf("}}", start + 2);
    if (end === -1) break;
    const inner = body.slice(start + 2, end).trim();
    if (inner.length > 0 && inner.length <= 200) {
      found.add(inner);
    }
    i = end + 2;
  }
  return [...found];
}

/**
 * Validate: tất cả tham chiếu {{var}} phải có prefix thuộc allowlist.
 * Throw nếu có biến ngoài allowlist.
 */
export function assertAllowlist(body: string): void {
  const refs = extractVariables(body);
  const offenders = refs.filter(
    (r) => !ALLOWED_VARIABLE_PREFIXES.some((p) => r.startsWith(p)),
  );
  if (offenders.length > 0) {
    throw new TemplateError(
      "TEMPLATE_VAR_NOT_ALLOWED",
      `Biến không trong allowlist: ${offenders.join(", ")}`,
    );
  }
}

/**
 * Render body bằng cách duyệt token {{...}}. Mỗi token thay bằng
 * resolver.get(name) đã được formatValue().
 */
export function render(
  body: string,
  resolver: VariableResolver,
  options: RenderOptions = {},
): string {
  const fallback = options.unknownFallback ?? "";
  const locale = options.locale ?? "vi-VN";
  let out = "";
  let i = 0;
  while (i < body.length) {
    const start = body.indexOf("{{", i);
    if (start === -1) {
      out += body.slice(i);
      break;
    }
    out += body.slice(i, start);
    const end = body.indexOf("}}", start + 2);
    if (end === -1) {
      // Không đóng — append phần còn lại thô.
      out += body.slice(start);
      break;
    }
    const name = body.slice(start + 2, end).trim();
    const raw = resolver.get(name);
    out += formatValue(raw, locale, fallback);
    i = end + 2;
  }
  return out;
}

/**
 * Format value theo kiểu dữ liệu suy luận. KHÔNG dùng eval.
 */
export function formatValue(
  raw: unknown,
  locale: string = "vi-VN",
  unknownFallback = "",
): string {
  if (raw === null || raw === undefined) return unknownFallback;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return unknownFallback;
    // VND price → "1.000 ₫". Heuristic: nếu key chứa 'price' thì format
    // tiền — chỗ này đơn giản hoá: luôn format integer với dấu phân cách.
    const formatted = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    }).format(raw);
    return raw >= 1000 ? `${formatted} ₫` : formatted;
  }
  if (typeof raw === "boolean") {
    return raw ? "Có" : "Không";
  }
  if (raw instanceof Date) {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(raw);
  }
  if (typeof raw === "string") {
    // Có thể là ISO date — parse nếu khớp.
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        return new Intl.DateTimeFormat(locale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(d);
      }
    }
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw.map((r) => formatValue(r, locale, unknownFallback)).join(", ");
  }
  if (typeof raw === "object") {
    // Render object đơn giản: key=value.
    return Object.entries(raw as Record<string, unknown>)
      .map(([k, v]) => `${k}=${formatValue(v, locale, unknownFallback)}`)
      .join("; ");
  }
  return String(raw);
}

/**
 * Adapter cho ProductSummary / VariantSummary — build resolver từ context
 * UI truyền vào.
 */
export function makeResolver(values: Record<string, unknown>): VariableResolver {
  return { get: (name: string) => values[name] };
}

export class TemplateError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "TemplateError";
  }
}
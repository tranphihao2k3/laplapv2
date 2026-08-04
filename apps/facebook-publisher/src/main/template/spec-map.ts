/**
 * Spec parsing cho template context.
 *
 * `variant.specs_json` ở DB có thể là:
 *  - Object: `{"CPU": "I5-12450H", "RAM": "16GB", ...}`
 *  - Array:  `[{"key": "CPU", "value": "I5-12450H"}, ...]`
 *  - String thô (API không chuẩn hoá) — fallback parse đơn giản.
 *
 * `buildSpecMap()` trả về flat `Record<string, string>` với key đã
 * chuẩn hoá (lowercase + bỏ dấu tiếng Việt + alias) để lookup dễ:
 *  - "cpu" → "I5-12450H (8 nhân 12 luồng) mạnh mẽ"
 *  - "ram" → "16GB"
 *  - "ssd" → "NVMe 256GB"
 *  - "gpu" → "Intel UHD"
 *  - "screen" / "manhinh" / "màn hình" → "15.6\" FHD IPS"
 *  - "battery" / "pin" → "2-4h"
 *  - "keyboard" / "phim" / "bàn phím" → "Full Size"
 *
 * Lookup dùng `SPEC_KEY_ALIASES` — gồm key "chuẩn" + mọi biến thể
 * tiếng Việt không dấu có dấu để tránh phụ thuộc format API.
 */

const SPEC_KEY_ALIASES: Record<string, readonly string[]> = {
  cpu: ["cpu", "chip", "processor", "vi xu ly", "vi xử lý"],
  ram: ["ram", "memory", "bo nho", "bộ nhớ"],
  // Backend admin hay dùng "ssd" (mới) hoặc "storage" (cũ). Map cả 2.
  ssd: ["ssd", "storage", "rom", "o cung", "ổ cứng", "hard drive"],
  gpu: ["gpu", "vga", "card do hoa", "card đồ họa", "graphics"],
  screen: ["screen", "display", "man hinh", "màn hình", "kich thuoc", "kích thước"],
  battery: ["battery", "pin", "dung luong pin", "dung lượng pin"],
  keyboard: ["keyboard", "phim", "ban phim", "bàn phím"],
  camera: ["camera", "webcam"],
  os: ["os", "he dieu hanh", "hệ điều hành"],
  weight: ["weight", "can nang", "cân nặng", "khoi luong", "khối lượng"],
  color: ["color", "mau", "màu", "mau sac", "màu sắc"],
};

/** Bỏ dấu tiếng Việt + lowercase + bỏ ký tự đặc biệt. */
function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tìm canonical key từ normalized alias. */
function resolveCanonicalKey(normalized: string): string | null {
  for (const [canonical, aliases] of Object.entries(SPEC_KEY_ALIASES)) {
    if (aliases.some((a) => a === normalized)) return canonical;
  }
  return null;
}

/** Parse `specs_json` từ DB thành `Record<canonicalKey, value>`. */
export function buildSpecMap(specsJson: string | null | undefined): Record<string, string> {
  if (!specsJson) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(specsJson);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};

  const out: Record<string, string> = {};

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item === "object" && "key" in item && "value" in item) {
        const k = String((item as { key: unknown }).key);
        const v = (item as { value: unknown }).value;
        if (v === null || v === undefined) continue;
        const canon = resolveCanonicalKey(normalizeKey(k));
        if (canon && !out[canon]) out[canon] = String(v);
      }
    }
  } else {
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      const canon = resolveCanonicalKey(normalizeKey(k));
      if (canon && !out[canon]) out[canon] = String(v);
    }
  }

  return out;
}

/** Format giá VND kiểu rút gọn "8.500K" (cho mẫu laptop Cần Thơ).
 *  - 1.000.000 → "1.000K"
 *  - 8.500.000 → "8.500K"
 *  - 24.500.000 → "24.500K"
 *  - null/undefined → "" */
export function formatPriceShort(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "";
  }
  const thousands = Math.round(value / 1000);
  // Intl dùng dấu "." cho phần nghìn ở vi-VN → khớp format mẫu.
  return new Intl.NumberFormat("vi-VN").format(thousands) + "K";
}

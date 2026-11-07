/**
 * Tự động điền dòng "biến thể" trong form tạo/sửa sản phẩm.
 *
 * Nguyên tắc:
 *  - SKU sinh từ slug/tên sản phẩm, tự thêm hậu tố `-2`, `-3`... nếu trùng.
 *  - Tên cấu hình kế thừa từ biến thể trước để chỉ sửa phần khác nhau.
 *  - Giá bán / giá vốn / tồn kho bắt chước biến thể vừa thêm (để thêm nhanh
 *    các biến thể còn lại chỉ cần sửa phần phân biệt). Khi chưa có biến thể
 *    nào thì lấy từ "Giá bán nhanh" / "Tồn kho ban đầu" ở phần trên.
 *
 * Module này chỉ chứa hàm thuần để dễ kiểm thử, không phụ thuộc React.
 */

export type VariantDraftField = "sku" | "name" | "sellingPrice" | "costPrice" | "initialStock";

export type VariantDraft = {
  sku: string;
  name: string;
  sellingPrice: number;
  costPrice: number;
  initialStock: number;
};

export type VariantDraftVariant = {
  sku: string;
  name: string;
  selling_price: number;
  cost_price: number;
  initial_stock?: number;
};

export type VariantDraftSource = {
  /** Tên sản phẩm (dùng khi chưa có slug). */
  productName: string;
  /** Slug sản phẩm — ưu tiên dùng để sinh SKU. */
  productSlug: string;
  /** "Giá bán nhanh" ở phần trên form ("" = chưa nhập). */
  quickPrice: number | "";
  /** "Tồn kho ban đầu" ở phần trên form ("" = chưa nhập). */
  quickStock: number | "";
  /** Các biến thể đang có trong form (đã thêm hoặc đã tồn tại trong DB). */
  existingVariants: VariantDraftVariant[];
  /** Specs đã điền (nếu có) — ưu tiên hơn parse từ tên. */
  specs?: Record<string, string> | null;
};

/** Validator server giới hạn SKU tối đa 100 ký tự. */
export const MAX_SKU_LENGTH = 100;

/** Chừa chỗ cho hậu tố `-2`..`-999` khi tự sinh SKU. */
const SKU_SUFFIX_RESERVE = 4;

export const DEFAULT_VARIANT_NAME = "Mặc định";

function pickSpec(
  specs: Record<string, string> | null | undefined,
  keys: string[],
): string | null {
  if (!specs) return null;
  const lower = new Map(
    Object.entries(specs).map(([k, v]) => [k.toLowerCase(), String(v ?? "").trim()]),
  );
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    if (v) return v;
  }
  return null;
}

function compactToken(raw: string, max = 28): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Rút tên sản phẩm / specs thành tên cấu hình ngắn: `CPU/RAM/SSD/VGA`.
 * VD: "Dell Inspiron i5-1135G7 8GB 512GB SSD RTX3050" → "i5-1135G7/8GB/512GB/RTX3050"
 */
export function buildCompactConfigName(
  productName: string,
  specs?: Record<string, string> | null,
): string {
  const fromSpecs = [
    pickSpec(specs, ["cpu", "processor", "cpu_name", "bo_xu_ly"]),
    pickSpec(specs, ["ram", "memory", "bo_nho"]),
    pickSpec(specs, ["ssd", "storage", "o_cung", "disk", "hdd"]),
    pickSpec(specs, ["gpu", "vga", "graphics", "card_do_hoa"]),
  ]
    .map((v) => (v ? compactToken(v) : ""))
    .filter(Boolean);

  if (fromSpecs.length >= 2) {
    return fromSpecs.join("/");
  }

  const text = (productName || "").trim();
  if (!text) return fromSpecs.join("/") || DEFAULT_VARIANT_NAME;

  // CPU: i5-12500H, i7 1165G7, Ryzen 5 5500U, Ultra 5 125H, M2 Pro, Core Ultra 7
  const cpuMatch =
    text.match(
      /\b((?:core\s+)?ultra\s*[3579]\s*[- ]?\d{2,5}\w*|i[3579]\s*[- ]?\d{3,5}\w*|ryzen\s*[3579]\s*[- ]?\d{3,5}\w*|m[1-4](?:\s*(?:pro|max|ultra))?)\b/i,
    ) ?? text.match(/\b(i[3579]|ryzen\s*[3579]|ultra\s*[3579]|m[1-4])\b/i);
  const cpu = cpuMatch
    ? compactToken(cpuMatch[1].replace(/\s+/g, "-").replace(/-+/g, "-"))
    : null;

  // RAM + SSD: gom mọi dung lượng dạng 8GB / 16G / 1TB / 256SSD
  // Thường thứ tự trong tên: RAM trước, ổ cứng sau. Có chữ SSD/NVMe/HDD → chắc là ổ.
  const capacityRe =
    /\b(\d+(?:[.,]\d+)?)\s*(TB|T|GB|G)?\s*(SSD|NVMe|HDD|eMMC|RAM)?\b/gi;
  const capacities: Array<{ value: string; kind: "ram" | "ssd" | "unknown" }> = [];
  let m: RegExpExecArray | null;
  while ((m = capacityRe.exec(text)) !== null) {
    const num = m[1].replace(",", ".");
    const unitRaw = (m[2] ?? "GB").toUpperCase();
    const unit = unitRaw.startsWith("T") ? "TB" : "GB";
    const tag = (m[3] ?? "").toUpperCase();
    // Bỏ qua số model CPU đã bắt (vd. 12500 trong i5-12500H) — chỉ nhận khi có đơn vị
    if (!m[2] && !m[3]) continue;
    const value = `${num}${unit}`;
    if (tag === "RAM") capacities.push({ value, kind: "ram" });
    else if (tag === "SSD" || tag === "NVME" || tag === "HDD" || tag === "EMMC") {
      capacities.push({ value, kind: "ssd" });
    } else if (unit === "TB") {
      capacities.push({ value, kind: "ssd" });
    } else {
      capacities.push({ value, kind: "unknown" });
    }
  }
  let ram: string | null = capacities.find((c) => c.kind === "ram")?.value ?? null;
  let ssd: string | null = capacities.find((c) => c.kind === "ssd")?.value ?? null;
  const unknowns = capacities.filter((c) => c.kind === "unknown").map((c) => c.value);
  if (!ram && unknowns.length > 0) ram = unknowns[0] ?? null;
  if (!ssd && unknowns.length > 1) ssd = unknowns[1] ?? null;
  // Một số tên ghi "256SSD" không có GB
  if (!ssd) {
    const bareSsd = text.match(/\b(\d{2,4})\s*SSD\b/i);
    if (bareSsd) ssd = `${bareSsd[1]}GB`;
  }

  // VGA: RTX 4050, GTX 1650, MX450, Iris Xe, Radeon XXX
  const vgaMatch =
    text.match(/\b((?:rtx|gtx|mx)\s*-?\s*\d{3,4}\s*(?:ti|super)?)\b/i) ??
    text.match(/\b(iris\s*xe|uhd\s*graphics|radeon\s+\w[\w\s-]{0,20})\b/i);
  const vga = vgaMatch
    ? compactToken(vgaMatch[1].replace(/\s+/g, "").toUpperCase().replace("IRISXE", "Iris Xe"))
    : null;

  const parts = [
    cpu ?? fromSpecs[0] ?? null,
    ram ?? fromSpecs[1] ?? null,
    ssd ?? fromSpecs[2] ?? null,
    vga ?? fromSpecs[3] ?? null,
  ].filter((p): p is string => Boolean(p));

  return parts.length > 0 ? parts.join("/") : DEFAULT_VARIANT_NAME;
}

/**
 * Chuẩn hoá tên/slug sản phẩm thành tiền tố SKU.
 * "Balo Targus 15.6 inch" → "balo-targus-15-6-inch"
 */
export function buildSkuBase(productName: string, productSlug: string): string {
  const raw = (productSlug || productName || "").trim();
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Trả về SKU duy nhất dựa trên tiền tố, tự tăng hậu tố nếu đã tồn tại.
 * `taken` được so khớp không phân biệt hoa/thường.
 */
export function nextUniqueSku(base: string, taken: Iterable<string>): string {
  const used = new Set<string>();
  for (const sku of taken) {
    const value = sku.trim().toUpperCase();
    if (value) used.add(value);
  }

  const root = (base || "sku").toUpperCase().slice(0, MAX_SKU_LENGTH - SKU_SUFFIX_RESERVE);
  if (!used.has(root)) return root;

  let index = 2;
  for (;;) {
    const candidate = `${root}-${index}`;
    if (!used.has(candidate)) return candidate;
    index += 1;
    if (index > 9999) return `${root}-${Date.now().toString().slice(-5)}`;
  }
}

/**
 * Suy ra giá trị mặc định cho ô nhập biến thể mới.
 */
export function deriveVariantDraft(source: VariantDraftSource): VariantDraft {
  const { productName, productSlug, quickPrice, quickStock, existingVariants, specs } =
    source;

  const base = buildSkuBase(productName, productSlug);
  const sku = nextUniqueSku(base, existingVariants.map((v) => v.sku));

  const last = existingVariants[existingVariants.length - 1];
  const index = existingVariants.length + 1;

  const sellingPrice = last
    ? Number(last.selling_price) || 0
    : typeof quickPrice === "number" && quickPrice > 0
      ? quickPrice
      : 0;

  const costPrice = last ? Number(last.cost_price) || 0 : 0;

  const initialStock = last
    ? Number(last.initial_stock) || 0
    : typeof quickStock === "number" && quickStock >= 0
      ? quickStock
      : 0;

  // Biến thể đầu: rút gọn từ tên SP / specs → CPU/RAM/SSD/VGA.
  // Biến thể sau: kế thừa tên trước (chỉ sửa phần khác).
  const compact = buildCompactConfigName(productName, specs);
  const lastName = (last?.name ?? "").trim();
  const name =
    index === 1
      ? compact
      : lastName && lastName !== DEFAULT_VARIANT_NAME
        ? lastName
        : compact !== DEFAULT_VARIANT_NAME
          ? compact
          : `${DEFAULT_VARIANT_NAME} ${index}`;

  return { sku, name, sellingPrice, costPrice, initialStock };
}

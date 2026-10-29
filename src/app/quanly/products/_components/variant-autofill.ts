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
};

/** Validator server giới hạn SKU tối đa 100 ký tự. */
export const MAX_SKU_LENGTH = 100;

/** Chừa chỗ cho hậu tố `-2`..`-999` khi tự sinh SKU. */
const SKU_SUFFIX_RESERVE = 4;

export const DEFAULT_VARIANT_NAME = "Mặc định";

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
  const { productName, productSlug, quickPrice, quickStock, existingVariants } = source;

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

  // Kế thừa tên của biến thể trước để người dùng chỉ sửa phần khác nhau.
  // Nếu biến thể trước vẫn dùng tên mặc định thì thêm số thứ tự cho dễ phân biệt.
  const lastName = (last?.name ?? "").trim();
  const name =
    index === 1
      ? DEFAULT_VARIANT_NAME
      : lastName && lastName !== DEFAULT_VARIANT_NAME
        ? lastName
        : `${DEFAULT_VARIANT_NAME} ${index}`;

  return { sku, name, sellingPrice, costPrice, initialStock };
}

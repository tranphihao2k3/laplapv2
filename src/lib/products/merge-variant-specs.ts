/**
 * Gom dữ liệu từ product_variants về mức product.
 *
 * Specs lưu ở product_variants.specs (jsonb) và một product có thể nhiều variant,
 * nên mọi chỗ hiển thị đều phải merge lại. Logic này trước đây viết inline trong
 * src/app/api/public/products/route.ts — tách ra để trang /so-sanh dùng chung,
 * tránh lệch hành vi giữa danh sách sản phẩm và bảng so sánh.
 */

export type VariantForMerge = {
  id: string;
  product_id: string | null;
  selling_price: number | null;
  specs: Record<string, unknown> | null;
  weight?: number | null;
  is_active: boolean | null;
};

export type MergedVariantData = {
  /** Giá thấp nhất trong các variant active. Chưa có giá → không có key này. */
  minPrice: Map<string, number>;
  /** Specs đã merge: với mỗi key, lấy giá trị non-empty ĐẦU TIÊN gặp được. */
  specs: Map<string, Record<string, string>>;
  /** Trọng lượng từ cột weight của variant đầu tiên có giá trị. */
  weight: Map<string, number>;
  /** ID của variant active đầu tiên — dùng để add-to-cart trực tiếp từ product listing. */
  firstActiveVariantId: Map<string, string>;
};

/**
 * Merge variants theo product_id. Chỉ tính các variant active (is_active !== false).
 *
 * Lưu ý về thứ tự: hàm giữ nguyên quy tắc cũ "key nào đã có thì không ghi đè"
 * (`!merged[k]`), nên kết quả phụ thuộc thứ tự variant do caller truyền vào.
 */
export function mergeVariants(variants: VariantForMerge[]): MergedVariantData {
  const minPrice = new Map<string, number>();
  const specs = new Map<string, Record<string, string>>();
  const weight = new Map<string, number>();
  const firstActiveVariantId = new Map<string, string>();

  for (const v of variants) {
    if (!v.product_id || v.is_active === false) continue;

    // Ghi nhận variant active đầu tiên
    if (!firstActiveVariantId.has(v.product_id)) {
      firstActiveVariantId.set(v.product_id, v.id);
    }

    if (v.selling_price != null) {
      const cur = minPrice.get(v.product_id);
      if (cur == null || v.selling_price < cur) minPrice.set(v.product_id, v.selling_price);
    }

    if (v.weight != null && v.weight > 0 && !weight.has(v.product_id)) {
      weight.set(v.product_id, v.weight);
    }

    if (v.specs && typeof v.specs === "object") {
      const merged = specs.get(v.product_id) ?? {};
      for (const [k, val] of Object.entries(v.specs)) {
        if (typeof val === "string" && val.trim() && !merged[k]) merged[k] = val.trim();
      }
      specs.set(v.product_id, merged);
    }
  }

  return { minPrice, specs, weight, firstActiveVariantId };
}

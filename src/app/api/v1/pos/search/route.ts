import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { extractQuickSpecs, mergeSpecSources, type QuickSpec } from "@/lib/products/quick-specs";

type VariantRow = {
  id: string;
  product_id: string | null;
  sku: string | null;
  barcode: string | null;
  name: string | null;
  selling_price: number | null;
  is_active: boolean | null;
  specs: Record<string, unknown> | null;
  attributes: Record<string, unknown> | null;
};

type ProductRow = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  status: string | null;
};

type StockRow = {
  product_variant_id: string | null;
  available_qty: number | null;
};

/** Một biến thể (variant) trong kết quả tìm kiếm POS. */
export type PosHit = {
  variant_id: string;
  product_id: string | null;
  display_name: string;
  product_name: string | null;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  thumbnail_url: string | null;
  selling_price: number;
  stock: number;
  /** Cấu hình nhanh (CPU / RAM / SSD / VGA / Màn hình) của riêng variant này. */
  specs: QuickSpec[];
  /** Số biến thể active của product chứa variant này (>= 2 → thu ngân cần chọn). */
  variant_count: number;
  /** true nếu variant này khớp từ khoá tìm kiếm (dùng để sắp xếp ưu tiên). */
  matched: boolean;
};

/** Gom các variant của cùng 1 product thành 1 nhóm để hiển thị trên mobile. */
export type PosGroup = {
  product_id: string | null;
  product_name: string | null;
  thumbnail_url: string | null;
  /** Tổng số biến thể active của product. */
  variant_count: number;
  /** Giá thấp nhất trong các variant (0 = chưa có giá). */
  min_price: number;
  /** Giá cao nhất trong các variant (0 = chưa có giá). */
  max_price: number;
  /** Tồn kho cộng dồn của product tại cửa hàng đang chọn. */
  total_stock: number;
  /** Các biến thể của product (đã sắp xếp: khớp từ khoá → còn hàng → giá). */
  variants: PosHit[];
};

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;
    const term = (sp.get("search") ?? "").trim().replace(/[%_]/g, "");
    const shopId = (sp.get("shop_id") ?? "").trim();
    const limit = Math.min(50, Math.max(1, Number(sp.get("limit") ?? 12)));

    // Kho thuộc cửa hàng đang chọn → tồn POS chỉ tính trong các kho này
    let shopWarehouseIds: string[] | null = null;
    if (shopId) {
      const { data: warehouses, error: wErr } = await supabase
        .from("warehouses")
        .select("id")
        .eq("shop_id", shopId)
        .eq("is_active", true);
      if (wErr) throw wErr;
      const warehouseRows = (warehouses ?? []) as Array<{ id: string }>;
      shopWarehouseIds = warehouseRows.map((w) => w.id);
    }

    // 1) Tìm products khớp search → lấy product_ids
    //    Không có từ khoá → lấy SP mới nhất (để POS hiện gợi ý nhanh).
    let productIds: string[] = [];
    let productMap = new Map<string, ProductRow>();
    /** Giữ thứ tự product mới → cũ khi browse (không search). */
    let browseOrderIds: string[] = [];
    if (term) {
      const { data: products, error } = await supabase
        .from("products")
        .select("id,name,thumbnail_url,status")
        .or(`name.ilike.%${term}%,slug.ilike.%${term}%`)
        .limit(limit);
      if (error) throw error;
      const rows = (products ?? []) as ProductRow[];
      productIds = rows.map((p) => p.id);
      productMap = new Map(rows.map((p) => [p.id, p]));
    } else {
      const { data: products, error } = await supabase
        .from("products")
        .select("id,name,thumbnail_url,status,created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (products ?? []) as ProductRow[];
      productIds = rows.map((p) => p.id);
      browseOrderIds = productIds.slice();
      productMap = new Map(rows.map((p) => [p.id, p]));
    }

    // 2) Query variants — vừa khớp trực tiếp (sku/barcode/name) vừa nằm trong productIds
    let matchedRows: VariantRow[] = [];
    if (term) {
      let q = supabase
        .from("product_variants")
        .select("id,product_id,sku,barcode,name,selling_price,is_active,specs,attributes")
        .eq("is_active", true)
        .limit(limit);
      const orParts: string[] = [
        `sku.ilike.%${term}%`,
        `barcode.ilike.%${term}%`,
        `name.ilike.%${term}%`,
      ];
      if (productIds.length > 0) {
        orParts.push(`product_id.in.(${productIds.join(",")})`);
      }
      q = q.or(orParts.join(","));
      const { data: variants, error: vErr } = await q;
      if (vErr) throw vErr;
      matchedRows = (variants ?? []) as VariantRow[];
    } else if (productIds.length > 0) {
      // Browse: lấy toàn bộ variant của N SP mới nhất
      const { data: variants, error: vErr } = await supabase
        .from("product_variants")
        .select("id,product_id,sku,barcode,name,selling_price,is_active,specs,attributes")
        .in("product_id", productIds)
        .eq("is_active", true);
      if (vErr) throw vErr;
      matchedRows = (variants ?? []) as VariantRow[];
    }
    const matchedIds = new Set(matchedRows.map((v) => v.id));

    // 3) Lấy thông tin product cho các variant chưa có trong productMap
    const missingProductIds = [
      ...new Set(
        matchedRows
          .map((v) => v.product_id)
          .filter((id): id is string => Boolean(id) && !productMap.has(id!)),
      ),
    ];
    if (missingProductIds.length > 0) {
      const { data: extraProducts, error: pErr } = await supabase
        .from("products")
        .select("id,name,thumbnail_url,status")
        .in("id", missingProductIds);
      if (pErr) throw pErr;
      for (const p of (extraProducts ?? []) as ProductRow[]) productMap.set(p.id, p);
    }

    // 4) Gộp thêm các variant "anh em" của product đã khớp — để thu ngân thấy ĐỦ
    //    các phiên bản (vd "Dell Inspiron" có 2 biến thể → hiện đủ 2 để chọn).
    const matchedProductIds = [
      ...new Set(matchedRows.map((v) => v.product_id).filter((id): id is string => Boolean(id))),
    ];
    let siblingRows: VariantRow[] = [];
    if (matchedProductIds.length > 0) {
      const { data: siblings, error: sibErr } = await supabase
        .from("product_variants")
        .select("id,product_id,sku,barcode,name,selling_price,is_active,specs,attributes")
        .in("product_id", matchedProductIds)
        .eq("is_active", true);
      if (sibErr) throw sibErr;
      siblingRows = (siblings ?? []) as VariantRow[];
    }

    // Không trùng lặp: variant khớp search được ưu tiên giữ bản đầy đủ nhất.
    const allRows: VariantRow[] = [
      ...matchedRows,
      ...siblingRows.filter((s) => !matchedIds.has(s.id)),
    ];

    // 5) Lấy tồn kho cho các variant — chỉ trong kho của cửa hàng đang chọn (nếu có shop_id)
    const variantIds = allRows.map((v) => v.id);
    const stockByVariant = new Map<string, number>();
    // Nếu đã chọn cửa hàng nhưng cửa hàng đó không có kho nào → tồn = 0 cho tất cả
    const skipStockQuery = shopWarehouseIds !== null && shopWarehouseIds.length === 0;
    if (variantIds.length > 0 && !skipStockQuery) {
      let stockQuery = supabase
        .from("stock_levels")
        .select("product_variant_id,available_qty")
        .in("product_variant_id", variantIds);
      if (shopWarehouseIds !== null) {
        stockQuery = stockQuery.in("warehouse_id", shopWarehouseIds);
      }
      const { data: stocks, error: sErr } = await stockQuery;
      if (sErr) throw sErr;
      for (const s of (stocks ?? []) as StockRow[]) {
        if (!s.product_variant_id) continue;
        stockByVariant.set(
          s.product_variant_id,
          (stockByVariant.get(s.product_variant_id) ?? 0) + (s.available_qty ?? 0),
        );
      }
    }

    // 6) Đếm số biến thể active của từng product
    const productIdsOfVariants = [
      ...new Set(allRows.map((v) => v.product_id).filter((id): id is string => Boolean(id))),
    ];
    const variantCountByProduct = new Map<string, number>();
    if (productIdsOfVariants.length > 0) {
      const { data: countRows, error: cErr } = await supabase
        .from("product_variants")
        .select("product_id")
        .in("product_id", productIdsOfVariants)
        .eq("is_active", true);
      if (cErr) throw cErr;
      for (const row of (countRows ?? []) as Array<{ product_id: string | null }>) {
        if (!row.product_id) continue;
        variantCountByProduct.set(
          row.product_id,
          (variantCountByProduct.get(row.product_id) ?? 0) + 1,
        );
      }
    }

    const toHit = (v: VariantRow): PosHit => {
      const product = v.product_id ? productMap.get(v.product_id) ?? null : null;
      const productName = product?.name ?? null;
      const variantName = v.name;
      const displayName =
        [productName, variantName].filter(Boolean).join(" — ") || v.sku || "Sản phẩm";
      return {
        variant_id: v.id,
        product_id: v.product_id,
        display_name: displayName,
        product_name: productName,
        variant_name: variantName,
        sku: v.sku,
        barcode: v.barcode,
        thumbnail_url: product?.thumbnail_url ?? null,
        selling_price: Number(v.selling_price ?? 0),
        stock: stockByVariant.get(v.id) ?? 0,
        specs: extractQuickSpecs(mergeSpecSources(v.specs, v.attributes)),
        variant_count: v.product_id ? (variantCountByProduct.get(v.product_id) ?? 1) : 1,
        matched: matchedIds.has(v.id),
      };
    };

    const items: PosHit[] = allRows.map(toHit);

    // 7) Gom theo product — 1 product = 1 nhóm trong dropdown.
    const groups = new Map<string, PosGroup>();
    for (const hit of items) {
      const key = hit.product_id ?? `__variant__${hit.variant_id}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          product_id: hit.product_id,
          product_name: hit.product_name,
          thumbnail_url: hit.thumbnail_url,
          variant_count: hit.variant_count,
          min_price: hit.selling_price,
          max_price: hit.selling_price,
          total_stock: hit.stock,
          variants: [hit],
        });
        continue;
      }
      existing.variants.push(hit);
      if (hit.selling_price > 0) {
        existing.min_price =
          existing.min_price > 0 ? Math.min(existing.min_price, hit.selling_price) : hit.selling_price;
        existing.max_price = Math.max(existing.max_price, hit.selling_price);
      }
      existing.total_stock += hit.stock;
    }

    const groupList = [...groups.values()];
    for (const g of groupList) {
      // Trong nhóm: khớp từ khoá trước, rồi variant còn hàng, rồi giá tăng dần.
      g.variants.sort((a, b) => {
        if (a.matched !== b.matched) return a.matched ? -1 : 1;
        const aOut = a.stock <= 0 ? 1 : 0;
        const bOut = b.stock <= 0 ? 1 : 0;
        if (aOut !== bOut) return aOut - bOut;
        return a.selling_price - b.selling_price;
      });
    }

    if (browseOrderIds.length > 0) {
      // Browse (không search): giữ thứ tự SP mới nhất.
      const order = new Map(browseOrderIds.map((id, i) => [id, i]));
      groupList.sort((a, b) => {
        const ai = a.product_id != null ? (order.get(a.product_id) ?? 9999) : 9999;
        const bi = b.product_id != null ? (order.get(b.product_id) ?? 9999) : 9999;
        if (ai !== bi) return ai - bi;
        return 0;
      });
    } else {
      // Ưu tiên sản phẩm CÒN tồn kho lên đầu, hết hàng (tồn = 0) xuống cuối.
      groupList.sort((a, b) => {
        const aOut = a.total_stock <= 0 ? 1 : 0;
        const bOut = b.total_stock <= 0 ? 1 : 0;
        if (aOut !== bOut) return aOut - bOut;
        const aName = a.product_name ?? a.variants[0]?.display_name ?? "";
        const bName = b.product_name ?? b.variants[0]?.display_name ?? "";
        return aName.localeCompare(bName, "vi");
      });
    }

    return ok({ items, groups: groupList, total: items.length });
  } catch (e) {
    return handleError(e);
  }
}

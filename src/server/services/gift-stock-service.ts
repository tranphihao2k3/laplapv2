/**
 * Trừ tồn kho quà tặng kèm khi bán sản phẩm chính (sau checkout_order).
 * Quà = product_gifts → lấy variant mặc định của từng gift product → trừ stock tại kho shop.
 */
import type { DB } from "@/lib/api/guard";

type SoldLine = {
  product_variant_id: string;
  quantity: number;
};

export type GiftDeductResult = {
  gift_variant_id: string;
  gift_name: string;
  quantity: number;
  warehouse_id: string;
};

export const giftStockService = {
  /**
   * Trừ tồn quà theo các dòng vừa bán.
   * Không throw cứng nếu thiếu tồn — ghi còn lại về 0 và trả warning trong result.
   */
  async deductForSoldItems(
    db: DB,
    args: {
      shopId: string;
      orderId: string;
      userId: string;
      orgId: string;
      items: SoldLine[];
    },
  ): Promise<{ deducted: GiftDeductResult[]; warnings: string[] }> {
    const { shopId, orderId, userId, orgId, items } = args;
    const warnings: string[] = [];
    const deducted: GiftDeductResult[] = [];

    if (!items.length) return { deducted, warnings };

    const soldVariantIds = [...new Set(items.map((i) => i.product_variant_id))];
    const { data: variants, error: vErr } = await db
      .from("product_variants")
      .select("id, product_id")
      .in("id", soldVariantIds);
    if (vErr) throw vErr;

    const qtyByProduct = new Map<string, number>();
    const productByVariant = new Map<string, string>();
    for (const v of variants ?? []) {
      if (!v.product_id) continue;
      productByVariant.set(v.id as string, v.product_id as string);
    }
    for (const line of items) {
      const productId = productByVariant.get(line.product_variant_id);
      if (!productId) continue;
      qtyByProduct.set(productId, (qtyByProduct.get(productId) ?? 0) + line.quantity);
    }
    if (qtyByProduct.size === 0) return { deducted, warnings };

    const productIds = [...qtyByProduct.keys()];
    const { data: links, error: linkErr } = await db
      .from("product_gifts")
      .select("product_id, gift_product_id")
      .in("product_id", productIds);
    if (linkErr) throw linkErr;
    if (!links?.length) return { deducted, warnings };

    // Tổng số quà cần trừ theo gift_product_id
    const giftNeed = new Map<string, number>();
    for (const link of links) {
      const soldQty = qtyByProduct.get(link.product_id as string) ?? 0;
      if (soldQty <= 0) continue;
      const gid = link.gift_product_id as string;
      giftNeed.set(gid, (giftNeed.get(gid) ?? 0) + soldQty);
    }
    if (giftNeed.size === 0) return { deducted, warnings };

    const giftProductIds = [...giftNeed.keys()];
    const { data: giftProducts, error: gpErr } = await db
      .from("products")
      .select("id, name")
      .in("id", giftProductIds);
    if (gpErr) throw gpErr;
    const giftNameById = new Map(
      (giftProducts ?? []).map((p: { id: string; name: string | null }) => [
        p.id,
        p.name ?? "Quà tặng",
      ]),
    );

    const { data: giftVariants, error: gvErr } = await db
      .from("product_variants")
      .select("id, product_id")
      .in("product_id", giftProductIds)
      .eq("is_active", true);
    if (gvErr) throw gvErr;

    // 1 gift product → 1 variant đầu tiên
    const variantByGiftProduct = new Map<string, string>();
    for (const gv of giftVariants ?? []) {
      const pid = gv.product_id as string;
      if (!variantByGiftProduct.has(pid)) {
        variantByGiftProduct.set(pid, gv.id as string);
      }
    }

    const { data: warehouses, error: whErr } = await db
      .from("warehouses")
      .select("id")
      .eq("shop_id", shopId)
      .eq("is_active", true);
    if (whErr) throw whErr;
    const warehouseIds = (warehouses ?? []).map((w: { id: string }) => w.id);
    if (warehouseIds.length === 0) {
      warnings.push("Không có kho để trừ tồn quà tặng");
      return { deducted, warnings };
    }
    const primaryWarehouseId = warehouseIds[0] as string;

    for (const [giftProductId, needQty] of giftNeed) {
      const giftVariantId = variantByGiftProduct.get(giftProductId);
      const giftName = giftNameById.get(giftProductId) ?? "Quà tặng";
      if (!giftVariantId) {
        warnings.push(`Quà "${giftName}" chưa có biến thể — bỏ qua trừ tồn`);
        continue;
      }

      const { data: stocks, error: stErr } = await db
        .from("stock_levels")
        .select("warehouse_id, available_qty")
        .eq("product_variant_id", giftVariantId)
        .in("warehouse_id", warehouseIds);
      if (stErr) throw stErr;

      let remaining = needQty;
      const rows = (stocks ?? []) as Array<{ warehouse_id: string; available_qty: number | null }>;
      // Ưu tiên kho chính (đầu list), rồi các kho khác
      rows.sort((a, b) => {
        if (a.warehouse_id === primaryWarehouseId) return -1;
        if (b.warehouse_id === primaryWarehouseId) return 1;
        return 0;
      });

      for (const row of rows) {
        if (remaining <= 0) break;
        const have = Number(row.available_qty ?? 0);
        if (have <= 0) continue;
        const take = Math.min(have, remaining);
        const next = have - take;
        const { error: updErr } = await db
          .from("stock_levels")
          .update({ available_qty: next })
          .eq("warehouse_id", row.warehouse_id)
          .eq("product_variant_id", giftVariantId);
        if (updErr) throw updErr;

        await db.from("inventory_transactions").insert({
          organization_id: orgId,
          warehouse_id: row.warehouse_id,
          product_variant_id: giftVariantId,
          type: "sale",
          quantity: -take,
          unit_cost: 0,
          reference_type: "order",
          reference_id: orderId,
          note: `Trừ quà tặng kèm: ${giftName}`,
          created_by: userId,
        });

        deducted.push({
          gift_variant_id: giftVariantId,
          gift_name: giftName,
          quantity: take,
          warehouse_id: row.warehouse_id,
        });
        remaining -= take;
      }

      if (remaining > 0) {
        // Chưa có dòng stock → tạo 0 rồi cảnh báo
        if (rows.length === 0) {
          await db.from("stock_levels").upsert(
            {
              warehouse_id: primaryWarehouseId,
              product_variant_id: giftVariantId,
              available_qty: 0,
            },
            { onConflict: "warehouse_id,product_variant_id" },
          );
        }
        warnings.push(
          `Thiếu tồn quà "${giftName}": cần ${needQty}, còn thiếu ${remaining}`,
        );
      }
    }

    return { deducted, warnings };
  },
};

/**
 * Đảm bảo 4 SP quà combo tồn tại + có variant + tồn kho đủ để trừ khi bán.
 */
import type { DB } from "@/lib/api/guard";
import {
  COMBO_GIFT_PRODUCTS,
  DEFAULT_COMBO_GIFT_STOCK,
  scoreGiftName,
} from "@/lib/products/combo-gifts";

export type EnsuredGift = {
  name: string;
  product_id: string;
  variant_id: string;
  created: boolean;
  stock_set: number;
};

async function findOrgShopAndWarehouse(db: DB, orgId: string) {
  const { data: shop, error: shopErr } = await db
    .from("shops")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (shopErr) throw shopErr;
  if (!shop?.id) throw Object.assign(new Error("Chưa có cửa hàng"), { status: 400 });

  const { data: wh, error: whErr } = await db
    .from("warehouses")
    .select("id, name")
    .eq("shop_id", shop.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (whErr) throw whErr;
  if (!wh?.id) throw Object.assign(new Error("Cửa hàng chưa có kho"), { status: 400 });

  return { shopId: shop.id as string, warehouseId: wh.id as string };
}

async function findExistingProduct(
  db: DB,
  orgId: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await db
    .from("products")
    .select("id, name")
    .eq("organization_id", orgId)
    .ilike("name", `%${name}%`)
    .limit(30);
  if (error) throw error;
  let best: { id: string; name: string } | null = null;
  let bestScore = 0;
  for (const p of data ?? []) {
    const s = scoreGiftName(String(p.name ?? ""), name);
    if (s > bestScore) {
      bestScore = s;
      best = { id: p.id as string, name: String(p.name) };
    }
  }
  return bestScore >= 70 ? best : null;
}

async function ensureVariant(db: DB, productId: string, sku: string): Promise<string> {
  const { data: existing, error } = await db
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (existing?.id) return existing.id as string;

  const { data: created, error: createErr } = await db
    .from("product_variants")
    .insert({
      product_id: productId,
      sku,
      name: "Mặc định",
      selling_price: 0,
      cost_price: 0,
      is_active: true,
    })
    .select("id")
    .single();
  if (createErr) throw createErr;
  return created.id as string;
}

export const comboGiftsService = {
  async ensure(
    db: DB,
    orgId: string,
    stockQty: number = DEFAULT_COMBO_GIFT_STOCK,
  ): Promise<{ items: EnsuredGift[]; warehouse_id: string }> {
    const { warehouseId } = await findOrgShopAndWarehouse(db, orgId);
    const items: EnsuredGift[] = [];

    for (const gift of COMBO_GIFT_PRODUCTS) {
      let created = false;
      let product = await findExistingProduct(db, orgId, gift.name);

      if (!product) {
        const { data: inserted, error: insErr } = await db
          .from("products")
          .insert({
            organization_id: orgId,
            name: gift.name,
            slug: gift.slug,
            status: "active",
            short_description: `Quà tặng kèm — ${gift.name}`,
            tags: ["qua-tang", "combo"],
          })
          .select("id, name")
          .single();
        if (insErr) {
          // slug trùng → tìm lại theo slug
          const { data: bySlug } = await db
            .from("products")
            .select("id, name")
            .eq("organization_id", orgId)
            .eq("slug", gift.slug)
            .maybeSingle();
          if (!bySlug) throw insErr;
          product = { id: bySlug.id as string, name: String(bySlug.name) };
        } else {
          product = { id: inserted.id as string, name: String(inserted.name) };
          created = true;
        }
      }

      const variantId = await ensureVariant(db, product.id, `GIFT-${gift.slug.toUpperCase()}`);

      const { error: stockErr } = await db.from("stock_levels").upsert(
        {
          warehouse_id: warehouseId,
          product_variant_id: variantId,
          available_qty: stockQty,
        },
        { onConflict: "warehouse_id,product_variant_id" },
      );
      if (stockErr) throw stockErr;

      items.push({
        name: gift.name,
        product_id: product.id,
        variant_id: variantId,
        created,
        stock_set: stockQty,
      });
    }

    return { items, warehouse_id: warehouseId };
  },
};

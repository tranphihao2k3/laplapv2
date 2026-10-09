/**
 * API: GET /api/pc-builder/components/[slot]
 *
 * Trả về danh sách linh kiện (kèm spec) cho 1 slot trong PC Builder.
 *
 * Lý do cần API route này (thay vì cho client gọi thẳng Supabase):
 *  - Bảng `products` / `pc_components_specs` không cấp quyền SELECT cho anon trong
 *    RLS — gọi trực tiếp từ `createClient()` (browser) trả về [] rỗng, picker hiện
 *    "Chưa có sản phẩm nào trong danh mục này" dù DB đã seed sẵn dữ liệu.
 *  - Dùng `createAdminClient()` (server-only) để bypass RLS — chỉ dùng cho dữ liệu
 *    catalog public, không lộ secret ra client.
 *  - Match pattern đang dùng cho `/api/public/products`.
 *
 * Query params (optional):
 *   - `q`: search theo tên/brand.
 *   - `limit`: mặc định 60, tối đa 200.
 *
 * Response:
 *   { items: ComponentWithSpec[], total: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ComponentSpecSummary, ComponentWithSpec, SlotKey } from "@/lib/pc-builder/types";

type ProductRow = {
  id: string;
  name: string;
  slug: string | null;
  thumbnail_url: string | null;
  status: string | null;
  brand_id: string | null;
  category_id: string | null;
};

type SpecRow = {
  product_id: string;
  category_slug: string;
  socket: string | null;
  ram_type: string | null;
  form_factor: string | null;
  tdp_w: number | null;
  length_mm: number | null;
  wattage_w: number | null;
  storage_interface: string | null;
  extras: unknown;
};

const SLOT_KEYS: readonly SlotKey[] = [
  "cpu",
  "mainboard",
  "ram",
  "gpu",
  "ssd",
  "hdd",
  "psu",
  "case",
  "cooler",
  "monitor",
  "keyboard",
  "mouse",
  "headset",
] as const;

function isValidSlot(s: string): s is SlotKey {
  return (SLOT_KEYS as readonly string[]).includes(s);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slot: string }> },
) {
  const { slot } = await ctx.params;

  if (!slot || !isValidSlot(slot)) {
    return NextResponse.json(
      { error: "INVALID_SLOT", message: `Slot không hợp lệ: ${slot}` },
      { status: 400 },
    );
  }

  const sp = _req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 60) || 60));

  try {
    const supabase = createAdminClient();

    // 1) Tìm category theo slug (slot = slug). Lấy luôn id để filter products.
    const { data: catData, error: catErr } = await supabase
      .from("categories")
      .select("id, slug")
      .eq("slug", slot)
      .maybeSingle();
    if (catErr) {
      // eslint-disable-next-line no-console
      console.warn("[pc-builder] category lookup error", catErr.message);
      return NextResponse.json({ items: [], total: 0 });
    }
    if (!catData) {
      return NextResponse.json({ items: [], total: 0 });
    }
    const categoryId = (catData as { id: string }).id;

    // 2) Lấy product active trong category.
    // Lưu ý: một số seed cũ dùng 'published' thay vì 'active' — match cả 2 để
    // tương thích ngược với dữ liệu đã có sẵn.
    let pq = supabase
      .from("products")
      .select("id, name, slug, thumbnail_url, status, brand_id, category_id")
      .eq("category_id", categoryId)
      .in("status", ["active", "published"])
      .order("name", { ascending: true })
      .limit(limit);
    if (q) pq = pq.ilike("name", `%${q}%`);

    const { data: prodData, error: prodErr } = await pq;
    if (prodErr) {
      // eslint-disable-next-line no-console
      console.warn("[pc-builder] products lookup error", prodErr.message);
      return NextResponse.json({ items: [], total: 0 });
    }
    const products = (prodData ?? []) as ProductRow[];
    if (products.length === 0) {
      return NextResponse.json({ items: [], total: 0 });
    }

    // 3) Lấy spec cho các product.
    const productIds = products.map((p) => p.id);
    const { data: specData, error: specErr } = await supabase
      .from("pc_components_specs")
      .select(
        "product_id, category_slug, socket, ram_type, form_factor, tdp_w, length_mm, wattage_w, storage_interface, extras",
      )
      .in("product_id", productIds);
    if (specErr) {
      // eslint-disable-next-line no-console
      console.warn("[pc-builder] specs lookup error", specErr.message);
    }
    const specsByProduct = new Map<string, SpecRow>();
    for (const s of (specData ?? []) as SpecRow[]) {
      specsByProduct.set(s.product_id, s);
    }

    // 4) Brand name (best-effort).
    const brandIds = Array.from(
      new Set(products.map((p) => p.brand_id).filter((x): x is string => !!x)),
    );
    const brandMap = new Map<string, string>();
    if (brandIds.length > 0) {
      const { data: brandData } = await supabase
        .from("brands")
        .select("id, name")
        .in("id", brandIds);
      for (const b of (brandData ?? []) as Array<{ id: string; name: string }>) {
        brandMap.set(b.id, b.name);
      }
    }

    // 5) Min price từ product_variants.
    const priceMap = new Map<string, number>();
    {
      const { data: varData } = await supabase
        .from("product_variants")
        .select("product_id, selling_price, is_active")
        .in("product_id", productIds)
        .eq("is_active", true);
      for (const v of (varData ?? []) as Array<{
        product_id: string | null;
        selling_price: number | null;
      }>) {
        if (!v.product_id || v.selling_price == null) continue;
        const cur = priceMap.get(v.product_id) ?? Infinity;
        if (v.selling_price < cur) priceMap.set(v.product_id, v.selling_price);
      }
    }

    // 6) Build output.
    const items: ComponentWithSpec[] = products.map((p) => {
      const specRow = specsByProduct.get(p.id);
      const spec: ComponentSpecSummary = {
        productId: p.id,
        categorySlug: slot,
        socket: specRow?.socket ?? null,
        ramType: specRow?.ram_type ?? null,
        formFactor: specRow?.form_factor ?? null,
        tdpW: specRow?.tdp_w ?? null,
        lengthMm: specRow?.length_mm ?? null,
        wattageW: specRow?.wattage_w ?? null,
        storageInterface: specRow?.storage_interface ?? null,
        extras: (specRow?.extras as Record<string, unknown> | null) ?? null,
      };
      return {
        product: {
          id: p.id,
          name: p.name,
          slug: p.slug ?? p.id,
          thumbnail_url: p.thumbnail_url ?? null,
          price: priceMap.get(p.id) ?? 0,
          brand: p.brand_id ? brandMap.get(p.brand_id) ?? null : null,
        },
        spec,
      };
    });

    return NextResponse.json({ items, total: items.length });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[pc-builder] components error", e);
    return NextResponse.json({ items: [], total: 0 });
  }
}

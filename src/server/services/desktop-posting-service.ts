/**
 * Service cho endpoint /api/v1/desktop-posting/products(/:id)
 *
 * Hợp đồng mục tiêu (docs/FB-PUBLISHER-TASKS.md §9):
 *   - list items: id, name, slug, shortDescription, thumbnailUrl, status,
 *     updatedAt, variantsCount, inStock.
 *   - detail: product object đầy đủ + variants[] với SKU, attributes, specs,
 *     sellingPrice, availableQty (tổng các kho), isActive.
 *
 * Nguyên tắc:
 *   - RLS theo organization: mọi query đều có `organization_id` filter.
 *   - Tất cả lỗi PostgREST throw để handleError → không bị nuốt thành 200 rỗng.
 *   - description (HTML) → parse bằng regex an toàn cho tập thẻ phổ biến.
 *   - Không cấp SERVICE_ROLE_KEY cho desktop — token user đi kèm mỗi request.
 */
import { Errors, rangeOf, type Paginated } from "@/lib/api/response";
import { requirePermissionFromRequest } from "@/lib/api/guard";
import type { AuthContext } from "@/lib/api/guard";
import { env } from "@/lib/env";
import type { ProductRow } from "@/types/database";

type AnySupabase = AuthContext["supabase"];

/* ───────────────────── List ───────────────────── */

export type PublishingProduct = {
  id: string;
  name: string;
  slug: string | null;
  shortDescription: string | null;
  thumbnailUrl: string | null;
  status: ProductRow["status"];
  updatedAt: string | null;
  variantsCount: number;
  inStock: boolean;
};

export type PublishingProductsQuery = {
  q?: string;
  page: number;
  pageSize: number;
  updatedSince?: string;
};

type PublishingProductRow = {
  id: string;
  name: string;
  slug: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  status: ProductRow["status"];
  updated_at: string | null;
};

function escapeIlike(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function annotateVariants(
  supabase: AnySupabase,
  productIds: string[],
): Promise<Map<string, { variantsCount: number; inStock: boolean }>> {
  const out = new Map<string, { variantsCount: number; inStock: boolean }>();
  if (productIds.length === 0) return out;

  const { data: variantRows, error: vErr } = (await supabase
    .from("product_variants")
    .select("id, product_id, is_active")
    .in("product_id", productIds)
    .eq("is_active", true)) as {
    data: { id: string; product_id: string | null; is_active: boolean | null }[] | null;
    error: { message?: string } | null;
  };
  if (vErr) throw new Error(`Không đọc được variants: ${vErr.message ?? "unknown"}`);

  const variantIds = (variantRows ?? [])
    .map((v) => v.id)
    .filter((id): id is string => typeof id === "string");

  const counts = new Map<string, number>();
  for (const v of variantRows ?? []) {
    const pid = v.product_id;
    if (!pid) continue;
    counts.set(pid, (counts.get(pid) ?? 0) + 1);
  }

  const anyInStock = new Set<string>();
  if (variantIds.length > 0) {
    const { data: stockRows, error: sErr } = (await supabase
      .from("stock_levels")
      .select("product_variant_id, available_qty")
      .in("product_variant_id", variantIds)) as {
      data: { product_variant_id: string; available_qty: number | null }[] | null;
      error: { message?: string } | null;
    };
    if (sErr) throw new Error(`Không đọc được stock_levels: ${sErr.message ?? "unknown"}`);

    const variantToProduct = new Map<string, string>();
    for (const v of variantRows ?? []) {
      if (v.product_id) variantToProduct.set(v.id, v.product_id);
    }
    for (const s of stockRows ?? []) {
      if ((s.available_qty ?? 0) > 0) {
        const pid = variantToProduct.get(s.product_variant_id);
        if (pid) anyInStock.add(pid);
      }
    }
  }

  for (const pid of productIds) {
    out.set(pid, {
      variantsCount: counts.get(pid) ?? 0,
      inStock: anyInStock.has(pid),
    });
  }
  return out;
}

export async function listPublishingProducts(
  req: Request,
  query: PublishingProductsQuery,
): Promise<Paginated<PublishingProduct>> {
  const ctx = await requirePermissionFromRequest(req, "publisher.use");
  const supabase = ctx.supabase as AnySupabase;

  const { from, to } = rangeOf(query.page, query.pageSize);

  let dbQuery = supabase
    .from("products")
    .select("id, name, slug, short_description, thumbnail_url, status, updated_at")
    .eq("organization_id", ctx.orgId)
    .eq("status", "active")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (query.q && query.q.trim().length > 0) {
    const pat = `%${escapeIlike(query.q.trim())}%`;
    dbQuery = dbQuery.or(`name.ilike.${pat},slug.ilike.${pat}`);
  }
  if (query.updatedSince) {
    dbQuery = dbQuery.gte("updated_at", query.updatedSince);
  }

  const { data: rows, error: pErr } = (await dbQuery) as {
    data: PublishingProductRow[] | null;
    error: { message?: string } | null;
  };
  if (pErr) throw new Error(`Không đọc được products: ${pErr.message ?? "unknown"}`);

  const safeRows = rows ?? [];
  const items: PublishingProduct[] = safeRows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug ?? null,
    shortDescription: r.short_description ?? null,
    thumbnailUrl: r.thumbnail_url ?? null,
    status: r.status,
    updatedAt: r.updated_at ?? null,
    variantsCount: 0,
    inStock: false,
  }));

  const annotations = await annotateVariants(supabase, items.map((i) => i.id));
  for (const item of items) {
    const anno = annotations.get(item.id);
    if (anno) {
      item.variantsCount = anno.variantsCount;
      item.inStock = anno.inStock;
    }
  }

  let totalQuery = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId)
    .eq("status", "active");
  if (query.q && query.q.trim().length > 0) {
    const pat = `%${escapeIlike(query.q.trim())}%`;
    totalQuery = totalQuery.or(`name.ilike.${pat},slug.ilike.${pat}`);
  }
  if (query.updatedSince) {
    totalQuery = totalQuery.gte("updated_at", query.updatedSince);
  }
  const { count, error: cErr } = (await totalQuery) as {
    count: number | null;
    error: { message?: string } | null;
  };
  if (cErr) throw new Error(`Không đếm được products: ${cErr.message ?? "unknown"}`);

  return {
    items,
    total: count ?? items.length,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil((count ?? items.length) / query.pageSize)),
  };
}

/* ───────────────────── Detail ───────────────────── */

export type ProductDetail = {
  product: {
    id: string;
    name: string;
    slug: string | null;
    shortDescription: string | null;
    plainTextDescription: string;
    thumbnailUrl: string | null;
    images: string[];
    productUrl: string;
    updatedAt: string | null;
  };
  variants: {
    id: string;
    sku: string;
    name: string | null;
    attributes: Record<string, unknown> | null;
    specs: Record<string, unknown> | null;
    sellingPrice: number | null;
    availableQty: number;
    isActive: boolean;
  }[];
};

/** Loại bỏ <script>/<style> (kể cả inline) và comment HTML. */
function stripDangerous(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "");
}

function htmlToPlainText(html: string | null): string {
  if (!html) return "";
  const cleaned = stripDangerous(html);
  const withBreaks = cleaned
    .replace(/<\/?(p|div|section|article|header|footer|li|h[1-6]|br)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const decoded = withBreaks
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

async function loadStockByVariant(
  supabase: AnySupabase,
  variantIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (variantIds.length === 0) return out;
  const { data, error } = (await supabase
    .from("stock_levels")
    .select("product_variant_id, available_qty")
    .in("product_variant_id", variantIds)) as {
    data: { product_variant_id: string; available_qty: number | null }[] | null;
    error: { message?: string } | null;
  };
  if (error) throw new Error(`Không đọc được stock_levels: ${error.message ?? "unknown"}`);
  for (const row of data ?? []) {
    out.set(row.product_variant_id, (out.get(row.product_variant_id) ?? 0) + (row.available_qty ?? 0));
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPublishingProductDetail(req: Request, id: string): Promise<ProductDetail> {
  const ctx = await requirePermissionFromRequest(req, "publisher.use");
  const supabase = ctx.supabase as AnySupabase;

  if (!UUID_RE.test(id)) {
    throw Errors.notFound("Sản phẩm");
  }

  const { data: product, error: pErr } = (await supabase
    .from("products")
    .select(
      "id, name, slug, short_description, description, thumbnail_url, images, status, updated_at, organization_id",
    )
    .eq("id", id)
    .eq("organization_id", ctx.orgId)
    .maybeSingle()) as {
    data: {
      id: string;
      name: string;
      slug: string | null;
      short_description: string | null;
      description: string | null;
      thumbnail_url: string | null;
      images: string[] | null;
      status: "draft" | "active" | "archived" | null;
      updated_at: string | null;
      organization_id: string | null;
    } | null;
    error: { message?: string } | null;
  };
  if (pErr) throw new Error(`Không đọc được product: ${pErr.message ?? "unknown"}`);
  if (!product) throw Errors.notFound("Sản phẩm");

  const { data: variantRows, error: vErr } = (await supabase
    .from("product_variants")
    .select("id, sku, name, attributes, specs, selling_price, is_active")
    .eq("product_id", product.id)
    .order("selling_price", { ascending: true, nullsFirst: false })) as {
    data: {
      id: string;
      sku: string;
      name: string | null;
      attributes: Record<string, unknown> | null;
      specs: Record<string, unknown> | null;
      selling_price: number | null;
      is_active: boolean | null;
    }[] | null;
    error: { message?: string } | null;
  };
  if (vErr) throw new Error(`Không đọc được product_variants: ${vErr.message ?? "unknown"}`);

  const stockByVariant = await loadStockByVariant(
    supabase,
    (variantRows ?? []).map((v) => v.id),
  );

  const gallery: string[] = Array.isArray(product.images)
    ? (product.images as unknown[]).filter((u): u is string => typeof u === "string" && u.length > 0)
    : product.thumbnail_url
      ? [product.thumbnail_url]
      : [];

  const productUrl = product.slug ? `${env.NEXT_PUBLIC_APP_URL}/products/${product.slug}` : "";

  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug ?? null,
      shortDescription: product.short_description ?? null,
      plainTextDescription: htmlToPlainText(product.description),
      thumbnailUrl: product.thumbnail_url ?? null,
      images: gallery,
      productUrl,
      updatedAt: product.updated_at ?? null,
    },
    variants: (variantRows ?? []).map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name ?? null,
      attributes: v.attributes ?? null,
      specs: v.specs ?? null,
      sellingPrice: v.selling_price ?? null,
      availableQty: stockByVariant.get(v.id) ?? 0,
      isActive: v.is_active !== false,
    })),
  };
}

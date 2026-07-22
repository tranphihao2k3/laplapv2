import { Errors, paginated, rangeOf, type Paginated } from "@/lib/api/response";
import { requireOrg } from "@/lib/api/guard";
import type { DB } from "@/lib/api/guard";
import type { Database } from "@/types/database";
import type { ListQuery } from "./_crud-factory";

const STORAGE_BUCKET = "product-images";
const STORAGE_PUBLIC_PREFIX = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

function extractStoragePaths(urls: (string | null | undefined)[]): string[] {
  const paths: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    const idx = url.indexOf(STORAGE_PUBLIC_PREFIX);
    if (idx !== -1) {
      paths.push(decodeURIComponent(url.slice(idx + STORAGE_PUBLIC_PREFIX.length)));
    }
  }
  return paths;
}

async function deleteStorageFiles(db: DB, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await (db as unknown as { storage: { from: (b: string) => { remove: (p: string[]) => Promise<unknown> } } })
    .storage.from(STORAGE_BUCKET).remove(paths);
}

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

type ProductGiftRow = {
  product_id: string;
  gift_product_id: string;
};

type GiftProductLite = Pick<ProductRow, "id" | "name" | "slug" | "thumbnail_url" | "status">;

type ProductWithGifts = ProductRow & {
  gift_product_ids: string[];
  gifts: GiftProductLite[];
  variants_count?: number;
};

function parseProductInput(input: ProductInsert | ProductUpdate) {
  const payload = { ...(input as Record<string, unknown>) };
  const rawGiftIds = payload.gift_product_ids;
  delete payload.gift_product_ids;
  const giftProductIds = Array.isArray(rawGiftIds)
    ? rawGiftIds.map(String).filter(Boolean)
    : undefined;
  return {
    payload: payload as ProductInsert | ProductUpdate,
    giftProductIds,
  };
}

async function syncProductGifts(db: DB, productId: string, giftProductIds: string[] | undefined) {
  if (!giftProductIds) return;
  const uniq = [...new Set(giftProductIds)].filter((id) => id !== productId);
  const { error: delErr } = await db.from("product_gifts").delete().eq("product_id", productId);
  if (delErr) throw delErr;
  if (uniq.length === 0) return;
  const rows = uniq.map((giftId) => ({ product_id: productId, gift_product_id: giftId }));
  const { error: insErr } = await db.from("product_gifts").insert(rows);
  if (insErr) throw insErr;
}

async function attachGifts(db: DB, products: ProductRow[]): Promise<ProductWithGifts[]> {
  if (products.length === 0) return [];
  const productIds = products.map((p) => p.id);

  const { data: links, error: linksError } = await db
    .from("product_gifts")
    .select("product_id,gift_product_id")
    .in("product_id", productIds);
  if (linksError) throw linksError;

  const normalizedLinks = ((links ?? []) as ProductGiftRow[]).filter((l) => l.product_id && l.gift_product_id);
  const allGiftIds = [...new Set(normalizedLinks.map((l) => l.gift_product_id))];

  let giftMap = new Map<string, GiftProductLite>();
  if (allGiftIds.length > 0) {
    const { data: gifts, error: giftsError } = await db
      .from("products")
      .select("id,name,slug,thumbnail_url,status")
      .in("id", allGiftIds);
    if (giftsError) throw giftsError;
    giftMap = new Map((gifts ?? []).map((g: GiftProductLite) => [g.id, g]));
  }

  const byProduct = new Map<string, string[]>();
  for (const link of normalizedLinks) {
    if (!byProduct.has(link.product_id)) byProduct.set(link.product_id, []);
    byProduct.get(link.product_id)?.push(link.gift_product_id);
  }

  return products.map((p) => {
    const giftIds = byProduct.get(p.id) ?? [];
    const gifts = giftIds.map((id) => giftMap.get(id)).filter((g): g is GiftProductLite => Boolean(g));
    return {
      ...p,
      gift_product_ids: giftIds,
      gifts,
    };
  });
}

export const productsService = {
  table: "products",

  async list(db: DB, query: ListQuery = {}): Promise<Paginated<ProductWithGifts>> {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const { from, to } = rangeOf(page, pageSize);

    let q = db.from("products").select("*", { count: "exact" }).range(from, to);

    if (query.search) {
      const term = query.search.replace(/[%_]/g, "");
      q = q.or(`name.ilike.%${term}%,slug.ilike.%${term}%,short_description.ilike.%${term}%`);
    }

    if (query.filters) {
      for (const [k, v] of Object.entries(query.filters)) {
        if (v === null || v === undefined || v === "") continue;
        q = q.eq(k, v as string | number | boolean);
      }
    }

    let sortCol = "created_at";
    let asc = false;
    if (query.sort) {
      const [col, dir] = query.sort.split(":");
      if (["name", "created_at", "updated_at"].includes(col)) {
        sortCol = col;
        asc = dir !== "desc";
      }
    }

    const { data, error, count } = await q.order(sortCol, { ascending: asc });
    if (error) throw error;

    const rows = (data ?? []) as ProductRow[];
    const withGifts = await attachGifts(db, rows);
    
    // Simple approach: fetch variant counts for products in the current page only
    const countMap = new Map<string, number>();
    if (rows.length > 0) {
      const productIds = rows.map((p) => p.id);
      const { data: variants } = await db
        .from("product_variants")
        .select("product_id")
        .in("product_id", productIds);
      for (const v of (variants ?? [])) {
        if (v.product_id) {
          countMap.set(v.product_id, (countMap.get(v.product_id) ?? 0) + 1);
        }
      }
      for (const p of withGifts) {
        p.variants_count = countMap.get(p.id) ?? 0;
      }
    }
    
    return paginated(withGifts, count ?? 0, page, pageSize);
  },

  async getById(db: DB, id: string): Promise<ProductWithGifts> {
    const { data, error } = await db.from("products").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw Errors.notFound("products");
    const withGifts = await attachGifts(db, [data as ProductRow]);
    return withGifts[0];
  },

  async create(db: DB, input: ProductInsert): Promise<ProductWithGifts> {
    const { payload, giftProductIds } = parseProductInput(input);
    const { orgId } = await requireOrg();
    const draft = { ...(payload as Record<string, unknown>) };
    if (draft.organization_id == null) draft.organization_id = orgId;

    const { data, error } = await db.from("products").insert(draft).select().single();
    if (error) throw error;

    await syncProductGifts(db, data.id, giftProductIds);
    const withGifts = await attachGifts(db, [data as ProductRow]);
    return withGifts[0];
  },

  async update(db: DB, id: string, input: ProductUpdate): Promise<ProductWithGifts> {
    // 1. Lấy thông tin sản phẩm cũ để biết các file ảnh cũ
    const { data: oldData } = await db.from("products").select("thumbnail_url, images").eq("id", id).maybeSingle();
    const oldImages = Array.isArray(oldData?.images) ? (oldData.images as string[]) : [];
    const oldUrls = [oldData?.thumbnail_url, ...oldImages].filter((u): u is string => !!u);

    const { payload, giftProductIds } = parseProductInput(input);
    const { data, error } = await db.from("products").update(payload).eq("id", id).select().single();
    if (error) throw error;

    await syncProductGifts(db, id, giftProductIds);

    // 2. So sánh ảnh mới và cũ để xóa những ảnh cũ không còn được sử dụng
    const newImages = Array.isArray(data.images) ? (data.images as string[]) : [];
    const newUrls = new Set([data.thumbnail_url, ...newImages].filter((u): u is string => !!u));

    const unusedUrls = oldUrls.filter((url) => !newUrls.has(url));
    const unusedPaths = extractStoragePaths(unusedUrls);
    if (unusedPaths.length > 0) {
      await deleteStorageFiles(db, unusedPaths);
    }

    const withGifts = await attachGifts(db, [data as ProductRow]);
    return withGifts[0];
  },

  async remove(db: DB, id: string): Promise<{ id: string }> {
    // 1. Lấy thông tin sản phẩm để biết các file ảnh cần xóa
    const { data } = await db.from("products").select("thumbnail_url, images").eq("id", id).maybeSingle();
    const images = Array.isArray(data?.images) ? (data.images as string[]) : [];
    const urlsToDelete = [data?.thumbnail_url, ...images].filter((u): u is string => !!u);

    // 2. Xóa sản phẩm khỏi DB (các product_gifts sẽ tự cascade hoặc có thể tự xử lý)
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) throw error;

    // 3. Xóa các file ảnh khỏi Supabase Storage
    const pathsToDelete = extractStoragePaths(urlsToDelete);
    if (pathsToDelete.length > 0) {
      await deleteStorageFiles(db, pathsToDelete);
    }

    return { id };
  },
};

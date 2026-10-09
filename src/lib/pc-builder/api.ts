/**
 * API client cho tính năng PC Builder.
 *
 * Lưu ý:
 *  - `fetchComponents` gọi qua API route server-side (RLS bypass) — bảng products /
 *    pc_components_specs không cấp SELECT cho anon nên không query thẳng từ browser.
 *  - `createBuild` / `fetchBuildByShareSlug` / `loadBuildAsState` dùng anon client:
 *    các bảng `pc_builds` & `pc_build_items` đã có policy cho phép anon đọc build
 *    public và insert build của guest (user_id = null), nên không cần API route.
 */

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type {
  BuildItem,
  BuildState,
  ComponentWithSpec,
  SavedBuild,
  SlotKey,
} from "./types";
import { calculateTotal, getOrCreateSessionId } from "./storage";

type BuildRow = Database["public"]["Tables"]["pc_builds"]["Row"];
type BuildItemRow = Database["public"]["Tables"]["pc_build_items"]["Row"];

/** Thông tin tối thiểu của 1 product cho picker. */
type ProductPick = {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  price: number;
  brand?: string | null;
};

/**
 * Lấy danh sách linh kiện cho 1 slot, kèm spec tương ứng.
 *
 * Gọi qua API route `/api/pc-builder/components/[slot]` thay vì Supabase trực tiếp
 * — bảng products/specs không cấp SELECT cho anon trong RLS, query browser sẽ trả [].
 * Server route dùng `createAdminClient()` để bypass RLS (chỉ đọc catalog public).
 */
export async function fetchComponents(
  slot: SlotKey,
  opts: { q?: string; limit?: number } = {},
): Promise<ComponentWithSpec[]> {
  try {
    const sp = new URLSearchParams();
    if (opts.q) sp.set("q", opts.q);
    if (opts.limit) sp.set("limit", String(opts.limit));
    const qs = sp.toString();
    const res = await fetch(`/api/pc-builder/components/${slot}${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: ComponentWithSpec[]; total?: number };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

/** Sinh share_slug ngẫu nhiên 8 ký tự alphanumeric (URL-safe). */
export function generateShareSlug(length = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(length);
    crypto.getRandomValues(buf);
    for (let i = 0; i < length; i++) out += alphabet[buf[i] % alphabet.length];
  } else {
    for (let i = 0; i < length; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return out;
}

/** Đảm bảo build có share_slug; nếu chưa thì tạo mới và update. */
export async function ensureShareSlug(id: string): Promise<string | null> {
  const supabase = createClient();
  const { data: cur } = await supabase
    .from("pc_builds")
    .select("share_slug")
    .eq("id", id)
    .maybeSingle();
  const existing = (cur as { share_slug?: string | null } | null)?.share_slug;
  if (existing) return existing;
  // Thử tối đa 5 lần nếu trùng unique
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateShareSlug(8);
    const { error } = await supabase
      .from("pc_builds")
      .update({ share_slug: candidate, is_public: true })
      .eq("id", id);
    if (!error) return candidate;
  }
  return null;
}

/** Helper: build items từ BuildState. */
function buildItemsFromState(state: BuildState): BuildItemRow[] {
  const rows: Array<Omit<BuildItemRow, "id" | "created_at">> = [];
  for (const slot of Object.keys(state) as SlotKey[]) {
    const items = state[slot] ?? [];
    for (const item of items) {
      if (!item.productId) continue;
      rows.push({
        build_id: "",
        product_id: item.productId,
        category_slug: slot,
        qty: item.qty || 1,
        unit_price: item.unitPrice || 0,
      });
    }
  }
  return rows as BuildItemRow[];
}

/** Tạo mới 1 build (dùng cho cả user và guest). */
export async function createBuild(
  state: BuildState,
  opts: { userId?: string | null; name?: string; note?: string } = {},
): Promise<{ id: string; share_slug: string | null } | null> {
  const supabase = createClient();
  const userId = opts.userId ?? null;
  const sessionId = userId ? null : getOrCreateSessionId();
  const total = calculateTotal(state);

  const insertRow = {
    user_id: userId,
    session_id: sessionId,
    name: opts.name ?? "Cấu hình của tôi",
    note: opts.note ?? null,
    total_price: total,
    is_public: false,
  };

  const { data: created, error } = await supabase
    .from("pc_builds")
    .insert(insertRow as unknown as Database["public"]["Tables"]["pc_builds"]["Insert"])
    .select("id")
    .single();
  if (error || !created) {
    // eslint-disable-next-line no-console
    console.warn("[pc-builder] createBuild error", error?.message);
    return null;
  }
  const buildId = (created as { id: string }).id;

  const items = buildItemsFromState(state);
  if (items.length > 0) {
    const payload = items.map((it) => ({
      ...it,
      build_id: buildId,
    }));
    const { error: itemsErr } = await supabase
      .from("pc_build_items")
      .insert(
        payload as unknown as Database["public"]["Tables"]["pc_build_items"]["Insert"][],
      );
    if (itemsErr) {
      // eslint-disable-next-line no-console
      console.warn("[pc-builder] insert items error", itemsErr.message);
    }
  }

  // Chia sẻ tự động: tạo slug ngay để user có thể copy link.
  const shareSlug = await ensureShareSlug(buildId);
  return { id: buildId, share_slug: shareSlug };
}

/** Update build + thay thế toàn bộ items. */
export async function updateBuild(
  id: string,
  state: BuildState,
  opts: { name?: string; note?: string } = {},
): Promise<{ share_slug: string | null } | null> {
  const supabase = createClient();
  const total = calculateTotal(state);
  const updateRow: Database["public"]["Tables"]["pc_builds"]["Update"] = {
    total_price: total,
  };
  if (typeof opts.name === "string") updateRow.name = opts.name;
  if (typeof opts.note === "string") updateRow.note = opts.note;

  const { error } = await supabase.from("pc_builds").update(updateRow).eq("id", id);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[pc-builder] updateBuild error", error.message);
    return null;
  }

  // Xoá items cũ → insert lại
  await supabase.from("pc_build_items").delete().eq("build_id", id);
  const items = buildItemsFromState(state).map((it) => ({ ...it, build_id: id }));
  if (items.length > 0) {
    const { error: insErr } = await supabase
      .from("pc_build_items")
      .insert(
        items as unknown as Database["public"]["Tables"]["pc_build_items"]["Insert"][],
      );
    if (insErr) {
      // eslint-disable-next-line no-console
      console.warn("[pc-builder] updateBuild items error", insErr.message);
    }
  }

  const shareSlug = await ensureShareSlug(id);
  return { share_slug: shareSlug };
}

/** Xoá build (chỉ chủ sở hữu hoặc admin — RLS sẽ enforce). */
export async function deleteBuild(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("pc_builds").delete().eq("id", id);
  return !error;
}

/** Lấy build theo share_slug (chỉ trả về nếu public). */
export async function fetchBuildByShareSlug(slug: string): Promise<SavedBuild | null> {
  const supabase = createClient();
  const { data: build, error } = await supabase
    .from("pc_builds")
    .select(
      "id, user_id, session_id, name, note, total_price, share_slug, is_public, created_at, updated_at",
    )
    .eq("share_slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (error || !build) return null;
  const b = build as BuildRow;

  const { data: items } = await supabase
    .from("pc_build_items")
    .select("id, build_id, product_id, category_slug, qty, unit_price")
    .eq("build_id", b.id);
  return {
    build: {
      id: b.id,
      user_id: b.user_id,
      session_id: b.session_id,
      name: b.name,
      note: b.note,
      total_price: b.total_price,
      share_slug: b.share_slug,
      is_public: b.is_public,
      created_at: b.created_at,
      updated_at: b.updated_at,
    },
    items: (items ?? []) as BuildItemRow[],
  };
}

/** Lấy danh sách build của user hiện tại. */
export async function fetchUserBuilds(): Promise<SavedBuild[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: builds } = await supabase
    .from("pc_builds")
    .select(
      "id, user_id, session_id, name, note, total_price, share_slug, is_public, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  const list = (builds ?? []) as BuildRow[];
  if (list.length === 0) return [];

  const ids = list.map((b) => b.id);
  const { data: items } = await supabase
    .from("pc_build_items")
    .select("id, build_id, product_id, category_slug, qty, unit_price")
    .in("build_id", ids);
  const itemsByBuild = new Map<string, BuildItemRow[]>();
  for (const it of (items ?? []) as BuildItemRow[]) {
    const arr = itemsByBuild.get(it.build_id) ?? [];
    arr.push(it);
    itemsByBuild.set(it.build_id, arr);
  }

  return list.map((b) => ({
    build: {
      id: b.id,
      user_id: b.user_id,
      session_id: b.session_id,
      name: b.name,
      note: b.note,
      total_price: b.total_price,
      share_slug: b.share_slug,
      is_public: b.is_public,
      created_at: b.created_at,
      updated_at: b.updated_at,
    },
    items: itemsByBuild.get(b.id) ?? [],
  }));
}

/**
 * Load build + items + map về BuildState để hiển thị.
 * Dùng cho trang `[slug]/page.tsx` (share) và `saved/page.tsx` (user).
 *
 * Bổ sung: gắn `name`, `thumbnail`, `unitPrice` vào BuildItem để UI hiển thị
 * mà không cần query thêm (price snapshot đã lưu trong pc_build_items.unit_price).
 */
export async function loadBuildAsState(
  saved: SavedBuild,
): Promise<{ state: BuildState; name: string; note: string | null }> {
  const state: BuildState = {};
  const productIds = Array.from(new Set(saved.items.map((i) => i.product_id)));

  // Lấy thông tin product để hiển thị tên + ảnh
  const supabase = createClient();
  const productMap = new Map<string, ProductPick>();
  if (productIds.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("id, name, slug, thumbnail_url, brand_id")
      .in("id", productIds);
    for (const p of (data ?? []) as Array<{
      id: string;
      name: string;
      slug: string | null;
      thumbnail_url: string | null;
      brand_id: string | null;
    }>) {
      productMap.set(p.id, {
        id: p.id,
        name: p.name,
        slug: p.slug ?? p.id,
        thumbnail_url: p.thumbnail_url ?? null,
        price: 0,
        brand: null,
      });
    }
  }

  for (const it of saved.items) {
    const slot = it.category_slug as SlotKey;
    const p = productMap.get(it.product_id);
    const item: BuildItem = {
      productId: it.product_id,
      categorySlug: slot,
      name: p?.name ?? "Sản phẩm",
      thumbnail: p?.thumbnail_url ?? null,
      qty: it.qty,
      unitPrice: it.unit_price,
    };
    const arr = state[slot] ?? [];
    arr.push(item);
    state[slot] = arr;
  }

  return {
    state,
    name: saved.build.name,
    note: saved.build.note,
  };
}

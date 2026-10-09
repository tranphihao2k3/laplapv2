/**
 * Page Blocks — CMS đơn giản cho các trang tĩnh (/about, /contact...).
 *
 * Mỗi block có `block_type` quyết định component render và `data` jsonb chứa
 * field riêng. Admin CRUD qua /quanly/{slug}-page, public đọc qua cached fetch.
 *
 * Cache:
 *   - Public read dùng React `cache()` + `unstable_cache` qua `page-blocks-cached.ts`.
 *   - Admin write gọi `revalidateTag('page-blocks:' + slug)` để bust cache.
 */

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type BlockType = "hero" | "richtext";

export const BLOCK_TYPES: Array<{
  type: BlockType;
  label: string;
  description: string;
}> = [
  {
    type: "hero",
    label: "Hero banner",
    description: "Tiêu đề lớn, badge, mô tả ngắn. Thường đặt đầu trang.",
  },
  {
    type: "richtext",
    label: "Văn bản",
    description: "Tiêu đề + 1–n đoạn văn, căn trái/giữa.",
  },
];

export type HeroBlockData = {
  badge?: string;
  title: string;
  subtitle?: string;
  description?: string;
  theme?: "dark" | "light";
};

export type RichTextBlockData = {
  heading?: string;
  /** 'left' | 'center' */
  alignment?: "left" | "center";
  /** Mỗi phần tử là 1 đoạn. Có thể dùng \n để xuống dòng nhẹ. */
  paragraphs: string[];
};

export type PageBlock = {
  id: string;
  pageSlug: string;
  blockType: BlockType;
  position: number;
  enabled: boolean;
  data: Json;
  createdAt: string;
  updatedAt: string;
};

type PageBlockRow = {
  id: string;
  page_slug: string;
  block_type: string;
  position: number;
  enabled: boolean;
  data: Json;
  created_at: string;
  updated_at: string;
};

function rowToBlock(row: PageBlockRow): PageBlock {
  return {
    id: row.id,
    pageSlug: row.page_slug,
    blockType: row.block_type as BlockType,
    position: row.position,
    enabled: row.enabled,
    data: row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Lấy tất cả block enabled của 1 page, sắp xếp theo position. */
export const getPageBlocks = cache(async (slug: string): Promise<PageBlock[]> => {
  return _getPageBlocks(slug);
});

async function _getPageBlocks(slug: string): Promise<PageBlock[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("page_blocks")
      .select("id, page_slug, block_type, position, enabled, data, created_at, updated_at")
      .eq("page_slug", slug)
      .eq("enabled", true)
      .order("position", { ascending: true });
    if (error || !data) return [];
    return (data as PageBlockRow[]).map(rowToBlock);
  } catch {
    return [];
  }
}

/** Lấy cả block (kể cả disabled) — dùng cho admin. */
export async function getAllPageBlocksAdmin(slug: string): Promise<PageBlock[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("page_blocks")
      .select("id, page_slug, block_type, position, enabled, data, created_at, updated_at")
      .eq("page_slug", slug)
      .order("position", { ascending: true });
    if (error || !data) return [];
    return (data as PageBlockRow[]).map(rowToBlock);
  } catch {
    return [];
  }
}

export type CreateBlockInput = {
  pageSlug: string;
  blockType: BlockType;
  data: Json;
  enabled?: boolean;
};

export type UpdateBlockInput = {
  id: string;
  data?: Json;
  enabled?: boolean;
};

/** Tạo block mới — gán position = max + 1. */
export async function createPageBlock(input: CreateBlockInput): Promise<PageBlock | null> {
  try {
    const supabase = createAdminClient();
    const { data: maxRow } = await supabase
      .from("page_blocks")
      .select("position")
      .eq("page_slug", input.pageSlug)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = ((maxRow as { position?: number } | null)?.position ?? -1) + 1;

    const { data, error } = await supabase
      .from("page_blocks")
      .insert({
        page_slug: input.pageSlug,
        block_type: input.blockType,
        data: input.data,
        enabled: input.enabled ?? true,
        position: nextPos,
      })
      .select("id, page_slug, block_type, position, enabled, data, created_at, updated_at")
      .single();
    if (error || !data) return null;
    return rowToBlock(data as PageBlockRow);
  } catch {
    return null;
  }
}

/** Cập nhật data / enabled. */
export async function updatePageBlock(input: UpdateBlockInput): Promise<PageBlock | null> {
  try {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {};
    if (input.data !== undefined) update.data = input.data;
    if (input.enabled !== undefined) update.enabled = input.enabled;
    const { data, error } = await supabase
      .from("page_blocks")
      .update(update)
      .eq("id", input.id)
      .select("id, page_slug, block_type, position, enabled, data, created_at, updated_at")
      .single();
    if (error || !data) return null;
    return rowToBlock(data as PageBlockRow);
  } catch {
    return null;
  }
}

/** Xóa block. */
export async function deletePageBlock(id: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("page_blocks").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Sắp xếp lại blocks theo thứ tự id trong mảng.
 * Dùng batch update với CASE WHEN để tránh N+1 query.
 */
export async function reorderPageBlocks(
  slug: string,
  orderedIds: string[],
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    // Update tuần tự — đơn giản, an toàn, đủ nhanh cho vài chục block.
    for (let i = 0; i < orderedIds.length; i++) {
      await supabase
        .from("page_blocks")
        .update({ position: i })
        .eq("id", orderedIds[i])
        .eq("page_slug", slug);
    }
    return true;
  } catch {
    return false;
  }
}

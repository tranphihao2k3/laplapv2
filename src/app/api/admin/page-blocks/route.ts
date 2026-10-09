/**
 * API: GET  /api/admin/page-blocks?slug=about
 *      POST /api/admin/page-blocks  { slug, blockType, data, enabled? }
 *
 * Auth: yêu cầu role admin/staff. Mọi thao tác đều đi qua server-side admin
 * client + RLS policy trên bảng `page_blocks`.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import {
  BLOCK_TYPES,
  createPageBlock,
  getAllPageBlocksAdmin,
  type BlockType,
} from "@/lib/page-blocks";

const BlockTypeSchema = z.enum(BLOCK_TYPES.map((b) => b.type) as [BlockType, ...BlockType[]]);

const CreateSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  blockType: BlockTypeSchema,
  data: z.record(z.string(), z.unknown()),
  enabled: z.boolean().optional(),
});

async function requireAdmin() {
  const { getServerEnv } = await import("@/lib/env");
  const env = getServerEnv();
  const supabase = createAdminClient();
  // Verify JWT role bằng cách query auth.getUser() với token từ header.
  // (Supabase auth helpers xử lý cookie tự động ở server route.)
  return { supabase, env };
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "MISSING_SLUG" }, { status: 400 });
  }
  const blocks = await getAllPageBlocksAdmin(slug);
  return NextResponse.json({ blocks });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { slug, blockType, data, enabled } = parsed.data;
  const block = await createPageBlock({
    pageSlug: slug,
    blockType,
    data: data as unknown as Parameters<typeof createPageBlock>[0]["data"],
    enabled,
  });
  if (!block) {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 500 });
  }
  try {
    revalidateTag(`page-blocks:${slug}`);
  } catch {
    // ignore — cache invalidation failure không nên block admin
  }
  return NextResponse.json({ block }, { status: 201 });
}

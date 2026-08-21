import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  parseProductsText,
  parseProductText,
  type AIProvider,
  type SpecTemplateForAI,
} from "@/lib/ai/product-parser";

const bodySchema = z.object({
  text: z.string().min(10, "Mô tả quá ngắn (tối thiểu 10 ký tự)"),
  provider: z.enum(["gemini", "openai"]).default("gemini"),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

type Lookup = { id: string; name: string };

function fuzzyFind(items: Lookup[], hint: string | null | undefined): Lookup | null {
  if (!hint) return null;
  const needle = normalize(hint);
  if (!needle) return null;
  const exact = items.find((i) => normalize(i.name) === needle);
  if (exact) return exact;
  const contains = items.find((i) => {
    const n = normalize(i.name);
    return n.includes(needle) || needle.includes(n);
  });
  return contains ?? null;
}

/**
 * Tính variant_name cho mỗi option trong cùng group — gọn, dễ đọc.
 * VD: trong group "dell-7420" có 3 option:
 *   - "8GB DDR4 + 256GB SSD"   → variant_name "8GB/256GB"
 *   - "16GB DDR4 + 512GB SSD"  → variant_name "16GB/512GB"
 *   - "16GB DDR4 + 256GB SSD"  → variant_name "16GB/256GB"
 * Lấy các spec keys khác biệt giữa các option làm tên.
 */
function buildVariantNames(
  options: Array<{ specs: Record<string, string>; name: string }>,
): string[] {
  if (options.length <= 1) return options.map(() => "Mặc định");

  // Bỏ qua các key "phổ biến" không phân biệt option (cpu, screen, brand...).
  const IGNORED_KEYS = new Set([
    "cpu",
    "screen",
    "man_hinh",
    "vga",
    "gpu",
    "card_do_hoa",
    "weight",
    "trong_luong",
    "battery",
    "pin",
    "warranty",
    "bao_hanh",
    "ports",
    "cong",
    "keyboard",
    "ban_phim",
    "color",
    "mau",
    "condition",
    "tinh_trang",
  ]);

  // Tập key xuất hiện ở ít nhất 1 option nhưng giá trị KHÁC nhau giữa các option
  // → dùng làm phần phân biệt variant.
  const allKeys = new Set<string>();
  for (const o of options) for (const k of Object.keys(o.specs)) allKeys.add(k);
  const distinguishingKeys: string[] = [];
  for (const k of allKeys) {
    if (IGNORED_KEYS.has(k)) continue;
    const values = options.map((o) => (o.specs[k] ?? "").trim());
    const unique = new Set(values.filter(Boolean));
    if (unique.size > 1) distinguishingKeys.push(k);
  }

  // Nếu không tìm được key phân biệt → fallback dùng tên gốc (đã khác).
  if (distinguishingKeys.length === 0) {
    return options.map((o) => o.name);
  }

  return options.map((o) => {
    const parts = distinguishingKeys
      .map((k) => o.specs[k]?.trim())
      .filter(Boolean);
    return parts.join(" / ");
  });
}

/**
 * Build suggestion cho 1 sản phẩm (đã parse xong) — copy logic cũ để giữ tương thích.
 */
function buildSuggestion(
  aiResult: import("@/lib/ai/product-parser").ParsedProduct,
  brands: Lookup[],
  categories: Lookup[],
  products: Array<Lookup & { slug: string; thumbnail_url: string | null; status: string | null }>,
  templates: SpecTemplateForAI[],
) {
  const matchedTemplate = aiResult.spec_template_id
    ? templates.find((t) => t.id === aiResult.spec_template_id) ?? null
    : null;
  const filteredSpecs: Record<string, string> = {};
  if (matchedTemplate) {
    const allowedKeys = new Set(matchedTemplate.fields.map((f) => f.key));
    allowedKeys.add("warranty");
    allowedKeys.add("bao_hanh");
    for (const [k, v] of Object.entries(aiResult.specs)) {
      if (allowedKeys.has(k) && v && v.trim()) filteredSpecs[k] = v.trim();
    }
  } else {
    for (const [k, v] of Object.entries(aiResult.specs)) {
      if (v && v.trim()) filteredSpecs[k] = v.trim();
    }
  }

  const matchedBrand = fuzzyFind(brands, aiResult.brand_hint);
  const matchedCategory =
    fuzzyFind(categories, aiResult.category_hint) ||
    fuzzyFind(categories, aiResult.category_hint === "laptop" ? "Laptop" : aiResult.category_hint);

  const matchedGifts = aiResult.gifts
    .map((g) => fuzzyFind(products, g))
    .filter((g): g is Lookup => !!g)
    .map((g) => {
      const full = products.find((p) => p.id === g.id)!;
      return {
        id: full.id,
        name: full.name,
        slug: full.slug,
        thumbnail_url: full.thumbnail_url,
        status: full.status,
      };
    });

  const baseSlug = slugify(aiResult.name);

  return {
    name: aiResult.name,
    slug: baseSlug,
    short_description: aiResult.short_description,
    description: aiResult.description,
    selling_price: aiResult.selling_price,
    cost_price: aiResult.cost_price,
    warranty_months: aiResult.warranty_months,
    condition: aiResult.condition,
    tags: aiResult.tags,
    need_tags: aiResult.need_tags,
    performance_review: aiResult.performance_review,
    specs: filteredSpecs,
    spec_template_id: matchedTemplate?.id ?? null,
    spec_template_match: matchedTemplate
      ? { id: matchedTemplate.id, name: matchedTemplate.name }
      : null,
    brand_id: matchedBrand?.id ?? null,
    brand_match: matchedBrand,
    category_id: matchedCategory?.id ?? null,
    category_match: matchedCategory,
    gift_products: matchedGifts,
    unmatched_gifts: aiResult.gifts.filter(
      (g) =>
        !matchedGifts.some(
          (mg) => normalize(mg.name).includes(normalize(g)) || normalize(g).includes(normalize(mg.name)),
        ),
    ),
  };
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { message: "Dữ liệu không hợp lệ", fields: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      );
    }
    const { text, provider } = parsed.data;

    // Resolve brand/category/gifts/templates từ Supabase
    const supabase = await createClient();
    const [brandsRes, categoriesRes, productsRes, templatesRes] = await Promise.all([
      supabase.from("brands").select("id, name").limit(500),
      supabase.from("categories").select("id, name").limit(500),
      supabase.from("products").select("id, name, slug, thumbnail_url, status").limit(500),
      supabase.from("spec_templates").select("id, name, category_id, fields").limit(100),
    ]);

    const categoryNameById = new Map<string, string>(
      ((categoriesRes.data ?? []) as Lookup[]).map((c) => [c.id, c.name]),
    );

    const templates: SpecTemplateForAI[] = ((templatesRes.data ?? []) as Array<{
      id: string;
      name: string;
      category_id: string | null;
      fields: Array<{ key: string; label?: string; type?: string }> | null;
    }>).map((t) => ({
      id: t.id,
      name: t.name,
      category_id: t.category_id,
      category_name: t.category_id ? categoryNameById.get(t.category_id) ?? null : null,
      fields: Array.isArray(t.fields) ? t.fields : [],
    }));

    const brands = (brandsRes.data ?? []) as Lookup[];
    const categories = (categoriesRes.data ?? []) as Lookup[];
    const products = (productsRes.data ?? []) as Array<
      Lookup & { slug: string; thumbnail_url: string | null; status: string | null }
    >;

    // Gọi multi-parser. Nếu provider hoặc env lỗi, fallback parseProductText cũ.
    let multi: Awaited<ReturnType<typeof parseProductsText>>;
    try {
      multi = await parseProductsText(text, provider as AIProvider, templates);
    } catch {
      // Fallback: gọi parser cũ (1 sản phẩm), wrap thành multi
      const single = await parseProductText(text, provider as AIProvider, templates);
      multi = {
        products: [single],
        variant_group: { "0": slugify(single.name) },
      };
    }

    // Tính suggestion cho từng sản phẩm
    const enrichedProducts = multi.products.map((p) =>
      buildSuggestion(p, brands, categories, products, templates),
    );

    // Group theo variant_group: cùng group_id → 1 sản phẩm cha + nhiều variants.
    const groupMap = new Map<
      string,
      {
        variant_group_id: string;
        baseIndex: number;
        base: (typeof enrichedProducts)[number];
        variantIndices: number[];
      }
    >();
    multi.products.forEach((_p, idx) => {
      const gid = multi.variant_group[String(idx)] || slugify(multi.products[idx].name);
      const sug = enrichedProducts[idx];
      const existing = groupMap.get(gid);
      if (!existing) {
        groupMap.set(gid, {
          variant_group_id: gid,
          baseIndex: idx,
          base: sug,
          variantIndices: [idx],
        });
      } else {
        existing.variantIndices.push(idx);
      }
    });

    // Build suggestions.groups: mỗi group có base + variants[] (đính kèm variant_name).
    const groups = Array.from(groupMap.values()).map((g) => {
      const variantOptions = g.variantIndices.map((idx) => ({
        ...enrichedProducts[idx],
        source_index: idx,
        specs_raw: multi.products[idx].specs,
      }));
      const variantNames = buildVariantNames(
        multi.products.filter((_, i) => g.variantIndices.includes(i)).map((p) => ({
          specs: p.specs,
          name: p.name,
        })),
      );
      const variants = variantOptions.map((v, j) => ({
        ...v,
        variant_name: variantNames[j],
        // SKU gợi ý: <base-slug>-<ram>-<ssd>...
        sku: buildVariantSku(g.base.slug, variantNames[j], j),
        // Specs riêng (chỉ phần phân biệt), merge với base specs.
        // FE dùng để tạo variant row.
      }));
      return {
        variant_group_id: g.variant_group_id,
        base: g.base,
        variants,
        variant_count: variants.length,
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        // AI raw (debug) — giữ cả 2 dạng để tương thích
        ai: multi,
        // Backward-compat: suggestion của sản phẩm đầu tiên (group đầu tiên)
        suggestions: groups[0]?.base ?? enrichedProducts[0],
        // Multi-product mới
        products: enrichedProducts,
        groups,
        product_count: enrichedProducts.length,
        group_count: groups.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ ok: false, error: { message } }, { status: 500 });
  }
}

/** Sinh SKU ngắn gọn cho variant: <base-slug>-<variant-attr>-<n> */
function buildVariantSku(baseSlug: string, variantAttr: string, idx: number): string {
  const base = (baseSlug || "VAR").toUpperCase().slice(0, 24);
  const attr = (variantAttr || "")
    .toUpperCase()
    .replace(/GB/g, "G")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  if (!attr) return `${base}-${idx + 1}`;
  return `${base}-${attr}`;
}

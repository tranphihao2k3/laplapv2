import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseProductText, type AIProvider, type SpecTemplateForAI } from "@/lib/ai/product-parser";

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

    const aiResult = await parseProductText(text, provider as AIProvider, templates);

    const brands = (brandsRes.data ?? []) as Lookup[];
    const categories = (categoriesRes.data ?? []) as Lookup[];
    const products = (productsRes.data ?? []) as Array<Lookup & { slug: string; thumbnail_url: string | null; status: string | null }>;
    const matchedTemplate = aiResult.spec_template_id
      ? templates.find((t) => t.id === aiResult.spec_template_id) ?? null
      : null;
    // Lọc specs về đúng keys của template để tránh AI lỡ thêm key lạ
    const filteredSpecs: Record<string, string> = {};
    if (matchedTemplate) {
      const allowedKeys = new Set(matchedTemplate.fields.map((f) => f.key));
      // Luôn cho phép keys "warranty"/"bao_hanh" lọt qua vì FE auto map từ warranty_months
      allowedKeys.add("warranty");
      allowedKeys.add("bao_hanh");
      for (const [k, v] of Object.entries(aiResult.specs)) {
        if (allowedKeys.has(k) && v && v.trim()) filteredSpecs[k] = v.trim();
      }
    } else {
      // Không match được template → giữ nguyên specs AI trả về
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

    return NextResponse.json({
      ok: true,
      data: {
        ai: aiResult,
        suggestions: {
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
            (g) => !matchedGifts.some((mg) => normalize(mg.name).includes(normalize(g)) || normalize(g).includes(normalize(mg.name))),
          ),
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ ok: false, error: { message } }, { status: 500 });
  }
}

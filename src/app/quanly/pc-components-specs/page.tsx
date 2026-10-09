/**
 * Trang quản lý Spec linh kiện PC cho admin.
 *
 * Server component: fetch products thuộc nhóm PC parts + specs hiện có (1 query
 * gộp qua .in() để tránh N+1) → truyền xuốn client component SpecEditor.
 *
 * Middleware cover auth, không cần check lại.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SpecEditor } from "@/components/admin/pc-builder/spec-editor";
import type { PcComponentsSpecRow } from "@/components/admin/pc-builder/helpers";

export const dynamic = "force-dynamic";

const PC_CATEGORY_SLUGS = [
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
];

type InitialProduct = {
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
  thumbnail_url: string | null;
  category_id: string | null;
  category: { id: string; name: string; slug: string } | null;
  spec: PcComponentsSpecRow | null;
};

export default async function PcComponentsSpecsPage() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect("/auth/login");
  }

  // Lấy tất cả products có category slug thuộc PC group, join category (dùng inner để
  // chỉ lấy product có danh mục hợp lệ).
  const { data: productRows, error: productsErr } = await supabase
    .from("products")
    .select(
      "id, name, slug, status, thumbnail_url, category_id, category:categories!inner(id, name, slug)",
    )
    .in("category.slug", PC_CATEGORY_SLUGS)
    .order("name", { ascending: true })
    .limit(500);

  if (productsErr) {
    return (
      <div className="p-6 text-destructive">
        Lỗi khi tải sản phẩm: {productsErr.message}
      </div>
    );
  }

  const rawProducts = (productRows ?? []) as unknown as Array<
    Omit<InitialProduct, "spec"> & {
      category: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
    }
  >;

  // Lấy specs tương ứng (1 query gộp)
  const productIds = rawProducts.map((p) => p.id);
  const specMap = new Map<string, PcComponentsSpecRow>();
  if (productIds.length > 0) {
    const { data: specRows, error: specErr } = await supabase
      .from("pc_components_specs")
      .select("*")
      .in("product_id", productIds);
    if (specErr) {
      return (
        <div className="p-6 text-destructive">
          Lỗi khi tải specs: {specErr.message}
        </div>
      );
    }
    for (const s of (specRows ?? []) as PcComponentsSpecRow[]) {
      specMap.set(s.product_id, s);
    }
  }

  const products: InitialProduct[] = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    thumbnail_url: p.thumbnail_url,
    category_id: p.category_id,
    category: Array.isArray(p.category) ? (p.category[0] ?? null) : p.category ?? null,
    spec: specMap.get(p.id) ?? null,
  }));

  // Lấy danh sách categories PC để filter dropdown
  const { data: pcCategories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .in("slug", PC_CATEGORY_SLUGS)
    .order("position", { ascending: true });

  return (
    <SpecEditor
      initialData={{
        products,
        categories: (pcCategories ?? []) as Array<{ id: string; name: string; slug: string }>,
      }}
    />
  );
}
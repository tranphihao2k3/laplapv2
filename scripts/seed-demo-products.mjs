/**
 * Seed laptop demo: brands + category "Laptop" + vài sản phẩm active + variant có specs.
 * Idempotent theo slug (chạy lại không nhân đôi).
 *
 * Yêu cầu: .env.local có NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
 * và đã chạy scripts/bootstrap-admin.mjs (để có organization).
 *
 * Chạy:  node scripts/seed-demo-products.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_CODE = "LAPLAP-ADMIN";
const die = (l, e) => {
  console.error(`✗ ${l}:`, e?.message || e);
  process.exit(1);
};

const BRANDS = [
  { name: "Apple", slug: "apple" },
  { name: "Dell", slug: "dell" },
  { name: "Lenovo", slug: "lenovo" },
  { name: "ASUS", slug: "asus" },
];

const CATEGORY = { name: "Laptop", slug: "laptop", description: "Máy tính xách tay" };

const PRODUCTS = [
  {
    slug: "macbook-pro-14-m3-pro",
    name: 'MacBook Pro 14" M3 Pro 18GB/512GB',
    brand: "apple",
    price: 39990000,
    specs: { cpu: "Apple M3 Pro", ram: "18GB", storage: "512GB SSD", display: '14.2" Liquid Retina XDR' },
  },
  {
    slug: "dell-xps-15-9530-i7",
    name: "Dell XPS 15 9530 i7-13700H 16GB",
    brand: "dell",
    price: 32990000,
    specs: { cpu: "Intel Core i7-13700H", ram: "16GB", storage: "512GB SSD", display: '15.6" OLED' },
  },
  {
    slug: "lenovo-thinkpad-x1-carbon-g11",
    name: "Lenovo ThinkPad X1 Carbon Gen 11",
    brand: "lenovo",
    price: 35990000,
    specs: { cpu: "Intel Core i7-1355U", ram: "16GB", storage: "1TB SSD", display: '14" WUXGA' },
  },
  {
    slug: "asus-rog-zephyrus-g14",
    name: "ASUS ROG Zephyrus G14 RTX 4070",
    brand: "asus",
    price: 38990000,
    specs: { cpu: "AMD Ryzen 9 7940HS", ram: "32GB", storage: "1TB SSD", gpu: "RTX 4070", display: '14" QHD+ 165Hz' },
  },
  {
    slug: "asus-vivobook-15-i5",
    name: "ASUS Vivobook 15 i5-1335U 8GB",
    brand: "asus",
    price: 13990000,
    specs: { cpu: "Intel Core i5-1335U", ram: "8GB", storage: "512GB SSD", display: '15.6" FHD' },
  },
  {
    slug: "dell-inspiron-14-i5",
    name: "Dell Inspiron 14 5430 i5-1340P 16GB",
    brand: "dell",
    price: 18990000,
    specs: { cpu: "Intel Core i5-1340P", ram: "16GB", storage: "512GB SSD", display: '14" FHD+' },
  },
];

async function run() {
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("code", ORG_CODE)
    .maybeSingle();
  if (orgErr) die("select organization", orgErr);
  if (!org) die("organization", `Chưa có organization "${ORG_CODE}". Chạy scripts/bootstrap-admin.mjs trước.`);
  const orgId = org.id;
  console.log(`✓ Organization: ${ORG_CODE} (${orgId})`);

  // Brands (idempotent theo slug).
  const brandId = {};
  for (const b of BRANDS) {
    const { data: ex } = await supabase
      .from("brands")
      .select("id")
      .eq("organization_id", orgId)
      .eq("slug", b.slug)
      .maybeSingle();
    if (ex) {
      brandId[b.slug] = ex.id;
    } else {
      const { data, error } = await supabase
        .from("brands")
        .insert({ organization_id: orgId, name: b.name, slug: b.slug })
        .select("id")
        .single();
      if (error) die(`insert brand ${b.slug}`, error);
      brandId[b.slug] = data.id;
    }
  }
  console.log(`✓ Brands: ${Object.keys(brandId).join(", ")}`);

  // Category Laptop.
  let categoryId;
  {
    const { data: ex } = await supabase
      .from("categories")
      .select("id")
      .eq("organization_id", orgId)
      .eq("slug", CATEGORY.slug)
      .maybeSingle();
    if (ex) categoryId = ex.id;
    else {
      const { data, error } = await supabase
        .from("categories")
        .insert({ organization_id: orgId, name: CATEGORY.name, slug: CATEGORY.slug })
        .select("id")
        .single();
      if (error) die("insert category laptop", error);
      categoryId = data.id;
    }
  }
  console.log(`✓ Category: laptop (${categoryId})`);

  // Products + 1 variant mỗi sản phẩm.
  for (const p of PRODUCTS) {
    let productId;
    const { data: exP } = await supabase
      .from("products")
      .select("id")
      .eq("organization_id", orgId)
      .eq("slug", p.slug)
      .maybeSingle();
    if (exP) {
      productId = exP.id;
      const { error } = await supabase
        .from("products")
        .update({ name: p.name, status: "active", brand_id: brandId[p.brand], category_id: categoryId })
        .eq("id", productId);
      if (error) die(`update product ${p.slug}`, error);
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({
          organization_id: orgId,
          name: p.name,
          slug: p.slug,
          status: "active",
          brand_id: brandId[p.brand],
          category_id: categoryId,
        })
        .select("id")
        .single();
      if (error) die(`insert product ${p.slug}`, error);
      productId = data.id;
    }

    const sku = `DEMO-${p.slug.toUpperCase()}`;
    const { data: exV } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", productId)
      .eq("sku", sku)
      .maybeSingle();
    if (exV) {
      const { error } = await supabase
        .from("product_variants")
        .update({ selling_price: p.price, specs: p.specs, is_active: true })
        .eq("id", exV.id);
      if (error) die(`update variant ${sku}`, error);
    } else {
      const { error } = await supabase.from("product_variants").insert({
        product_id: productId,
        sku,
        name: "Mặc định",
        selling_price: p.price,
        cost_price: Math.round(p.price * 0.85),
        specs: p.specs,
        is_active: true,
      });
      if (error) die(`insert variant ${sku}`, error);
    }
    console.log(`  • ${p.name}`);
  }

  console.log(`\n✓ Seed xong ${PRODUCTS.length} sản phẩm laptop demo.`);
}

run().catch((e) => die("run", e));

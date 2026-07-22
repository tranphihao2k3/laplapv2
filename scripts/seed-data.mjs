import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables từ .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log("=== BẮT ĐẦU SEED DỮ LIỆU TỰ ĐỘNG ===");

  // 1. Lấy hoặc tạo Organization mặc định
  let orgId;
  const { data: orgs, error: orgsErr } = await supabase.from("organizations").select("id").limit(1);
  if (orgsErr) throw orgsErr;

  if (orgs && orgs.length > 0) {
    orgId = orgs[0].id;
    console.log(`Đã chọn Organization hiện có: ${orgId}`);
  } else {
    const { data: newOrg, error: newOrgErr } = await supabase
      .from("organizations")
      .insert({
        name: "LapLap Technology JSC",
        code: "LAPLAP",
        tax_code: "0123456789",
        is_active: true
      })
      .select("id")
      .single();
    if (newOrgErr) throw newOrgErr;
    orgId = newOrg.id;
    console.log(`Đã tạo Organization mới: ${orgId}`);
  }

  // 2. Lấy hoặc tạo Shop mặc định
  let shopId;
  const { data: shops, error: shopsErr } = await supabase.from("shops").select("id").limit(1);
  if (shopsErr) throw shopsErr;

  if (shops && shops.length > 0) {
    shopId = shops[0].id;
    console.log(`Đã chọn Shop hiện có: ${shopId}`);
  } else {
    const { data: newShop, error: newShopErr } = await supabase
      .from("shops")
      .insert({
        organization_id: orgId,
        name: "LapLap Flagship Store - Cầu Giấy",
        code: "LL-CG-01",
        timezone: "Asia/Ho_Chi_Minh",
        is_active: true
      })
      .select("id")
      .single();
    if (newShopErr) throw newShopErr;
    shopId = newShop.id;
    console.log(`Đã tạo Shop mới: ${shopId}`);
  }

  // Xoá sạch dữ liệu cũ — dùng REST API trực tiếp, đúng thứ tự FK constraints
  console.log("Đang dọn dẹp dữ liệu cũ...");
  const REST_HEADERS = {
    "Content-Type": "application/json",
    "apikey": supabaseServiceKey,
    "Authorization": `Bearer ${supabaseServiceKey}`,
    "Prefer": "count=exact",
  };
  async function deleteAll(table, filter) {
    const url = `${supabaseUrl}/rest/v1/${table}?${filter}`;
    const res = await fetch(url, { method: "DELETE", headers: REST_HEADERS });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`⚠️ Xoá ${table} thất bại: ${res.status} ${text.slice(0, 200)}`);
    } else {
      const count = parseInt(res.headers.get("content-range")?.split("/")[1] ?? "0", 10);
      console.log(`  ✅ Đã xoá ${count} dòng từ ${table}`);
    }
  }
  // Xoá theo thứ tự FK (con trước, cha sau)
  const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
  const NOT_STRING = "____DELETE_ALL__STRING__";
  await deleteAll("inventory_transactions", `id=gt.${EMPTY_UUID}`);
  await deleteAll("serial_numbers", `product_variant_id=gt.${EMPTY_UUID}`);
  await deleteAll("purchase_order_items", `product_variant_id=gt.${EMPTY_UUID}`);
  await deleteAll("order_items", `product_variant_id=gt.${EMPTY_UUID}`);
  await deleteAll("stock_levels", `warehouse_id=gt.${EMPTY_UUID}`);
  await deleteAll("product_variants", `sku=neq.${NOT_STRING}`);
  await deleteAll("product_gifts", `product_id=gt.${EMPTY_UUID}`);
  await deleteAll("products", `slug=neq.${NOT_STRING}`);
  await deleteAll("spec_templates", `name=neq.${NOT_STRING}`);
  await deleteAll("categories", `slug=neq.${NOT_STRING}`);
  await deleteAll("brands", `slug=neq.${NOT_STRING}`);
  await deleteAll("warehouses", `code=neq.${NOT_STRING}`);

  // 3. Tạo 10 Brands
  console.log("Đang tạo 10 Brands...");
  const brandData = [
    { name: "Apple", slug: "apple", organization_id: orgId, show_on_homepage: true },
    { name: "Dell", slug: "dell", organization_id: orgId, show_on_homepage: true },
    { name: "ASUS", slug: "asus", organization_id: orgId, show_on_homepage: true },
    { name: "HP", slug: "hp", organization_id: orgId, show_on_homepage: true },
    { name: "Lenovo", slug: "lenovo", organization_id: orgId, show_on_homepage: true },
    { name: "MSI", slug: "msi", organization_id: orgId, show_on_homepage: true },
    { name: "Acer", slug: "acer", organization_id: orgId, show_on_homepage: true },
    { name: "Gigabyte", slug: "gigabyte", organization_id: orgId, show_on_homepage: false },
    { name: "LG", slug: "lg", organization_id: orgId, show_on_homepage: true },
    { name: "Microsoft Surface", slug: "surface", organization_id: orgId, show_on_homepage: false },
  ];
  const { data: insertedBrands, error: brandErr } = await supabase
    .from("brands")
    .insert(brandData)
    .select("id, name");
  if (brandErr) throw brandErr;
  console.log(`Đã tạo ${insertedBrands.length} brands.`);

  // 4. Tạo 10 Categories
  console.log("Đang tạo 10 Categories...");
  const categoryData = [
    { name: "Laptop Văn Phòng", slug: "laptop-van-phong", organization_id: orgId },
    { name: "Laptop Gaming", slug: "laptop-gaming", organization_id: orgId },
    { name: "Laptop Cũ Like New", slug: "laptop-cu", organization_id: orgId },
    { name: "MacBook", slug: "macbook", organization_id: orgId },
    { name: "Ultrabook Cao Cấp", slug: "ultrabook", organization_id: orgId },
    { name: "Laptop Đồ Hoạ", slug: "laptop-do-hoa", organization_id: orgId },
    { name: "Màn Hình Máy Tính", slug: "man-hinh", organization_id: orgId },
    { name: "Bàn Phím Cơ", slug: "ban-phim", organization_id: orgId },
    { name: "Chuột Gaming", slug: "chuot-gaming", organization_id: orgId },
    { name: "Phụ Kiện Laptop", slug: "phu-kien", organization_id: orgId },
  ];
  const { data: insertedCategories, error: catErr } = await supabase
    .from("categories")
    .insert(categoryData)
    .select("id, name");
  if (catErr) throw catErr;
  console.log(`Đã tạo ${insertedCategories.length} categories.`);

  // 5. Tạo 10 Spec Templates tương ứng
  console.log("Đang tạo 10 Spec Templates...");
  const templateData = insertedCategories.map((cat, idx) => ({
    name: `Mẫu cấu hình cho ${cat.name}`,
    category_id: cat.id,
    fields: [
      { key: "cpu", label: "Vi xử lý (CPU)", type: "string" },
      { key: "ram", label: "Bộ nhớ RAM", type: "string" },
      { key: "ssd", label: "Ổ cứng lưu trữ", type: "string" },
      { key: "gpu", label: "Card đồ họa (VGA)", type: "string" },
      { key: "display", label: "Màn hình", type: "string" },
      { key: "battery", label: "Thời lượng pin", type: "string" },
      { key: "ban_phim", label: "Đèn bàn phím", type: "string" },
      { key: "warranty", label: "Bảo hành", type: "string" }
    ],
    organization_id: orgId
  }));
  const { data: insertedTemplates, error: tempErr } = await supabase
    .from("spec_templates")
    .insert(templateData)
    .select("id, name, category_id");
  if (tempErr) throw tempErr;
  console.log(`Đã tạo ${insertedTemplates.length} spec templates.`);

  // 6. Tạo 10 Warehouses
  console.log("Đang tạo 10 Warehouses...");
  const warehouseData = Array.from({ length: 10 }).map((_, i) => ({
    organization_id: orgId,
    shop_id: shopId,
    name: `Kho chứa hàng LapLap Chi nhánh #${i + 1}`,
    code: `KHO-CN-${String(i + 1).padStart(2, "0")}`,
    type: i === 0 ? "central" : "store",
    address: `Số ${10 + i * 5} Đường Cầu Giấy, Hà Nội`,
    is_active: true,
    manager_name: `Quản lý kho #${i + 1}`,
    phone: `098765432${i}`
  }));
  const { data: insertedWarehouses, error: whErr } = await supabase
    .from("warehouses")
    .insert(warehouseData)
    .select("id, name, code");
  if (whErr) throw whErr;
  console.log(`Đã tạo ${insertedWarehouses.length} warehouses.`);

  // 7. Tạo 10 Products liên kết các Brands, Categories
  console.log("Đang tạo 10 Products...");
  const productNames = [
    { name: "Dell XPS 13 Plus 9320", brand: "Dell", cat: "Ultrabook Cao Cấp" },
    { name: "MacBook Air M2 2023", brand: "Apple", cat: "MacBook" },
    { name: "ASUS TUF Gaming A15", brand: "ASUS", cat: "Laptop Gaming" },
    { name: "HP EliteBook 840 G10", brand: "HP", cat: "Laptop Văn Phòng" },
    { name: "Lenovo ThinkPad X1 Carbon Gen 11", brand: "Lenovo", cat: "Ultrabook Cao Cấp" },
    { name: "MSI Katana 15 B13V", brand: "MSI", cat: "Laptop Gaming" },
    { name: "Acer Aspire 5 A515", brand: "Acer", cat: "Laptop Văn Phòng" },
    { name: "LG Gram 16 2024", brand: "LG", cat: "Ultrabook Cao Cấp" },
    { name: "Microsoft Surface Laptop 5", brand: "Microsoft Surface", cat: "Ultrabook Cao Cấp" },
    { name: "ASUS ROG Strix G16", brand: "ASUS", cat: "Laptop Gaming" }
  ];

  const productData = productNames.map((p, idx) => {
    const brand = insertedBrands.find((b) => b.name === p.brand);
    const category = insertedCategories.find((c) => c.name === p.cat);
    const slug = `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}-${idx + 1}`;

    return {
      organization_id: orgId,
      brand_id: brand?.id ?? null,
      category_id: category?.id ?? null,
      name: p.name,
      slug,
      status: "active",
      short_description: `Siêu phẩm laptop công nghệ cao cấp chính hãng từ ${p.brand}.`,
      description: `<section><h3>🧩 Cấu hình chính</h3><p>Màn hình đẹp, hiệu năng khỏe cho công việc.</p></section>`,
      thumbnail_url: `https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=400&q=80`,
      images: [
        `https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80`
      ],
      tags: ["laptop", p.brand.toLowerCase(), "laptop-chinh-hang"]
    };
  });

  const { data: insertedProducts, error: prodErr } = await supabase
    .from("products")
    .insert(productData)
    .select("id, name");
  if (prodErr) throw prodErr;
  console.log(`Đã tạo ${insertedProducts.length} products.`);

  // 8. Tạo 10 Product Variants tương ứng và 10 Stock Levels
  console.log("Đang tạo 10 Product Variants và Stock Levels...");
  const variantData = [];
  const stockLevelData = [];

  insertedProducts.forEach((p, idx) => {
    const sellingPrice = 15000000 + idx * 2500000;
    const costPrice = 12000000 + idx * 2000000;
    const sku = `LAPLAP-${Date.now()}-${String(idx + 1).padStart(3, "0")}`;

    variantData.push({
      product_id: p.id,
      name: "Phiên bản Tiêu chuẩn",
      sku,
      selling_price: sellingPrice,
      cost_price: costPrice,
      is_active: true,
      specs: {
        cpu: idx % 2 === 0 ? "Intel Core i7-1370P (suy luận)" : "AMD Ryzen 7 7735HS",
        ram: "16GB LPDDR5 5200MHz",
        storage: "512GB SSD NVMe PCIe 4.0",
        gpu: idx % 3 === 0 ? "NVIDIA GeForce RTX 4050 6GB" : "Intel Iris Xe Graphics (onboard)",
        display: "13.4 inch FHD+ IPS, 100% sRGB",
        battery: "4-6 giờ",
        ban_phim: "Có (LED trắng)",
        warranty: "12 tháng"
      }
    });
  });

  const { data: insertedVariants, error: varErr } = await supabase
    .from("product_variants")
    .insert(variantData)
    .select("id, product_id, sku");
  if (varErr) throw varErr;
  console.log(`Đã tạo ${insertedVariants.length} product variants.`);

  // Link variant to stock level
  insertedVariants.forEach((v, idx) => {
    // Phân bổ ngẫu nhiên hàng tồn kho vào 10 warehouse đã tạo
    insertedWarehouses.forEach((wh) => {
      stockLevelData.push({
        warehouse_id: wh.id,
        product_variant_id: v.id,
        available_qty: Math.floor(Math.random() * 20) + 5, // 5 đến 25 chiếc mỗi kho
        reserved_qty: Math.floor(Math.random() * 3),
        incoming_qty: 0
      });
    });
  });

  const { error: stockErr } = await supabase
    .from("stock_levels")
    .insert(stockLevelData);
  if (stockErr) throw stockErr;
  console.log(`Đã tạo ${stockLevelData.length} stock level entries.`);

  console.log("=== SEED DỮ LIỆU THÀNH CÔNG ===");
}

seed().catch((err) => {
  console.error("Lỗi trong quá trình seed dữ liệu:", err);
  process.exit(1);
});

/**
 * Seed danh mục linh kiện + spec templates cho PC / RAM / SSD / Bàn phím / Chuột.
 *
 * Idempotent — chạy lại không trùng:
 *   - Categories: PC, RAM, SSD, Bàn phím, Chuột (cấp 1).
 *   - Spec template: 1 mẫu cho mỗi danh mục.
 *
 * Yêu cầu: .env.local có NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
 * và đã chạy scripts/bootstrap-admin.mjs (để có organization).
 *
 * Chạy:
 *   node scripts/seed-spec-templates.mjs
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

// ---------- Định nghĩa danh mục & template ----------

const CATEGORIES = [
  { name: "PC", slug: "pc", description: "Máy tính để bàn / PC build sẵn" },
  { name: "RAM", slug: "ram", description: "Bộ nhớ trong DDR4 / DDR5" },
  { name: "SSD", slug: "ssd", description: "Ổ cứng thể rắn SATA / NVMe" },
  { name: "Bàn phím", slug: "ban-phim", description: "Bàn phím cơ / membrane / không dây" },
  { name: "Chuột", slug: "chuot", description: "Chuột gaming / văn phòng / không dây" },
];

/** Mỗi field: key (mã), label (tên hiển thị), type (text|number|boolean|select), options (cho select). */
const TEMPLATES = {
  PC: {
    name: "PC Standard",
    fields: [
      { key: "cpu", label: "CPU", type: "text" },
      { key: "motherboard", label: "Mainboard", type: "text" },
      { key: "ram", label: "RAM", type: "text" },
      { key: "storage", label: "Ổ cứng", type: "text" },
      { key: "gpu", label: "Card đồ họa (GPU)", type: "text" },
      { key: "psu", label: "Nguồn (PSU)", type: "text" },
      { key: "case", label: "Vỏ máy (Case)", type: "text" },
      { key: "cooling", label: "Tản nhiệt", type: "text" },
      {
        key: "os",
        label: "Hệ điều hành",
        type: "select",
        options: ["Không có", "Windows 11 Home", "Windows 11 Pro", "Ubuntu", "Khác"],
      },
      { key: "warranty_months", label: "Bảo hành (tháng)", type: "number" },
    ],
  },
  RAM: {
    name: "RAM Standard",
    fields: [
      { key: "capacity", label: "Dung lượng", type: "select", options: ["4GB", "8GB", "16GB", "32GB", "64GB"] },
      { key: "type", label: "Chuẩn", type: "select", options: ["DDR3", "DDR4", "DDR5"] },
      { key: "bus_speed", label: "Tốc độ Bus (MHz)", type: "number" },
      { key: "form_factor", label: "Form Factor", type: "select", options: ["DIMM (Desktop)", "SO-DIMM (Laptop)"] },
      { key: "cas_latency", label: "CAS Latency (CL)", type: "text" },
      { key: "voltage", label: "Điện áp (V)", type: "text" },
      { key: "has_rgb", label: "Có RGB", type: "boolean" },
      { key: "heatsink", label: "Tản nhiệt", type: "boolean" },
      { key: "warranty_months", label: "Bảo hành (tháng)", type: "number" },
    ],
  },
  SSD: {
    name: "SSD Standard",
    fields: [
      { key: "capacity", label: "Dung lượng", type: "select", options: ["128GB", "240GB", "256GB", "480GB", "500GB", "512GB", "1TB", "2TB", "4TB"] },
      { key: "interface", label: "Giao tiếp", type: "select", options: ["SATA III", "NVMe PCIe 3.0", "NVMe PCIe 4.0", "NVMe PCIe 5.0"] },
      { key: "form_factor", label: "Form Factor", type: "select", options: ["2.5 inch", "M.2 2280", "M.2 2230", "mSATA"] },
      { key: "read_speed", label: "Tốc độ đọc (MB/s)", type: "number" },
      { key: "write_speed", label: "Tốc độ ghi (MB/s)", type: "number" },
      { key: "tbw", label: "TBW (Terabytes Written)", type: "text" },
      { key: "nand_type", label: "Loại NAND", type: "select", options: ["SLC", "MLC", "TLC", "QLC"] },
      { key: "has_dram", label: "Có DRAM cache", type: "boolean" },
      { key: "warranty_months", label: "Bảo hành (tháng)", type: "number" },
    ],
  },
  "Bàn phím": {
    name: "Bàn phím Standard",
    fields: [
      { key: "layout", label: "Layout", type: "select", options: ["Full-size", "TKL (87 keys)", "75%", "65%", "60%", "Numpad"] },
      { key: "switch_type", label: "Kiểu switch", type: "select", options: ["Cơ (Mechanical)", "Membrane", "Quang học (Optical)", "Topre"] },
      { key: "switch_brand", label: "Hãng switch", type: "text" },
      { key: "switch_color", label: "Màu switch", type: "select", options: ["Red", "Blue", "Brown", "Black", "Yellow", "Silver", "Khác"] },
      { key: "connectivity", label: "Kết nối", type: "select", options: ["Có dây (USB)", "Không dây 2.4GHz", "Bluetooth", "Đa kết nối"] },
      { key: "backlight", label: "Đèn nền", type: "select", options: ["Không", "Single color", "RGB"] },
      { key: "hot_swap", label: "Hot-swap switch", type: "boolean" },
      { key: "is_wireless", label: "Không dây", type: "boolean" },
      { key: "battery_life", label: "Thời lượng pin (giờ)", type: "number" },
      { key: "keycap_material", label: "Chất liệu keycap", type: "select", options: ["ABS", "PBT", "POM", "Khác"] },
      { key: "warranty_months", label: "Bảo hành (tháng)", type: "number" },
    ],
  },
  "Chuột": {
    name: "Chuột Standard",
    fields: [
      { key: "sensor", label: "Sensor", type: "text" },
      { key: "dpi_max", label: "DPI tối đa", type: "number" },
      { key: "polling_rate", label: "Polling rate (Hz)", type: "select", options: ["125", "500", "1000", "2000", "4000", "8000"] },
      { key: "button_count", label: "Số nút", type: "number" },
      { key: "connectivity", label: "Kết nối", type: "select", options: ["Có dây (USB)", "Không dây 2.4GHz", "Bluetooth", "Đa kết nối"] },
      { key: "is_wireless", label: "Không dây", type: "boolean" },
      { key: "weight_grams", label: "Trọng lượng (g)", type: "number" },
      { key: "battery_life", label: "Thời lượng pin (giờ)", type: "number" },
      { key: "has_rgb", label: "Có RGB", type: "boolean" },
      { key: "hand_orientation", label: "Thuận tay", type: "select", options: ["Phải", "Trái", "Hai bên"] },
      { key: "grip_style", label: "Kiểu cầm", type: "select", options: ["Palm grip", "Claw grip", "Fingertip grip", "Đa năng"] },
      { key: "warranty_months", label: "Bảo hành (tháng)", type: "number" },
    ],
  },
};

// ---------- Chạy ----------

(async () => {
  console.log("=== Seed danh mục linh kiện + spec templates ===");

  // 1) Lấy org
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("code", ORG_CODE)
    .maybeSingle();
  if (orgErr) die("select organization", orgErr);
  if (!org) die("organization", `Chưa có organization "${ORG_CODE}". Chạy scripts/bootstrap-admin.mjs trước.`);
  const orgId = org.id;
  console.log(`✓ Organization: ${ORG_CODE} (${orgId})`);

  // 2) Tạo từng category nếu chưa có
  const catIds = {};
  for (const cat of CATEGORIES) {
    const { data: existing, error: selErr } = await supabase
      .from("categories")
      .select("id")
      .eq("organization_id", orgId)
      .eq("slug", cat.slug)
      .maybeSingle();
    if (selErr) die(`select category ${cat.slug}`, selErr);
    if (existing) {
      catIds[cat.name] = existing.id;
      console.log(`✓ Category đã có: ${cat.name}`);
      continue;
    }
    const { data, error } = await supabase
      .from("categories")
      .insert({
        organization_id: orgId,
        name: cat.name,
        slug: cat.slug,
      })
      .select("id")
      .single();
    if (error) die(`insert category ${cat.slug}`, error);
    catIds[cat.name] = data.id;
    console.log(`✓ Đã tạo category: ${cat.name}`);
  }

  // 3) Upsert spec templates theo (organization_id, name)
  for (const [catName, tpl] of Object.entries(TEMPLATES)) {
    const categoryId = catIds[catName];
    const { data: existing, error: selErr } = await supabase
      .from("spec_templates")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", tpl.name)
      .maybeSingle();
    if (selErr) die(`select template ${tpl.name}`, selErr);

    if (existing) {
      const { error } = await supabase
        .from("spec_templates")
        .update({ category_id: categoryId, fields: tpl.fields })
        .eq("id", existing.id);
      if (error) die(`update template ${tpl.name}`, error);
      console.log(`✓ Cập nhật template: ${tpl.name} (${tpl.fields.length} fields)`);
    } else {
      const { error } = await supabase
        .from("spec_templates")
        .insert({
          organization_id: orgId,
          category_id: categoryId,
          name: tpl.name,
          fields: tpl.fields,
        });
      if (error) die(`insert template ${tpl.name}`, error);
      console.log(`✓ Đã tạo template: ${tpl.name} (${tpl.fields.length} fields)`);
    }
  }

  console.log("");
  console.log("════════════════════════════════════════");
  console.log("✓ Hoàn tất! Vào /quanly/spec-templates để xem.");
  console.log("════════════════════════════════════════");
})();

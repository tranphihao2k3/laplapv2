/**
 * Script seed/update tất cả thông tin store + footer vào settings table.
 * Chạy: npx tsx scripts/seed-store-info.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

type Row = { group_name: string; key: string; value: unknown };

const rows: Row[] = [
  // ===== STORE (basic) =====
  { group_name: "store", key: "name", value: "Laptop Thành Võ" },
  { group_name: "store", key: "description", value: "Hệ thống bán lẻ laptop chính hãng hàng đầu tại Cần Thơ. Cam kết sản phẩm chính hãng, giá tốt nhất." },
  { group_name: "store", key: "address", value: "123 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ" },
  { group_name: "store", key: "phone", value: "1900 1234" },
  { group_name: "store", key: "email", value: "info@laplap.vn" },
  { group_name: "store", key: "hotline", value: "1900 1234" },
  { group_name: "store", key: "warranty_months", value: "12" },
  { group_name: "store", key: "return_policy_days", value: "30" },
  { group_name: "store", key: "shipping_info", value: "Nội thành Cần Thơ trong 2 giờ, hỗ trợ ship toàn quốc" },

  // ===== CONTACT (JSON) =====
  {
    group_name: "contact",
    key: "contact_channels",
    value: JSON.stringify([
      { icon: "phone", label: "Hotline bán hàng", value: "1900 1234", type: "phone" },
      { icon: "headphones", label: "Hỗ trợ kỹ thuật", value: "1900 1234", type: "phone" },
      { icon: "message-circle", label: "Zalo / WhatsApp", value: "0901 234 567", link: "https://zalo.me/0901234567", type: "zalo" },
      { icon: "mail", label: "Email", value: "info@laplap.vn", type: "email" },
    ]),
  },
  {
    group_name: "contact",
    key: "opening_hours",
    value: JSON.stringify({
      weekday: "8:00 - 21:00",
      saturday: "8:00 - 22:00",
      sunday: "9:00 - 20:00",
    }),
  },
  {
    group_name: "contact",
    key: "social_links",
    value: JSON.stringify({
      facebook: "https://facebook.com/laplapcantho",
      zalo: "https://zalo.me/laplapcantho",
      website: "https://laplap.vn",
    }),
  },

  // ===== FOOTER =====
  {
    group_name: "footer",
    key: "footer_description",
    value: "Hệ thống bán lẻ laptop chính hãng hàng đầu tại Cần Thơ. Cam kết sản phẩm chính hãng, giá tốt nhất.",
  },
  {
    group_name: "footer",
    key: "footer_payment_methods",
    value: JSON.stringify(["Visa", "MasterCard", "COD", "MoMo", "VNPay", "Trả góp 0%"]),
  },

  // ===== LEGAL =====
  {
    group_name: "legal",
    key: "legal.business_name",
    value: "CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ LAPTOP THÀNH VÕ",
  },
  { group_name: "legal", key: "legal.tax_id", value: "1800123456" },
  {
    group_name: "legal",
    key: "legal.business_registration_number",
    value: "1800123456",
  },
  {
    group_name: "legal",
    key: "legal.business_registration_issued_by",
    value: "Sở Kế hoạch và Đầu tư thành phố Cần Thơ",
  },
  { group_name: "legal", key: "legal.business_registration_issued_date", value: "2019-03-15" },
  { group_name: "legal", key: "legal.legal_representative", value: "Nguyễn Văn A" },
  { group_name: "legal", key: "legal.legal_representative_title", value: "Giám đốc" },
  { group_name: "legal", key: "legal.content_manager_phone", value: "1900 1234" },
  { group_name: "legal", key: "legal.content_manager_email", value: "info@laplap.vn" },
  {
    group_name: "legal",
    key: "legal.bo_cong_thuong_url",
    value: "https://online.gov.vn/Home/App/Details/PLACEHOLDER",
  },
  { group_name: "legal", key: "legal.bo_cong_thuong_notified_at", value: "2025-01-01" },
];

async function upsertRow(row: Row) {
  const { data: existing } = await supabase
    .from("settings")
    .select("id")
    .eq("group_name", row.group_name)
    .eq("key", row.key)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("settings")
      .update({ value: row.value as never })
      .eq("id", existing.id);
    if (error) throw new Error(`Update ${row.group_name}/${row.key}: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("settings")
      .insert({ group_name: row.group_name, key: row.key, value: row.value as never });
    if (error) throw new Error(`Insert ${row.group_name}/${row.key}: ${error.message}`);
  }
}

async function main() {
  for (const row of rows) {
    await upsertRow(row);
    console.log(`  ✓ ${row.group_name}.${row.key}`);
  }
  console.log(`\n✅ Đã seed ${rows.length} rows vào bảng settings.`);
  console.log("   Refresh trang web để thấy thay đổi.");
}

main().catch((e) => {
  console.error("Lỗi:", e);
  process.exit(1);
});

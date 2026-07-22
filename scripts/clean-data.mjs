/**
 * DỌN SẠCH DỮ LIỆU — giữ lại tối thiểu để bắt đầu vận hành cửa hàng.
 *
 * ⚠️  KHÔNG THỂ HOÀN TÁC. Chạy trên database thật (dùng SERVICE_ROLE key).
 *
 * GIỮ LẠI:
 *   - 1 tài khoản admin (mặc định admin@laplap.vn) + user_profiles của nó
 *   - Tổ chức / Cửa hàng / Kho gắn với admin (giữ 1 bộ để login dùng được ngay)
 *   - Toàn bộ RBAC: roles, permissions, role_permissions, shop_staff (của admin)
 *   - brands (thương hiệu), categories (danh mục), spec_templates (mẫu thông số)
 *     → được "re-stamp" về tổ chức của admin để không bị mồ côi.
 *
 * XOÁ TRẮNG:
 *   - Sản phẩm & biến thể, quà tặng, serial, tồn kho, giao dịch kho
 *   - Đơn hàng, order_items, payments, phiên POS, điểm loyalty
 *   - Bảo hành, phiếu sửa chữa, thu cũ đổi mới, đơn trả hàng
 *   - Đơn nhập hàng (PO) + items, nhà cung cấp, khách hàng
 *   - settings, audit_logs, benchmark_drafts
 *   - Mọi tổ chức / cửa hàng / kho / user KHÁC admin
 *
 * CÁCH DÙNG (bắt buộc có CONFIRM=YES để thực sự xoá):
 *   node scripts/clean-data.mjs               # DRY-RUN: chỉ in số lượng, không xoá
 *   CONFIRM=YES node scripts/clean-data.mjs   # XOÁ THẬT
 *
 * Tuỳ chọn: ADMIN_EMAIL=you@domain.com CONFIRM=YES node scripts/clean-data.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

const envText = readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("✗ Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local");
  process.exit(1);
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@laplap.vn").toLowerCase();
const CONFIRM = process.env.CONFIRM === "YES";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn(...a);

/** Đếm số dòng của 1 bảng (trả -1 nếu bảng không tồn tại). */
async function countRows(table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) {
    if (/does not exist|relation/i.test(error.message)) return -1;
    return -2; // lỗi khác
  }
  return count ?? 0;
}

// Bảng dùng khoá tổng hợp (không có cột "id") → xoá theo cột khác luôn khác null.
const KEY_COLUMN = {
  stock_levels: "warehouse_id",
  role_permissions: "role_id",
};

/** Xoá toàn bộ dòng của 1 bảng. Bỏ qua nếu bảng không tồn tại. */
async function wipe(table) {
  const c = await countRows(table);
  if (c === -1) {
    warn(`  · (bỏ qua) bảng "${table}" không tồn tại`);
    return;
  }
  if (c === 0) {
    log(`  · ${table}: đã trống`);
    return;
  }
  // Xoá tất cả: dùng điều kiện luôn đúng trên cột khoá không null.
  const col = KEY_COLUMN[table] ?? "id";
  const { error } = await supabase.from(table).delete().not(col, "is", null);
  if (error) {
    warn(`  ✗ xoá "${table}" lỗi: ${error.message}`);
    return;
  }
  log(`  ✓ ${table}: đã xoá ${c} dòng`);
}

// Thứ tự XOÁ TRẮNG — con trước, cha sau (tránh vướng khoá ngoại).
const WIPE_TABLES = [
  // Bán hàng
  "payments",
  "order_items",
  "orders",
  "pos_sessions",
  "loyalty_transactions",
  // Hậu mãi
  "warranties",
  "repair_tickets",
  "trade_in_requests",
  "return_order_items",
  "return_orders",
  // Kho & nhập hàng
  "serial_numbers",
  "stock_levels",
  "inventory_transactions",
  "purchase_order_items",
  "purchase_orders",
  // Sản phẩm
  "product_gifts",
  "product_variants",
  "products",
  // Danh bạ
  "customers",
  "suppliers",
  // Hệ thống / nhật ký
  "settings",
  "audit_logs",
  "benchmark_drafts",
];

async function main() {
  log("========================================================");
  log(CONFIRM ? "⚠️  CHẾ ĐỘ XOÁ THẬT (CONFIRM=YES)" : "🔍 DRY-RUN (chưa xoá gì) — thêm CONFIRM=YES để xoá thật");
  log(`   Admin giữ lại: ${ADMIN_EMAIL}`);
  log("========================================================\n");

  // 1) Tìm admin user
  let adminId = null;
  let page = 1;
  while (!adminId) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error("✗ listUsers:", error.message); process.exit(1); }
    const found = data.users.find((u) => (u.email || "").toLowerCase() === ADMIN_EMAIL);
    if (found) { adminId = found.id; break; }
    if (data.users.length < 200) break;
    page++;
  }
  if (!adminId) {
    console.error(`✗ Không tìm thấy tài khoản admin "${ADMIN_EMAIL}". Chạy bootstrap-admin.mjs trước.`);
    process.exit(1);
  }
  log(`✓ Admin user id = ${adminId}`);

  // 2) Org của admin (qua user_profiles)
  const { data: profile } = await supabase
    .from("user_profiles").select("organization_id").eq("id", adminId).maybeSingle();
  const keepOrgId = profile?.organization_id ?? null;
  if (!keepOrgId) {
    console.error("✗ Admin chưa có organization_id trong user_profiles. Chạy bootstrap-admin.mjs trước.");
    process.exit(1);
  }
  log(`✓ Giữ tổ chức id = ${keepOrgId}`);

  // 3) Shop của admin (qua shop_staff, ưu tiên bản ghi active)
  const { data: staffRows } = await supabase
    .from("shop_staff").select("shop_id, is_active").eq("user_id", adminId);
  const keepShopId =
    (staffRows ?? []).find((r) => r.is_active)?.shop_id ??
    (staffRows ?? [])[0]?.shop_id ?? null;
  log(`✓ Giữ cửa hàng id = ${keepShopId ?? "(chưa có — sẽ không giữ shop nào)"}`);

  // ===== DRY-RUN: chỉ in số lượng =====
  if (!CONFIRM) {
    log("\n--- Số dòng sẽ bị XOÁ TRẮNG ---");
    for (const t of WIPE_TABLES) {
      const c = await countRows(t);
      log(`  ${t.padEnd(24)} ${c === -1 ? "(không có bảng)" : c}`);
    }
    const { count: orgOther } = await supabase.from("organizations")
      .select("*", { count: "exact", head: true }).neq("id", keepOrgId);
    const { count: shopOther } = await supabase.from("shops")
      .select("*", { count: "exact", head: true }).neq("id", keepShopId ?? "00000000-0000-0000-0000-000000000000");
    log(`\n  organizations (khác admin)  ${orgOther ?? 0}  → sẽ xoá`);
    log(`  shops (khác admin)          ${shopOther ?? 0}  → sẽ xoá`);
    log(`  auth users (khác admin)     → sẽ xoá\n`);
    log("👉 Chạy lại với:  CONFIRM=YES node scripts/clean-data.mjs");
    return;
  }

  // ===== XOÁ THẬT =====
  log("\n--- Xoá dữ liệu giao dịch / sản phẩm / danh bạ ---");
  for (const t of WIPE_TABLES) await wipe(t);

  // 4) Re-stamp brands/categories/spec_templates về org admin (tránh mồ côi khi xoá org khác)
  log("\n--- Gắn thương hiệu / danh mục / mẫu thông số về tổ chức admin ---");
  for (const t of ["brands", "categories", "spec_templates"]) {
    const { error } = await supabase.from(t).update({ organization_id: keepOrgId }).neq("organization_id", keepOrgId);
    if (error) warn(`  ✗ re-stamp ${t}: ${error.message}`);
    else log(`  ✓ ${t}: đã gắn về org admin`);
  }

  // 5) Xoá kho không thuộc cửa hàng admin.
  //    Lưu ý: .neq("shop_id", x) BỎ QUA dòng shop_id = NULL → phải lấy danh sách id cần giữ
  //    rồi xoá theo "id không thuộc danh sách" để dọn cả kho NULL / mồ côi.
  log("\n--- Xoá kho / cửa hàng / tổ chức thừa ---");
  if (keepShopId) {
    const { data: keepWh } = await supabase.from("warehouses").select("id").eq("shop_id", keepShopId);
    const keepIds = (keepWh ?? []).map((w) => w.id);
    let del = supabase.from("warehouses").delete();
    del = keepIds.length ? del.not("id", "in", `(${keepIds.join(",")})`) : del.not("id", "is", null);
    const { error } = await del;
    if (error) warn(`  ✗ warehouses: ${error.message}`);
    else log(`  ✓ warehouses: chỉ giữ ${keepIds.length} kho của cửa hàng admin`);
  }
  // Xoá roles không thuộc tổ chức admin (role mồ côi từ org đã xoá). Giữ role .neq org (kể cả NULL an toàn).
  {
    const { data: keepRoles } = await supabase.from("roles").select("id").eq("organization_id", keepOrgId);
    const keepRoleIds = (keepRoles ?? []).map((r) => r.id);
    if (keepRoleIds.length) {
      const inList = `(${keepRoleIds.join(",")})`;
      // Dọn role_permissions của role sắp xoá trước (tránh vướng FK)
      await supabase.from("role_permissions").delete().not("role_id", "in", inList);
      const { error } = await supabase.from("roles").delete().not("id", "in", inList);
      if (error) warn(`  ✗ roles: ${error.message}`); else log(`  ✓ roles: chỉ giữ ${keepRoleIds.length} role của tổ chức admin`);
    }
  }
  // Xoá shop_staff không thuộc admin
  {
    const { error } = await supabase.from("shop_staff").delete().neq("user_id", adminId);
    if (error) warn(`  ✗ shop_staff: ${error.message}`); else log("  ✓ shop_staff: chỉ giữ của admin");
  }
  // Xoá shops khác của admin
  if (keepShopId) {
    const { error } = await supabase.from("shops").delete().neq("id", keepShopId);
    if (error) warn(`  ✗ shops: ${error.message}`); else log("  ✓ shops: chỉ giữ cửa hàng admin");
  }
  // Xoá user_profiles khác admin
  {
    const { error } = await supabase.from("user_profiles").delete().neq("id", adminId);
    if (error) warn(`  ✗ user_profiles: ${error.message}`); else log("  ✓ user_profiles: chỉ giữ admin");
  }
  // Xoá organizations khác org admin (làm sau cùng vì nhiều bảng trỏ vào)
  {
    const { error } = await supabase.from("organizations").delete().neq("id", keepOrgId);
    if (error) warn(`  ✗ organizations: ${error.message}`); else log("  ✓ organizations: chỉ giữ tổ chức admin");
  }

  // 6) Xoá mọi auth user khác admin
  log("\n--- Xoá tài khoản đăng nhập thừa ---");
  let p = 1, removed = 0;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: p, perPage: 200 });
    if (error) { warn(`  ✗ listUsers: ${error.message}`); break; }
    for (const u of data.users) {
      if (u.id === adminId) continue;
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delErr) warn(`  ✗ xoá user ${u.email}: ${delErr.message}`);
      else removed++;
    }
    if (data.users.length < 200) break;
    p++;
  }
  log(`  ✓ Đã xoá ${removed} tài khoản (giữ lại ${ADMIN_EMAIL})`);

  log("\n========================================================");
  log("✓ HOÀN TẤT DỌN SẠCH.");
  log("  Giữ lại: admin, RBAC, org/shop/kho của admin, brands, categories, spec_templates.");
  log("  Bước tiếp: đăng nhập /login và làm theo docs/SETUP-CUA-HANG.md");
  log("========================================================");
}

main().catch((e) => { console.error("✗ Lỗi:", e?.message || e); process.exit(1); });

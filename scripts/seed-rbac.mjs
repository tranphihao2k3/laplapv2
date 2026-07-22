/**
 * Seed RBAC: permissions, roles, role_permissions, shop_staff.
 *
 * Idempotent — chạy lại được nhiều lần.
 *
 * Cách dùng:
 *   node scripts/seed-rbac.mjs
 *
 * Yêu cầu .env.local có:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
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
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function die(label, error) {
  console.error(`✗ ${label}:`, error?.message || error);
  process.exit(1);
}

// --- Danh sách quyền (khớp với rbac-presets.ts) ---
const PERMISSIONS = [
  // API yêu cầu
  { code: "orders.create", description: "Tạo đơn hàng / checkout — /api/v1/checkout" },
  { code: "orders.cancel", description: "Hủy đơn hàng — /api/v1/orders/{id}/cancel" },
  { code: "inventory.transfer", description: "Chuyển kho nội bộ — /api/v1/inventory/transfer" },
  { code: "pos.open_session", description: "Mở phiên POS — /api/v1/pos-sessions (POST)" },
  { code: "pos.close_session", description: "Đóng phiên POS — /api/v1/pos-sessions/{id}/close" },
  { code: "purchase_orders.receive", description: "Nhập hàng từ phiếu mua — /api/v1/purchase-orders/{id}/receive" },
  { code: "serial_numbers.bulk_create", description: "Tạo serial hàng loạt — /api/v1/serial-numbers/bulk" },
  { code: "rbac.assign_permissions", description: "Gán quyền cho role — /api/v1/role-permissions(/assign)" },
  // Sản phẩm
  { code: "products.read", description: "Xem sản phẩm" },
  { code: "products.create", description: "Tạo sản phẩm" },
  { code: "products.update", description: "Cập nhật sản phẩm" },
  { code: "products.delete", description: "Xóa sản phẩm" },
  { code: "product_variants.read", description: "Xem biến thể" },
  { code: "product_variants.create", description: "Tạo biến thể" },
  { code: "product_variants.update", description: "Cập nhật biến thể" },
  { code: "product_variants.delete", description: "Xóa biến thể" },
  { code: "brands.read", description: "Xem thương hiệu" },
  { code: "brands.create", description: "Tạo thương hiệu" },
  { code: "brands.update", description: "Cập nhật thương hiệu" },
  { code: "brands.delete", description: "Xóa thương hiệu" },
  { code: "categories.read", description: "Xem danh mục" },
  { code: "categories.create", description: "Tạo danh mục" },
  { code: "categories.update", description: "Cập nhật danh mục" },
  { code: "categories.delete", description: "Xóa danh mục" },
  { code: "spec_templates.read", description: "Xem template thông số" },
  { code: "spec_templates.create", description: "Tạo template thông số" },
  { code: "spec_templates.update", description: "Cập nhật template thông số" },
  { code: "spec_templates.delete", description: "Xóa template thông số" },
  { code: "product_gifts.create", description: "Thêm quà tặng kèm SP" },
  { code: "product_gifts.delete", description: "Xóa quà tặng kèm SP" },
  // Kho
  { code: "inventory.read", description: "Xem tồn kho / inventory transactions" },
  { code: "stock_levels.read", description: "Xem tồn kho" },
  { code: "stock_levels.update", description: "Điều chỉnh tồn kho" },
  { code: "inventory_transactions.read", description: "Xem giao dịch kho" },
  { code: "inventory_transactions.create", description: "Tạo giao dịch kho" },
  { code: "purchase_orders.read", description: "Xem phiếu nhập" },
  { code: "purchase_orders.create", description: "Tạo phiếu nhập" },
  { code: "purchase_orders.update", description: "Cập nhật phiếu nhập" },
  { code: "purchase_orders.delete", description: "Xóa phiếu nhập" },
  { code: "purchase_order_items.read", description: "Xem dòng phiếu nhập" },
  { code: "purchase_order_items.create", description: "Thêm dòng phiếu nhập" },
  { code: "purchase_order_items.update", description: "Cập nhật dòng phiếu nhập" },
  { code: "purchase_order_items.delete", description: "Xóa dòng phiếu nhập" },
  { code: "warehouses.read", description: "Xem kho hàng" },
  { code: "warehouses.create", description: "Tạo kho" },
  { code: "warehouses.update", description: "Cập nhật kho" },
  { code: "warehouses.delete", description: "Xóa kho" },
  { code: "serial_numbers.read", description: "Xem serial / IMEI" },
  { code: "serial_numbers.create", description: "Tạo serial" },
  { code: "serial_numbers.update", description: "Cập nhật serial" },
  { code: "serial_numbers.delete", description: "Xóa serial" },
  // Bán hàng
  { code: "orders.read", description: "Xem đơn hàng" },
  { code: "orders.update", description: "Cập nhật đơn hàng" },
  { code: "orders.delete", description: "Xóa đơn hàng" },
  { code: "order_items.read", description: "Xem dòng đơn hàng" },
  { code: "order_items.create", description: "Thêm dòng đơn hàng" },
  { code: "order_items.update", description: "Cập nhật dòng đơn hàng" },
  { code: "order_items.delete", description: "Xóa dòng đơn hàng" },
  { code: "payments.read", description: "Xem thanh toán" },
  { code: "payments.create", description: "Tạo thanh toán" },
  { code: "payments.update", description: "Cập nhật thanh toán" },
  { code: "payments.delete", description: "Xóa thanh toán" },
  { code: "pos_sessions.read", description: "Xem phiên POS" },
  { code: "pos_sessions.update", description: "Cập nhật phiên POS" },
  { code: "loyalty_transactions.read", description: "Xem giao dịch tích/đổi điểm" },
  { code: "loyalty_transactions.create", description: "Tạo giao dịch điểm thưởng" },
  // Trả hàng
  { code: "returns.read", description: "Xem đơn trả" },
  { code: "returns.create", description: "Tạo đơn trả" },
  { code: "returns.update", description: "Cập nhật đơn trả" },
  { code: "returns.delete", description: "Xóa đơn trả" },
  { code: "returns.approve", description: "Duyệt đơn trả + cộng tồn" },
  // Đối tác
  { code: "customers.read", description: "Xem khách hàng" },
  { code: "customers.create", description: "Tạo khách hàng" },
  { code: "customers.update", description: "Cập nhật khách hàng" },
  { code: "customers.delete", description: "Xóa khách hàng" },
  { code: "suppliers.read", description: "Xem nhà cung cấp" },
  { code: "suppliers.create", description: "Tạo nhà cung cấp" },
  { code: "suppliers.update", description: "Cập nhật nhà cung cấp" },
  { code: "suppliers.delete", description: "Xóa nhà cung cấp" },
  // Sau bán hàng
  { code: "warranties.read", description: "Xem bảo hành" },
  { code: "warranties.create", description: "Tạo bảo hành" },
  { code: "warranties.update", description: "Cập nhật bảo hành" },
  { code: "warranties.delete", description: "Xóa bảo hành" },
  { code: "repair_tickets.read", description: "Xem phiếu sửa chữa" },
  { code: "repair_tickets.create", description: "Tạo phiếu sửa chữa" },
  { code: "repair_tickets.update", description: "Cập nhật phiếu sửa chữa" },
  { code: "repair_tickets.delete", description: "Xóa phiếu sửa chữa" },
  { code: "trade_in_requests.read", description: "Xem yêu cầu thu cũ" },
  { code: "trade_in_requests.create", description: "Tạo yêu cầu thu cũ" },
  { code: "trade_in_requests.update", description: "Cập nhật thu cũ đổi mới" },
  { code: "trade_in_requests.delete", description: "Xóa thu cũ đổi mới" },
  { code: "repair_services.read", description: "Xem dịch vụ sửa chữa" },
  { code: "repair_services.create", description: "Tạo dịch vụ sửa chữa" },
  { code: "repair_services.update", description: "Cập nhật dịch vụ sửa chữa" },
  { code: "repair_services.delete", description: "Xóa dịch vụ sửa chữa" },
  // Nhân sự & phân quyền
  { code: "roles.read", description: "Xem vai trò" },
  { code: "roles.create", description: "Tạo vai trò" },
  { code: "roles.update", description: "Cập nhật vai trò" },
  { code: "roles.delete", description: "Xóa vai trò" },
  { code: "permissions.read", description: "Xem danh mục quyền" },
  { code: "permissions.create", description: "Tạo mã quyền mới" },
  { code: "permissions.update", description: "Cập nhật mã quyền" },
  { code: "permissions.delete", description: "Xóa mã quyền" },
  { code: "shop_staff.read", description: "Xem phân công nhân sự" },
  { code: "shop_staff.create", description: "Tạo phân công nhân sự" },
  { code: "shop_staff.update", description: "Cập nhật phân công nhân sự" },
  { code: "shop_staff.delete", description: "Xóa phân công nhân sự" },
  { code: "user_profiles.read", description: "Xem hồ sơ người dùng" },
  { code: "user_profiles.update", description: "Cập nhật hồ sơ người dùng" },
  // Tổ chức
  { code: "organizations.read", description: "Xem tổ chức" },
  { code: "organizations.create", description: "Tạo tổ chức" },
  { code: "organizations.update", description: "Cập nhật tổ chức" },
  { code: "organizations.delete", description: "Xóa tổ chức" },
  { code: "shops.read", description: "Xem chi nhánh" },
  { code: "shops.create", description: "Tạo chi nhánh" },
  { code: "shops.update", description: "Cập nhật chi nhánh" },
  { code: "shops.delete", description: "Xóa chi nhánh" },
  // Hệ thống
  { code: "audit_logs.read", description: "Xem nhật ký hệ thống" },
  { code: "reports.read", description: "Xem báo cáo" },
  // Quản trị
  { code: "admin.manage_users", description: "Tạo / quản lý tài khoản người dùng" },
  { code: "settings.read", description: "Xem cài đặt hệ thống" },
  { code: "settings.create", description: "Tạo cài đặt" },
  { code: "settings.update", description: "Cập nhật cài đặt" },
  { code: "settings.delete", description: "Xóa cài đặt" },
];

const PERMISSION_CODES = PERMISSIONS.map((p) => p.code);

// --- Roles ---
const ROLES = [
  { code: "admin", name: "Quản trị hệ thống", perms: "all" },
  { code: "manager", name: "Quản lý cửa hàng", perms: ["products.*", "brands.*", "categories.*", "spec_templates.*", "inventory.*", "stock_levels.*", "inventory_transactions.*", "purchase_orders.*", "purchase_order_items.*", "warehouses.*", "serial_numbers.*", "orders.*", "order_items.*", "payments.*", "pos_sessions.*", "loyalty_transactions.*", "returns.*", "customers.*", "suppliers.*", "warranties.*", "repair_tickets.*", "repair_services.*", "trade_in_requests.*", "shops.*", "settings.*", "audit_logs.*"] },
  { code: "staff_sales", name: "Nhân viên bán hàng", perms: ["products.read", "product_variants.read", "categories.read", "brands.read", "orders.read", "orders.create", "order_items.*", "payments.create", "payments.read", "customers.*", "pos_sessions.read", "pos.open_session", "pos.close_session", "loyalty_transactions.read", "loyalty_transactions.create"] },
  { code: "staff_warehouse", name: "Nhân viên kho", perms: ["products.read", "product_variants.read", "inventory.*", "stock_levels.*", "inventory_transactions.*", "purchase_orders.*", "purchase_order_items.*", "warehouses.*", "serial_numbers.*", "serial_numbers.bulk_create"] },
  { code: "staff_repair", name: "Nhân viên kỹ thuật/sửa chữa", perms: ["products.read", "customers.read", "customers.create", "repair_tickets.*", "repair_services.*", "warranties.*"] },
  { code: "accountant", name: "Kế toán", perms: ["orders.read", "payments.*", "returns.*", "purchase_orders.read", "inventory_transactions.read", "reports.read"] },
  { code: "cashier", name: "Thu ngân", perms: ["orders.read", "payments.create", "payments.read", "pos_sessions.read", "pos.open_session", "pos.close_session", "customers.read"] },
  { code: "marketing", name: "Marketing/CSKH", perms: ["customers.*", "orders.read", "loyalty_transactions.*"] },
  { code: "viewer", name: "Chỉ xem (báo cáo)", perms: ["products.read", "brands.read", "categories.read", "orders.read", "payments.read", "customers.read", "suppliers.read", "inventory.read", "reports.read", "audit_logs.read"] },
];

const ADMIN_EMAIL = "admin@laplap.vn";

function matches(code, pattern) {
  if (pattern === "all") return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return code.startsWith(prefix);
  }
  return code === pattern;
}

(async () => {
  console.log("=== Seed RBAC ===");

  // 1) Seed permissions
  let permCount = 0;
  for (const p of PERMISSIONS) {
    const { data: existing } = await supabase
      .from("permissions")
      .select("id")
      .eq("code", p.code)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("permissions").insert({
      code: p.code,
      description: p.description,
    });
    if (error) die(`insert permission ${p.code}`, error);
    permCount++;
  }
  console.log(`✓ Permissions: ${permCount} mới / ${PERMISSIONS.length} tổng`);

  // 2) Lấy tất cả permission IDs
  const { data: allPerms, error: permErr } = await supabase
    .from("permissions")
    .select("id, code");
  if (permErr) die("select permissions", permErr);
  const permMap = new Map(allPerms.map((p) => [p.code, p.id]));

  // 3) Tìm organization đầu tiên
  const { data: orgs } = await supabase.from("organizations").select("id").limit(1);
  if (!orgs || orgs.length === 0) {
    console.log("⚠ Chưa có organization nào. Bỏ qua bước tạo role.");
    console.log("→ Chạy: node scripts/bootstrap-admin.mjs");
    process.exit(0);
  }
  const orgId = orgs[0].id;

  // 4) Tạo roles
  const roleIds = {};
  for (const r of ROLES) {
    const { data: existing } = await supabase
      .from("roles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("code", r.code)
      .maybeSingle();
    if (existing) {
      roleIds[r.code] = existing.id;
      continue;
    }
    const { data, error } = await supabase
      .from("roles")
      .insert({ organization_id: orgId, code: r.code, name: r.name })
      .select("id")
      .single();
    if (error) die(`insert role ${r.code}`, error);
    roleIds[r.code] = data.id;
    console.log(`  ✓ Tạo role: ${r.name} (${r.code})`);
  }
  console.log(`✓ Roles: ${Object.keys(roleIds).length}/${ROLES.length}`);

  // 5) Gán permissions cho roles
  let rpCount = 0;
  for (const r of ROLES) {
    const roleId = roleIds[r.code];
    const patterns = r.perms === "all" ? ["all"] : r.perms;
    const matching = PERMISSION_CODES.filter((code) =>
      patterns.some((pat) => matches(code, pat)),
    );
    for (const code of matching) {
      const permId = permMap.get(code);
      if (!permId) continue;
      const { error } = await supabase
        .from("role_permissions")
        .upsert(
          { role_id: roleId, permission_id: permId },
          { onConflict: "role_id,permission_id", ignoreDuplicates: true },
        );
      if (error) die(`assign ${code} to ${r.code}`, error);
      rpCount++;
    }
  }
  console.log(`✓ Role-permissions: ${rpCount} assignments`);

  // 6) Gán user admin vào role admin
  const { data: users } = await supabase.auth.admin.listUsers();
  const adminUser = users.users.find((u) => u.email === ADMIN_EMAIL);
  if (adminUser) {
    const adminRoleId = roleIds["admin"];
    // Tìm shop đầu tiên
    const { data: shops } = await supabase
      .from("shops")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1);
    if (shops && shops.length > 0) {
      const shopId = shops[0].id;
      const { data: existingStaff } = await supabase
        .from("shop_staff")
        .select("id")
        .eq("shop_id", shopId)
        .eq("user_id", adminUser.id)
        .maybeSingle();
      if (existingStaff) {
        const { error: upErr } = await supabase
          .from("shop_staff")
          .update({ role_id: adminRoleId, is_active: true })
          .eq("id", existingStaff.id);
        if (upErr) die("update shop_staff", upErr);
      } else {
        const { error: inErr } = await supabase
          .from("shop_staff")
          .insert({ shop_id: shopId, user_id: adminUser.id, role_id: adminRoleId, is_active: true });
        if (inErr) die("insert shop_staff", inErr);
      }
      console.log(`✓ Gán ${ADMIN_EMAIL} vào role admin tại shop ${shopId}`);
    } else {
      console.log("⚠ Không tìm thấy shop nào — bỏ qua shop_staff");
    }
  } else {
    console.log(`⚠ Không tìm thấy user ${ADMIN_EMAIL}`);
  }

  console.log("");
  console.log("════════════════════════════════════════");
  console.log("✓ HOÀN TẤT! Đăng nhập lại để refresh session.");
  console.log("════════════════════════════════════════");
})();

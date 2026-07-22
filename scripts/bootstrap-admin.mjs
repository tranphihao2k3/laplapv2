/**
 * Bootstrap tài khoản admin quyền cao nhất.
 *
 * Tạo (idempotent — chạy lại được nhiều lần):
 *   - Auth user: admin@laplap.vn / admin (đã confirm email)
 *   - Organization: "LapLap Admin"
 *   - user_profiles: gắn user vào organization
 *   - Role "Admin" + tất cả permissions
 *   - Shop "Chi nhánh chính" + warehouse
 *   - shop_staff: gán user làm Admin cho shop
 *
 * Cách dùng:
 *   node scripts/bootstrap-admin.mjs
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

// --- Load .env.local đơn giản (không thêm dependency) ---
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

const EMAIL = "admin@laplap.vn";
// Supabase Auth bắt buộc ≥ 6 
// ký tự. Dùng "admin1" để vẫn dễ nhớ.
const PASSWORD = "admin1";
const ORG_CODE = "LAPLAP-ADMIN";
const ORG_NAME = "LapLap Admin";
const SHOP_CODE = "MAIN";
const SHOP_NAME = "Chi nhánh chính";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function die(label, error) {
  console.error(`✗ ${label}:`, error?.message || error);
  process.exit(1);
}

async function ensureUser() {
  // Tìm user theo email (Admin API)
  let userId = null;
  let page = 1;
  while (!userId) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) die("listUsers", error);
    const found = data.users.find((u) => (u.email || "").toLowerCase() === EMAIL);
    if (found) {
      userId = found.id;
      // Reset password + confirm email để chắc chắn login được
      const { error: updErr } = await supabase.auth.admin.updateUserById(found.id, {
        password: PASSWORD,
        email_confirm: true,
      });
      if (updErr) die("updateUserById", updErr);
      console.log(`✓ User đã tồn tại — đã reset password: ${EMAIL} (id=${userId})`);
      break;
    }
    if (data.users.length < 200) break; // hết trang
    page++;
  }

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: "Admin" },
    });
    if (error) die("createUser", error);
    userId = data.user.id;
    console.log(`✓ Đã tạo auth user: ${EMAIL} (id=${userId})`);
  }
  return userId;
}

async function ensureOrg() {
  const { data: existing, error: selErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("code", ORG_CODE)
    .maybeSingle();
  if (selErr) die("select organization", selErr);
  if (existing) {
    console.log(`✓ Organization đã tồn tại: ${ORG_CODE} (id=${existing.id})`);
    return existing.id;
  }
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: ORG_NAME, code: ORG_CODE })
    .select("id")
    .single();
  if (error) die("insert organization", error);
  console.log(`✓ Đã tạo organization: ${ORG_CODE} (id=${data.id})`);
  return data.id;
}

async function ensureProfile(userId, orgId) {
  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: userId,
        organization_id: orgId,
        full_name: "Super Admin",
        phone: "0000000000",
      },
      { onConflict: "id" },
    );
  if (error) die("upsert user_profiles", error);
  console.log(`✓ user_profiles cập nhật: user=${userId} org=${orgId}`);
}

async function ensureRoleAdmin(orgId) {
  const { data: existing, error: selErr } = await supabase
    .from("roles")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", "Admin")
    .maybeSingle();
  if (selErr) die("select role", selErr);
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("roles")
    .insert({ organization_id: orgId, name: "Admin", code: "admin" })
    .select("id")
    .single();
  if (error) die("insert role", error);
  console.log(`✓ Đã tạo role Admin (id=${data.id})`);
  return data.id;
}

async function ensureAllPermissionsForRole(roleId) {
  const { data: perms, error } = await supabase.from("permissions").select("id, code");
  if (error) die("select permissions", error);
  if (!perms || perms.length === 0) {
    console.log("⚠ Bảng permissions rỗng — không có gì để gán. (Bỏ qua)");
    return;
  }
  const rows = perms.map((p) => ({ role_id: roleId, permission_id: p.id }));
  const { error: upErr } = await supabase.from("role_permissions").upsert(rows, {
    onConflict: "role_id,permission_id",
    ignoreDuplicates: true,
  });
  if (upErr) die("upsert role_permissions", upErr);
  console.log(`✓ Đã gán ${perms.length} permission cho role Admin`);
}

async function ensureShop(orgId) {
  const { data: existing, error: selErr } = await supabase
    .from("shops")
    .select("id")
    .eq("organization_id", orgId)
    .eq("code", SHOP_CODE)
    .maybeSingle();
  if (selErr) die("select shop", selErr);
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("shops")
    .insert({
      organization_id: orgId,
      name: SHOP_NAME,
      code: SHOP_CODE,
      address: "Trụ sở chính",
      phone: "0000000000",
      timezone: "Asia/Ho_Chi_Minh",
      is_active: true,
    })
    .select("id")
    .single();
  if (error) die("insert shop", error);
  console.log(`✓ Đã tạo shop ${SHOP_CODE} (id=${data.id})`);
  return data.id;
}

async function ensureWarehouse(shopId) {
  const { data: existing } = await supabase
    .from("warehouses")
    .select("id")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("warehouses")
    .insert({ shop_id: shopId, name: "Kho chính", type: "store" })
    .select("id")
    .single();
  if (error) die("insert warehouse", error);
  console.log(`✓ Đã tạo warehouse (id=${data.id})`);
  return data.id;
}

async function ensureShopStaff(shopId, userId, roleId) {
  const { data: existing, error: selErr } = await supabase
    .from("shop_staff")
    .select("id, role_id, is_active")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) die("select shop_staff", selErr);

  if (existing) {
    const { error } = await supabase
      .from("shop_staff")
      .update({ role_id: roleId, is_active: true })
      .eq("id", existing.id);
    if (error) die("update shop_staff", error);
    console.log(`✓ shop_staff đã cập nhật (id=${existing.id})`);
    return existing.id;
  }
  const { data, error } = await supabase
    .from("shop_staff")
    .insert({ shop_id: shopId, user_id: userId, role_id: roleId, is_active: true })
    .select("id")
    .single();
  if (error) die("insert shop_staff", error);
  console.log(`✓ Đã gán user vào shop_staff (id=${data.id})`);
  return data.id;
}

(async () => {
  console.log("=== Bootstrap admin account ===");
  const userId = await ensureUser();
  const orgId = await ensureOrg();
  await ensureProfile(userId, orgId);
  const roleId = await ensureRoleAdmin(orgId);
  await ensureAllPermissionsForRole(roleId);
  const shopId = await ensureShop(orgId);
  await ensureWarehouse(shopId);
  await ensureShopStaff(shopId, userId, roleId);

  console.log("");
  console.log("════════════════════════════════════════");
  console.log("✓ HOÀN TẤT — đăng nhập tại /login:");
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Mật khẩu: ${PASSWORD}`);
  console.log("════════════════════════════════════════");
})();

/**
 * Gán 1 tài khoản (theo email) vào org LAPLAP-ADMIN với role Admin + đủ 120 quyền.
 * Dùng khi tài khoản bạn đang đăng nhập bị 403 (chưa có org/quyền).
 *
 * Chạy:  node scripts/grant-admin.mjs you@example.com
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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = (process.argv[2] || "").toLowerCase().trim();
if (!EMAIL) {
  console.error("Cách dùng: node scripts/grant-admin.mjs you@example.com");
  process.exit(1);
}
const die = (l, e) => { console.error(`✗ ${l}:`, e?.message || e); process.exit(1); };

// 1) Tìm user theo email
let userId = null, page = 1;
while (true) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  if (error) die("listUsers", error);
  const f = data.users.find((u) => (u.email || "").toLowerCase() === EMAIL);
  if (f) { userId = f.id; break; }
  if (data.users.length < 200) break;
  page++;
}
if (!userId) die("user", `Không tìm thấy tài khoản ${EMAIL}. Hãy đăng ký/đăng nhập trước.`);
console.log("✓ user:", userId);

// 2) Org LAPLAP-ADMIN
const { data: org } = await sb.from("organizations").select("id").eq("code", "LAPLAP-ADMIN").maybeSingle();
if (!org) die("org", "Chưa có org LAPLAP-ADMIN. Chạy bootstrap-admin.mjs trước.");
const orgId = org.id;

// 3) Profile
{
  const { error } = await sb.from("user_profiles").upsert(
    { id: userId, organization_id: orgId, full_name: EMAIL.split("@")[0], phone: "0000000000" },
    { onConflict: "id" },
  );
  if (error) die("upsert profile", error);
  console.log("✓ profile gắn org");
}

// 4) Role Admin (đã có sẵn từ bootstrap)
const { data: role } = await sb.from("roles").select("id").eq("organization_id", orgId).eq("name", "Admin").maybeSingle();
if (!role) die("role", "Chưa có role Admin. Chạy bootstrap-admin.mjs trước.");
const roleId = role.id;

// 5) Đảm bảo role có đủ quyền
{
  const { data: perms } = await sb.from("permissions").select("id");
  const rows = (perms ?? []).map((p) => ({ role_id: roleId, permission_id: p.id }));
  if (rows.length) {
    const { error } = await sb.from("role_permissions").upsert(rows, { onConflict: "role_id,permission_id", ignoreDuplicates: true });
    if (error) die("role_permissions", error);
  }
  console.log(`✓ role Admin có ${rows.length} quyền`);
}

// 6) Shop MAIN
const { data: shop } = await sb.from("shops").select("id").eq("organization_id", orgId).eq("code", "MAIN").maybeSingle();
if (!shop) die("shop", "Chưa có shop MAIN. Chạy bootstrap-admin.mjs trước.");
const shopId = shop.id;

// 7) shop_staff
{
  const { data: ex } = await sb.from("shop_staff").select("id").eq("shop_id", shopId).eq("user_id", userId).maybeSingle();
  if (ex) {
    const { error } = await sb.from("shop_staff").update({ role_id: roleId, is_active: true }).eq("id", ex.id);
    if (error) die("update shop_staff", error);
  } else {
    const { error } = await sb.from("shop_staff").insert({ shop_id: shopId, user_id: userId, role_id: roleId, is_active: true });
    if (error) die("insert shop_staff", error);
  }
  console.log("✓ shop_staff (Admin, active)");
}

console.log(`\n✓ HOÀN TẤT — ${EMAIL} giờ là Admin. Reload lại trang admin (có thể cần đăng xuất/đăng nhập lại).`);

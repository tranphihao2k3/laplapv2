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
const EMAIL = "admin@laplap.vn";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== Kiểm tra quyền truy cập admin ===\n");

const { data: users } = await supabase.auth.admin.listUsers();
const user = users.users.find(u => (u.email || "").toLowerCase() === EMAIL);

if (!user) {
  console.log("❌ Không tìm thấy user admin@laplap.vn");
  process.exit(1);
}

const userId = user.id;
console.log("✓ User ID:", userId);
console.log("✓ Email confirmed:", user.email_confirmed_at ? "Yes" : "No");

const { data: profile, error: profileErr } = await supabase
  .from("user_profiles")
  .select("organization_id, full_name, phone")
  .eq("id", userId)
  .maybeSingle();

if (profileErr) {
  console.log("❌ Lỗi query user_profiles:", profileErr.message);
  process.exit(1);
}

if (!profile) {
  console.log("❌ Không tìm thấy user_profiles");
  process.exit(1);
}

console.log("✓ Profile:", profile);

if (!profile.organization_id) {
  console.log("❌ organization_id = NULL");
  process.exit(1);
}

const { data: org } = await supabase
  .from("organizations")
  .select("id, name, code")
  .eq("id", profile.organization_id)
  .maybeSingle();

console.log("✓ Organization:", org);

const { data: staffRecords, error: staffErr } = await supabase
  .from("shop_staff")
  .select("id, shop_id, role_id, is_active, shops(name, code), roles(name, code)")
  .eq("user_id", userId);

if (staffErr) {
  console.log("❌ Lỗi query shop_staff:", staffErr.message);
  process.exit(1);
}

console.log("\n✓ Shop staff records:", staffRecords?.length || 0);
staffRecords?.forEach((s, i) => {
  console.log(`  [${i + 1}] Shop: ${s.shops?.name} (${s.shops?.code}), Role: ${s.roles?.name}, Active: ${s.is_active}`);
});

const activeStaff = staffRecords?.filter(s => s.is_active);
if (!activeStaff || activeStaff.length === 0) {
  console.log("\n❌ KHÔNG CÓ shop_staff active! User không thể truy cập /quanly");
  process.exit(1);
}

const { data: permissions } = await supabase
  .from("shop_staff")
  .select("roles!inner(role_permissions!inner(permissions!inner(code)))")
  .eq("user_id", userId)
  .eq("is_active", true);

const permCodes = new Set();
permissions?.forEach(s => {
  s.roles?.role_permissions?.forEach(rp => {
    if (rp.permissions?.code) permCodes.add(rp.permissions.code);
  });
});

console.log(`\n✓ Permissions: ${permCodes.size} quyền`);
if (permCodes.size > 0) {
  console.log("  Ví dụ:", Array.from(permCodes).slice(0, 5).join(", "));
}

console.log("\n✅ Tài khoản admin có đầy đủ quyền truy cập!");

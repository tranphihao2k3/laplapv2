/**
 * Dọn kho demo trùng + role trùng lặp sau khi clean-data.
 *   - Kho: chỉ giữ 1 kho "store" của cửa hàng admin (kho bootstrap tạo).
 *   - Role: giữ 1 role cho mỗi code (ưu tiên role admin đang gán cho tài khoản admin).
 *
 * DRY-RUN mặc định; CONFIRM=YES để xoá thật.
 *   node scripts/dedupe-warehouses-roles.mjs
 *   CONFIRM=YES node scripts/dedupe-warehouses-roles.mjs
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
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@laplap.vn").toLowerCase();
const CONFIRM = process.env.CONFIRM === "YES";
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const log = (...a) => console.log(...a);

async function main() {
  log(CONFIRM ? "⚠️  XOÁ THẬT" : "🔍 DRY-RUN (thêm CONFIRM=YES để xoá)");

  // admin id + shop + role đang gán
  let adminId = null, p = 1;
  while (!adminId) {
    const { data } = await s.auth.admin.listUsers({ page: p, perPage: 200 });
    const f = data.users.find((u) => (u.email || "").toLowerCase() === ADMIN_EMAIL);
    if (f) { adminId = f.id; break; }
    if (data.users.length < 200) break; p++;
  }
  const { data: staff } = await s.from("shop_staff").select("shop_id, role_id").eq("user_id", adminId);
  const keepShopId = (staff ?? [])[0]?.shop_id ?? null;
  const adminRoleId = (staff ?? [])[0]?.role_id ?? null;
  log(`  admin=${adminId}  shop=${keepShopId}  role đang gán=${adminRoleId}`);

  // ---- KHO: giữ 1 kho store của cửa hàng admin ----
  const { data: whs } = await s.from("warehouses").select("id,name,type,created_at").eq("shop_id", keepShopId).order("created_at", { ascending: true });
  const keepWh = whs.find((w) => w.type === "store") ?? whs[0];
  const dropWh = whs.filter((w) => w.id !== keepWh.id).map((w) => w.id);
  log(`\n  KHO: giữ "${keepWh.name}" (${keepWh.id.slice(0,8)}), xoá ${dropWh.length} kho`);
  if (CONFIRM && dropWh.length) {
    const { error } = await s.from("warehouses").delete().in("id", dropWh);
    log(error ? `  ✗ ${error.message}` : `  ✓ đã xoá ${dropWh.length} kho`);
  }

  // ---- ROLE: giữ 1 role / code ----
  const { data: roles } = await s.from("roles").select("id,name,code,created_at").order("created_at", { ascending: true });
  const keepByCode = new Map();
  for (const r of roles) {
    const key = r.code || r.id;
    // ưu tiên giữ role admin đang được gán
    if (r.id === adminRoleId) keepByCode.set(key, r.id);
    else if (!keepByCode.has(key)) keepByCode.set(key, r.id);
  }
  const keepRoleIds = new Set(keepByCode.values());
  const dropRoles = roles.filter((r) => !keepRoleIds.has(r.id)).map((r) => r.id);
  log(`\n  ROLE: giữ ${keepRoleIds.size} role (mỗi code 1), xoá ${dropRoles.length} bản trùng`);
  if (CONFIRM && dropRoles.length) {
    await s.from("role_permissions").delete().in("role_id", dropRoles);
    // gỡ shop_staff trỏ tới role sắp xoá (nếu có) — trừ admin đã giữ
    await s.from("shop_staff").delete().in("role_id", dropRoles);
    const { error } = await s.from("roles").delete().in("id", dropRoles);
    log(error ? `  ✗ ${error.message}` : `  ✓ đã xoá ${dropRoles.length} role`);
  }

  log("\n✓ Xong." + (CONFIRM ? "" : "  (chưa xoá — thêm CONFIRM=YES)"));
}
main().catch((e) => { console.error("✗", e?.message || e); process.exit(1); });

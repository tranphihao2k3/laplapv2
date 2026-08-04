/**
 * Verify (READ-ONLY) rang setup tool catalog da xong:
 *   1. Bang `tools` ton tai (migration 021 da chay).
 *   2. Permission 'admin.manage_tools' ton tai trong bang permissions.
 *   3. Permission do da duoc gan vao role admin (role_permissions).
 *
 * Khong ghi gi vao DB. Chay: node scripts/verify-tools-setup.mjs
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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

let fail = 0;
const ok = (m) => console.log(`  OK   ${m}`);
const bad = (m) => {
  console.log(`  FAIL ${m}`);
  fail++;
};

// 1) Bang tools
const { data: tools, error: tErr } = await supabase
  .from("tools")
  .select("id, name, status, r2_key")
  .limit(5);
if (tErr) bad(`bang 'tools': ${tErr.message}`);
else ok(`bang 'tools' ton tai (${tools.length} row hien co)`);

// 2) Permission ton tai
const { data: perm, error: pErr } = await supabase
  .from("permissions")
  .select("id, code, description")
  .eq("code", "admin.manage_tools")
  .maybeSingle();
if (pErr) bad(`query permissions: ${pErr.message}`);
else if (!perm) bad("permission 'admin.manage_tools' CHUA co -> chay seed-rbac.mjs");
else ok(`permission 'admin.manage_tools' id=${perm.id}`);

// 3) Da gan vao role admin chua
if (perm) {
  const { data: adminRoles, error: rErr } = await supabase
    .from("roles")
    .select("id, code, name")
    .eq("code", "admin");
  if (rErr) bad(`query roles: ${rErr.message}`);
  else if (!adminRoles?.length) bad("khong tim thay role 'admin'");
  else {
    for (const role of adminRoles) {
      const { data: rp, error: rpErr } = await supabase
        .from("role_permissions")
        .select("role_id")
        .eq("role_id", role.id)
        .eq("permission_id", perm.id)
        .maybeSingle();
      if (rpErr) bad(`query role_permissions: ${rpErr.message}`);
      else if (!rp) bad(`role admin (${role.id}) CHUA co quyen -> chay seed-rbac.mjs`);
      else ok(`role admin (${role.id}) da co 'admin.manage_tools'`);
    }
  }
}

console.log(fail === 0 ? "\nTAT CA OK" : `\n${fail} kiem tra THAT BAI`);
process.exit(fail === 0 ? 0 : 1);

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
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.listUsers();
if (error) {
  console.error("Error:", error);
  process.exit(1);
}

const adminUser = data.users.find(u => (u.email || "").toLowerCase() === "admin@laplap.vn");
if (!adminUser) {
  console.log("❌ Không tìm thấy user admin@laplap.vn");
  process.exit(1);
}

console.log("=== Admin User Details ===");
console.log("ID:", adminUser.id);
console.log("Email:", adminUser.email);
console.log("Email confirmed:", adminUser.email_confirmed_at ? "✓ Yes" : "✗ No");
console.log("Created:", adminUser.created_at);
console.log("Last login:", adminUser.last_sign_in_at || "Never");
console.log("User metadata:", JSON.stringify(adminUser.user_metadata, null, 2));

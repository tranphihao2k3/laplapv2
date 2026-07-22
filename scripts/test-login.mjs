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
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = "admin@laplap.vn";
const PASSWORD = "admin1";

console.log("=== Test đăng nhập với client credentials ===\n");
console.log("URL:", SUPABASE_URL);
console.log("Email:", EMAIL);
console.log("Password:", PASSWORD);
console.log("");

const supabase = createClient(SUPABASE_URL, ANON_KEY);

console.log("Đang gọi signInWithPassword...");
const { data, error } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});

if (error) {
  console.log("\n❌ LỖI ĐĂNG NHẬP:");
  console.log("  Code:", error.code || error.name);
  console.log("  Status:", error.status);
  console.log("  Message:", error.message);
  console.log("\nĐây chính là lỗi mà client gặp phải!");
  process.exit(1);
}

if (!data.session) {
  console.log("\n❌ Không tạo được session (nhưng không có lỗi)");
  console.log("Data:", data);
  process.exit(1);
}

console.log("\n✅ ĐĂNG NHẬP THÀNH CÔNG!");
console.log("User ID:", data.user.id);
console.log("Email:", data.user.email);
console.log("Session expires:", new Date(data.session.expires_at * 1000).toISOString());
console.log("\nKết luận: Tài khoản admin@laplap.vn / admin1 hoạt động bình thường!");

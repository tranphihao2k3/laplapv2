/**
 * Script update tên store trong settings table
 * Chạy: npx tsx scripts/update-store-name.ts
 *
 * Lưu ý: cần SUPABASE_SERVICE_ROLE_KEY hợp lệ (key trong .env.local có thể đã
 * bị rotate — lấy key mới từ dashboard Supabase hoặc từ máy deploy:
 *   flyctl ssh console -a laplapv2 -C "printenv SUPABASE_SERVICE_ROLE_KEY"
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const STORE_NAME = "Laptop Thành Võ";

// Load env
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local");
  process.exit(1);
}

async function main() {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // First check if record exists
  const { data: existing } = await supabase
    .from("settings")
    .select("id")
    .eq("group_name", "store")
    .eq("key", "name")
    .maybeSingle();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("settings")
      .update({ value: STORE_NAME })
      .eq("id", existing.id);

    if (error) {
      console.error("Lỗi update:", error.message);
      process.exit(1);
    }
  } else {
    // Insert new
    const { error } = await supabase
      .from("settings")
      .insert({
        group_name: "store",
        key: "name",
        value: STORE_NAME,
      });

    if (error) {
      console.error("Lỗi insert:", error.message);
      process.exit(1);
    }
  }

  console.log(`✅ Đã đổi tên store thành '${STORE_NAME}'`);
}

main();

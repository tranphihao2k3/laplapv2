/**
 * Script update tên store trong settings table
 * Chạy: npx tsx scripts/update-store-name.ts
 *
 * Lưu ý: cần SUPABASE_SERVICE_ROLE_KEY hợp lệ (key trong .env.local có thể đã
 * bị rotate — lấy key mới từ dashboard Supabase hoặc từ máy deploy:
 *   flyctl ssh console -a laplapv2 -C "printenv SUPABASE_SERVICE_ROLE_KEY"
 *
 * Script ghi thẳng bảng `settings` nên KHÔNG trigger `revalidateTag` của
 * `settingsService`. Vì vậy sau khi update, script gọi
 * `POST /api/admin/revalidate-store` (Bearer CRON_SECRET) để xoá cache
 * server-side — nếu không, tên mới chỉ hiện sau khi TTL 1h hết hạn.
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

  // Xoá cache server-side để tên mới hiện ngay (không đợi TTL 1h).
  await revalidateStoreCache();
}

/**
 * Gọi endpoint revalidate của production để xoá cache store-info.
 *
 * Target URL lấy theo thứ tự:
 *   1. `STORE_REVALIDATE_URL` (biến môi trường, ví dụ trong CI).
 *   2. `NEXT_PUBLIC_APP_URL` — nhưng file .env.local CỦA MÁY DEV trỏ về
 *      http://localhost:3000, nên sẽ bỏ qua nếu là localhost.
 *   3. Fallback cố định về domain production.
 *
 * Best-effort: nếu thiếu CRON_SECRET hoặc endpoint lỗi thì chỉ cảnh báo,
 * cache vẫn tự hết hạn sau 1h.
 */
async function revalidateStoreCache() {
  const secret = process.env.CRON_SECRET;
  const fallback = "https://laplapcantho.store";
  const configured = (process.env.STORE_REVALIDATE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  const appUrl = configured && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(configured)
    ? configured
    : fallback;

  if (!secret) {
    console.warn("⚠️  Thiếu CRON_SECRET — bỏ qua revalidate cache.");
    return;
  }
  try {
    const res = await fetch(`${appUrl.replace(/\/$/, "")}/api/admin/revalidate-store`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (res.ok) {
      console.log(`✅ Đã revalidate cache store-info tại ${appUrl}.`);
    } else {
      console.warn(`⚠️  Revalidate cache thất bại (HTTP ${res.status}) tại ${appUrl}.`);
    }
  } catch (err) {
    console.warn("⚠️  Không gọi được revalidate cache:", (err as Error).message);
  }
}

main();

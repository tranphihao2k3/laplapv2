/**
 * Script debug: liệt kê TOÀN BỘ row trong bảng `settings` kèm scope.
 * Chạy: npx tsx scripts/debug-settings-name.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local");
  process.exit(1);
}

async function main() {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("settings")
    .select("id, group_name, key, value, shop_id, organization_id")
    .order("group_name")
    .order("key");

  if (error) {
    console.error("Lỗi query:", error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  console.log(`Tổng ${rows.length} row trong bảng settings:\n`);

  // Gom theo (group, key) để thấy row trùng.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.group_name}::${r.key}`;
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }

  for (const [k, list] of groups) {
    const mark = list.length > 1 ? "🔴 TRÙNG" : "  ok  ";
    console.log(`${mark} ${k}  (${list.length} row)`);
    for (const r of list) {
      console.log(
        `         id=${r.id} org=${String(r.organization_id ?? "-").slice(0, 8)} shop=${String(r.shop_id ?? "-").slice(0, 8)} value=${JSON.stringify(r.value).slice(0, 70)}`,
      );
    }
  }
}

main();

/**
 * Migration: xoá multi-shop, giữ lại 1 cửa hàng duy nhất.
 *
 * - Xoá 2nd shop (LTV / df3b1480-...-650)
 * - Xoá shop_staff rows không còn trỏ vào shop nào
 * - Giữ nguyên `shops` table + FK constraints (vì còn ~7 bảng đang dùng: orders,
 *   pos_sessions, repair_tickets, settings, shop_staff, warehouses, ...)
 * - Code refactor sẽ tự xử lý việc không còn dùng shopId trong queries
 *
 * Run: npx tsx scripts/migrate-single-shop.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("Missing env");

const s = createClient(url, key);

async function main() {
  // 1. List all shops
  const { data: shops, error } = await s
    .from("shops")
    .select("id, name, code, is_active, primary_domain, created_at")
    .order("created_at");
  if (error) throw error;
  console.log("Shops trước khi xoá:");
  console.table(shops);

  // 2. Xác định shop giữ lại (cũ nhất, MAIN)
  const keep = shops!.find((x) => x.code === "MAIN") ?? shops![0];
  const dropIds = shops!.filter((x) => x.id !== keep.id).map((x) => x.id);
  console.log(`\nGiữ lại: ${keep.id} (${keep.name} / ${keep.code})`);
  console.log(`Xoá: ${dropIds.join(", ")}`);

  // 3. Move settings.shop_id rows về keep.id (vì có FK)
  console.log("\nMigrating settings.shop_id...");
  for (const dropId of dropIds) {
    const { data: settings } = await s
      .from("settings")
      .select("id, key, group_name, shop_id")
      .eq("shop_id", dropId);
    console.log(`  ${settings?.length ?? 0} settings rows thuộc shop ${dropId}`);

    // Nếu setting key đã tồn tại ở keep.id thì xoá row drop
    // Nếu chưa thì update shop_id
    for (const row of settings ?? []) {
      const { data: existing } = await s
        .from("settings")
        .select("id")
        .eq("shop_id", keep.id)
        .eq("key", row.key)
        .eq("group_name", row.group_name)
        .maybeSingle();
      if (existing) {
        await s.from("settings").delete().eq("id", row.id);
        console.log(`    - xoá dup setting ${row.group_name}.${row.key}`);
      } else {
        await s.from("settings").update({ shop_id: keep.id }).eq("id", row.id);
        console.log(`    + migrate setting ${row.group_name}.${row.key} → keep.id`);
      }
    }
  }

  // 4. Xoá shop_staff rows thuộc shop drop
  for (const dropId of dropIds) {
    const { data: staff } = await s
      .from("shop_staff")
      .select("id, user_id")
      .eq("shop_id", dropId);
    if (staff && staff.length) {
      await s.from("shop_staff").delete().eq("shop_id", dropId);
      console.log(`  Xoá ${staff.length} shop_staff rows của ${dropId}`);
    }
  }

  // 5. Set shop_id = keep.id cho orders/pos_sessions/repair_tickets/warehouses
  // của shop drop (giữ data, chỉ đổi FK)
  for (const table of ["orders", "pos_sessions", "repair_tickets", "warehouses"]) {
    for (const dropId of dropIds) {
      const { count } = await s
        .from(table as never)
        .select("*", { count: "exact", head: true })
        .eq("shop_id", dropId);
      if (count && count > 0) {
        await s.from(table as never).update({ shop_id: keep.id }).eq("shop_id", dropId);
        console.log(`  Migrate ${count} ${table} rows → keep.id`);
      }
    }
  }

  // 6. Xoá shop drop
  for (const dropId of dropIds) {
    const { error: delErr } = await s.from("shops").delete().eq("id", dropId);
    if (delErr) {
      console.error(`  ❌ Không thể xoá shop ${dropId}: ${delErr.message}`);
    } else {
      console.log(`  ✓ Xoá shop ${dropId}`);
    }
  }

  // 7. Verify
  const { data: after } = await s
    .from("shops")
    .select("id, name, code, is_active, primary_domain")
    .order("created_at");
  console.log("\nShops sau khi xoá:");
  console.table(after);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

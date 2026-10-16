/**
 * Check FK constraints pointing AT shops table.
 * Run: npx tsx scripts/check-shops-fk.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing env");

const s = createClient(url, key);

async function main() {
  // Query pg_constraint directly via REST PostgREST RPC? Use the actual constraint query as raw SQL.
  // Supabase JS doesn't expose raw SQL, so use information_schema.
  const { data: fks, error } = await s
    .from("information_schema.table_constraints" as never)
    .select("constraint_name, table_name")
    .eq("constraint_type", "FOREIGN KEY")
    .eq("constraint_schema", "public");

  if (error) {
    console.error("FK list error (likely RLS):", error.message);
  } else {
    console.log("All FKs in public schema:");
    console.table(fks);
  }

  // Check tables that have a `shop_id` column
  const { data: cols, error: e2 } = await s
    .from("information_schema.columns" as never)
    .select("table_name, column_name, data_type, is_nullable")
    .eq("table_schema", "public")
    .eq("column_name", "shop_id");

  if (e2) {
    console.error("cols error:", e2.message);
  } else {
    console.log("\nTables with shop_id column:");
    console.table(cols);
  }

  // Check tables that have a `shops` FK via primary_domain / allowed_domains — already covered
  // by constraint list above.

  // Show row counts for shops + tables with shop_id to see what data is at risk
  console.log("\nRow counts:");
  const { count: shopCount } = await s.from("shops").select("*", { count: "exact", head: true });
  console.log(`  shops: ${shopCount}`);

  if (cols) {
    for (const c of cols as Array<{ table_name: string }>) {
      const { count } = await s
        .from(c.table_name as never)
        .select("*", { count: "exact", head: true });
      console.log(`  ${c.table_name}: ${count}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * apply-migration.ts
 *
 * Apply Supabase migration SQL qua PostgREST + service-role key.
 * Cách này bypass Supabase MCP, dùng trực tiếp connection string.
 *
 * Cấu hình qua env:
 *   SUPABASE_DB_URL  — connection string Postgres trực tiếp
 *                       (lấy từ Supabase Dashboard → Settings → Database → Connection string)
 *                       Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
 *
 * Chạy:  node --import tsx scripts/apply-migration.ts supabase/migrations/20261011000000_account_customer_linking.sql
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const sqlPath = process.argv[2] ?? "supabase/migrations/20261011000000_account_customer_linking.sql";
const connStr = process.env.SUPABASE_DB_URL;

if (!connStr) {
  console.error("ERROR: SUPABASE_DB_URL chưa set trong env.");
  console.error("Lấy connection string từ Supabase Dashboard → Settings → Database → Connection string");
  console.error("Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres");
  process.exit(1);
}

async function main() {
  const absPath = resolve(process.cwd(), sqlPath);
  const sql = readFileSync(absPath, "utf8");
  console.log(`[apply-migration] Đọc file: ${absPath}`);
  console.log(`[apply-migration] SQL length: ${sql.length} chars`);

  const sql_ = postgres(connStr, { max: 1, prepare: false });
  try {
    console.log("[apply-migration] Kết nối database...");
    await sql_.begin(async (sqlTx) => {
      // Tách SQL thành các statement riêng (Postgres chạy từng statement một)
      // Skip dòng comment, statement rỗng
      const statements = sql
        .split(/;\s*(?:\n|$)/g)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      let i = 0;
      for (const stmt of statements) {
        i++;
        const firstLine = stmt.split("\n")[0]?.trim() ?? "";
        const preview = firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
        try {
          await sqlTx.unsafe(stmt);
          console.log(`  [${i}/${statements.length}] OK: ${preview}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Nếu chỉ là "already exists" type thì vẫn OK
          if (
            msg.includes("already exists") ||
            msg.includes("does not exist")
          ) {
            console.log(`  [${i}/${statements.length}] SKIP: ${preview} (${msg.split("\n")[0]})`);
            continue;
          }
          console.error(`  [${i}/${statements.length}] FAIL: ${preview}`);
          console.error(`    ${msg}`);
          throw err;
        }
      }
    });
    console.log("[apply-migration] Hoàn tất!");
  } catch (err) {
    console.error("[apply-migration] FAILED:", err);
    process.exit(2);
  } finally {
    await sql_.end({ timeout: 5 });
  }
}

main();

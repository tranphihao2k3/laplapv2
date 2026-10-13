/**
 * apply-migration-pg.mjs
 *
 * Apply Supabase migration SQL qua pg (node-postgres).
 * Giống scripts/apply-migration.ts nhưng dùng `pg` thay vì `postgres`
 * (vì dự án này chưa cài `postgres` npm package).
 *
 *   SUPABASE_DB_URL=postgresql://postgres:[JWT]@db.[REF].supabase.co:5432/postgres
 *   node scripts/apply-migration-pg.mjs supabase/migrations/xxx.sql
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const sqlPath = process.argv[2];
const connStr = process.env.SUPABASE_DB_URL;

if (!sqlPath) {
  console.error("Usage: node scripts/apply-migration-pg.mjs <path-to-sql>");
  process.exit(1);
}
if (!connStr) {
  console.error("ERROR: SUPABASE_DB_URL chưa set.");
  process.exit(1);
}

const absPath = resolve(process.cwd(), sqlPath);
const sql = readFileSync(absPath, "utf8");
console.log(`[apply-migration] File: ${absPath} (${sql.length} chars)`);

const client = new pg.Client({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("[apply-migration] Connected");

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
      await client.query(stmt);
      console.log(`  [${i}/${statements.length}] OK: ${preview}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exists") || msg.includes("does not exist")) {
        console.log(`  [${i}/${statements.length}] SKIP: ${preview}`);
        continue;
      }
      console.error(`  [${i}/${statements.length}] FAIL: ${preview}`);
      console.error(`    ${msg}`);
      throw err;
    }
  }
  console.log("[apply-migration] Done!");
} catch (err) {
  console.error("[apply-migration] FAILED:", err);
  process.exit(2);
} finally {
  await client.end();
}

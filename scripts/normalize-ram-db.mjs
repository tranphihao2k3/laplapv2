/**
 * Chuẩn hoá trường specs.ram của TẤT CẢ product_variants về định dạng thống nhất
 * "<dung lượng>GB <loại DDR>" (vd "16GB DDR4"), bỏ chú thích thừa như
 * "(hỗ trợ nâng cấp tối đa 32GB)", "(2 khe)", "bus 3200"...
 *
 * DRY-RUN mặc định (chỉ in ra thay đổi); CONFIRM=YES để ghi thật.
 *   node scripts/normalize-ram-db.mjs
 *   CONFIRM=YES node scripts/normalize-ram-db.mjs
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
const CONFIRM = process.env.CONFIRM === "YES";
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const log = (...a) => console.log(...a);

// GIỮ ĐỒNG BỘ với src/lib/normalize-ram.ts
function normalizeRam(input) {
  if (typeof input !== "string") return "";
  const raw = input.trim();
  if (!raw) return "";
  const sizeMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:gb|g\b)/i);
  const ddrMatch = raw.match(/\b(LP)?DDR\s*([345])(X)?\b/i);
  if (!sizeMatch) return raw;
  const size = `${sizeMatch[1]}GB`;
  if (!ddrMatch) return size;
  const lp = ddrMatch[1] ? "LP" : "";
  const gen = ddrMatch[2];
  const x = ddrMatch[3] ? "X" : "";
  return `${size} ${lp}DDR${gen}${x}`;
}

async function main() {
  log(CONFIRM ? "⚠️  GHI THẬT" : "🔍 DRY-RUN (thêm CONFIRM=YES để ghi)");

  const { data: variants, error } = await s
    .from("product_variants")
    .select("id,specs");
  if (error) {
    log("✗ Lỗi đọc product_variants:", error.message);
    process.exit(1);
  }

  let changed = 0;
  let skipped = 0;
  for (const v of variants ?? []) {
    const specs = v.specs;
    if (!specs || typeof specs !== "object") { skipped++; continue; }
    const oldRam = specs.ram;
    if (typeof oldRam !== "string" || !oldRam.trim()) { skipped++; continue; }

    const newRam = normalizeRam(oldRam);
    if (newRam === oldRam) { skipped++; continue; }

    changed++;
    log(`  ${v.id.slice(0, 8)}  "${oldRam}"  →  "${newRam}"`);

    if (CONFIRM) {
      const nextSpecs = { ...specs, ram: newRam };
      const { error: upErr } = await s
        .from("product_variants")
        .update({ specs: nextSpecs })
        .eq("id", v.id);
      if (upErr) log(`    ✗ ghi thất bại: ${upErr.message}`);
    }
  }

  log(`\nTổng: ${(variants ?? []).length} biến thể · đổi ${changed} · giữ nguyên ${skipped}`);
  log(CONFIRM ? "✓ Đã ghi." : "  (chưa ghi — thêm CONFIRM=YES để áp dụng)");
}
main().catch((e) => { console.error("✗", e?.message || e); process.exit(1); });

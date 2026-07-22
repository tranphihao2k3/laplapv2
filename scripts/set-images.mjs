import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const t = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const e = {};
for (const l of t.split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
  if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SLUG = "asus-fa506";
const base = `${e.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/products/`;
const files = [
  "1779723816309-500fhr8.jpg",
  "1779723817128-p6lfg6g.jpg",
  "1779723817556-ztfywhi.jpg",
  "1779723818002-u23e8vx.jpg",
];
const images = files.map((f) => base + f);

const { error } = await sb
  .from("products")
  .update({ images, thumbnail_url: images[0] })
  .eq("slug", SLUG);
console.log(error ? "✗ " + error.message : "✓ Đã gán " + images.length + " ảnh cho " + SLUG);

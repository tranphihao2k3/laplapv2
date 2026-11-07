import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envText = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

for (const slot of ["cpu", "gpu", "ram", "ssd", "pc-parts"]) {
  const { data, error } = await sb.from("categories").select("id,slug,name,parent_id,organization_id").eq("slug", slot);
  console.log(slot, error?.message || data);
}

const { data: cpuCat } = await sb.from("categories").select("id").eq("slug", "cpu").maybeSingle();
console.log("maybeSingle cpu", cpuCat);

if (cpuCat) {
  const { data: prods, error, count } = await sb
    .from("products")
    .select("id,name,status", { count: "exact" })
    .eq("category_id", cpuCat.id)
    .in("status", ["active", "published"])
    .limit(5);
  console.log("cpu products", { error: error?.message, count, prods });
}

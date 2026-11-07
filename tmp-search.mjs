import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || process.cwd();
const needle = process.argv[3] || "";
const skip = new Set(["node_modules", ".git", ".next", "out", "dist", ".turbo", "standalone"]);
const hits = [];

function walk(dir, depth = 0) {
  if (depth > 12) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (skip.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, depth + 1);
    } else {
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.size > 8_000_000) continue;
      if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|sql|md|py|go|rs|yml|yaml|txt|env|example)$/i.test(e.name)) continue;
      try {
        const txt = readFileSync(p, "utf8");
        if (needle && txt.includes(needle)) hits.push(p);
      } catch {}
    }
  }
}
walk(root);
console.log(hits.length ? hits.join("\n") : "NO_MATCH");

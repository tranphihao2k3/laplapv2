/**
 * Kiểm chứng cache localStorage của kết quả AI phân tích.
 *
 * Chạy:
 *   npx esbuild scripts/verify-ai-cache-local.ts --bundle --platform=node \
 *     --format=cjs --outfile=scripts/.verify-ai-cache.cjs --alias:@=./src
 *   node scripts/.verify-ai-cache.cjs
 *
 * Chốt các hành vi dễ hỏng âm thầm: hết hạn, giới hạn số mục, nuốt lỗi khi
 * localStorage bị chặn, và bỏ qua bản lưu sai shape sau khi đổi schema.
 */

// --- localStorage giả, phải cài TRƯỚC khi import module ---
let store: Record<string, string> = {};
let throwOnWrite = false;
const g = globalThis as Record<string, unknown>;
g.window = {
  localStorage: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      if (throwOnWrite) throw new Error("QuotaExceededError");
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  },
};

import {
  readLocalAi,
  writeLocalAi,
  clearLocalAi,
  formatSavedAgo,
  LOCAL_TTL_MS,
} from "@/lib/compare/ai-cache-local";
import type { CompareAiPayload } from "@/lib/compare/types";

let pass = 0;
let fail = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL ${label}\n       nhan: ${a}\n       mong: ${e}`);
  }
}

const KEY = "laplap-compare-ai-v1";
const mkPayload = (n: number): CompareAiPayload => ({
  scores: [{ productId: `p${n}`, cpuScore: n, gpuScore: n, displayScore: n }],
  machines: [
    {
      index: 0,
      cpu_score: n,
      cpu_note: "",
      gpu_score: n,
      gpu_note: "",
      display_score: n,
      display_note: "",
      summary: `may ${n}`,
      strengths: [],
      weaknesses: [],
    },
  ],
  verdict: `ket luan ${n}`,
  needNotes: [],
});
const reset = () => {
  store = {};
  throwOnWrite = false;
};

console.log("=== GHI VA DOC ===");
reset();
writeLocalAi("a,b", mkPayload(1));
eq("doc lai duoc", readLocalAi("a,b")?.data.verdict, "ket luan 1");
eq("co moc thoi gian", typeof readLocalAi("a,b")?.savedAt, "number");
eq("bo may khac -> null", readLocalAi("c,d"), null);

console.log("=== HET HAN ===");
reset();
writeLocalAi("a,b", mkPayload(1));
// Lùi thời điểm lưu ra quá TTL.
const aged = JSON.parse(store[KEY]);
aged["a,b"].savedAt = Date.now() - LOCAL_TTL_MS - 1000;
store[KEY] = JSON.stringify(aged);
eq("qua TTL -> null", readLocalAi("a,b"), null);

reset();
writeLocalAi("a,b", mkPayload(1));
const fresh = JSON.parse(store[KEY]);
fresh["a,b"].savedAt = Date.now() - LOCAL_TTL_MS + 60_000; // con 1 phut
store[KEY] = JSON.stringify(fresh);
eq("con han -> van doc duoc", readLocalAi("a,b")?.data.verdict, "ket luan 1");

console.log("=== GIOI HAN SO MUC ===");
reset();
// Ghi 7 bo may, moi bo cach nhau 10ms de savedAt khac nhau.
for (let i = 1; i <= 7; i++) {
  writeLocalAi(`bo-${i}`, mkPayload(i));
  const s = JSON.parse(store[KEY]);
  s[`bo-${i}`].savedAt = Date.now() + i * 10; // ep thu tu ro rang
  store[KEY] = JSON.stringify(s);
}
const kept = Object.keys(JSON.parse(store[KEY]));
eq("giu toi da 5 muc", kept.length, 5);
eq("giu lai ban MOI nhat", kept.includes("bo-7"), true);
eq("bo ban CU nhat", kept.includes("bo-1"), false);

console.log("=== XOA (nut phan tich lai) ===");
reset();
writeLocalAi("a,b", mkPayload(1));
writeLocalAi("c,d", mkPayload(2));
clearLocalAi("a,b");
eq("da xoa dung bo", readLocalAi("a,b"), null);
eq("bo khac khong bi anh huong", readLocalAi("c,d")?.data.verdict, "ket luan 2");

console.log("=== CHIU LOI ===");
reset();
store[KEY] = "{khong phai json}";
eq("JSON hong -> null, khong nem", readLocalAi("a,b"), null);

reset();
store[KEY] = JSON.stringify({ "a,b": { data: { rac: true }, savedAt: Date.now() } });
eq("payload sai shape -> bo qua", readLocalAi("a,b"), null);

reset();
store[KEY] = JSON.stringify({ "a,b": { data: mkPayload(1) } }); // thieu savedAt
eq("thieu savedAt -> bo qua", readLocalAi("a,b"), null);

reset();
throwOnWrite = true;
let threw = false;
try {
  writeLocalAi("a,b", mkPayload(1));
} catch {
  threw = true;
}
eq("het quota -> nuot loi, KHONG nem", threw, false);

console.log("=== NHAN THOI GIAN ===");
eq("vua xong", formatSavedAgo(Date.now()), "vừa xong");
eq("3 phut truoc", formatSavedAgo(Date.now() - 3 * 60_000), "3 phút trước");

console.log(`
${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

/**
 * Kiểm chứng engine xếp hạng của tính năng so sánh laptop (/so-sanh).
 *
 * Chạy:
 *   npx esbuild scripts/verify-compare-ranking.ts --bundle --platform=node \
 *     --format=cjs --outfile=scripts/.verify-compare.cjs --alias:@=./src
 *   node scripts/.verify-compare.cjs
 *
 * Chốt lại ngữ nghĩa rank/% để refactor về sau không âm thầm đổi hành vi:
 * competition ranking (1,1,3,4), mẫu số của % luôn là mốc so sánh, thiếu dữ liệu
 * không bị xếp bét, "thấp hơn tốt hơn" (giá/trọng lượng) đảo đúng chiều.
 */
import { rankRow, advantagePct, buildCompareResult } from "../src/lib/compare/ranking";
import {
  parseRamGb,
  parseStorageGb,
  parseWeightKg,
  parseBatteryWh,
  parseRefreshHz,
  parseScreenInch,
  parseResolutionPx,
} from "../src/lib/compare/parse-specs";
import type { ProductForCompare } from "../src/lib/compare/types";

let pass = 0;
let fail = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL ${label}\n   actual   = ${a}\n   expected = ${e}`);
  }
}
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

console.log("=== PARSE ===");
eq("ram 16GB DDR4", parseRamGb("16GB DDR4"), 16);
eq("ram 8gb ddr4", parseRamGb("8gb ddr4"), 8);
eq("ram nâng cấp", parseRamGb("16GB DDR5 (nâng cấp tối đa 64GB)"), 16);
eq("ram rỗng", parseRamGb(undefined), null);
eq("ram vô nghĩa", parseRamGb("Onboard"), null);

eq("ssd 512GB SSD", parseStorageGb("512GB SSD NVMe"), 512);
eq("ssd 1TB", parseStorageGb("1TB SSD"), 1024);
eq("ssd 1 TB spaced", parseStorageGb("1 TB"), 1024);

eq("weight 1.35 kg", parseWeightKg("1.35 kg"), 1.35);
eq("weight 1,35kg", parseWeightKg("1,35kg"), 1.35);
eq("weight 1350g", parseWeightKg("1350g"), 1.35);
eq("weight khoảng", parseWeightKg("khoảng 1.4 kg"), 1.4);
eq("weight fallback cột kg", parseWeightKg(undefined, 1.8), 1.8);
eq("weight fallback cột gram", parseWeightKg(undefined, 1800), 1.8);
eq("weight không rõ", parseWeightKg("nhẹ"), null);

eq("pin 56Wh", parseBatteryWh("56Wh"), 56);
eq("pin 3 cell 41 Wh", parseBatteryWh("3 cell 41 Wh"), 41);
eq("pin mAh -> null", parseBatteryWh("5000mAh"), null);

eq("hz 144", parseRefreshHz("15.6 inch FHD 144Hz"), 144);
eq("hz thiếu -> null (không mặc định 60)", parseRefreshHz("15.6 inch FHD IPS"), null);

eq("inch 15.6 inch", parseScreenInch('15.6 inch FHD IPS 144Hz'), 15.6);
eq("inch dấu nháy", parseScreenInch('15.6" FHD'), 15.6);
eq("inch số trần", parseScreenInch("15.6 FHD IPS"), 15.6);
eq("inch không nuốt 144Hz", parseScreenInch("144Hz FHD"), null);

eq("res chính xác", parseResolutionPx("1920x1080"), 1920 * 1080);
eq("res FHD", parseResolutionPx("15.6 inch FHD IPS"), 1920 * 1080);
eq("res 4K trước 2K", parseResolutionPx("4K OLED"), 3840 * 2160);
eq("res QHD không lẫn HD", parseResolutionPx("QHD 165Hz"), 2560 * 1440);
eq("res FHD+ ", parseResolutionPx("1920x1200"), 1920 * 1200);
eq("res Retina -> null", parseResolutionPx("Retina display"), null);

console.log("=== VÍ DỤ A: RAM (higher) 32/16/16/8 ===");
const rowA = rankRow("ram", "higher", 0, [
  { productId: "M1", raw: "32GB", value: 32, display: "32 GB" },
  { productId: "M2", raw: "16GB", value: 16, display: "16 GB" },
  { productId: "M3", raw: "16GB", value: 16, display: "16 GB" },
  { productId: "M4", raw: "8GB", value: 8, display: "8 GB" },
]);
eq("A ranks (competition 1,2,2,4)", rowA.cells.map((c) => c.rank), [1, 2, 2, 4]);
eq("A vsBestPct", rowA.cells.map((c) => r1(c.vsBestPct)), [0, -50, -50, -75]);
eq("A leadPct M1 = +100", r1(rowA.cells[0].leadPct), 100);
eq("A leadPct others null", rowA.cells.slice(1).map((c) => c.leadPct), [null, null, null]);
eq("A barPct", rowA.cells.map((c) => r1(c.barPct)), [100, 50, 50, 25]);
eq("A best ids", rowA.bestProductIds, ["M1"]);

console.log("=== VÍ DỤ B: Trọng lượng (lower) 1.2/1.8/2.4 ===");
const rowB = rankRow("weight", "lower", 2, [
  { productId: "M1", raw: "1.2kg", value: 1.2, display: "1.2 kg" },
  { productId: "M2", raw: "1.8kg", value: 1.8, display: "1.8 kg" },
  { productId: "M3", raw: "2.4kg", value: 2.4, display: "2.4 kg" },
]);
eq("B ranks", rowB.cells.map((c) => c.rank), [1, 2, 3]);
eq("B leadPct M1 = +33.3", r1(rowB.cells[0].leadPct), 33.3);
eq("B vsBestPct", rowB.cells.map((c) => r1(c.vsBestPct)), [0, -50, -100]);
eq("B barPct", rowB.cells.map((c) => r1(c.barPct)), [100, 66.7, 50]);

console.log("=== VÍ DỤ C: điểm CPU AI 78/65 ===");
const rowC = rankRow("cpu", "higher", 0, [
  { productId: "M1", raw: "i7", value: 78, display: "i7" },
  { productId: "M2", raw: "i5", value: 65, display: "i5" },
]);
eq("C vsBestPct M2 = -16.7", r1(rowC.cells[1].vsBestPct), -16.7);
eq("C leadPct M1 = +20", r1(rowC.cells[0].leadPct), 20);

console.log("=== VÍ DỤ D: giá (lower) 12tr/18tr ===");
const rowD = rankRow("price", "lower", 0, [
  { productId: "M1", raw: null, value: 12_000_000, display: "12tr" },
  { productId: "M2", raw: null, value: 18_000_000, display: "18tr" },
]);
eq("D leadPct M1 = +33.3", r1(rowD.cells[0].leadPct), 33.3);
eq("D vsBestPct M2 = -50", r1(rowD.cells[1].vsBestPct), -50);

console.log("=== CẠNH BIÊN ===");
const rowMissing = rankRow("battery", "higher", 0, [
  { productId: "M1", raw: "56Wh", value: 56, display: "56 Wh" },
  { productId: "M2", raw: null, value: null, display: "—" },
  { productId: "M3", raw: null, value: null, display: "—" },
]);
eq("chỉ 1 máy có dữ liệu -> ranked false", rowMissing.ranked, false);
eq("chỉ 1 máy -> rank đều null", rowMissing.cells.map((c) => c.rank), [null, null, null]);

const rowMissing2 = rankRow("battery", "higher", 0, [
  { productId: "M1", raw: "56Wh", value: 56, display: "56 Wh" },
  { productId: "M2", raw: "41Wh", value: 41, display: "41 Wh" },
  { productId: "M3", raw: null, value: null, display: "—" },
]);
eq("2 máy có dữ liệu -> ranked", rowMissing2.ranked, true);
eq("máy thiếu dữ liệu KHÔNG bị xếp bét", rowMissing2.cells.map((c) => c.rank), [1, 2, null]);

const rowEq = rankRow("ram", "higher", 0, [
  { productId: "M1", raw: "16GB", value: 16, display: "16 GB" },
  { productId: "M2", raw: "16GB", value: 16, display: "16 GB" },
]);
eq("tất cả bằng nhau -> allEqual", rowEq.allEqual, true);
eq("allEqual -> không có bestProductIds", rowEq.bestProductIds, []);
eq("allEqual -> leadPct null", rowEq.cells.map((c) => c.leadPct), [null, null]);

const rowEps = rankRow("weight", "lower", 2, [
  { productId: "M1", raw: "1.400kg", value: 1.4, display: "1.4 kg" },
  { productId: "M2", raw: "1.4kg", value: 1.4001, display: "1.4 kg" },
]);
eq("epsilon: 1.400 == 1.4 -> đồng hạng", rowEps.cells.map((c) => c.rank), [1, 1]);
eq("epsilon -> allEqual", rowEps.allEqual, true);

eq("advantagePct mốc 0 -> null", advantagePct(5, 0, "higher"), null);

console.log("=== BUILD RESULT không có AI ===");
const mk = (id: string, specs: Record<string, string>, price: number): ProductForCompare => ({
  id,
  name: `Máy ${id}`,
  slug: id,
  image: null,
  price,
  brandName: null,
  tags: [],
  specs,
  variantWeightKg: null,
  inStock: true,
});
const products = [
  mk("A", { cpu: "Intel Core i7-13620H", gpu: "RTX 4060", ram: "16GB DDR5", ssd: "1TB SSD", display: '15.6" QHD 165Hz', battery: "60Wh", weight: "2.3kg", warranty: "24 tháng" }, 28_000_000),
  mk("B", { cpu: "Intel Core i5-12450H", gpu: "Intel Iris Xe", ram: "16GB DDR4", ssd: "512GB SSD", display: '15.6" FHD 144Hz', battery: "54Wh", weight: "1.8kg" }, 16_000_000),
  mk("C", { cpu: "Intel Core i3-1215U", ram: "8GB DDR4", ssd: "256GB SSD", display: '14" FHD IPS', battery: "41Wh", weight: "1.4kg", mainboard: "Custom X99" }, 9_000_000),
];
const res = buildCompareResult(products, null);
eq("hasAiScores false", res.hasAiScores, false);
const ramRow = res.groups.flatMap((g) => g.rows).find((r) => r.metricId === "ram")!;
eq("ram ranks A,B,C", ramRow.cells.map((c) => c.rank), [1, 1, 3]);
eq("ram display", ramRow.cells.map((c) => c.display), ["16 GB", "16 GB", "8 GB"]);
const storageRow = res.groups.flatMap((g) => g.rows).find((r) => r.metricId === "storage")!;
eq("storage 1TB display", storageRow.cells[0].display, "1 TB");
const cpuRow = res.groups.flatMap((g) => g.rows).find((r) => r.metricId === "cpu")!;
eq("cpu chưa có AI -> ranked false", cpuRow.ranked, false);
eq("cpu vẫn hiện tên CPU", cpuRow.cells[0].display, "Intel Core i7-13620H");
const weightRow = res.groups.flatMap((g) => g.rows).find((r) => r.metricId === "weight")!;
eq("weight: nhẹ nhất là TOP 1", weightRow.cells.map((c) => c.rank), [3, 2, 1]);
const priceRow = res.groups.flatMap((g) => g.rows).find((r) => r.metricId === "price")!;
eq("price: rẻ nhất TOP 1", priceRow.cells.map((c) => c.rank), [3, 2, 1]);
eq("extra row cho key lạ", res.extraRows.map((r) => r.metricId), ["extra:mainboard"]);
eq("overall có 3 máy", res.overall.length, 3);
eq("overall rank là 1..3", res.overall.map((o) => o.rank).sort(), [1, 2, 3]);

console.log("=== BUILD RESULT có AI ===");
const res2 = buildCompareResult(products, [
  { productId: "A", cpuScore: 82, gpuScore: 78, displayScore: 75 },
  { productId: "B", cpuScore: 64, gpuScore: 25, displayScore: 60 },
  { productId: "C", cpuScore: 38, gpuScore: 12, displayScore: 50 },
]);
eq("hasAiScores true", res2.hasAiScores, true);
const cpuRow2 = res2.groups.flatMap((g) => g.rows).find((r) => r.metricId === "cpu")!;
eq("cpu có AI -> ranked", cpuRow2.ranked, true);
eq("cpu ranks", cpuRow2.cells.map((c) => c.rank), [1, 2, 3]);
eq("cpu vẫn hiện tên chứ không phải điểm", cpuRow2.cells[0].display, "Intel Core i7-13620H");
eq("cpu value = điểm AI", cpuRow2.cells.map((c) => c.value), [82, 64, 38]);
// Nhất quán: máy có cpuScore cao nhất PHẢI là máy mang badge TOP 1 ở hàng CPU.
eq("nhất quán AI-rank", cpuRow2.bestProductIds, ["A"]);
const overallTop = [...res2.overall].sort((a, b) => a.rank - b.rank)[0];
eq("overall TOP 1 là máy A (mạnh nhất)", overallTop.productId, "A");
eq("valueScores có rank", res2.valueScores.every((v) => v.rank != null), true);
eq("bestByNeed có đủ 4 nhu cầu", res2.bestByNeed.length, 4);
const gaming = res2.bestByNeed.find((b) => b.needSlug === "gaming")!;
eq("gaming -> máy A (RTX 4060)", gaming.productId, "A");
const mongNhe = res2.bestByNeed.find((b) => b.needSlug === "mong-nhe")!;
eq("mỏng nhẹ -> máy C (1.4kg)", mongNhe.productId, "C");


// --- Gate điều kiện cứng cho bestByNeed ---
console.log("=== GATE nhu cầu ===");
import { hasDiscreteGpu } from "../src/lib/compare/parse-specs";
eq("gpu RTX 4060 -> rời", hasDiscreteGpu("NVIDIA GeForce RTX 4060"), true);
eq("gpu Iris Xe -> tích hợp", hasDiscreteGpu("Intel Iris Xe"), false);
eq("gpu UHD -> tích hợp", hasDiscreteGpu("Intel UHD Graphics"), false);
eq("gpu Radeon Graphics -> tích hợp", hasDiscreteGpu("AMD Radeon Graphics"), false);
eq("gpu Radeon RX 6600M -> rời", hasDiscreteGpu("AMD Radeon RX 6600M"), true);
eq("gpu MX550 -> rời", hasDiscreteGpu("NVIDIA MX550"), true);
eq("gpu onboard -> tích hợp", hasDiscreteGpu("Onboard"), false);
eq("gpu rỗng -> null", hasDiscreteGpu(undefined), null);

// --- Pin may cu: sức khoẻ pin + chu kỳ sạc (dữ liệu thật của shop) ---
console.log("=== PIN MAY CU ===");
import { parseBatteryHealthPct, parseBatteryCycles } from "../src/lib/compare/parse-specs";
eq("chai pin 100%", parseBatteryHealthPct("100% (93 chu kỳ sạc)"), 100);
eq("chai pin 87%", parseBatteryHealthPct("Pin 87%"), 87);
eq("chai pin sai dai -> null", parseBatteryHealthPct("120%"), null);
eq("chai pin khong co -> null", parseBatteryHealthPct("2-4 giờ"), null);
eq("chu ky 93", parseBatteryCycles("100% (93 chu kỳ sạc)"), 93);
eq("chu ky cycles", parseBatteryCycles("120 cycles"), 120);
eq("chu ky khong co -> null", parseBatteryCycles("56Wh"), null);

// Metric do duoc parse khong ra -> hien "—", KHONG fallback chuoi goc.
// Nhieu metric doc chung key display; fallback se nhet "15 inch" vao hang "Tan so quet".
const pMac = mk("MAC", { display: "15 inch", battery: "100% (93 chu kỳ sạc)" }, 24_000_000);
const pWin = mk("WIN", { display: '15.6" FHD 165Hz', battery: "2-4 giờ" }, 16_000_000);
const resFb = buildCompareResult([pMac, pWin], null);
const allRows = resFb.groups.flatMap((g) => g.rows);
const hz = allRows.find((r) => r.metricId === "refreshHz")!;
eq("khong nhet '15 inch' vao hang tan so quet", hz.cells[0].display, "—");
eq("may co 165Hz van hien dung", hz.cells[1].display, "165 Hz");
const health = allRows.find((r) => r.metricId === "batteryHealth")!;
eq("khong nhet '2-4 giờ' vao hang do chai pin", health.cells[1].display, "—");
eq("do chai pin doc dung tu chuoi may cu", health.cells[0].display, "100%");

// Diem tong khong duoc ra 0/100 chi vi min-max.
const twoNear = [
  mk("X", { ram: "24GB", ssd: "512GB SSD" }, 20_000_000),
  mk("Y", { ram: "16GB", ssd: "512GB SSD" }, 18_000_000),
];
const resNear = buildCompareResult(twoNear, null);
const worst = resNear.overall.find((o) => o.productId === "Y")!;
eq("may kem hon KHONG bi 0 diem", worst.score > 0, true);
eq("diem nam trong dai hop ly", resNear.overall.every((o) => o.score >= 25 && o.score <= 95), true);
eq("canh bao thieu thong so", worst.lowConfidence, true);

// --- Breakdown: "thắng N/M tiêu chí" phải khớp chính thứ hạng ---
console.log("=== BREAKDOWN ===");
const bdProducts = [
  // STRONG hơn ở MỌI tiêu chí đo được; CHEAP rẻ nhất nhưng yếu nhất.
  mk("STRONG", { ram: "32GB", ssd: "1TB SSD", display: '15.6" QHD 165Hz', battery: "80Wh", weight: "1.4kg" }, 30_000_000),
  mk("CHEAP", { ram: "8GB", ssd: "256GB SSD", display: '15.6" HD 60Hz', battery: "40Wh", weight: "2.2kg" }, 9_000_000),
];
const resBd = buildCompareResult(bdProducts, null);
const bdStrong = resBd.breakdowns.find((b) => b.productId === "STRONG")!;
const bdCheap = resBd.breakdowns.find((b) => b.productId === "CHEAP")!;

eq("may manh thang het tieu chi", bdStrong.wins === bdStrong.rankedCount, true);
eq("may yeu khong thang tieu chi nao", bdCheap.wins, 0);
eq("rankedCount dong nhat giua cac may", bdStrong.rankedCount === bdCheap.rankedCount, true);
eq("wins khop so standing hang 1", bdStrong.wins, bdStrong.standings.filter((s) => s.rank === 1 && !s.allEqual).length);
// GIÁ không được tính vào wins: nếu tính, CHEAP sẽ hiện "thắng 1 tiêu chí" ngay
// cạnh điểm bét bảng — hai con số mâu thuẫn trên cùng một thẻ.
eq("gia KHONG nam trong breakdown", bdStrong.standings.some((s) => s.metricId === "price"), false);
eq("sap theo trong so giam dan", bdStrong.standings.every((s, i, a) => i === 0 || a[i - 1].weight >= s.weight), true);
eq("may thang het phai dung hang 1", resBd.overall.find((o) => o.productId === "STRONG")!.rank, 1);

// Tiêu chí mọi máy đều bằng nhau -> KHÔNG ai "thắng" tiêu chí đó.
const bdEqual = buildCompareResult(
  [mk("E1", { ram: "16GB", ssd: "512GB SSD" }, 20_000_000), mk("E2", { ram: "16GB", ssd: "512GB SSD" }, 20_000_000)],
  null,
).breakdowns;
eq("ngang nhau -> khong ai thang", bdEqual.every((b) => b.wins === 0), true);
eq("ngang nhau -> rankedCount = 0", bdEqual[0].rankedCount, 0);

console.log(`
${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
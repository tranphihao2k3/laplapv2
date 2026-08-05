/**
 * Engine xếp hạng — hàm thuần, không phụ thuộc React/DB.
 *
 * QUY TẮC XẾP HẠNG: competition ranking (kiểu "1,1,3,4").
 * Giá trị bằng nhau → cùng rank, rank kế tiếp NHẢY SỐ.
 *   RAM 32 / 16 / 16 / 8  →  rank 1 / 2 / 2 / 4
 * Lý do không dùng dense ranking (1,2,2,3): nếu 2 máy đồng hạng nhất thì
 * KHÔNG máy nào là "TOP 2" — gắn badge TOP 2 cho máy hạng ba sẽ gây hiểu nhầm.
 *
 * QUY TẮC %: mẫu số LUÔN là cái được lấy làm mốc. Đây đúng cách người Việt đọc
 * "A hơn B bao nhiêu phần trăm" (mốc là B).
 *
 * THIẾU DỮ LIỆU: value = null → rank null, hiển thị "—", KHÔNG tính vào mẫu số,
 * KHÔNG coi là 0. Nếu < 2 máy có dữ liệu → cả hàng không xếp hạng.
 */

import { NEED_TAGS } from "@/lib/product-collections";
import {
  hasDiscreteGpu,
  parseBatteryWh,
  parseRamGb,
  parseRefreshHz,
  parseResolutionPx,
  parseScreenInch,
  parseStorageGb,
  parseWeightKg,
  formatMetricValue,
} from "./parse-specs";
import { WEIGHT_PROFILES } from "./profiles";
import {
  GROUP_ORDER,
  METRICS,
  METRIC_BY_ID,
  humanizeKey,
  rawValueOf,
  unknownSpecKeys,
  type Metric,
} from "./spec-registry";
import type {
  AiMachineScores,
  Cell,
  CompareResult,
  Direction,
  OverallScore,
  ProductForCompare,
  Row,
} from "./types";

/** Dưới ngưỡng này thì coi như "gần như tương đương", không hiện câu %. */
export const NEGLIGIBLE_PCT = 3;

/**
 * % lợi thế của `subject` so với mốc `reference`.
 * Dương = subject tốt hơn, âm = kém hơn.
 *   higher (nhiều hơn tốt hơn): (subject - reference) / reference
 *   lower  (ít hơn tốt hơn):    (reference - subject) / reference
 */
export function advantagePct(subject: number, reference: number, dir: Direction): number | null {
  if (!Number.isFinite(subject) || !Number.isFinite(reference) || reference === 0) return null;
  const raw = dir === "higher" ? (subject - reference) / reference : (reference - subject) / reference;
  return raw * 100;
}

/** Chuẩn hoá về "cao hơn = tốt hơn" bằng nghịch đảo, để vẽ bar cho lower-is-better. */
function goodness(v: number, dir: Direction): number {
  if (dir === "higher") return v;
  return v === 0 ? Infinity : 1 / v;
}

function roundTo(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

type CellInput = { productId: string; raw: string | null; value: number | null; display: string };

/**
 * Xếp hạng một hàng. Giữ nguyên thứ tự máy đầu vào ở output.
 */
export function rankRow(
  metricId: string,
  dir: Direction,
  decimals: number,
  inputs: CellInput[],
): Row {
  const present = inputs.filter(
    (i): i is CellInput & { value: number } => i.value != null && Number.isFinite(i.value),
  );

  const bare = (i: CellInput): Cell => ({
    ...i,
    rank: null,
    vsBestPct: null,
    leadPct: null,
    barPct: null,
  });

  // Không thể "so sánh" khi chỉ 0-1 máy có dữ liệu.
  if (present.length < 2) {
    return {
      metricId,
      ranked: false,
      allEqual: false,
      bestProductIds: [],
      cells: inputs.map(bare),
    };
  }

  // So sánh trên giá trị ĐÃ LÀM TRÒN để 1.400 và 1.4 coi là bằng nhau.
  const key = (v: number) => roundTo(v, decimals);
  /** > 0 nghĩa là a tốt hơn b. */
  const better = (a: number, b: number) => (dir === "higher" ? key(a) - key(b) : key(b) - key(a));

  const bestVal = present.reduce((best, p) => (better(p.value, best) > 0 ? p.value : best), present[0].value);
  const allEqual = present.every((p) => key(p.value) === key(bestVal));

  // Giá trị tốt thứ nhì THỰC SỰ khác giá trị tốt nhất (bỏ qua các máy đồng hạng nhất).
  const others = present.filter((p) => key(p.value) !== key(bestVal)).map((p) => p.value);
  const secondVal = others.length
    ? others.reduce((best, v) => (better(v, best) > 0 ? v : best), others[0])
    : null;

  const bestGood = goodness(bestVal, dir);

  const cells: Cell[] = inputs.map((i) => {
    if (i.value == null || !Number.isFinite(i.value)) return bare(i);
    // Competition rank = 1 + số máy có giá trị TỐT HƠN THỰC SỰ.
    const rank = 1 + present.filter((p) => better(p.value, i.value as number) > 0).length;
    const isBest = rank === 1;
    const ratio = bestGood === Infinity ? 1 : goodness(i.value, dir) / bestGood;
    return {
      ...i,
      rank,
      vsBestPct: isBest ? 0 : advantagePct(i.value, bestVal, dir),
      leadPct: isBest && secondVal != null && !allEqual ? advantagePct(bestVal, secondVal, dir) : null,
      barPct: Math.max(0, Math.min(100, ratio * 100)),
    };
  });

  return {
    metricId,
    ranked: true,
    allEqual,
    bestProductIds: allEqual ? [] : cells.filter((c) => c.rank === 1).map((c) => c.productId),
    cells,
  };
}

/** Đọc giá trị số của một metric measurable từ 1 máy. */
function measurableValueOf(metric: Metric, p: ProductForCompare): number | null {
  const raw = rawValueOf(metric, p.specs);
  switch (metric.id) {
    case "ram":
      return parseRamGb(raw);
    case "storage":
      return parseStorageGb(raw);
    case "screenInch":
      return parseScreenInch(raw);
    case "refreshHz":
      return parseRefreshHz(raw);
    case "resolution":
      return parseResolutionPx(raw);
    case "battery":
      return parseBatteryWh(raw);
    case "weight":
      return parseWeightKg(raw, p.variantWeightKg);
    case "price":
      // Giá 0 = chưa có giá → null, KHÔNG phải 0. Nếu để 0 thì máy chưa có giá
      // sẽ thắng hạng "rẻ nhất".
      return p.price > 0 ? p.price : null;
    default:
      return null;
  }
}

/**
 * Điều kiện CỨNG để một máy được phép mang nhãn "tốt nhất cho <nhu cầu>".
 *
 * Trọng số riêng lẻ không đủ: một máy gaming 2.3kg với CPU/RAM/pin áp đảo vẫn có
 * thể thắng điểm profile "mỏng nhẹ". Gate này chặn các gợi ý vô lý như vậy.
 * Thiếu dữ liệu → KHÔNG loại (tránh loại oan máy chưa nhập đủ spec).
 */
function isEligibleForNeed(needSlug: string, p: ProductForCompare): boolean {
  const weightMetric = METRIC_BY_ID.get("weight");
  const gpuMetric = METRIC_BY_ID.get("gpu");

  switch (needSlug) {
    case "mong-nhe": {
      // Ngưỡng 1.6kg: aiHint của NEED_TAGS ghi "≈dưới 1.5kg", nới nhẹ cho chữ "≈".
      // Không nới tới 1.8kg — ở mức đó máy 1.8kg pin to sẽ thắng điểm máy 1.4kg,
      // trong khi người cần máy mang đi hằng ngày quan tâm trọng lượng trước tiên.
      const kg = weightMetric
        ? parseWeightKg(rawValueOf(weightMetric, p.specs), p.variantWeightKg)
        : null;
      return kg == null || kg <= 1.6;
    }
    case "gaming": {
      // Cần GPU rời. Không rõ GPU → cho qua, để điểm quyết định.
      const discrete = gpuMetric ? hasDiscreteGpu(rawValueOf(gpuMetric, p.specs)) : null;
      return discrete !== false;
    }
    case "do-hoa": {
      // Đồ hoạ cần RAM tối thiểu 16GB (theo aiHint của NEED_TAGS).
      const ramMetric = METRIC_BY_ID.get("ram");
      const gb = ramMetric ? parseRamGb(rawValueOf(ramMetric, p.specs)) : null;
      return gb == null || gb >= 16;
    }
    default:
      // van-phong: hầu hết laptop đều phù hợp, không cần gate.
      return true;
  }
}

/** Min-max normalize về 0-100 trong nhóm máy đang so. */
function normalize01(v: number, min: number, max: number, dir: Direction): number {
  if (max === min) return 50; // Tất cả bằng nhau → điểm trung tính.
  const t = (v - min) / (max - min);
  return (dir === "higher" ? t : 1 - t) * 100;
}

/**
 * Tính điểm tổng theo một profile trọng số.
 * Metric thiếu dữ liệu ở máy nào thì bị loại khỏi CẢ tử số và mẫu số của
 * riêng máy đó (renormalize per-machine) — để máy thiếu 1 spec không bị phạt oan.
 */
function computeOverall(
  products: ProductForCompare[],
  rowByMetric: Map<string, Row>,
  profile: Record<string, number>,
): OverallScore[] {
  // Điểm thành phần 0-100 cho từng (metric, máy).
  const partial = new Map<string, Map<string, number>>();

  for (const metric of METRICS) {
    if (!metric.scored) continue;
    const weight = profile[metric.id];
    if (!weight) continue;
    const row = rowByMetric.get(metric.id);
    if (!row) continue;

    const vals = row.cells.map((c) => c.value).filter((v): v is number => v != null);
    if (vals.length === 0) continue;

    const scores = new Map<string, number>();
    if (metric.kind === "ai-scored") {
      // Điểm AI đã là thang tuyệt đối 0-100 → dùng thẳng, KHÔNG min-max.
      // Nhờ vậy giữ được ý nghĩa "cả 4 máy đều yếu".
      for (const c of row.cells) if (c.value != null) scores.set(c.productId, c.value);
    } else {
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const dir = metric.direction ?? "higher";
      for (const c of row.cells) {
        if (c.value != null) scores.set(c.productId, normalize01(c.value, min, max, dir));
      }
    }
    partial.set(metric.id, scores);
  }

  const raw = products.map((p) => {
    let sum = 0;
    let wSum = 0;
    let used = 0;
    for (const [metricId, scores] of partial) {
      const s = scores.get(p.id);
      if (s == null) continue;
      const w = profile[metricId] ?? 0;
      sum += w * s;
      wSum += w;
      used++;
    }
    return { productId: p.id, score: wSum > 0 ? sum / wSum : 0, metricsUsed: used };
  });

  // Rank theo điểm (competition ranking, làm tròn 1 chữ số để tránh nhiễu float).
  const k = (v: number) => Math.round(v * 10) / 10;
  return raw.map((r) => ({
    ...r,
    score: k(r.score),
    rank: 1 + raw.filter((o) => k(o.score) > k(r.score)).length,
  }));
}

/**
 * Dựng toàn bộ kết quả so sánh.
 *
 * Chạy được CẢ KHI CHƯA CÓ AI (`aiScores = null`): các hàng ai-scored sẽ
 * ranked=false và chỉ hiện text thô. Nghĩa là bảng so sánh dùng được ngay,
 * AI chỉ là lớp bổ sung — không phải dependency cứng của trang.
 */
export function buildCompareResult(
  products: ProductForCompare[],
  aiScores: AiMachineScores[] | null = null,
): CompareResult {
  const aiById = new Map((aiScores ?? []).map((s) => [s.productId, s]));
  const hasAiScores = aiById.size > 0;

  const rows: Row[] = [];

  for (const metric of METRICS) {
    if (metric.kind === "info") {
      // Hàng info: chỉ hiển thị text, không xếp hạng.
      rows.push({
        metricId: metric.id,
        ranked: false,
        allEqual: false,
        bestProductIds: [],
        cells: products.map((p) => {
          const raw = rawValueOf(metric, p.specs) ?? null;
          return {
            productId: p.id,
            raw,
            value: null,
            display: raw ?? "—",
            rank: null,
            vsBestPct: null,
            leadPct: null,
            barPct: null,
          };
        }),
      });
      continue;
    }

    const dir = metric.direction ?? "higher";
    const decimals = metric.decimals ?? 2;

    const inputs: CellInput[] = products.map((p) => {
      const raw = metric.id === "price" ? null : rawValueOf(metric, p.specs) ?? null;

      let value: number | null;
      if (metric.kind === "ai-scored") {
        const s = aiById.get(p.id);
        value =
          metric.id === "cpu"
            ? s?.cpuScore ?? null
            : metric.id === "gpu"
              ? s?.gpuScore ?? null
              : s?.displayScore ?? null;
      } else {
        value = measurableValueOf(metric, p);
      }

      // Với hàng ai-scored, chuỗi gốc (tên CPU/GPU) mới là thứ người dùng cần đọc;
      // điểm số chỉ dùng để xếp hạng nên không thay thế phần hiển thị.
      const display =
        metric.kind === "ai-scored"
          ? raw ?? "—"
          : value != null
            ? formatMetricValue(metric.id, value)
            : raw ?? "—";

      return { productId: p.id, raw, value, display };
    });

    rows.push(rankRow(metric.id, dir, decimals, inputs));
  }

  const rowByMetric = new Map(rows.map((r) => [r.metricId, r]));

  // Hàng động cho các key specs lạ không có trong registry.
  const extras = unknownSpecKeys(products.map((p) => p.specs));
  const extraRows: Row[] = extras.map((k) => ({
    metricId: `extra:${k}`,
    ranked: false,
    allEqual: false,
    bestProductIds: [],
    cells: products.map((p) => {
      const raw = p.specs[k]?.trim() || null;
      return {
        productId: p.id,
        raw,
        value: null,
        display: raw ?? "—",
        rank: null,
        vsBestPct: null,
        leadPct: null,
        barPct: null,
      };
    }),
  }));

  // Gom theo nhóm, giữ đúng thứ tự GROUP_ORDER.
  const groups = GROUP_ORDER.map((group) => ({
    group,
    rows: rows.filter((r) => {
      const m = METRICS.find((x) => x.id === r.metricId);
      return m?.group === group;
    }),
  })).filter((g) => g.rows.length > 0);

  const overall = computeOverall(products, rowByMetric, WEIGHT_PROFILES.default);

  // Đáng tiền = điểm tổng / giá (triệu đồng). Máy chưa có giá → null.
  const overallById = new Map(overall.map((o) => [o.productId, o]));
  const rawValues = products.map((p) => {
    const o = overallById.get(p.id);
    const value = p.price > 0 && o ? o.score / (p.price / 1_000_000) : null;
    return { productId: p.id, value };
  });
  const valueScores = rawValues.map((v) => ({
    ...v,
    value: v.value == null ? null : Math.round(v.value * 100) / 100,
    rank:
      v.value == null
        ? null
        : 1 + rawValues.filter((o) => o.value != null && o.value > (v.value as number)).length,
  }));

  // Máy tốt nhất cho từng nhu cầu — CODE tính từ WEIGHT_PROFILES, KHÔNG để AI quyết,
  // nhờ vậy nhãn "Tốt nhất cho Gaming" luôn nhất quán với bảng số bên dưới.
  const bestByNeed = NEED_TAGS.map((tag) => {
    const profile = WEIGHT_PROFILES[tag.slug];
    if (!profile) return null;

    // Điều kiện CỨNG trước khi xét điểm: chỉ riêng trọng số là không đủ.
    // Máy cấu hình khủng 2.3kg vẫn có thể thắng điểm profile "mỏng nhẹ" nhờ
    // CPU/RAM/pin áp đảo — nhưng gợi ý nó cho người cần máy nhẹ là sai.
    const eligible = products.filter((p) => isEligibleForNeed(tag.slug, p));
    if (eligible.length === 0) return null;

    const scores = computeOverall(products, rowByMetric, profile).filter((s) =>
      eligible.some((p) => p.id === s.productId),
    );
    const best = scores.reduce((a, b) => (b.score > a.score ? b : a), scores[0]);
    if (!best || best.score <= 0) return null;
    return {
      needSlug: tag.slug,
      needLabel: tag.label,
      productId: best.productId,
      score: best.score,
    };
  }).filter((x): x is NonNullable<typeof x> => x != null);

  return {
    products,
    groups,
    extraRows,
    overall,
    valueScores,
    bestByNeed,
    hasAiScores,
  };
}

/** Nhãn hiển thị cho hàng extra (key lạ). */
export function extraRowLabel(metricId: string): string {
  return humanizeKey(metricId.replace(/^extra:/, ""));
}

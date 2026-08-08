/**
 * AI chấm điểm hiệu năng cho tính năng so sánh laptop.
 *
 * PHÂN CHIA TRÁCH NHIỆM (quan trọng):
 *   AI  → CHỈ cho điểm 0-100 cho 3 mục định tính (CPU, GPU, chất lượng màn) + nhận xét.
 *   CODE → tính toàn bộ rank, %, điểm tổng, "tốt nhất cho nhu cầu nào".
 *
 * Vì sao chia vậy: nếu để AI tự xếp hạng thì mỗi lần bấm lại có thể ra thứ tự
 * khác, và nhãn "tốt nhất cho Gaming" dễ mâu thuẫn với bảng số ngay bên dưới.
 * Cho điểm thì AI làm tốt; xếp hạng để code làm cho nhất quán.
 */

import { z } from "zod";
import { NEED_TAGS, NEED_TAG_SLUGS } from "@/lib/product-collections";
import { rawValueOf, METRIC_BY_ID } from "@/lib/compare/spec-registry";
import type { ProductForCompare } from "@/lib/compare/types";
import { generateJson, type AIProvider } from "./gemini-client";

const SYSTEM_PROMPT = `Bạn là chuyên gia tư vấn laptop tại Việt Nam, nhiệm vụ là CHẤM ĐIỂM hiệu năng phần cứng.

NHIỆM VỤ: với 2-4 máy được cung cấp, cho điểm 0-100 ba mục định tính:
cpu_score, gpu_score, display_score. Trả về JSON đúng cấu trúc yêu cầu.

TUYỆT ĐỐI KHÔNG LÀM:
- KHÔNG xếp hạng, KHÔNG ghi "TOP 1/2/3", KHÔNG tính phần trăm hơn kém.
- KHÔNG nói máy nào tốt nhất cho nhu cầu nào (hệ thống tự tính từ điểm của bạn).
- KHÔNG bịa thông số không có trong dữ liệu được cung cấp.
Hệ thống sẽ tự xếp hạng từ điểm bạn cho, nên điểm phải PHẢN ÁNH ĐÚNG chênh lệch
thực tế: mạnh gấp đôi thì điểm phải chênh tương ứng.

THANG ĐIỂM CPU (0-100) — mốc neo:
  95-100: Apple M3/M4 Max, Intel HX cao cấp (i9-14900HX), Ryzen 9 HX
  80-94 : i7/i9 dòng H mới, Ryzen 7/9 HS, Apple M2/M3 Pro
  65-79 : i5-13500H, Ryzen 5 7640HS, Apple M1/M2, i7 dòng U mới
  50-64 : i5 dòng U thế hệ 11-13, Ryzen 5 5500U/5625U
  30-49 : i5/i7 thế hệ 8-10, Ryzen 3
  10-29 : Celeron, Pentium, i3 đời cũ

THANG ĐIỂM GPU (0-100) — mốc neo:
  90-100: RTX 4080/4090 Laptop
  75-89 : RTX 4060/4070, RTX 3070/3080
  60-74 : RTX 3050/3050 Ti/4050, GTX 1660Ti
  40-59 : MX550, Iris Xe của Core Ultra, GPU tích hợp Apple M-series
  20-39 : Iris Xe thường, Radeon Vega/Radeon Graphics tích hợp
  5-19  : Intel UHD, GPU onboard đời cũ
  Nếu chỉ ghi "Onboard" mà không rõ loại → cho 10-20.

THANG ĐIỂM MÀN HÌNH (0-100) — CHỈ chấm CHẤT LƯỢNG TẤM NỀN:
  Hệ thống ĐÃ TỰ ĐO kích thước, độ phân giải và tần số quét — ĐỪNG chấm lại 3 thứ đó.
  Chỉ xét: loại tấm nền, độ phủ màu, độ sáng.
  90-100: OLED/mini-LED, phủ 100% DCI-P3, độ sáng >= 500 nit
  70-89 : IPS cao cấp, 100% sRGB, độ sáng 350-500 nit
  50-69 : IPS thường, phủ màu ~60-70% sRGB
  25-49 : tấm nền TN, độ sáng thấp
  Nếu KHÔNG rõ loại tấm nền → cho 50 và ghi rõ "chưa rõ tấm nền" trong display_note.

QUY TẮC KHÁC:
- Viết tiếng Việt tự nhiên, giọng tư vấn trung thực, không quảng cáo lố.
- strengths/weaknesses: gạch đầu dòng cực ngắn, mỗi ý tối đa 12 từ.
- Nếu dữ liệu ghi "(suy luận)" thì đó là phỏng đoán, hãy thận trọng khi chấm.
- need_notes: với MỖI nhu cầu (gaming, van-phong, do-hoa, mong-nhe) viết 1-2 câu
  giải thích nhu cầu đó nên ưu tiên tiêu chí nào KHI XÉT NHÓM MÁY NÀY.
  KHÔNG nêu tên máy cụ thể.
- machines PHẢI có đúng N phần tử, đúng thứ tự đầu vào, index chạy 0..N-1.`;

/**
 * responseSchema cho Gemini.
 *
 * Gemini chỉ hỗ trợ object có shape CỐ ĐỊNH (không hỗ trợ keys động) — nên dùng
 * mảng object `machines[{index,...}]` thay vì object keyed theo product id.
 * Nhờ vậy không phải dùng thủ thuật trả JSON string như parse-product.
 *
 * Không dùng minimum/maximum (Gemini hay bỏ qua) — clamp bằng zod ở dưới.
 */
const compareResponseSchema = {
  type: "object",
  properties: {
    machines: {
      type: "array",
      description: "Mỗi phần tử ứng với 1 máy, ĐÚNG THỨ TỰ và ĐÚNG SỐ LƯỢNG như đầu vào.",
      items: {
        type: "object",
        properties: {
          index: { type: "integer", description: "Số thứ tự máy trong đầu vào, bắt đầu từ 0" },
          cpu_score: { type: "integer", description: "Điểm hiệu năng CPU 0-100 theo thang mốc" },
          cpu_note: { type: "string", description: "1 câu ngắn (<=20 từ) về CPU máy này" },
          gpu_score: { type: "integer", description: "Điểm hiệu năng GPU 0-100" },
          gpu_note: { type: "string" },
          display_score: { type: "integer", description: "Điểm CHẤT LƯỢNG tấm nền 0-100" },
          display_note: { type: "string" },
          summary: { type: "string", description: "2-3 câu tổng quan về máy này" },
          strengths: {
            type: "array",
            items: { type: "string" },
            description: "2-3 điểm mạnh, mỗi ý <=12 từ",
          },
          weaknesses: {
            type: "array",
            items: { type: "string" },
            description: "1-3 điểm yếu, mỗi ý <=12 từ",
          },
        },
        required: [
          "index",
          "cpu_score",
          "cpu_note",
          "gpu_score",
          "gpu_note",
          "display_score",
          "display_note",
          "summary",
          "strengths",
          "weaknesses",
        ],
        propertyOrdering: [
          "index",
          "cpu_score",
          "cpu_note",
          "gpu_score",
          "gpu_note",
          "display_score",
          "display_note",
          "summary",
          "strengths",
          "weaknesses",
        ],
      },
    },
    verdict: {
      type: "string",
      description: "3-5 câu kết luận chung, tiếng Việt, giọng tư vấn trung thực",
    },
    need_notes: {
      type: "array",
      description: "Mỗi nhu cầu 1 phần tử. KHÔNG nêu tên máy nào thắng.",
      items: {
        type: "object",
        properties: {
          need_slug: { type: "string", description: "Chỉ dùng: gaming | van-phong | do-hoa | mong-nhe" },
          note: { type: "string", description: "1-2 câu về tiêu chí nên ưu tiên" },
        },
        required: ["need_slug", "note"],
      },
    },
  },
  required: ["machines", "verdict", "need_notes"],
  propertyOrdering: ["machines", "verdict", "need_notes"],
} as const;

/** Ép về số nguyên 0-100, chịu được cả khi AI trả "78" hoặc 78.4. */
const score100 = z.coerce
  .number()
  .transform((n) => Math.max(0, Math.min(100, Math.round(n))));

const shortList = z.array(z.string().trim().min(1)).max(5).catch([]).default([]);

export const aiMachineSchema = z.object({
  index: z.coerce.number().int().min(0).max(3),
  cpu_score: score100,
  cpu_note: z.string().trim().catch("").default(""),
  gpu_score: score100,
  gpu_note: z.string().trim().catch("").default(""),
  display_score: score100,
  display_note: z.string().trim().catch("").default(""),
  summary: z.string().trim().catch("").default(""),
  strengths: shortList,
  weaknesses: shortList,
});

export const aiCompareSchema = z.object({
  machines: z.array(aiMachineSchema).min(2).max(4),
  verdict: z.string().trim().catch("").default(""),
  need_notes: z
    .array(z.object({ need_slug: z.string(), note: z.string().trim() }))
    // Backstop giống keepValidNeedTags: loại slug lạ do AI tự chế.
    .transform((arr) => arr.filter((n) => NEED_TAG_SLUGS.includes(n.need_slug)))
    .catch([])
    .default([]),
});

export type AiCompareResult = z.infer<typeof aiCompareSchema>;

/**
 * Dựng user prompt gọn nhất có thể: chỉ 5 thông số/máy, không gửi mô tả HTML.
 * Prompt ngắn = ít token, phản hồi nhanh, đỡ vượt thời gian sống của request.
 */
function buildUserPrompt(products: ProductForCompare[]): string {
  const blocks = products.map((p, i) => {
    const get = (metricId: string) => {
      const m = METRIC_BY_ID.get(metricId);
      return m ? rawValueOf(m, p.specs) : undefined;
    };
    const lines = [`[Máy ${i}] ${p.name}`];
    const cpu = get("cpu");
    const gpu = get("gpu");
    const display = get("display");
    const ram = get("ram");
    const storage = get("storage");
    if (cpu) lines.push(`- CPU: ${cpu}`);
    if (gpu) lines.push(`- GPU: ${gpu}`);
    if (display) lines.push(`- Màn hình: ${display}`);
    if (ram || storage) lines.push(`- RAM: ${ram ?? "?"} | Ổ cứng: ${storage ?? "?"}`);
    if (p.price > 0) lines.push(`- Giá: ${(p.price / 1_000_000).toFixed(1)} triệu`);
    return lines.join("\n");
  });

  const needList = NEED_TAGS.map((t) => `${t.slug} (${t.label})`).join(", ");

  return [
    `Có ${products.length} máy cần chấm điểm:`,
    "",
    blocks.join("\n\n"),
    "",
    `Các nhu cầu cần viết ghi chú: ${needList}`,
    "",
    `Trả về JSON với: machines (mảng ${products.length} phần tử, index 0..${products.length - 1},`,
    "mỗi phần tử có cpu_score, cpu_note, gpu_score, gpu_note, display_score, display_note,",
    "summary, strengths, weaknesses), verdict (chuỗi), need_notes (mảng {need_slug, note}).",
  ].join("\n");
}

/**
 * Parse JSON, cố vớt lại nếu output bị cắt giữa câu.
 *
 * Gặp thật khi chấm 4 máy: Gemini chạm giới hạn token và trả JSON dở
 * ("Unterminated string in JSON at position 1371"), làm cả lượt gọi mất trắng.
 * Đã nâng maxOutputTokens, nhưng vẫn giữ lớp vớt này: đóng lại chuỗi/mảng/object
 * còn hở rồi bỏ phần tử cuối cùng bị dở, để cứu được các máy đã chấm xong.
 */
function parseLooseJson(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(text);
  } catch {
    // Cắt tới phần tử `machines` cuối cùng còn NGUYÊN VẸN rồi tự đóng ngoặc.
    const lastComplete = text.lastIndexOf("]},");
    const cut = lastComplete > 0 ? text.slice(0, lastComplete + 2) : text;
    for (const tail of ["]}", "}]}", '"}]}']) {
      try {
        return JSON.parse(`${cut}${tail}`);
      } catch {
        // thử đuôi tiếp theo
      }
    }
    throw new Error("AI trả JSON không hợp lệ (có thể bị cắt do quá dài)");
  }
}

/**
 * Gọi AI chấm điểm. Ném Error nếu mọi provider đều thất bại.
 *
 * Giới hạn 2 key Gemini (thay vì 4) vì mỗi lần thử là một lượt chờ mạng —
 * thử hết 4 key rồi mới sang OpenAI dễ vượt thời gian sống của request.
 */
export async function analyzeComparison(
  products: ProductForCompare[],
  provider: AIProvider = "gemini",
): Promise<AiCompareResult> {
  if (products.length < 2) throw new Error("Cần ít nhất 2 máy để phân tích");

  return generateJson({
    provider,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(products),
    responseSchema: compareResponseSchema as unknown as Record<string, unknown>,
    temperature: 0.2,
    /*
      Cấp theo số máy vì tiếng Việt tốn token hơn tiếng Anh nhiều.
      Đặt 2600 cứng đã làm JSON bị cắt giữa câu ("Unterminated string") khi so
      4 máy → JSON.parse hỏng và mọi key đều "thất bại". Thà cấp thừa còn hơn
      mất cả lượt gọi.
    */
    maxOutputTokens: 1600 + products.length * 900,
    maxGeminiKeys: 2,
    parse: (raw) => {
      const parsed = aiCompareSchema.parse(parseLooseJson(raw));
      // Thiếu máy → thất bại để thử key khác. Thừa thì cắt bớt.
      if (parsed.machines.length < products.length) {
        throw new Error(`AI chỉ chấm ${parsed.machines.length}/${products.length} máy`);
      }
      parsed.machines = parsed.machines.slice(0, products.length);
      return parsed;
    },
  });
}

/**
 * Ghép điểm AI với product id.
 *
 * KHÔNG tin `index` của AI một cách mù quáng: nếu index bị trùng hoặc lệch khỏi
 * khoảng hợp lệ thì bỏ qua index và dùng thứ tự mảng — thứ tự mảng đã được
 * kiểm tra đúng số lượng ở trên.
 */
export function mapScoresToProducts(
  result: AiCompareResult,
  products: ProductForCompare[],
): { productId: string; cpuScore: number; gpuScore: number; displayScore: number }[] {
  const indexes = result.machines.map((m) => m.index);
  const validIndexes =
    new Set(indexes).size === indexes.length && indexes.every((i) => i < products.length);

  return result.machines.map((m, i) => {
    const product = products[validIndexes ? m.index : i];
    return {
      productId: product.id,
      cpuScore: m.cpu_score,
      gpuScore: m.gpu_score,
      displayScore: m.display_score,
    };
  });
}

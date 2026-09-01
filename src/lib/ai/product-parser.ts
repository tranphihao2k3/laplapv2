import { z } from "zod";
import { normalizeRam } from "@/lib/normalize-ram";
import { NEED_TAGS, NEED_TAG_SLUGS, keepValidNeedTags } from "@/lib/product-collections";

export const parsedProductSchema = z.object({
  name: z.string().describe("Tên sản phẩm gọn, có thương hiệu và model. VD: 'HP EliteBook 840 G5'"),
  category_hint: z
    .string()
    .describe("Loại sản phẩm: laptop, phone, watch, accessory, desktop, tablet, monitor, audio, other"),
  spec_template_id: z
    .string()
    .nullable()
    .describe("id của spec template được chọn khớp nhất với sản phẩm, hoặc null nếu không có template nào phù hợp"),
  brand_hint: z.string().nullable().describe("Tên thương hiệu nếu nhận diện được, VD: 'HP', 'Apple', 'Samsung'"),
  short_description: z.string().describe("Mô tả ngắn 1 câu, dùng làm tiêu đề phụ"),
  description: z
    .string()
    .describe(
      "Mô tả chi tiết bằng HTML (KHÔNG phải Markdown). Dùng <h3>, <p>, <ul><li>, <strong>, <em>, <table><thead><tbody> để trình bày các phần: Cấu hình chính, Đánh giá hiệu năng, Tác vụ phù hợp, Đối tượng người dùng phù hợp, Khả năng chơi game (kèm danh sách game cụ thể có thể chơi mượt/ổn/không), Phụ kiện đi kèm & bảo hành.",
    ),
  selling_price: z.number().nullable().describe("Giá bán bằng VND, đã chuẩn hoá. VD: '6triuX' → 6000000"),
  cost_price: z.number().nullable().describe("Giá vốn nếu có, không thì null"),
  warranty_months: z.number().nullable().describe("Số tháng bảo hành"),
  condition: z.string().nullable().describe("Tình trạng máy: 'new', 'used-98%', 'refurbished'..."),
  tags: z.array(z.string()).describe("Mảng tag ngắn cho sản phẩm"),
  need_tags: z
    .array(z.string())
    .describe(
      `Nhóm nhu cầu của sản phẩm — CHỈ chọn trong các slug: ${NEED_TAG_SLUGS.join(", ")}. Được chọn NHIỀU nhóm (1 máy có thể vừa gaming vừa mỏng nhẹ). Không tự chế slug khác.`,
    ),
  gifts: z.array(z.string()).describe("Danh sách quà tặng kèm dạng tên"),
  specs: z
    .record(z.string(), z.string())
    .describe("Cặp key-value thông số kỹ thuật. Keys nên ngắn snake_case: cpu, ram, ssd, screen, vga, battery, ports, keyboard..."),
  performance_review: z
    .string()
    .describe("2-4 câu đánh giá hiệu năng dựa trên cấu hình: phù hợp tác vụ gì, điểm mạnh, điểm yếu"),
});

export type ParsedProduct = z.infer<typeof parsedProductSchema>;

/**
 * Schema cho parse NHIỀU sản phẩm (multi-block hoặc multi-option).
 * Ưu tiên `products` (mảng) — fallback `product` (đơn) để tương thích ngược.
 */
export const multiParsedProductSchema = z.object({
  // Một khối duy nhất (multi-options cho 1 model) hoặc nhiều khối (nhiều sản phẩm).
  // Đặt cùng `variant_group` cho các option của CÙNG 1 model → server sẽ gộp thành
  // 1 product cha + nhiều variants.
  products: z
    .array(parsedProductSchema)
    .describe(
      "Mảng các sản phẩm. Mỗi phần tử là 1 ParsedProduct. " +
        "QUAN TRỌNG: Nếu text liệt kê NHIỀU CẤU HÌNH của CÙNG 1 model (VD 'Dell 7420: RAM 8GB giá 6tr, RAM 16GB giá 8tr'), " +
        "trả về NHIỀU phần tử với cùng `variant_group` (cùng brand + model chuẩn hoá). " +
        "Nếu text liệt kê NHIỀU MODEL khác nhau (VD '1. Dell 7420...\\n2. HP 840 G5...'), " +
        "mỗi model là 1 phần tử với `variant_group` KHÁC NHAU.",
    ),
  variant_group: z
    .record(z.string(), z.string())
    .describe(
      "Map { productIndex (string 0/1/2) → variant_group_id }. " +
        "Cùng `variant_group_id` cho các option cùng model → server gộp thành variants. " +
        "Mặc định: mỗi index là group riêng (không gộp). " +
        "Chỉ đặt cùng group khi text mô tả các option khác nhau của CÙNG 1 model (khác RAM/SSD/màu). " +
        "variant_group_id nên là brand+model viết thường không dấu, VD 'dell-latitude-7420', 'hp-elitebook-840-g5'.",
    ),
});

export type MultiParsedProduct = z.infer<typeof multiParsedProductSchema>;
export type VariantGroupMap = Record<string, string>;

export type AIProvider = "gemini" | "openai";

export type SpecTemplateForAI = {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  fields: Array<{ key: string; label?: string; type?: string }>;
};

const SYSTEM_PROMPT = `Bạn là trợ lý phân tích mô tả sản phẩm công nghệ tiếng Việt cho cửa hàng laptop/điện thoại tại Việt Nam.

Đầu vào là đoạn text mô tả sản phẩm (thường copy từ Facebook, Zalo) — có emoji, viết tắt, tiếng lóng. Hãy parse thật chính xác và trả về JSON đúng schema.

QUY TẮC CHUNG:
1. Giá tiền: chuẩn hoá về số nguyên VND.
   - "6triuX", "6tr5", "6.500k", "6.5tr", "6 triệu rưỡi" → 6500000
   - "6tr" → 6000000
   - "990k" → 990000
   - Nếu giá ghi mập mờ như "6triuX" thì hiểu là khoảng 6 triệu mấy, lấy ước lượng hợp lý (ví dụ 6500000).
2. Tên sản phẩm: viết hoa chuẩn, có model đầy đủ (VD "HP EliteBook 840 G5" thay vì "Hp 840g5").
3. category_hint: chọn 1 trong các giá trị: laptop, phone, watch, accessory, desktop, tablet, monitor, audio, other.
4. gifts: tách từng món, bỏ emoji. VD "Balo + túi chống sốc + chuột" → ["Balo", "Túi chống sốc", "Chuột"].
5. condition: "98%", "máy zin", "like new" → "used-98%". Hàng mới → "new".
6. performance_review: viết tiếng Việt tự nhiên 2-4 câu, dựa trên CPU/RAM/GPU.
7. description: TRẢ VỀ HTML THUẦN (không Markdown, không \`\`\`). Cấu trúc bắt buộc, theo đúng thứ tự, mỗi section là một <section>:

   <section>
     <h3>🧩 Cấu hình chính</h3>
     <table>
       <tbody>
         <tr><th>CPU</th><td>...</td></tr>
         <tr><th>RAM</th><td>...</td></tr>
         <tr><th>Lưu trữ</th><td>...</td></tr>
         <tr><th>GPU</th><td>...</td></tr>
         <tr><th>Màn hình</th><td>...</td></tr>
         <tr><th>Pin</th><td>...</td></tr>
         <tr><th>Trọng lượng</th><td>...</td></tr>
       </tbody>
     </table>
     <p>(chỉ liệt kê dòng có dữ liệu, bỏ dòng không biết)</p>
   </section>

   <section>
     <h3>⚡ Đánh giá hiệu năng</h3>
     <p>2-4 câu tự nhiên dựa trên CPU/RAM/GPU. Nói rõ điểm mạnh, điểm yếu.</p>
   </section>

   <section>
     <h3>🎯 Tác vụ phù hợp</h3>
     <ul>
       <li><strong>Văn phòng & học tập:</strong> mượt / ổn / hơi đuối — kèm 1 câu giải thích.</li>
       <li><strong>Đồ họa / dựng video:</strong> ...</li>
       <li><strong>Lập trình / data:</strong> ...</li>
       <li><strong>Giải trí, xem phim:</strong> ...</li>
     </ul>
   </section>

   <section>
     <h3>👤 Đối tượng phù hợp</h3>
     <ul>
       <li>Sinh viên ngành ... vì ...</li>
       <li>Nhân viên văn phòng cần ...</li>
       <li>Designer / coder mức ...</li>
     </ul>
   </section>

   <section>
     <h3>🎮 Khả năng chơi game</h3>
     <p>Đánh giá tổng quan 1-2 câu (chơi tốt / chơi nhẹ / không phù hợp gaming).</p>
     <table>
       <thead><tr><th>Game</th><th>Mức chơi được</th><th>Setting gợi ý</th></tr></thead>
       <tbody>
         <tr><td>Liên Minh Huyền Thoại</td><td>Mượt 100+ FPS / Ổn ~60 FPS / Không khuyến nghị</td><td>Medium 1080p</td></tr>
         <tr><td>Valorant / CS2</td><td>...</td><td>...</td></tr>
         <tr><td>GTA V</td><td>...</td><td>...</td></tr>
         <tr><td>Genshin Impact</td><td>...</td><td>...</td></tr>
         <tr><td>FIFA Online 4</td><td>...</td><td>...</td></tr>
         <tr><td>(thêm 1-2 game nặng như Cyberpunk/Elden Ring nếu máy đủ mạnh)</td><td>...</td><td>...</td></tr>
       </tbody>
     </table>
     <p>Nếu máy KHÔNG có GPU rời và iGPU yếu → ghi rõ "Chỉ phù hợp game online nhẹ, không chơi được AAA hiện đại".</p>
   </section>

   <section>
     <h3>🎁 Phụ kiện đi kèm & 🛡️ Bảo hành</h3>
     <ul>
       <li>Phụ kiện: ...</li>
       <li>Bảo hành: ... tháng</li>
     </ul>
   </section>

   QUAN TRỌNG: KHÔNG dùng \`\`\`html\`\`\`, KHÔNG escape, KHÔNG markdown. Trả về HTML thô.

QUY TẮC ĐIỀN SPECS (cực kỳ quan trọng):
- Bạn sẽ được cung cấp DANH SÁCH SPEC TEMPLATE của shop. Mỗi template thuộc 1 category và có danh sách field cố định (key + label).
- Chọn TEMPLATE PHÙ HỢP NHẤT với loại sản phẩm trong text, ghi id template vào trường "spec_template_id".
- specs PHẢI dùng đúng các "key" của template đó (không tự đặt key mới).
- Với mỗi field của template:
  • Nếu text có đề cập → điền giá trị gọn, đã làm sạch emoji "⚡️💻🔥".
  • Nếu không đề cập nhưng SUY LUẬN ĐƯỢC chắc chắn từ thông tin khác → điền và đánh dấu chữ "(suy luận)" ở cuối. Ví dụ: CPU Intel thế hệ 8 → GPU "Intel UHD Graphics 620 (onboard, suy luận)".
  • Quy ước viết tắt:
      - GPU/VGA không có card rời → "Onboard" (kèm tên iGPU nếu biết).
      - HDD không có → "Không có".
      - SSD/HDD nếu chỉ có dung lượng → giữ dạng "256GB SSD NVMe".
      - RAM: LUÔN chuẩn hoá về đúng định dạng "<dung lượng>GB <loại DDR>", viết hoa GB và DDR. VD: "16GB DDR4", "8GB DDR5", "16GB LPDDR5". Nếu KHÔNG biết loại DDR thì chỉ ghi dung lượng "16GB". TUYỆT ĐỐI không thêm chú thích như "(hỗ trợ nâng cấp tối đa...)", "(2 khe)", "bus 3200"... vào trường ram — chỉ dung lượng + loại DDR. Thông tin nâng cấp/khe cắm (nếu có) đưa vào phần mô tả HTML, không đưa vào specs.ram.
      - Đèn phím "sáng trưng" → "Có (LED trắng)".
  • Nếu KHÔNG có thông tin và KHÔNG suy luận được → BỎ QUA key đó (không thêm vào specs). Đừng điền "không rõ", "n/a".
- KHÔNG thêm key ngoài template.

QUY TẮC PHÂN NHÓM NHU CẦU (need_tags):
- Chọn các nhóm phù hợp trong danh sách sau (dùng đúng "slug", được chọn NHIỀU nhóm cho 1 máy):
${NEED_TAGS.map((t) => `  • ${t.slug}: ${t.aiHint}`).join("\n")}
- Suy luận từ cấu hình (CPU/GPU/RAM/trọng lượng) và tên dòng máy. Ví dụ: laptop có RTX 4060 + nặng → ["gaming", "do-hoa"]; MacBook Air M2 → ["van-phong", "mong-nhe", "do-hoa"]; Dell Latitude i5 8GB → ["van-phong"].
- Nếu không chắc, ít nhất gán "van-phong" cho laptop phổ thông. TUYỆT ĐỐI không tạo slug ngoài danh sách.

QUY TẮC MULTI-PRODUCT / MULTI-VARIANT (rất quan trọng):
- Bạn PHẢI trả về object có shape { products: [...], variant_group: {...} }.
- "products" là mảng. Mỗi phần tử là 1 sản phẩm đầy đủ (đúng schema ở trên).
- TÁCH SẢN PHẨM: Nếu text có nhiều sản phẩm / nhiều cấu hình, mỗi cái là 1 phần tử trong mảng:
  • Nhiều MODEL khác nhau (mỗi model 1 khối riêng trong text): mỗi model = 1 phần tử.
  • Nhiều OPTION/CẤU HÌNH của CÙNG 1 model (VD "Dell 7420: 8GB/256GB giá 6tr, 16GB/512GB giá 8tr"): mỗi cấu hình = 1 phần tử, CÙNG variant_group_id.
- Nếu text chỉ có 1 sản phẩm → trả mảng 1 phần tử, variant_group_id là brand+model chuẩn hoá.
- "variant_group" là object { "<index>": "<group_id>" }, trong đó index là vị trí trong mảng products (0, 1, 2...), group_id là chuỗi slug từ brand+model.
  • VD: 3 option của Dell 7420 → variant_group = { "0": "dell-latitude-7420", "1": "dell-latitude-7420", "2": "dell-latitude-7420" }
  • 2 model khác nhau → variant_group = { "0": "dell-latitude-7420", "1": "hp-elitebook-840-g5" }
- Nếu CHỈ 1 sản phẩm và bạn không chắc có option khác, vẫn wrap trong mảng 1 phần tử.
- group_id viết thường, không dấu, gạch ngang. Cùng brand+model → cùng group_id.

LUÔN trả về JSON hợp lệ đúng schema.`;

function formatTemplatesForPrompt(templates: SpecTemplateForAI[]) {
  if (!templates.length) {
    return "Không có spec template trong hệ thống — bỏ trống specs và spec_template_id.";
  }
  return templates
    .map((t) => {
      const cat = t.category_name ? ` (category: ${t.category_name})` : "";
      const fields = t.fields
        .map((f) => `  - ${f.key}${f.label ? ` (${f.label})` : ""}${f.type ? ` [${f.type}]` : ""}`)
        .join("\n");
      return `Template id=${t.id} · ${t.name}${cat}\n${fields}`;
    })
    .join("\n\n");
}

function getUserPrompt(text: string, templates: SpecTemplateForAI[]) {
  return [
    "Phân tích đoạn mô tả sản phẩm sau và trả về JSON đúng schema.",
    "",
    "=== DANH SÁCH SPEC TEMPLATE HIỆN CÓ ===",
    formatTemplatesForPrompt(templates),
    "",
    "=== MÔ TẢ SẢN PHẨM ===",
    `"""${text}"""`,
  ].join("\n");
}

async function parseWithGemini(
  text: string,
  templates: SpecTemplateForAI[],
  apiKey: string,
): Promise<MultiParsedProduct> {
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Schema response dạng { products: [...], variant_group: {...} }.
  // specs là free-form object → wrap thành string (specs_json) để Gemini chấp nhận.
  const responseSchema = {
    type: "object",
    properties: {
      products: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            category_hint: { type: "string" },
            spec_template_id: { type: "string", nullable: true },
            brand_hint: { type: "string", nullable: true },
            short_description: { type: "string" },
            description: { type: "string" },
            selling_price: { type: "number", nullable: true },
            cost_price: { type: "number", nullable: true },
            warranty_months: { type: "number", nullable: true },
            condition: { type: "string", nullable: true },
            tags: { type: "array", items: { type: "string" } },
            need_tags: { type: "array", items: { type: "string" } },
            gifts: { type: "array", items: { type: "string" } },
            specs_json: { type: "string" },
            performance_review: { type: "string" },
          },
          required: [
            "name",
            "category_hint",
            "short_description",
            "description",
            "tags",
            "need_tags",
            "gifts",
            "specs_json",
            "performance_review",
          ],
        },
      },
      // Gemini response_schema không hỗ trợ additionalProperties → khai báo key index cố định (0-19).
      // Đủ cho hầu hết trường hợp multi-product.
      variant_group: {
        type: "object",
        properties: {
          "0":  { type: "string" },
          "1":  { type: "string" },
          "2":  { type: "string" },
          "3":  { type: "string" },
          "4":  { type: "string" },
          "5":  { type: "string" },
          "6":  { type: "string" },
          "7":  { type: "string" },
          "8":  { type: "string" },
          "9":  { type: "string" },
          "10": { type: "string" },
          "11": { type: "string" },
          "12": { type: "string" },
          "13": { type: "string" },
          "14": { type: "string" },
          "15": { type: "string" },
          "16": { type: "string" },
          "17": { type: "string" },
          "18": { type: "string" },
          "19": { type: "string" },
        },
      },
    },
    required: ["products", "variant_group"],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: getUserPrompt(text, templates) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API lỗi ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Gemini không trả nội dung");
  const parsed = unpackSpecsJson(JSON.parse(rawText));
  return normalizeMulti(normalizeSpecs(parsed));
}

async function parseWithOpenAI(
  text: string,
  templates: SpecTemplateForAI[],
  apiKey: string,
): Promise<MultiParsedProduct> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: getUserPrompt(text, templates) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API lỗi ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawText = json.choices?.[0]?.message?.content;
  if (!rawText) throw new Error("OpenAI không trả nội dung");
  const parsed = unpackSpecsJson(JSON.parse(rawText));
  return normalizeMulti(normalizeSpecs(parsed));
}

/** Gemini chỉ hỗ trợ object có shape cố định → ta yêu cầu nó trả specs dưới dạng string JSON rồi parse lại ở đây.
 * Hỗ trợ cả 2 dạng:
 *  - Cũ (1 sản phẩm): { specs_json: "...", ... }
 *  - Mới (multi): { products: [{ specs_json: "..." }, ...], variant_group: {...} }
 */
function unpackSpecsJson(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const obj = input as Record<string, unknown>;
  if (Array.isArray(obj.products)) {
    for (const p of obj.products) {
      unpackSpecsJson(p);
    }
    return obj;
  }
  if (typeof obj.specs_json === "string" && obj.specs === undefined) {
    try {
      obj.specs = JSON.parse(obj.specs_json);
    } catch {
      obj.specs = {};
    }
    delete obj.specs_json;
  }
  if (!obj.specs || typeof obj.specs !== "object") obj.specs = {};
  return obj;
}

function normalizeSpecs(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const obj = input as Record<string, unknown>;
  // Backstop: chỉ giữ need_tags là slug hợp lệ (phòng AI chế slug lạ).
  obj.need_tags = keepValidNeedTags(obj.need_tags);
  if (obj.specs && typeof obj.specs === "object") {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj.specs as Record<string, unknown>)) {
      if (v == null || v === "") continue;
      const value = String(v).replace(/^[⚡️💻🔥✨🎁💸⏰]+\s*/u, "").trim();
      // Backstop: dù prompt đã yêu cầu, vẫn chuẩn hoá ram về "<dung lượng>GB <DDR>" ở code.
      cleaned[k] = k === "ram" ? normalizeRam(value) : value;
    }
    obj.specs = cleaned;
  }
  return obj;
}

/**
 * Normalize response thành MultiParsedProduct.
 * - Nếu AI trả object 1 sản phẩm (cũ), wrap thành mảng 1 phần tử.
 * - Validate từng sản phẩm bằng parsedProductSchema.
 * - variant_group: map { "<index>": "<group>" }; nếu thiếu thì mỗi index là group riêng.
 */
function normalizeMulti(input: unknown): MultiParsedProduct {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  let products: ParsedProduct[] = [];
  let variantGroupRaw: Record<string, string> = {};

  if (Array.isArray(raw.products)) {
    // Validate từng phần tử (best-effort: nếu 1 cái fail, bỏ qua, không cản cả mảng).
    for (const p of raw.products) {
      try {
        products.push(parsedProductSchema.parse(normalizeSpecs(p)));
      } catch (err) {
        // Log nhẹ để debug nhưng vẫn tiếp tục
        console.warn("[product-parser] Bỏ qua sản phẩm không hợp lệ:", err);
      }
    }
    if (raw.variant_group && typeof raw.variant_group === "object") {
      variantGroupRaw = raw.variant_group as Record<string, string>;
    }
  } else if (raw.name) {
    // Tương thích ngược: AI trả về 1 object sản phẩm (cũ).
    try {
      products = [parsedProductSchema.parse(normalizeSpecs(raw))];
      variantGroupRaw = { "0": slugifyGroupId(raw.name as string) };
    } catch {
      products = [];
    }
  }

  if (products.length === 0) {
    throw new Error("AI không trả về sản phẩm nào hợp lệ");
  }

  // Đảm bảo mỗi index có group_id (default = chính index đó).
  const variant_group: Record<string, string> = {};
  for (let i = 0; i < products.length; i++) {
    const g = variantGroupRaw[String(i)] || variantGroupRaw[String(products[i].name)] || "";
    variant_group[String(i)] = g || slugifyGroupId(products[i].name);
  }

  return multiParsedProductSchema.parse({ products, variant_group });
}

/** Slug hoá tên sản phẩm thành group_id (không dấu, snake-case). */
function slugifyGroupId(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Gọi Gemini/OpenAI với fallback key. Trả về MultiParsedProduct.
 * Internal helper — callers nên dùng parseProductsText().
 */
async function tryProviders(
  text: string,
  provider: AIProvider,
  templates: SpecTemplateForAI[],
): Promise<MultiParsedProduct> {
  const geminiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter((k): k is string => !!k);

  const openaiKey = process.env.OPENAI_API_KEY;
  const errors: string[] = [];

  const tryGemini = async (): Promise<MultiParsedProduct> => {
    if (geminiKeys.length === 0) {
      throw new Error("Chưa cấu hình bất kỳ GEMINI_API_KEY nào");
    }
    for (let i = 0; i < geminiKeys.length; i++) {
      try {
        return await parseWithGemini(text, templates, geminiKeys[i]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Gemini Key ${i + 1} thất bại: ${msg}`);
      }
    }
    throw new Error("Tất cả key Gemini đều thất bại");
  };

  const tryOpenAI = async (): Promise<MultiParsedProduct> => {
    if (!openaiKey) {
      throw new Error("Chưa cấu hình OPENAI_API_KEY");
    }
    try {
      return await parseWithOpenAI(text, templates, openaiKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`OpenAI thất bại: ${msg}`);
      throw err;
    }
  };

  if (provider === "gemini") {
    try {
      return await tryGemini();
    } catch {
      if (openaiKey) {
        try {
          return await tryOpenAI();
        } catch {
          throw new Error(`Gemini & OpenAI fallback đều thất bại. Chi tiết lỗi:\n${errors.join("\n")}`);
        }
      }
      throw new Error(`Tất cả key Gemini đều thất bại và không có OpenAI key dự phòng. Chi tiết lỗi:\n${errors.join("\n")}`);
    }
  }
  try {
    return await tryOpenAI();
  } catch {
    if (geminiKeys.length > 0) {
      try {
        return await tryGemini();
      } catch {
        throw new Error(`OpenAI & Gemini fallback đều thất bại. Chi tiết lỗi:\n${errors.join("\n")}`);
      }
    }
    throw new Error(`OpenAI thất bại và không có Gemini key dự phòng. Chi tiết lỗi:\n${errors.join("\n")}`);
  }
}

/**
 * Parse text thành NHIỀU sản phẩm (kèm variant_group để server gộp variants).
 * Đây là API chính cho `parse-product`.
 */
export async function parseProductsText(
  text: string,
  provider: AIProvider,
  templates: SpecTemplateForAI[] = [],
): Promise<MultiParsedProduct> {
  if (!text.trim()) throw new Error("Text rỗng");
  return await tryProviders(text, provider, templates);
}

/**
 * Backward-compat: parse 1 sản phẩm (lấy phần tử đầu tiên từ parseProductsText).
 * Khuyến khích dùng parseProductsText() cho multi-product flow mới.
 */
export async function parseProductText(
  text: string,
  provider: AIProvider,
  templates: SpecTemplateForAI[] = [],
): Promise<ParsedProduct> {
  const multi = await parseProductsText(text, provider, templates);
  return multi.products[0];
}

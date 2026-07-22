import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  productName: z.string().min(1),
  shortDescription: z.string().default(""),
  specs: z.record(z.string(), z.string()).nullable().default(null),
});

// Phat hien may co GPU roi choi game duoc hay khong.
// MacBook / Apple Silicon / chi co GPU tich hop -> KHONG phai may gaming.
function detectGamingCapable(
  productName: string,
  specs: Record<string, string> | null,
): boolean {
  const name = productName.toLowerCase();
  const cpu = (specs?.cpu ?? "").toLowerCase();
  const gpu = (specs?.gpu ?? "").toLowerCase();
  const os = (specs?.os ?? "").toLowerCase();

  // MacBook / macOS / chip Apple M -> loai ngay (khong choi game Windows).
  if (
    name.includes("macbook") ||
    name.includes("imac") ||
    name.includes("mac mini") ||
    os.includes("mac") ||
    /\bapple\s*m\d/.test(cpu)
  ) {
    return false;
  }

  // Chi coi la may gaming khi co GPU ROI thuc su (NVIDIA/AMD/Intel Arc).
  // Cac GPU tich hop (Iris Xe, UHD, Vega tich hop) -> khong tinh.
  const dedicatedGpu = /\b(rtx|gtx|geforce\s*mx|quadro|radeon\s*rx|\brx\s*\d{3,}|arc\s*a\d{3})\b/.test(gpu);
  return dedicatedGpu;
}

// Section game (chi chen khi may co GPU roi). Yeu cau AI dua vao benchmark THAT
// tim qua Google Search, KHONG duoc bia so FPS.
const GAMING_SECTION = `
<section>
<div class="flex items-center gap-3 mb-4"><span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-lg">🎮</span><h3 class="text-lg font-bold text-foreground m-0">Khả năng chơi game</h3></div>
<p class="text-muted-foreground leading-relaxed mb-3">1-2 câu đánh giá tổng quan khả năng gaming của GPU rời này.</p>
<table><thead><tr><th>Game</th><th>FPS thực tế</th><th>Setting gợi ý</th></tr></thead><tbody>
  <!-- Liệt kê 4-6 game phổ biến PHÙ HỢP với đúng GPU + độ phân giải màn hình của máy này.
       Số FPS phải dựa trên benchmark THỰC TẾ tìm được qua Google Search cho đúng model GPU,
       KHÔNG được bịa. Nếu không tìm thấy dữ liệu tin cậy cho một game, BỎ dòng đó. -->
</tbody></table>
<p class="text-muted-foreground leading-relaxed mb-3 text-sm"><em>* FPS tham khảo từ benchmark thực tế, có thể chênh lệch tùy tản nhiệt và driver.</em></p>
</section>
`;

function buildSystemPrompt(gamingCapable: boolean): string {
  return `Bạn là chuyên viên viết mô tả sản phẩm công nghệ bằng tiếng Việt. Nhiệm vụ của bạn là tạo một bài viết blog-style, chuyên nghiệp, có cấu trúc HTML cho một sản phẩm laptop/dienthoai/máy tính bảng dựa trên thông số kỹ thuật được cung cấp.

YÊU CẦU:
- Viết bằng tiếng Việt tự nhiên, hấp dẫn, chuẩn SEO.
- Sử dụng HTML thuần (KHÔNG Markdown, KHÔNG escape).
- Bài viết dạng blog, có sections rõ ràng với heading và nội dung chi tiết.
- TUYỆT ĐỐI KHÔNG bịa số liệu (FPS, điểm benchmark, thời lượng pin cụ thể) nếu không chắc chắn.

CẤU TRÚC BẮT BUỘC:

<section>
<div class="flex items-center gap-3 mb-4"><span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-lg">🧩</span><h3 class="text-lg font-bold text-foreground m-0">Cấu hình chính</h3></div>
<table><tbody>
  <tr><th>CPU</th><td>...</td></tr>
  <tr><th>RAM</th><td>...</td></tr>
  <tr><th>Lưu trữ</th><td>...</td></tr>
  <tr><th>GPU</th><td>...</td></tr>
  <tr><th>Màn hình</th><td>...</td></tr>
  <tr><th>Pin</th><td>...</td></tr>
</tbody></table>
<p class="text-muted-foreground leading-relaxed mb-3">Tổng quan ngắn về cấu hình, xu hướng sử dụng.</p>
</section>

<section>
<div class="flex items-center gap-3 mb-4"><span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-lg">⚡</span><h3 class="text-lg font-bold text-foreground m-0">Đánh giá hiệu năng</h3></div>
<p class="text-muted-foreground leading-relaxed mb-3">3-5 câu đánh giá hiệu năng chi tiết: CPU mạnh/thế nào, RAM đủ đa nhiệm không, GPU xử lý đồ họa ra sao, SSD nhanh thế nào. So sánh với các dòng tương tự. Nêu điểm mạnh và hạn chế.</p>
</section>

<section>
<div class="flex items-center gap-3 mb-4"><span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-lg">🎯</span><h3 class="text-lg font-bold text-foreground m-0">Tác vụ phù hợp</h3></div>
<ul class="space-y-2 list-disc pl-5">
<li><strong>Văn phòng & học tập:</strong> ...</li>
<li><strong>Đồ họa / dựng video:</strong> ...</li>
<li><strong>Lập trình:</strong> ...</li>
<li><strong>Giải trí & xem phim:</strong> ...</li>
</ul>
</section>

<section>
<div class="flex items-center gap-3 mb-4"><span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-lg">👤</span><h3 class="text-lg font-bold text-foreground m-0">Đối tượng phù hợp</h3></div>
<ul class="space-y-2 list-disc pl-5">
<li>Sinh viên ngành ... vì ...</li>
<li>Nhân viên văn phòng cần ...</li>
<li>Designer / Freelancer ...</li>
</ul>
</section>
${gamingCapable ? GAMING_SECTION : ""}
<section>
<div class="flex items-center gap-3 mb-4"><span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-lg">🎁</span><h3 class="text-lg font-bold text-foreground m-0">Phụ kiện đi kèm & Bảo hành</h3></div>
<ul class="space-y-2 list-disc pl-5">
<li>Phụ kiện đi kèm: sạc, túi chống sốc, chuột (nếu có thông tin)</li>
<li>Bảo hành: theo thông tin sản phẩm</li>
<li>Hỗ trợ trả góp 0% qua thẻ tín dụng</li>
</ul>
</section>

QUAN TRỌNG:
- KHÔNG dùng \`\`\`html, KHÔNG markdown.
- Chỉ liệt kê dòng có dữ liệu trong bảng cấu hình.
- Nếu specs có "ram", "cpu", "gpu", "storage", "display" → dùng dữ liệu đó.
- Viết tự nhiên, cuốn hút, không quá ngắn.
${
  gamingCapable
    ? '- Máy này CÓ GPU rời: hãy đưa mục "Khả năng chơi game" với FPS THỰC TẾ tra từ benchmark, không bịa.'
    : '- Máy này KHÔNG phù hợp gaming (MacBook/máy văn phòng/GPU tích hợp): TUYỆT ĐỐI KHÔNG thêm mục "Khả năng chơi game", KHÔNG liệt kê FPS game. Nếu cần, chỉ nói ngắn gọn trong mục hiệu năng rằng máy phù hợp giải trí nhẹ, không phải máy chuyên game.'
}`;
}

function buildSpecsTable(specs: Record<string, string>): string {
  const LABELS: Record<string, string> = {
    cpu: "CPU",
    ram: "RAM",
    gpu: "Card đồ họa",
    storage: "Lưu trữ",
    ssd: "SSD",
    display: "Màn hình",
    man_hinh: "Màn hình",
    ban_phim: "Bàn phím",
    battery: "Pin",
    weight: "Trọng lượng",
    os: "Hệ điều hành",
    bao_hanh: "Bảo hành",
    warranty: "Bảo hành",
    color: "Màu sắc",
    ports: "Cổng kết nối",
  };
  const rows = Object.entries(specs)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => {
      const label = LABELS[k] ?? k;
      return `  <tr><th>${label}</th><td>${v}</td></tr>`;
    });
  return `<table><tbody>\n${rows.join("\n")}\n</tbody></table>`;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { message: "Dữ liệu không hợp lệ" } },
        { status: 400 },
      );
    }

    const { productName, shortDescription, specs } = parsed.data;

    // Xac dinh may co choi game duoc khong -> quyet dinh co mục game + grounding.
    const gamingCapable = detectGamingCapable(productName, specs);
    const systemPrompt = buildSystemPrompt(gamingCapable);

    const specsSection = specs && Object.keys(specs).length > 0
      ? `\nTHÔNG SỐ KỸ THUẬT:\n${Object.entries(specs).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`
      : "";

    const prompt = [
      `Sản phẩm: ${productName}`,
      shortDescription ? `Mô tả ngắn: ${shortDescription}` : "",
      specsSection,
      "",
      "Hãy viết bài giới thiệu chi tiết, blog-style bằng HTML (KHÔNG markdown).",
    ].filter(Boolean).join("\n");

    const geminiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
    ].filter((k): k is string => !!k);

    if (geminiKeys.length === 0) {
      return NextResponse.json(
        { ok: false, error: { message: "Chưa cấu hình bất kỳ GEMINI_API_KEY nào" } },
        { status: 500 },
      );
    }

    const model = "gemini-2.5-flash";
    const errors: string[] = [];
    let rawText: string | undefined;

    for (let i = 0; i < geminiKeys.length; i++) {
      const apiKey = geminiKeys[i];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            // May gaming: bat Google Search de lay FPS benchmark THAT thay vi doan.
            ...(gamingCapable ? { tools: [{ google_search: {} }] } : {}),
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
            },
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          errors.push(`Key ${i + 1} lỗi ${res.status}: ${body}`);
          continue;
        }

        const result = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        // Grounding co the tra text o nhieu parts -> noi tat ca lai.
        const parts = result.candidates?.[0]?.content?.parts ?? [];
        const joined = parts.map((p) => p.text ?? "").join("").trim();
        rawText = joined || undefined;
        if (!rawText) {
          errors.push(`Key ${i + 1}: Gemini không trả nội dung`);
          continue;
        }

        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Key ${i + 1} exception: ${msg}`);
      }
    }

    if (!rawText) {
      throw new Error(`Tất cả ${geminiKeys.length} key Gemini đều thất bại:\n${errors.join("\n")}`);
    }

    const cleaned = rawText
      .replace(/^```html\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    return NextResponse.json({
      ok: true,
      data: {
        description: cleaned,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ ok: false, error: { message } }, { status: 500 });
  }
}

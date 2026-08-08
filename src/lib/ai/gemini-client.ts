/**
 * Hạ tầng gọi LLM dùng chung — chỉ lo VẬN CHUYỂN, không chứa prompt nghiệp vụ.
 *
 * Tách ra từ src/lib/ai/product-parser.ts để trang so sánh dùng lại vòng lặp
 * "thử lần lượt 4 key Gemini rồi fallback OpenAI" mà không phải copy code.
 */

export type AIProvider = "gemini" | "openai";

export const GEMINI_MODEL = "gemini-2.5-flash";
export const OPENAI_MODEL = "gpt-4o-mini";

/** Gom các key Gemini theo đúng thứ tự ưu tiên (dùng để né rate limit). */
export function getGeminiKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter((k): k is string => !!k);
}

export function getOpenAIKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

export type JsonCallOptions = {
  systemPrompt: string;
  userPrompt: string;
  /** responseSchema của Gemini (OpenAI bỏ qua, nên prompt phải tự mô tả shape). */
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  /**
   * Giới hạn độ dài output. CHỈ set khi biết chắc output ngắn — áp cho tác vụ
   * sinh văn bản dài (mô tả sản phẩm) sẽ cắt cụt bài viết giữa câu.
   */
  maxOutputTokens?: number;
  /** Huỷ request sau N ms — chống treo request trên Cloudflare Worker. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 25_000;

/** Gọi 1 key Gemini, trả TEXT thô. Ném Error khi lỗi. */
export async function callGeminiRaw(opts: JsonCallOptions & { apiKey: string }): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${opts.apiKey}`;

  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.responseSchema) generationConfig.responseSchema = opts.responseSchema;
  if (opts.maxOutputTokens) generationConfig.maxOutputTokens = opts.maxOutputTokens;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API lỗi ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  // Nối TẤT CẢ parts — output dài có thể bị chia thành nhiều part, chỉ lấy
  // parts[0] sẽ mất phần sau và JSON.parse hỏng.
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const rawText = parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!rawText) throw new Error("Gemini không trả nội dung");
  return rawText;
}

/** Gọi OpenAI chat completions, trả TEXT thô. */
export async function callOpenAIRaw(opts: JsonCallOptions & { apiKey: string }): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: opts.temperature ?? 0.2,
      response_format: { type: "json_object" },
      ...(opts.maxOutputTokens ? { max_tokens: opts.maxOutputTokens } : {}),
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API lỗi ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const rawText = json.choices?.[0]?.message?.content?.trim();
  if (!rawText) throw new Error("OpenAI không trả nội dung");
  return rawText;
}

/**
 * Điều phối: thử lần lượt các key Gemini, rồi fallback sang provider còn lại.
 *
 * `parse` nhận text thô và trả kết quả đã validate. Nếu parse ném lỗi thì coi
 * như key đó thất bại và thử key tiếp theo — AI trả JSON sai shape cũng là lỗi.
 *
 * `maxGeminiKeys` giới hạn số key được thử: mỗi lần thử là một lượt chờ mạng,
 * thử hết 4 key rồi mới sang OpenAI có thể vượt thời gian sống của request.
 */
export async function generateJson<T>(
  opts: JsonCallOptions & {
    provider: AIProvider;
    parse: (rawText: string) => T;
    maxGeminiKeys?: number;
  },
): Promise<T> {
  const { provider, parse, maxGeminiKeys } = opts;
  const geminiKeys = getGeminiKeys();
  const openaiKey = getOpenAIKey();
  const errors: string[] = [];

  const tryGemini = async (): Promise<T> => {
    if (geminiKeys.length === 0) {
      throw new Error("Chưa cấu hình bất kỳ GEMINI_API_KEY nào");
    }
    const keys = maxGeminiKeys ? geminiKeys.slice(0, maxGeminiKeys) : geminiKeys;
    for (let i = 0; i < keys.length; i++) {
      try {
        return parse(await callGeminiRaw({ ...opts, apiKey: keys[i] }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Gemini Key ${i + 1} thất bại: ${msg}`);
      }
    }
    throw new Error("Tất cả key Gemini đều thất bại");
  };

  const tryOpenAI = async (): Promise<T> => {
    if (!openaiKey) throw new Error("Chưa cấu hình OPENAI_API_KEY");
    try {
      return parse(await callOpenAIRaw({ ...opts, apiKey: openaiKey }));
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
          throw new Error(
            `Gemini & OpenAI fallback đều thất bại. Chi tiết lỗi:\n${errors.join("\n")}`,
          );
        }
      }
      throw new Error(
        `Tất cả key Gemini đều thất bại và không có OpenAI key dự phòng. Chi tiết lỗi:\n${errors.join("\n")}`,
      );
    }
  }

  try {
    return await tryOpenAI();
  } catch {
    if (geminiKeys.length > 0) {
      try {
        return await tryGemini();
      } catch {
        throw new Error(
          `OpenAI & Gemini fallback đều thất bại. Chi tiết lỗi:\n${errors.join("\n")}`,
        );
      }
    }
    throw new Error(
      `OpenAI thất bại và không có Gemini key dự phòng. Chi tiết lỗi:\n${errors.join("\n")}`,
    );
  }
}

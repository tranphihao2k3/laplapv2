"use client";

import { useState } from "react";
import { Sparkles, Loader2, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GiftProductLite } from "@/components/admin/gift-product-picker";

export type ParseSuggestions = {
  name: string;
  slug: string;
  short_description: string;
  description: string;
  selling_price: number | null;
  cost_price: number | null;
  warranty_months: number | null;
  condition: string | null;
  tags: string[];
  need_tags: string[];
  performance_review: string;
  specs: Record<string, string>;
  brand_id: string | null;
  brand_match: { id: string; name: string } | null;
  category_id: string | null;
  category_match: { id: string; name: string } | null;
  spec_template_id: string | null;
  spec_template_match: { id: string; name: string } | null;
  gift_products: GiftProductLite[];
  unmatched_gifts: string[];
};

/** Một variant trong group, có thêm variant_name + sku gợi ý. */
export type ParsedVariant = ParseSuggestions & {
  source_index: number;
  variant_name: string;
  sku: string;
  specs_raw: Record<string, string>;
};

/** Một nhóm variants (cùng model). variants.length === 1 → không phải variant, là 1 sp độc lập. */
export type ParsedGroup = {
  variant_group_id: string;
  base: ParseSuggestions;
  variants: ParsedVariant[];
  variant_count: number;
};

export type ParseResult = {
  /** Backward-compat: suggestion đầu tiên (= group đầu tiên.base). */
  suggestions: ParseSuggestions;
  /** Tất cả sản phẩm AI đã parse (chưa group). */
  products: ParseSuggestions[];
  /** Nhóm theo variant_group — mỗi group = 1 product cha + nhiều variants. */
  groups: ParsedGroup[];
  product_count: number;
  group_count: number;
};

type Provider = "gemini" | "openai";

type Props = {
  onApply: (result: ParseResult, groupIdx: number) => void;
};

const SAMPLE = `1 máy duy nhất giá tốt đẹp 98% máy nguyên Zin
💻Hp 840g5
⚡️Cpu i7-8650U upto 4.2ghz(8cpus)
⚡️Ram 8G/ Ssd 256G
⚡️Màn 14in FullHD
💸Giá chỉ 6triuX
⏰Bảo hành 3 tháng
🎁Balo + túi chống sốc + chuột + lót chuột + sạc`;

const SAMPLE_MULTI = `🎯 Dell Latitude 7420 - 3 option:
1️⃣ i5-1135G7 / RAM 8GB / SSD 256GB — 7.5 triệu
2️⃣ i5-1135G7 / RAM 16GB / SSD 512GB — 10.5 triệu
3️⃣ i7-1185G7 / RAM 16GB / SSD 512GB — 13.5 triệu
Bảo hành 6 tháng, kèm sạc zin.

🎯 HP EliteBook 840 G5:
- i5-8350U / 8GB / 256GB / 14in FHD — 5.9 triệu
- Bảo hành 3 tháng, tặng balo`;

export function AIPasteBox({ onApply }: Props) {
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ParseResult | null>(null);

  const handleParse = async () => {
    if (text.trim().length < 10) {
      toast.error("Vui lòng nhập mô tả sản phẩm (tối thiểu 10 ký tự)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/parse-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, provider }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "Lỗi phân tích");
        return;
      }
      const result: ParseResult = {
        suggestions: json.data.suggestions,
        products: json.data.products ?? [json.data.suggestions],
        groups: json.data.groups ?? [
          {
            variant_group_id: json.data.suggestions?.slug ?? "single",
            base: json.data.suggestions,
            variants: [],
            variant_count: 1,
          },
        ],
        product_count: json.data.product_count ?? 1,
        group_count: json.data.group_count ?? 1,
      };
      setLastResult(result);

      // Nếu 1 group: apply luôn như cũ. Nếu nhiều group: hiện preview list + cho user chọn group đầu.
      if (result.group_count === 1) {
        onApply(result, 0);
        toast.success(
          result.groups[0].variant_count > 1
            ? `Đã nhận diện ${result.groups[0].variant_count} biến thể của 1 sản phẩm`
            : "Đã tự động điền các trường — kiểm tra lại trước khi lưu nhé",
        );
      } else {
        toast.success(
          `Đã nhận diện ${result.product_count} sản phẩm / ${result.group_count} nhóm — chọn nhóm bên dưới để điền form`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi gọi AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Tự động phân tích bằng AI</Label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setText(SAMPLE_MULTI)}
            title="Dán mẫu nhiều sản phẩm"
          >
            Mẫu nhiều SP
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setText(SAMPLE)}
          >
            Dùng mẫu thử
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Dán đoạn mô tả sản phẩm (copy từ Facebook/Zalo cũng được). Hỗ trợ <strong>nhiều sản phẩm</strong> hoặc <strong>nhiều cấu hình của cùng 1 model</strong> (sẽ tự tách thành variants).
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Dán đoạn mô tả sản phẩm tại đây..."
        className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1 w-44">
          <Label className="text-xs">Mô hình AI</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Gemini (Google)</SelectItem>
              <SelectItem value="openai">GPT (OpenAI)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={handleParse} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang phân tích...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" /> Phân tích & điền form
            </>
          )}
        </Button>
      </div>

      {lastResult && lastResult.group_count > 1 && (
        <div className="space-y-2 rounded-md bg-background/60 border px-3 py-2 text-xs">
          <p className="font-semibold flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Đã nhận diện {lastResult.product_count} sản phẩm / {lastResult.group_count} nhóm
          </p>
          <div className="space-y-1.5">
            {lastResult.groups.map((g, idx) => (
              <button
                key={g.variant_group_id + idx}
                type="button"
                onClick={() => {
                  onApply(lastResult, idx);
                  toast.success(`Đã điền form cho: ${g.base.name}${g.variant_count > 1 ? ` (${g.variant_count} biến thể)` : ""}`);
                }}
                className="w-full flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5 text-left hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{g.base.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {g.base.brand_match?.name ? `${g.base.brand_match.name} · ` : ""}
                    {g.base.category_match?.name || "Chưa rõ danh mục"}
                    {g.variant_count > 1 && ` · ${g.variant_count} biến thể`}
                  </p>
                </div>
                <span className="text-[10px] text-primary shrink-0">Điền form →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {lastResult && lastResult.group_count === 1 && (
        <div className="space-y-1 rounded-md bg-background/60 border px-3 py-2 text-xs">
          <p>
            <strong>Đã nhận diện:</strong> {lastResult.suggestions.name}
            {lastResult.suggestions.brand_match && <> · Thương hiệu: <em>{lastResult.suggestions.brand_match.name}</em></>}
            {lastResult.suggestions.category_match && <> · Danh mục: <em>{lastResult.suggestions.category_match.name}</em></>}
          </p>
          {lastResult.suggestions.selling_price != null && (
            <p>
              <strong>Giá:</strong> {lastResult.suggestions.selling_price.toLocaleString("vi-VN")} đ
              {lastResult.suggestions.warranty_months != null && <> · Bảo hành {lastResult.suggestions.warranty_months} tháng</>}
            </p>
          )}
          {lastResult.groups[0]?.variant_count > 1 && (
            <p className="text-primary font-medium">
              <Layers className="inline h-3 w-3 mr-0.5" />
              {lastResult.groups[0].variant_count} biến thể đã được tách — kiểm tra danh sách variant bên dưới
            </p>
          )}
          {lastResult.suggestions.unmatched_gifts.length > 0 && (
            <p className="text-amber-700 dark:text-amber-400">
              ⚠ Quà tặng chưa khớp sản phẩm trong kho: {lastResult.suggestions.unmatched_gifts.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

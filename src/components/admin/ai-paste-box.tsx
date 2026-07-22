"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
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

type Provider = "gemini" | "openai";

type Props = {
  onApply: (s: ParseSuggestions) => void;
};

const SAMPLE = `1 máy duy nhất giá tốt đẹp 98% máy nguyên Zin
💻Hp 840g5
⚡️Cpu i7-8650U upto 4.2ghz(8cpus)
⚡️Ram 8G/ Ssd 256G
⚡️Màn 14in FullHD
💸Giá chỉ 6triuX
⏰Bảo hành 3 tháng
🎁Balo + túi chống sốc + chuột + lót chuột + sạc`;

export function AIPasteBox({ onApply }: Props) {
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ParseSuggestions | null>(null);

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
      const suggestions: ParseSuggestions = json.data.suggestions;
      setLastResult(suggestions);
      onApply(suggestions);
      toast.success("Đã tự động điền các trường — kiểm tra lại trước khi lưu nhé");
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
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setText(SAMPLE)}
        >
          Dùng mẫu thử
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Dán đoạn mô tả sản phẩm (copy từ Facebook/Zalo cũng được). AI sẽ tách tên model, cấu hình, giá, bảo hành, quà tặng và tự điền vào các trường bên dưới.
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

      {lastResult && (
        <div className="space-y-1 rounded-md bg-background/60 border px-3 py-2 text-xs">
          <p>
            <strong>Đã nhận diện:</strong> {lastResult.name}
            {lastResult.brand_match && <> · Thương hiệu: <em>{lastResult.brand_match.name}</em></>}
            {lastResult.category_match && <> · Danh mục: <em>{lastResult.category_match.name}</em></>}
          </p>
          {lastResult.selling_price != null && (
            <p>
              <strong>Giá:</strong> {lastResult.selling_price.toLocaleString("vi-VN")} đ
              {lastResult.warranty_months != null && <> · Bảo hành {lastResult.warranty_months} tháng</>}
            </p>
          )}
          {lastResult.unmatched_gifts.length > 0 && (
            <p className="text-amber-700 dark:text-amber-400">
              ⚠ Quà tặng chưa khớp sản phẩm trong kho: {lastResult.unmatched_gifts.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { toast } from "sonner";
import { Check, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_COMPARE } from "@/lib/compare/fetch-products";
import { useCompareStore, type CompareItem } from "@/stores/compare-store";
import { useCompareHydrated } from "./use-compare-hydrated";

type Props = {
  product: CompareItem;
  className?: string;
};

/**
 * Nút chọn máy để so sánh, đặt trên product card.
 *
 * Card là stretched-link (thẻ <Link> phủ toàn bộ ở z-20), nên nút này phải nằm
 * ở z-30 để nhận được click. Vẫn chặn sự kiện tường minh để an toàn nếu về sau
 * cấu trúc card đổi lại — và phải chặn cả pointerDown, không chỉ click.
 */
export function CompareToggle({ product, className }: Props) {
  const hydrated = useCompareHydrated();
  const items = useCompareStore((s) => s.items);
  const toggle = useCompareStore((s) => s.toggle);

  const selected = items.some((i) => i.id === product.id);
  const full = items.length >= MAX_COMPARE;

  // Chờ đọc xong localStorage mới render để không lệch HTML với server.
  if (!hydrated) return null;

  const handle = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selected && full) {
      toast.error(`Chỉ so sánh tối đa ${MAX_COMPARE} máy`, {
        description: "Bỏ chọn một máy khác rồi thử lại.",
      });
      return;
    }
    const ok = toggle(product);
    if (ok && !selected) {
      toast.success("Đã thêm vào danh sách so sánh", { description: product.name });
    }
  };

  return (
    <button
      type="button"
      // Ngăn stretched-link nuốt sự kiện: Radix/thẻ a kích hoạt ở pointerdown.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={handle}
      aria-pressed={selected}
      aria-label={selected ? `Bỏ so sánh ${product.name}` : `So sánh ${product.name}`}
      title={
        !selected && full ? `Chỉ so sánh tối đa ${MAX_COMPARE} máy` : "Thêm vào danh sách so sánh"
      }
      className={cn(
        "absolute left-3 top-3 z-30 flex items-center gap-1.5 rounded-full px-2.5 py-1.5",
        "text-[11px] font-medium shadow-sm ring-1 backdrop-blur-sm transition-all duration-200",
        selected
          ? "bg-primary text-primary-foreground ring-primary/30"
          : "bg-white/90 text-slate-600 ring-slate-200 hover:bg-white hover:text-slate-900",
        // Chưa chọn thì chỉ hiện khi hover card (đỡ rối); đã chọn thì luôn hiện.
        !selected && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        !selected && full && "cursor-not-allowed",
        className,
      )}
    >
      {selected ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <GitCompareArrows className="h-3.5 w-3.5" />
      )}
      <span>{selected ? "Đang so sánh" : "So sánh"}</span>
    </button>
  );
}

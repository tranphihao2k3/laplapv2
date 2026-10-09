"use client";

import { X, CheckCircle2, FileEdit, Archive, Layers, Filter, ArrowDownAZ, ArrowUpAZ, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProductFilterValue } from "./products-filters";

type Chip = {
  key: keyof ProductFilterValue;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
};

type Props = {
  value: ProductFilterValue;
  brandName?: string | null;
  categoryName?: string | null;
  /**
   * Số danh mục con đã được mở rộng kèm theo category đã chọn.
   * - 0: chọn đúng 1 category lá (không có con)
   * - >0: chọn cha có N mục con → chip hiển thị "gồm N mục con" để user biết filter đã mở rộng
   */
  categoryChildCount?: number;
  onRemove: (key: keyof ProductFilterValue) => void;
  onClearAll: () => void;
};

const SORT_LABEL: Record<NonNullable<ProductFilterValue["sort"]>, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  "": { label: "Mặc định", icon: Clock },
  "created_at:desc": { label: "Mới nhất", icon: Clock },
  "created_at:asc": { label: "Cũ nhất", icon: Clock },
  "name:asc": { label: "Tên A → Z", icon: ArrowDownAZ },
  "name:desc": { label: "Tên Z → A", icon: ArrowUpAZ },
  "price:asc": { label: "Giá tăng dần", icon: ArrowDownAZ },
  "price:desc": { label: "Giá giảm dần", icon: ArrowUpAZ },
};

export function ProductFilterChips({
  value,
  brandName,
  categoryName,
  categoryChildCount,
  onRemove,
  onClearAll,
}: Props) {
  const chips: Chip[] = [];

  if (value.status) {
    const map: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
      active: { label: "Đang bán", icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
      draft: { label: "Bản nháp", icon: FileEdit, tone: "border-amber-200 bg-amber-50 text-amber-700" },
      archived: { label: "Ngừng bán", icon: Archive, tone: "border-border bg-muted text-muted-foreground" },
    };
    const s = map[value.status];
    if (s) chips.push({ key: "status", label: s.label, icon: s.icon, tone: s.tone });
  }

  if (value.brandId) {
    chips.push({
      key: "brandId",
      label: brandName ? `Thương hiệu: ${brandName}` : "Thương hiệu đã chọn",
      icon: Layers,
      tone: "border-blue-200 bg-blue-50 text-blue-700",
    });
  }

  if (value.categoryId) {
    const childCount = categoryChildCount ?? 0;
    const categoryLabel =
      categoryName
        ? `Danh mục: ${categoryName}${childCount > 0 ? ` (gồm ${childCount} mục con)` : ""}`
        : "Danh mục đã chọn";
    chips.push({
      key: "categoryId",
      label: categoryLabel,
      icon: Filter,
      tone: "border-violet-200 bg-violet-50 text-violet-700",
    });
  }

  if (value.search) {
    chips.push({
      key: "search",
      label: `Từ khoá: "${value.search}"`,
      icon: Filter,
      tone: "border-slate-200 bg-slate-50 text-slate-700",
    });
  }

  if (value.sort && value.sort !== "created_at:desc") {
    const s = SORT_LABEL[value.sort as keyof typeof SORT_LABEL];
    if (s) chips.push({ key: "sort", label: s.label, icon: s.icon, tone: "border-border bg-muted text-muted-foreground" });
  }

  if (chips.length === 0) return null;

  return (
    <div className="relative z-20 flex flex-wrap items-center gap-1.5 rounded-md border border-dashed bg-muted/20 px-2.5 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Đang lọc:
      </span>
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onRemove(chip.key)}
            className={cn(
              "group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-all hover:shadow-sm",
              chip.tone,
            )}
            aria-label={`Bỏ lọc ${chip.label}`}
          >
            <Icon className="h-3 w-3" />
            <span>{chip.label}</span>
            <X className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
          </button>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
      >
        Xoá tất cả
      </Button>
    </div>
  );
}

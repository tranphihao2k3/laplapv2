"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Filter,
  X,
  ChevronDown,
  Search,
  CheckCircle2,
  Archive,
  FileEdit,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OptionsSelect, type SelectOption } from "@/components/ui/options-select";
import { cn } from "@/lib/utils";

export type ProductFilterValue = {
  search: string;
  status: "" | "active" | "draft" | "archived";
  brandId: string;
  categoryId: string;
  sort: "" | "name:asc" | "name:desc" | "created_at:desc" | "created_at:asc" | "price:asc" | "price:desc";
};

export const EMPTY_FILTER: ProductFilterValue = {
  search: "",
  status: "",
  brandId: "",
  categoryId: "",
  sort: "created_at:desc",
};

type Props = {
  value: ProductFilterValue;
  onChange: (next: ProductFilterValue) => void;
  brandOptions: SelectOption[];
  categoryOptions: SelectOption[];
  totalLabel?: string;
  filteredLabel?: string;
};

const STATUS_OPTIONS = [
  { value: "active", label: "Đang bán", icon: CheckCircle2, color: "text-emerald-600" },
  { value: "draft", label: "Bản nháp", icon: FileEdit, color: "text-amber-600" },
  { value: "archived", label: "Ngừng bán", icon: Archive, color: "text-muted-foreground" },
] as const;

const SORT_OPTIONS = [
  { value: "created_at:desc", label: "Mới nhất" },
  { value: "created_at:asc", label: "Cũ nhất" },
  { value: "name:asc", label: "Tên A → Z" },
  { value: "name:desc", label: "Tên Z → A" },
] as const;

export function ProductFilters({
  value,
  onChange,
  brandOptions,
  categoryOptions,
  totalLabel,
  filteredLabel,
}: Props) {
  const [open, setOpen] = useState(true);

  // Auto-collapse when user starts scrolling down on mobile to save space
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 200) setOpen(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeCount = useMemo(() => {
    let n = 0;
    if (value.status) n++;
    if (value.brandId) n++;
    if (value.categoryId) n++;
    if (value.search) n++;
    return n;
  }, [value]);

  const clearAll = () => onChange(EMPTY_FILTER);

  const update = (patch: Partial<ProductFilterValue>) => onChange({ ...value, ...patch });

  return (
    <div className="relative z-30 rounded-lg border bg-card shadow-sm">
      {/* Header bar — luôn hiện */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
        <div className="flex h-8 items-center gap-1.5 rounded-md bg-primary/10 px-2 text-xs font-semibold text-primary">
          <Filter className="h-3.5 w-3.5" />
          Bộ lọc
        </div>

        {/* Search — luôn hiện ở header */}
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Tìm tên, slug, mô tả..."
            className="h-9 pl-8 text-sm"
            aria-label="Tìm kiếm sản phẩm"
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8 gap-1 text-xs"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="hidden sm:inline">Bộ lọc nâng cao</span>
          <span className="sm:hidden">Lọc</span>
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground tabular-nums">
              {activeCount}
            </span>
          )}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
          />
        </Button>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
            onClick={clearAll}
          >
            <X className="h-3.5 w-3.5" />
            Xoá bộ lọc
          </Button>
        )}
      </div>

      {/* Expandable filter row */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open
            ? "grid-rows-[1fr] border-t opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-2 sm:px-4 lg:grid-cols-4">
            {/* Status */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" /> Trạng thái
              </Label>
              <Select
                value={value.status}
                onValueChange={(v) => update({ status: v as ProductFilterValue["status"] })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Tất cả trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tất cả trạng thái</SelectItem>
                  {STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className={cn("h-3.5 w-3.5", opt.color)} />
                          {opt.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Brand */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Layers className="h-3 w-3" /> Thương hiệu
              </Label>
              <OptionsSelect
                options={brandOptions}
                value={value.brandId}
                onValueChange={(v) => update({ brandId: v })}
                placeholder="Tất cả thương hiệu"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Filter className="h-3 w-3" /> Danh mục
              </Label>
              <OptionsSelect
                options={categoryOptions}
                value={value.categoryId}
                onValueChange={(v) => update({ categoryId: v })}
                placeholder="Tất cả danh mục"
              />
            </div>

            {/* Sort */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Filter className="h-3 w-3" /> Sắp xếp
              </Label>
              <Select
                value={value.sort || "created_at:desc"}
                onValueChange={(v) => update({ sort: v as ProductFilterValue["sort"] })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Counts line */}
          {(totalLabel || filteredLabel) && (
            <div className="border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground sm:px-4">
              {filteredLabel ? (
                <span>
                  Hiển thị <span className="font-semibold text-foreground">{filteredLabel}</span>
                  {totalLabel && (
                    <>
                      {" / "}
                      <span className="font-semibold text-foreground">{totalLabel}</span> sản phẩm
                    </>
                  )}
                </span>
              ) : (
                totalLabel && (
                  <span>
                    Tổng <span className="font-semibold text-foreground">{totalLabel}</span> sản phẩm
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

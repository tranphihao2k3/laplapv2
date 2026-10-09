"use client";

/**
 * Sheet/Drawer mở ra khi user click vào 1 slot trong CategoryRail.
 *
 * - Fetch components theo slot qua TanStack Query.
 * - Mỗi item card: thumbnail, tên, brand, giá, specs liên quan (socket / ram_type / form_factor...).
 * - Click → gọi `onSelect(item)` để parent thêm vào slot.
 */

import { useState, useMemo } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Loader2,
  Check,
  Plus,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { fetchComponents } from "@/lib/pc-builder/api";
import {
  SLOT_LABEL,
  type BuildItem,
  type ComponentWithSpec,
  type SlotKey,
} from "@/lib/pc-builder/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: SlotKey | null;
  currentItems: BuildItem[];
  onSelect: (item: BuildItem) => void;
};

/** Các trường spec nổi bật cần hiển thị tuỳ slot. */
function getSpecChips(item: ComponentWithSpec): Array<{ label: string; value: string }> {
  const chips: Array<{ label: string; value: string }> = [];
  const s = item.spec;
  if (s.socket) chips.push({ label: "Socket", value: s.socket });
  if (s.ramType) chips.push({ label: "RAM", value: s.ramType });
  if (s.formFactor) chips.push({ label: "Form", value: s.formFactor });
  if (typeof s.tdpW === "number") chips.push({ label: "TDP", value: `${s.tdpW}W` });
  if (typeof s.lengthMm === "number") chips.push({ label: "Dài", value: `${s.lengthMm}mm` });
  if (typeof s.wattageW === "number") chips.push({ label: "Công suất", value: `${s.wattageW}W` });
  if (s.storageInterface) chips.push({ label: "Chuẩn", value: s.storageInterface });
  return chips;
}

export function ComponentPicker({
  open,
  onOpenChange,
  slot,
  currentItems,
  onSelect,
}: Props) {
  const [term, setTerm] = useState("");
  const trimmed = term.trim().toLowerCase();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["pc-builder", "components", slot],
    queryFn: () => fetchComponents(slot as SlotKey),
    enabled: open && !!slot,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!trimmed) return data;
    return data.filter((it) =>
      `${it.product.name} ${it.product.brand ?? ""}`
        .toLowerCase()
        .includes(trimmed),
    );
  }, [data, trimmed]);

  const hasExisting = currentItems.length > 0;
  const firstSelectedId = currentItems[0]?.productId ?? null;

  const handleChoose = (item: ComponentWithSpec) => {
    const buildItem: BuildItem = {
      productId: item.product.id,
      categorySlug: slot as SlotKey,
      name: item.product.name,
      thumbnail: item.product.thumbnail_url,
      qty: 1,
      unitPrice: item.product.price,
      brand: item.product.brand ?? null,
    };
    onSelect(buildItem);
    onOpenChange(false);
    setTerm("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Chọn {slot ? SLOT_LABEL[slot] : "linh kiện"}
          </SheetTitle>
          <SheetDescription>
            {hasExisting
              ? "Đã chọn sản phẩm. Click để thay thế."
              : "Tìm và chọn linh kiện phù hợp."}
          </SheetDescription>
        </SheetHeader>

        <div className="border-b px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Tìm theo tên, hãng..."
              className="pl-9"
              aria-label="Tìm linh kiện"
            />
          </div>
          {hasExisting ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700">
              <RefreshCw className="h-3 w-3" />
              Chọn sản phẩm khác sẽ thay thế linh kiện hiện tại.
            </p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2 p-5">
            {isLoading || isFetching ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3"
                >
                  <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))
            ) : isError ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-slate-500">
                <p>Không tải được danh sách linh kiện.</p>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Đóng
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-slate-500">
                <p>
                  {trimmed
                    ? `Không có linh kiện nào khớp "${term}"`
                    : "Chưa có sản phẩm nào trong danh mục này."}
                </p>
              </div>
            ) : (
              filtered.map((item) => {
                const chips = getSpecChips(item);
                const isSelected = firstSelectedId === item.product.id;
                return (
                  <button
                    key={item.product.id}
                    type="button"
                    onClick={() => handleChoose(item)}
                    className={cn(
                      "flex w-full gap-3 rounded-xl border bg-white p-3 text-left transition-all",
                      "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                      isSelected && "border-primary/60 bg-primary/5",
                    )}
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                      {item.product.thumbnail_url ? (
                        <Image
                          src={item.product.thumbnail_url}
                          alt={item.product.name}
                          fill
                          sizes="64px"
                          className="object-contain p-1"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] font-semibold text-slate-300">
                          LapLap
                        </div>
                      )}
                      {isSelected ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/80 text-white">
                          <Check className="h-4 w-4" />
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium text-slate-800">
                            {item.product.name}
                          </p>
                          {item.product.brand ? (
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {item.product.brand}
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-sm font-bold text-slate-900">
                          {item.product.price > 0
                            ? formatCurrency(item.product.price)
                            : "Liên hệ"}
                        </p>
                      </div>
                      {chips.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {chips.map((c) => (
                            <Badge
                              key={`${c.label}-${c.value}`}
                              variant="secondary"
                              className="border-slate-200 bg-slate-50 px-1.5 py-0 text-[10px] font-medium text-slate-600"
                            >
                              <span className="text-slate-400">{c.label}:</span>{" "}
                              {c.value}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t bg-slate-50/60 px-5 py-3 text-center text-[11px] text-slate-500">
          {isLoading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Đang tải...
            </span>
          ) : (
            <>Hiển thị {filtered.length} sản phẩm</>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

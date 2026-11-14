"use client";

/**
 * Chọn sản phẩm catalog để gắn vào phiếu bảo hành nhanh.
 *
 * Khác OptionsSelect thường ở chỗ:
 *   - dữ liệu lấy từ `/v1/warranties/linkable-products` — CHỈ sản phẩm còn tồn
 *     kho (hết hàng / đã bán / quà tặng combo đã bị lọc từ server);
 *   - dropdown rộng đúng bằng ô input, mỗi dòng 2 tầng gọn (tên + SKU · giá · tồn);
 *   - tìm ngay trong dropdown, bỏ dấu tiếng Việt.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, PackageSearch, Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { httpGet } from "@/lib/api/http";
import { cn } from "@/lib/utils";
import type { QuickSpec } from "@/lib/products/quick-specs";

export type LinkableVariant = {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  thumbnail_url: string | null;
  selling_price: number;
  stock: number;
  specs: QuickSpec[];
};

type Props = {
  value: string;
  onSelect: (variant: LinkableVariant | null) => void;
  /** Chỉ tải dữ liệu khi dialog mở. */
  enabled?: boolean;
  placeholder?: string;
  className?: string;
};

const NONE_VALUE = "__none__";

// ItemText của SelectItem là span bọc ngoài; phải cho nó shrink (min-w-0)
// thì tên dài mới truncate thay vì tràn ngang khỏi dropdown.
const ITEM_CLASS =
  "overflow-hidden py-1.5 pl-2 pr-7 [&>span:last-child]:flex [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1";

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function formatPrice(value: number) {
  if (value <= 0) return "Chưa có giá";
  return `${value.toLocaleString("vi-VN")}đ`;
}

function displayName(v: LinkableVariant) {
  return [v.product_name, v.variant_name].filter(Boolean).join(" — ");
}

export function LinkableProductPicker({
  value,
  onSelect,
  enabled = true,
  placeholder = "Chọn sản phẩm còn hàng...",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<LinkableVariant | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["warranties", "linkable-products"],
    enabled,
    staleTime: 60 * 1000,
    queryFn: () =>
      httpGet<{ items: LinkableVariant[]; total: number }>(
        "/v1/warranties/linkable-products",
        { limit: 300 },
      ),
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  // Giữ object đã chọn để hiển thị cả khi dữ liệu đã đổi / chưa tải xong.
  useEffect(() => {
    if (!value) {
      setPicked(null);
      return;
    }
    if (picked?.variant_id === value) return;
    const found = items.find((v) => v.variant_id === value);
    if (found) setPicked(found);
  }, [value, items, picked]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return items;
    return items.filter((v) =>
      normalize(
        [v.product_name, v.variant_name, v.sku, v.barcode].filter(Boolean).join(" "),
      ).includes(q),
    );
  }, [items, query]);

  // Gom theo sản phẩm: SP nhiều phiên bản (RAM/SSD khác nhau) hiện 1 tiêu đề
  // chung + các dòng phiên bản bên dưới, thay vì lặp tên SP nhiều lần.
  const groups = useMemo(() => {
    const map = new Map<string, { product_name: string; variants: LinkableVariant[] }>();
    for (const v of visible) {
      const g = map.get(v.product_id);
      if (g) g.variants.push(v);
      else map.set(v.product_id, { product_name: v.product_name, variants: [v] });
    }
    return [...map.values()];
  }, [visible]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const selectedLabel = picked ? displayName(picked) : "";

  return (
    <Select
      value={value || NONE_VALUE}
      onValueChange={(next) => {
        if (next === NONE_VALUE) {
          setPicked(null);
          onSelect(null);
          return;
        }
        const v = items.find((x) => x.variant_id === next) ?? null;
        setPicked(v);
        onSelect(v);
      }}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger
        className={cn(
          "h-9 w-full gap-2 px-3 text-sm",
          !picked && "text-muted-foreground",
          className,
        )}
        aria-label="Sản phẩm liên kết"
      >
        {/* Dùng div (không phải span) để không bị class `[&>span]:line-clamp-1`
            của SelectTrigger bóp mất badge tồn kho. */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {isLoading && enabled ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : null}
          <span className="truncate">{selectedLabel || placeholder}</span>
          {picked ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              tồn {picked.stock}
            </span>
          ) : null}
          {picked ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Bỏ liên kết sản phẩm"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setPicked(null);
                onSelect(null);
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
      </SelectTrigger>

      <SelectContent
        position="popper"
        sideOffset={4}
        // Bám đúng chiều rộng ô input, giới hạn chiều cao để danh sách không
        // tràn khỏi dialog; bỏ padding mặc định của Viewport để header tìm
        // kiếm dính sát mép trên.
        className="max-h-[min(21rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-0 overflow-y-auto p-0 [&>div]:p-0 [&_.lucide-chevron-up]:hidden [&_.lucide-chevron-down]:hidden"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div
          className="sticky top-0 z-10 border-b bg-popover p-2"
          onKeyDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên / SKU / mã vạch..."
              className="h-8 pl-8 text-sm"
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key !== "Enter") return;
                const first = visible[0];
                if (!first) return;
                e.preventDefault();
                setPicked(first);
                onSelect(first);
                setOpen(false);
              }}
            />
          </div>
          <p className="mt-1 px-0.5 text-[10px] leading-tight text-muted-foreground">
            Chỉ hiện sản phẩm còn tồn kho · chưa bán
          </p>
        </div>

        {value ? (
          <SelectItem value={NONE_VALUE} className="py-1.5 text-xs text-muted-foreground">
            Bỏ liên kết sản phẩm
          </SelectItem>
        ) : null}

        {isError ? (
          <p className="px-3 py-6 text-center text-xs text-destructive">
            Không tải được danh sách sản phẩm
          </p>
        ) : isLoading ? (
          <p className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...
          </p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-3 py-6 text-center text-xs text-muted-foreground">
            <PackageSearch className="h-5 w-5" />
            <span>
              {query.trim()
                ? "Không có sản phẩm còn hàng khớp từ khoá"
                : "Chưa có sản phẩm nào còn hàng"}
            </span>
          </div>
        ) : (
          groups.map((group) => {
            const single = group.variants.length === 1;
            const rows = group.variants.map((v) => (
              <SelectItem
                key={v.variant_id}
                value={v.variant_id}
                className={ITEM_CLASS}
                title={`${displayName(v)} · ${v.sku ?? ""}`}
              >
                <span className="flex w-full min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium leading-tight">
                      {single ? (
                        <>
                          {v.product_name}
                          {v.variant_name ? (
                            <span className="font-normal text-muted-foreground">
                              {" — "}
                              {v.variant_name}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        (v.variant_name ?? "Phiên bản mặc định")
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {v.sku ? (
                        <>
                          <span className="truncate font-mono">{v.sku}</span>
                          <span className="shrink-0">·</span>
                        </>
                      ) : null}
                      <span className="shrink-0 tabular-nums">{formatPrice(v.selling_price)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-700">
                    còn {v.stock}
                  </span>
                </span>
              </SelectItem>
            ));

            if (single) return rows;

            return (
              <SelectGroup key={group.variants[0].product_id}>
                <SelectLabel className="flex items-center justify-between gap-2 px-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="truncate">{group.product_name}</span>
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal">
                    {group.variants.length} phiên bản
                  </span>
                </SelectLabel>
                {rows}
              </SelectGroup>
            );
          })
        )}
      </SelectContent>
    </Select>
  );
}

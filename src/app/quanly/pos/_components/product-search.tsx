"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, ScanLine, Package, AlertCircle, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { httpGet } from "@/lib/api/http";
import { formatVND } from "./types";

export type PosSearchHit = {
  variant_id: string;
  product_id: string | null;
  display_name: string;
  product_name: string | null;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  thumbnail_url: string | null;
  selling_price: number;
  stock: number;
};

type Props = {
  onPick: (hit: PosSearchHit) => void;
  shopId: string;
  /** Khi true: render dạng stack dọc (mobile), mở fullscreen sheet. */
  compact?: boolean;
};

export function ProductSearch({ onPick, shopId, compact = false }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const justPickedRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || (target?.isContentEditable ?? false);
      if (isEditable) return;

      if (e.key === "/" || (e.key === "k" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const searchQuery = useQuery({
    queryKey: ["pos-search", shopId, debounced],
    enabled: open && !!shopId,
    queryFn: () =>
      httpGet<{ items: PosSearchHit[]; total: number }>("/v1/pos/search", {
        search: debounced || undefined,
        shop_id: shopId || undefined,
        limit: compact ? 20 : 12,
      }),
    staleTime: 30 * 1000,
  });
  const items = useMemo(() => searchQuery.data?.items ?? [], [searchQuery.data]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debounced, items.length]);

  const pick = (hit: PosSearchHit) => {
    onPick(hit);
    setQuery("");
    setDebounced("");
    setOpen(false);
    justPickedRef.current = true;
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (items[activeIndex]) {
        e.preventDefault();
        pick(items[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const hasError = !!searchQuery.error;
  const isEmpty = !searchQuery.isFetching && items.length === 0;

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          if (justPickedRef.current) {
            justPickedRef.current = false;
            return;
          }
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={
          compact
            ? "Tìm sản phẩm..."
            : "Quét mã vạch hoặc tìm sản phẩm (SKU/tên)...   /"
        }
        inputMode="search"
        autoComplete="off"
        className="h-12 pl-10 pr-20 text-base shadow-sm"
        aria-label="Tìm sản phẩm"
        aria-expanded={open}
        aria-controls="pos-search-results"
      />
      <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-muted-foreground">
        {searchQuery.isFetching && (
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Đang tìm" />
        )}
        {query && !searchQuery.isFetching && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDebounced("");
              inputRef.current?.focus();
            }}
            className="pointer-events-auto rounded p-0.5 hover:bg-muted hover:text-foreground"
            aria-label="Xoá tìm kiếm"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <ScanLine className="h-4 w-4" aria-hidden />
      </div>

      {open && (
        <div
          id="pos-search-results"
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-2 max-h-[60vh] overflow-y-auto rounded-lg border bg-popover shadow-xl sm:max-h-[420px]"
        >
          {!shopId ? (
            <EmptyHint icon={<Package className="h-5 w-5" />}>
              Chọn cửa hàng trước khi tìm sản phẩm.
            </EmptyHint>
          ) : hasError ? (
            <EmptyHint icon={<AlertCircle className="h-5 w-5 text-destructive" />}>
              Lỗi tải sản phẩm. Vui lòng thử lại.
            </EmptyHint>
          ) : searchQuery.isFetching && items.length === 0 ? (
            <EmptyHint icon={<Loader2 className="h-5 w-5 animate-spin" />}>
              Đang tìm...
            </EmptyHint>
          ) : isEmpty ? (
            <EmptyHint icon={<Package className="h-5 w-5" />}>
              {debounced ? `Không tìm thấy "${debounced}"` : "Gõ tên / SKU / mã vạch để tìm sản phẩm"}
            </EmptyHint>
          ) : (
            <ul className="py-1">
              {items.map((hit, idx) => {
                const isActive = idx === activeIndex;
                const outOfStock = hit.stock <= 0;
                return (
                  <li key={hit.variant_id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => pick(hit)}
                      disabled={outOfStock}
                      role="option"
                      aria-selected={isActive}
                      aria-disabled={outOfStock}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition ${
                        isActive ? "bg-accent" : "hover:bg-accent/60"
                      } ${outOfStock ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      {hit.thumbnail_url ? (
                        <Image
                          src={hit.thumbnail_url}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 flex-shrink-0 rounded border object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border bg-muted text-[10px] text-muted-foreground">
                          No img
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{hit.display_name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {hit.sku ?? "—"}
                          {hit.barcode ? ` · ${hit.barcode}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-semibold text-primary tabular-nums">
                          {formatVND(hit.selling_price)}
                        </span>
                        <span
                          className={`text-[11px] tabular-nums ${
                            outOfStock
                              ? "font-semibold text-destructive"
                              : hit.stock <= 3
                                ? "font-medium text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {outOfStock ? "Hết hàng" : `Tồn: ${hit.stock}`}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
            ↑↓ di chuyển · Enter chọn · Esc đóng
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyHint({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 text-sm text-muted-foreground">
      {icon}
      <span>{children}</span>
    </div>
  );
}
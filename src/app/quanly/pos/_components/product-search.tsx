"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, ScanLine } from "lucide-react";
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
};

export function ProductSearch({ onPick, shopId }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Cờ bỏ qua lần focus ngay sau khi chọn sản phẩm (tránh mở lại box)
  const justPickedRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.key === "/" || (e.key === "k" && (e.ctrlKey || e.metaKey))) &&
        document.activeElement !== inputRef.current
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const searchQuery = useQuery({
    queryKey: ["pos-search", shopId, debounced],
    enabled: open && !!shopId,
    queryFn: () =>
      httpGet<{ items: PosSearchHit[]; total: number }>("/v1/pos/search", {
        search: debounced || undefined,
        shop_id: shopId || undefined,
        limit: 12,
      }),
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
          // Vừa chọn sản phẩm xong → giữ box đóng, không mở lại
          if (justPickedRef.current) {
            justPickedRef.current = false;
            return;
          }
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="Quét mã vạch hoặc tìm sản phẩm theo SKU/tên... (phím tắt: / )"
        className="h-12 pl-10 pr-10 text-base"
      />
      <ScanLine className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      {searchQuery.isFetching && (
        <Loader2 className="absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[420px] overflow-y-auto rounded-md border bg-popover shadow-lg">
          {!shopId ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Chọn cửa hàng trước khi tìm sản phẩm
            </div>
          ) : searchQuery.isFetching && items.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Đang tìm...</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              {debounced ? `Không tìm thấy "${debounced}"` : "Gõ tên / SKU / mã vạch để tìm sản phẩm"}
            </div>
          ) : (
            <ul className="py-1">
              {items.map((hit, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <li key={hit.variant_id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => pick(hit)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                        isActive ? "bg-accent" : "hover:bg-accent/60"
                      }`}
                    >
                      {hit.thumbnail_url ? (
                        <Image
                          src={hit.thumbnail_url}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 flex-shrink-0 rounded border object-cover"
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
                        <span className="font-semibold text-primary">
                          {formatVND(hit.selling_price)}
                        </span>
                        <span
                          className={`text-[11px] ${
                            hit.stock > 0 ? "text-muted-foreground" : "text-destructive"
                          }`}
                        >
                          Tồn CN: {hit.stock}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

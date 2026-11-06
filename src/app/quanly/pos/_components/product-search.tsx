"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Loader2,
  Search,
  ScanLine,
  Package,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { httpGet } from "@/lib/api/http";
import { formatVND } from "./types";
import type { QuickSpec } from "@/lib/products/quick-specs";

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
  /** Cấu hình nhanh (CPU / RAM / SSD / VGA / Màn hình) của variant. */
  specs?: QuickSpec[];
  /** Số biến thể active của product chứa variant này. */
  variant_count?: number;
};

/** Nhóm kết quả theo product — mỗi product 1 card trong dropdown. */
export type PosSearchGroup = {
  product_id: string | null;
  product_name: string | null;
  thumbnail_url: string | null;
  variant_count: number;
  min_price: number;
  max_price: number;
  total_stock: number;
  variants: PosSearchHit[];
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const justPickedRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  /** Product_id đang mở danh sách biến thể (mobile: chọn đúng phiên bản). */
  const [expanded, setExpanded] = useState<string | null>(null);
  /** Màn hình hẹp (<640px): dropdown render fixed, bám theo ô input. */
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches,
  );
  /** Vị trí panel trên mobile (tính theo viewport, không phụ thuộc layout hẹp của input). */
  const [panelBox, setPanelBox] = useState<{ top: number; maxHeight: number } | null>(null);

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
      httpGet<{ items: PosSearchHit[]; groups?: PosSearchGroup[]; total: number }>(
        "/v1/pos/search",
        {
          search: debounced || undefined,
          shop_id: shopId || undefined,
          limit: compact ? 20 : 12,
        },
      ),
    staleTime: 30 * 1000,
  });

  // Ưu tiên nhóm theo product (để hiện badge "N phiên bản" + danh sách biến thể).
  // Fallback về danh sách phẳng nếu API cũ chưa trả `groups`.
  const groups = useMemo<PosSearchGroup[]>(() => {
    const data = searchQuery.data;
    if (data?.groups?.length) return data.groups;
    const items = data?.items ?? [];
    return items.map((hit) => ({
      product_id: hit.product_id,
      product_name: hit.product_name,
      thumbnail_url: hit.thumbnail_url,
      variant_count: hit.variant_count ?? 1,
      min_price: hit.selling_price,
      max_price: hit.selling_price,
      total_stock: hit.stock,
      variants: [hit],
    }));
  }, [searchQuery.data]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // Panel có thể render qua portal (mobile) nên phải kiểm tra cả panelRef,
      // nếu không thì bấm vào kết quả sẽ bị đóng dropdown trước khi onPick chạy.
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // ====== Mobile: dropdown phải rộng gần hết màn hình ======
  // Ô input nằm cạnh 2 nút (Sửa chữa / Đơn tạm) nên trên điện thoại chỉ còn
  // ~180px. Dropdown bám theo ô input => bị bóp nén, nội dung tràn ngang.
  // Ta đo viewport bằng matchMedia và chuyển sang panel `fixed` khi màn hình hẹp.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Vị trí panel tính theo viewport (fixed) — cập nhật khi resize/scroll vì
  // panel fixed không tự bám theo input khi trang cuộn.
  const measurePanel = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    // Chừa chỗ nhỏ ở đáy để panel không dính sát cạnh màn hình.
    const bottomReserve = 16;
    const gap = 8;
    const maxH = 560;
    const below = Math.round(rect.bottom) + gap;
    const spaceBelow = viewportH - below - bottomReserve;

    if (spaceBelow >= 200) {
      // Đủ chỗ bên dưới → panel nằm ngay dưới ô input (quen thuộc như desktop).
      setPanelBox({ top: below, maxHeight: Math.min(maxH, spaceBelow) });
      return;
    }
    // Không đủ chỗ bên dưới → đưa panel lên TRÊN input để không bị cắt cụt.
    const aboveBottom = Math.round(rect.top) - gap;
    const spaceAbove = aboveBottom - 8;
    if (spaceAbove >= 160) {
      setPanelBox({
        top: Math.max(8, aboveBottom - Math.min(maxH, spaceAbove)),
        maxHeight: Math.min(maxH, spaceAbove),
      });
      return;
    }
    // Cả trên lẫn dưới đều chật → bám dưới input với chiều cao tối thiểu.
    setPanelBox({ top: below, maxHeight: Math.max(140, spaceBelow) });
  }, []);

  useEffect(() => {
    if (!isNarrow) return;
    measurePanel();
    if (!open) return;
    window.addEventListener("resize", measurePanel);
    window.addEventListener("scroll", measurePanel, true);
    return () => {
      window.removeEventListener("resize", measurePanel);
      window.removeEventListener("scroll", measurePanel, true);
    };
  }, [isNarrow, open, measurePanel]);

  useEffect(() => {
    setActiveIndex(0);
    setExpanded(null);
  }, [debounced, groups.length]);

  const pick = (hit: PosSearchHit) => {
    onPick(hit);
    setQuery("");
    setDebounced("");
    setOpen(false);
    justPickedRef.current = true;
    inputRef.current?.focus();
  };

  /** Variant nên chọn khi bấm vào card product: ưu tiên còn hàng, rồi rẻ nhất. */
  const defaultVariant = (group: PosSearchGroup): PosSearchHit | undefined => {
    const withStock = group.variants.filter((v) => v.stock > 0);
    const pool = withStock.length ? withStock : group.variants;
    return pool[0];
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, groups.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const group = groups[activeIndex];
      if (group) {
        e.preventDefault();
        // Nhiều phiên bản → Enter mở danh sách biến thể để thu ngân chọn.
        if (group.variants.length > 1) {
          setExpanded((prev) => (prev === groupKey(group) ? null : groupKey(group)));
        } else {
          const hit = defaultVariant(group);
          if (hit) pick(hit);
        }
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const hasError = !!searchQuery.error;
  const isEmpty = !searchQuery.isFetching && groups.length === 0;

  // Nội dung dropdown dùng chung cho panel mobile (fixed) và desktop (absolute).
  const panelContent = (
    <>
      {!shopId ? (
        <EmptyHint icon={<Package className="h-5 w-5" />}>
          Chọn cửa hàng trước khi tìm sản phẩm.
        </EmptyHint>
      ) : hasError ? (
        <EmptyHint icon={<AlertCircle className="h-5 w-5 text-destructive" />}>
          Lỗi tải sản phẩm. Vui lòng thử lại.
        </EmptyHint>
      ) : searchQuery.isFetching && groups.length === 0 ? (
        <EmptyHint icon={<Loader2 className="h-5 w-5 animate-spin" />}>
          Đang tìm...
        </EmptyHint>
      ) : isEmpty ? (
        <EmptyHint icon={<Package className="h-5 w-5" />}>
          {debounced ? `Không tìm thấy "${debounced}"` : "Gõ tên / SKU / mã vạch để tìm sản phẩm"}
        </EmptyHint>
      ) : (
        <ul className="py-1">
          {groups.map((group, idx) => (
            <ResultGroupCard
              key={groupKey(group)}
              group={group}
              isActive={idx === activeIndex}
              expanded={expanded === groupKey(group)}
              onHover={() => setActiveIndex(idx)}
              onToggle={() =>
                setExpanded((prev) => (prev === groupKey(group) ? null : groupKey(group)))
              }
              onPick={pick}
            />
          ))}
        </ul>
      )}
      <div className="border-t bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
        ↑↓ di chuyển · Enter chọn · Esc đóng
      </div>
    </>
  );

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
        <>
          {/* ---------- Mobile: panel fixed, rộng gần hết màn hình ---------- */}
          {/* Render qua portal để không bị ancestor `overflow-auto` của AdminShell
              cắt mất (POS nằm trong `h-screen overflow-auto`). */}
          {isNarrow && panelBox && typeof document !== "undefined" &&
            createPortal(
              <div
                id="pos-search-results"
                role="listbox"
                ref={panelRef}
                style={{ top: panelBox.top, maxHeight: panelBox.maxHeight }}
                className="fixed inset-x-2 z-[var(--z-floating)] overflow-y-auto overscroll-contain rounded-xl border bg-popover shadow-2xl"
              >
                {panelContent}
              </div>,
              document.body,
            )}

          {/* ---------- Desktop: panel absolute bám theo ô input ---------- */}
          {!isNarrow && (
            <div
              id="pos-search-results"
              role="listbox"
              ref={panelRef}
              className="absolute left-0 right-0 z-50 mt-2 max-h-[420px] overflow-y-auto rounded-lg border bg-popover shadow-xl"
            >
              {panelContent}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function groupKey(group: PosSearchGroup): string {
  return group.product_id ?? `__variant__${group.variants[0]?.variant_id ?? ""}`;
}

/**
 * Cấu hình nhanh hiển thị trên card của product.
 *
 * Với product nhiều biến thể, mỗi biến thể có thể khác cấu hình (RAM 8GB vs 16GB).
 * Ta lấy specs của biến thể có giá THẤP NHẤT — khớp với con số "từ X đ" đang hiện,
 * tránh việc thu ngân thấy "RAM 16GB" nhưng giá lại của bản 8GB.
 */
function groupSpecs(group: PosSearchGroup): QuickSpec[] {
  if (group.variants.length === 1) return group.variants[0].specs ?? [];
  let cheapest = group.variants[0];
  for (const v of group.variants) {
    if (v.selling_price > 0 && v.selling_price < cheapest.selling_price) cheapest = v;
  }
  return cheapest.specs ?? [];
}

function ResultGroupCard({
  group,
  isActive,
  expanded,
  onHover,
  onToggle,
  onPick,
}: {
  group: PosSearchGroup;
  isActive: boolean;
  expanded: boolean;
  onHover: () => void;
  onToggle: () => void;
  onPick: (hit: PosSearchHit) => void;
}) {
  const multi = group.variants.length > 1;
  const outOfStock = group.total_stock <= 0;
  const specs = groupSpecs(group);
  const title = group.product_name ?? group.variants[0]?.display_name ?? "Sản phẩm";
  const hasRange = group.min_price > 0 && group.max_price > group.min_price;
  const priceLabel = hasRange
    ? `${formatVND(group.min_price)} - ${formatVND(group.max_price)}`
    : group.min_price > 0
      ? formatVND(group.min_price)
      : "Liên hệ";
  // Mobile: khoảng giá "12.990.000 đ - 15.990.000 đ" quá dài, chỉ hiện giá thấp nhất
  // (kèm chữ "từ") để không tràn ra ngoài card.
  const priceLabelMobile = hasRange
    ? `từ ${formatVND(group.min_price)}`
    : priceLabel;

  return (
    <li
      className={`border-b last:border-b-0 ${isActive ? "bg-accent/60" : ""}`}
      onMouseEnter={onHover}
    >
      {/* Mobile: xếp dọc (ảnh + tên ở trên, giá + nút ở hàng dưới) để không bị
          bóp nén làm nội dung tràn ngang. Desktop: giữ bố cục cột như cũ. */}
      <div
        className={`flex cursor-pointer flex-col gap-2 px-3 py-2 transition-colors sm:flex-row sm:items-start sm:gap-3 ${
          isActive ? "" : "hover:bg-accent/40"
        }`}
        role="option"
        aria-selected={isActive}
        onClick={() => {
          if (multi) onToggle();
          else {
            const hit = group.variants[0];
            if (hit && !outOfStock) onPick(hit);
          }
        }}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
          {/* Ảnh */}
          {group.thumbnail_url ? (
            <Image
              src={group.thumbnail_url}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 flex-shrink-0 rounded border object-cover sm:h-11 sm:w-11"
              unoptimized
            />
          ) : (
            <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border bg-muted text-[10px] text-muted-foreground sm:h-11 sm:w-11">
              No img
            </span>
          )}

          {/* Nội dung: tên + spec + giá */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium leading-tight">{title}</div>
                {!multi && group.variants[0]?.variant_name && (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {group.variants[0].variant_name}
                  </div>
                )}
              </div>
              {multi && (
                <Badge
                  variant="secondary"
                  className="h-5 shrink-0 gap-0.5 px-1.5 text-[10px] font-semibold"
                >
                  <Layers className="h-2.5 w-2.5" />
                  {group.variant_count} phiên bản
                </Badge>
              )}
            </div>

            {/* Cấu hình nhanh: CPU / RAM / SSD / VGA / màn hình */}
            {specs.length > 0 && <SpecLine specs={specs} />}

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="font-mono">{group.variants[0]?.sku ?? "—"}</span>
              {multi && group.min_price > 0 && (
                <span className="hidden font-medium text-foreground/70 sm:inline">
                  từ {formatVND(group.min_price)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Giá + tồn + nút chọn — mobile: hàng ngang dưới, desktop: cột bên phải */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-dashed pt-2 sm:flex-col sm:items-end sm:gap-1 sm:border-0 sm:pt-0">
          <div className="flex min-w-0 flex-1 flex-col items-start sm:flex-none sm:items-end">
            <span className="text-sm font-semibold text-primary tabular-nums sm:hidden">
              {priceLabelMobile}
            </span>
            <span className="hidden text-sm font-semibold text-primary tabular-nums sm:inline">
              {priceLabel}
            </span>
            <span
              className={`text-[11px] tabular-nums ${
                outOfStock
                  ? "font-semibold text-destructive"
                  : group.total_stock <= 3
                    ? "font-medium text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
              }`}
            >
              {outOfStock ? "Hết hàng" : `Tồn: ${group.total_stock}`}
            </span>
          </div>
          {multi ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              aria-expanded={expanded}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1 rounded-md border bg-background px-3 text-xs font-medium text-foreground hover:bg-accent sm:min-h-[36px] sm:px-2 sm:text-[11px]"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {expanded ? "Ẩn" : "Chọn bản"}
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (group.variants[0]) onPick(group.variants[0]);
              }}
              disabled={outOfStock}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-md border bg-background px-4 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[36px] sm:px-2 sm:text-[11px]"
            >
              Chọn
            </button>
          )}
        </div>
      </div>

      {/* Danh sách biến thể — mở ra để thu ngân chọn đúng phiên bản */}
      {multi && expanded && (
        <ul className="space-y-1.5 border-t bg-muted/20 px-3 py-2">
          {group.variants.map((v) => {
            const vOut = v.stock <= 0;
            return (
              <li key={v.variant_id}>
                <div className="flex w-full flex-col gap-1.5 rounded-lg border bg-card p-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate text-xs font-semibold">
                        {v.variant_name || v.sku || "Phiên bản"}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {v.sku ?? ""}
                      </span>
                    </div>
                    {v.specs && v.specs.length > 0 && (
                      <SpecLine specs={v.specs} className="mt-0.5" />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:gap-0.5">
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {v.selling_price > 0 ? formatVND(v.selling_price) : "Liên hệ"}
                    </span>
                    <span
                      className={`text-[11px] tabular-nums ${
                        vOut
                          ? "font-semibold text-destructive"
                          : v.stock <= 3
                            ? "font-medium text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {vOut ? "Hết hàng" : `Tồn: ${v.stock}`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPick(v);
                    }}
                    disabled={vOut}
                    className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                  >
                    Chọn
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/**
 * Dòng cấu hình nhanh — gộp nhiều mục, mỗi mục là 1 chip. Trên màn hình hẹp
 * (mobile) hiển thị tối đa 3 mục để không đẩy card quá cao.
 */
function SpecLine({
  specs,
  className,
}: {
  specs: QuickSpec[];
  className?: string;
}) {
  if (specs.length === 0) return null;
  const visible = specs.slice(0, 3);
  const rest = specs.length - visible.length;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {visible.map((spec) => (
        <span
          key={spec.id}
          title={`${spec.label}: ${spec.raw}`}
          className="inline-flex max-w-[46%] items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] leading-tight text-muted-foreground"
        >
          <span className="font-semibold text-foreground/70">{spec.label}</span>
          <span className="truncate">{spec.value}</span>
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[10px] text-muted-foreground">+{rest} mục</span>
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

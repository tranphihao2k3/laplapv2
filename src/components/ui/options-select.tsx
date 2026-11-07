"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  /** Do sau trong cay (danh muc cha-con) - se thut le khi hien thi */
  depth?: number;
  /** Text phu (VD: ma kho, SKU) hien thi nho phia sau ten */
  keywords?: string;
};

/** Radix Select khong cho phep item co value rong -> can sentinel de bieu dien "chua chon". */
const NONE_VALUE = "__none__";

type Props = {
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /**
   * Bat o tim kiem ngay trong dropdown.
   * Dung khi danh sach option dai (VD: danh muc / thuong hieu) — go de loc,
   * bam 1 lan de chon. KHONG tach o search ra ngoai Select.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
};

/** Bo dau tieng Viet de search "acer" khop "Acer", "laptop" khop "Laptop"... */
function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

/**
 * Select danh sach option, boc bang Radix Select (giong Select mac dinh cua app).
 *
 * Khi `searchable`: o search nam BEN TRONG dropdown (khong tach ra ngoai),
 * nen chi can 1 thao tac: mo Select → go → chon.
 */
export function OptionsSelect({
  options,
  value,
  onValueChange,
  placeholder = "Chọn...",
  disabled,
  className,
  searchable = false,
  searchPlaceholder = "Tìm kiếm...",
  emptyText = "Không có kết quả",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Render dong chu "chua chon" bang item dau tien de giu hinh dang cua Select.
  const items = useMemo(
    () => [{ value: NONE_VALUE, label: placeholder, depth: 0, keywords: "" }, ...options],
    [options, placeholder],
  );

  // Loc theo ten (bo qua dau thuong) + kieu/ma phu. Option dang chon luon
  // duoc giu lai trong danh sach ke ca khi khong khop filter, neu khong
  // Select se khong hien gi ca gia tri hien tai.
  const visibleItems = useMemo(() => {
    if (!searchable) return items;
    const q = normalize(query.trim());
    if (!q) return items;
    return items.filter((o) => {
      if (o.value === NONE_VALUE) return true;
      if (o.value === value) return true;
      return normalize(`${o.label} ${o.keywords ?? ""}`).includes(q);
    });
  }, [items, query, searchable, value]);

  // Mo dropdown → focus o search; dong → xoa query de lan sau mo lai sach.
  useEffect(() => {
    if (!searchable) return;
    if (open) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    setQuery("");
  }, [open, searchable]);

  return (
    <Select
      value={value || NONE_VALUE}
      onValueChange={(v) => onValueChange(v === NONE_VALUE ? "" : v)}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger className={cn("h-9 text-sm", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        // Khi co search: khong auto-focus item dau (de focus o input),
        // va chan typeahead cua Radix de go chu khong bi "nhay" option.
        onCloseAutoFocus={(e) => {
          if (searchable) e.preventDefault();
        }}
      >
        {searchable ? (
          <div
            className="sticky top-0 z-10 border-b bg-popover px-2 pb-2 pt-1"
            // Chan click/keydown lan sang Select (tranh dong dropdown / typeahead).
            onKeyDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 pl-8 text-sm"
                // Enter chon item dau tien (khac NONE) neu dang loc.
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key !== "Enter") return;
                  const first = visibleItems.find((o) => o.value !== NONE_VALUE);
                  if (!first) return;
                  e.preventDefault();
                  onValueChange(first.value);
                  setOpen(false);
                }}
              />
            </div>
          </div>
        ) : null}

        {searchable &&
        query.trim() &&
        visibleItems.filter((o) => o.value !== NONE_VALUE).length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          visibleItems.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              <span className="truncate">
                {o.depth ? `${"\u00A0\u00A0".repeat(o.depth)}↳ ` : ""}
                {o.label}
                {o.keywords ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({o.keywords})
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

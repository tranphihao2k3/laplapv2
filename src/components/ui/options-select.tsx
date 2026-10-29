"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
   * Bat o tim kiem phia tren danh sach.
   * Dung khi danh sach option dai (VD: danh muc / thuong hieu) va nguoi dung
   * can loc theo ten thay vi phai cuon/tra chu.
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
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

/**
 * Select danh sach option, boc bang Radix Select (giong Select mac dinh cua app).
 *
 * Radix Select quet lý portal + focus-trap dung chuan, nen hoat dong on dinh
 * ben trong Dialog: mo dropdown, cuon danh sach va chon item deu khong lam
 * Dialog bi dong ngoai (vi khong dung portal tuy chon ra document.body nhu
 * SearchableSelect truoc day).
 *
 * Khong co o tim kiem mac dinh - dung native typeahead cua trinh duyet (go chu de
 * nhay den option khop). Hop khi danh sach vua phai chon. Bat `searchable` de
 * them o loc danh sach.
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
    const selected = items.find((o) => o.value === value);
    return items.filter((o) => {
      if (o.value === NONE_VALUE) return true;
      if (o.value === value) return true;
      return normalize(`${o.label} ${o.keywords ?? ""}`).includes(q);
    });
  }, [items, query, searchable, value]);

  const select = (
    <Select
      value={value || NONE_VALUE}
      onValueChange={(v) => onValueChange(v === NONE_VALUE ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn("h-9 text-sm", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {visibleItems.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="truncate">
              {o.depth ? `${"\u00A0\u00A0".repeat(o.depth)}↳ ` : ""}
              {o.label}
              {o.keywords ? <span className="ml-1 text-xs text-muted-foreground">({o.keywords})</span> : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!searchable) return select;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          disabled={disabled}
          className="h-8 pl-8 text-sm"
        />
      </div>
      {select}
      {searchable && query.trim() && visibleItems.filter((o) => o.value !== NONE_VALUE).length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : null}
    </div>
  );
}
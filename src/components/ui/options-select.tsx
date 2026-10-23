"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
};

/**
 * Select danh sach option, boc bang Radix Select (giong Select mac dinh cua app).
 *
 * Radix Select quet lý portal + focus-trap dung chuan, nen hoat dong on dinh
 * ben trong Dialog: mo dropdown, cuon danh sach va chon item deu khong lam
 * Dialog bi dong ngoai (vi khong dung portal tuy chon ra document.body nhu
 * SearchableSelect truoc day).
 *
 * Khong co o tim kiem - dung native typeahead cua trinh duyet (go chu de nhay
 * den option khop). Hop khi danh sach vua phai chon.
 */
export function OptionsSelect({
  options,
  value,
  onValueChange,
  placeholder = "Chọn...",
  disabled,
  className,
}: Props) {
  // Render dong chu "chua chon" bang item dau tien de giu hinh dang cua Select.
  const items = [{ value: NONE_VALUE, label: placeholder, depth: 0, keywords: "" }, ...options];

  return (
    <Select
      value={value || NONE_VALUE}
      onValueChange={(v) => onValueChange(v === NONE_VALUE ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn("h-9 text-sm", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
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
}
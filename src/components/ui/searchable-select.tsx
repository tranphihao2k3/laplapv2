"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableOption = {
  value: string;
  label: string;
  /** Do sau trong cay (dung cho danh muc cha-con) - se thut le khi hien thi */
  depth?: number;
  /** Text phu de search kem (VD: ma kho, slug) ma khong hien thi tren trigger */
  keywords?: string;
};

type Props = {
  options: SearchableOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

/** Bo dau tieng Viet de search "acer" khop "Acer", "laptop" khop "Laptop"... */
function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

/** Khoang cach giua trigger va dropdown (thay the `mt-1`). */
const DROPDOWN_GAP = 4;

/**
 * Select co o tim kiem - thay the @/components/ui/select khi danh sach dai.
 * Ho tro thut le theo `depth` cho cay danh muc.
 *
 * Dropdown duoc render qua Portal (document.body) de tranh bi clip boi
 * `overflow-hidden` cua filter row / Card, va de luon noi len tren table
 * ben duoi (vi tri dropdown tinh lai theo scroll/resize).
 */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Chon...",
  searchPlaceholder = "Tim kiem...",
  emptyText = "Khong co ket qua",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Chi chay portal o client
  useEffect(() => setMounted(true), []);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((o) => normalize(`${o.label} ${o.keywords ?? ""}`).includes(q));
  }, [options, query]);

  // Tinh vi tri dropdown theo trigger; cap nhat khi scroll/resize.
  // Neu trigger roi khoi viewport thi tu dong dong dropdown.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      // Trigger ra khoi viewport -> dong
      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
        setOpen(false);
        return;
      }
      setPosition({
        top: rect.bottom + DROPDOWN_GAP,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    // Capture phase de bat scroll tu moi ancestor (vd: Card co overflow-auto)
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Dong khi click ngoai (kiem ca trigger lan dropdown vi dropdown o body)
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Focus o search + reset query moi khi mo
  useEffect(() => {
    if (open) {
      setQuery("");
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const choose = (v: string) => {
    onValueChange(v);
    setOpen(false);
  };

  const dropdown =
    open && position && mounted ? (
      <div
        ref={dropdownRef}
        data-searchable-select
        // Chặn mọi event bubble ra khỏi dropdown để Radix Dialog / các listener
        // khác (click-outside, focus trap) không tưởng là "outside" / "mất focus".
        // Cần thiết vì dropdown được portal ra document.body, nằm NGOÀI
        // DOM tree của DialogContent.
        onPointerDown={(e) => e.stopPropagation()}
        onPointerDownCapture={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          width: position.width,
        }}
        className="z-[100] rounded-md border bg-popover text-popover-foreground shadow-md"
      >
        <div className="flex items-center gap-2 border-b px-2.5 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && filtered.length > 0) {
                e.preventDefault();
                choose(filtered[0].value);
              }
            }}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          // overscroll-contain chặn scroll chaining: khi user cuộn đến mép trong
          // dropdown thì KHÔNG tiếp tục cuộn form/dialog phía sau.
          className="max-h-[min(60vh,320px)] overflow-y-auto overscroll-contain p-1"
          onWheel={(e) => {
            const el = e.currentTarget as HTMLElement;
            const atTop = el.scrollTop <= 0 && e.deltaY < 0;
            const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight && e.deltaY > 0;
            if (atTop || atBottom) e.preventDefault();
            e.stopPropagation();
          }}
        >
          {filtered.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">{emptyText}</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => choose(o.value)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  o.value === value && "bg-accent/50",
                )}
              >
                <Check
                  className={cn("h-4 w-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")}
                />
                <span
                  className="line-clamp-1"
                  style={o.depth ? { paddingLeft: o.depth * 12 } : undefined}
                >
                  {o.depth ? "↳ " : ""}
                  {o.label}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn("line-clamp-1 text-left", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {mounted && dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}

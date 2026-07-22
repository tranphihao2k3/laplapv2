"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCrudList } from "@/lib/api/admin-crud";

export type GiftProductLite = {
  id: string;
  name: string;
  slug?: string;
  thumbnail_url: string | null;
  status?: string | null;
};

type Props = {
  /** id sản phẩm đang chỉnh sửa — sẽ bị loại khỏi kết quả search để tránh tự tặng chính nó */
  excludeProductId?: string;
  /** danh sách quà đã chọn (đầy đủ object, không chỉ id — để hiển thị chip có ảnh + tên) */
  value: GiftProductLite[];
  onChange: (next: GiftProductLite[]) => void;
};

/**
 * Combobox search cho quà tặng kèm.
 * - Debounce 300ms khi gõ
 * - Gọi /v1/products?search= (qua useCrudList) để KHÔNG bị giới hạn 50 sản phẩm như list ngoài
 * - Hiển thị thumbnail + tên + status để admin phân biệt nhanh
 * - Chip đã chọn ở phía trên có nút X gỡ
 */
export function GiftProductPicker({ excludeProductId, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // chỉ fetch khi có ít nhất 1 ký tự hoặc khi dropdown đang mở (để show gợi ý mặc định)
  const shouldFetch = open;
  const { data, isFetching } = useCrudList<GiftProductLite>(
    "products",
    { search: debounced || undefined, page: 1, pageSize: 20 },
    shouldFetch,
  );

  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);

  const results = useMemo(() => {
    const items = (data?.items ?? []) as GiftProductLite[];
    return items.filter((p) => p.id !== excludeProductId && !selectedIds.has(p.id));
  }, [data, excludeProductId, selectedIds]);

  // click ngoài thì đóng dropdown
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const addGift = (p: GiftProductLite) => {
    if (selectedIds.has(p.id) || p.id === excludeProductId) return;
    onChange([...value, p]);
    setQuery("");
  };

  const removeGift = (id: string) => {
    onChange(value.filter((v) => v.id !== id));
  };

  return (
    <div ref={rootRef} className="space-y-2">
      {/* Chip đã chọn */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-md border border-dashed p-2">
          {value.map((g) => (
            <Badge key={g.id} variant="secondary" className="flex items-center gap-1.5 pl-1 pr-1.5 py-1">
              {g.thumbnail_url ? (
                <Image
                  src={g.thumbnail_url}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 rounded object-cover"
                />
              ) : (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted text-[9px] text-muted-foreground">
                  ?
                </span>
              )}
              <span className="max-w-[180px] truncate text-xs">{g.name}</span>
              <button
                type="button"
                onClick={() => removeGift(g.id)}
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-destructive/20 hover:text-destructive"
                aria-label={`Gỡ ${g.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Ô search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Tìm sản phẩm để thêm làm quà tặng..."
          className="pl-8"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}

        {open && (
          <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
            {isFetching && results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Đang tìm...</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {debounced ? `Không tìm thấy sản phẩm khớp "${debounced}"` : "Gõ tên sản phẩm để tìm"}
              </div>
            ) : (
              <ul className="py-1">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addGift(p)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      {p.thumbnail_url ? (
                        <Image
                          src={p.thumbnail_url}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 flex-shrink-0 rounded object-cover border"
                        />
                      ) : (
                        <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border bg-muted text-[10px] text-muted-foreground">
                          No img
                        </span>
                      )}
                      <span className="flex-1 truncate">{p.name}</span>
                      {p.status && p.status !== "active" && (
                        <span className="text-[10px] uppercase text-muted-foreground">{p.status}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Gõ tên sản phẩm để tìm, nhấn để thêm vào danh sách quà tặng kèm.
      </p>
    </div>
  );
}

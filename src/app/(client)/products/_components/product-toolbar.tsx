"use client";

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORT_OPTIONS, type ProductQuery, type SortValue } from "../_lib/types";

type Props = {
  query: ProductQuery;
  setQuery: (patch: Partial<ProductQuery>) => void;
  total: number;
  onOpenFilters: () => void;
  activeCount: number;
};

export function ProductToolbar({ query, setQuery, total, onOpenFilters, activeCount }: Props) {
  const [term, setTerm] = useState(query.q);

  // Sync khi URL đổi từ ngoài (vd: nút back).
  useEffect(() => setTerm(query.q), [query.q]);

  // Debounce tìm kiếm tên 400ms.
  useEffect(() => {
    if (term === query.q) return;
    const id = setTimeout(() => setQuery({ q: term }), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Tìm kiếm sản phẩm theo tên..."
          className="h-10 pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" className="h-10 shrink-0 lg:hidden" onClick={onOpenFilters}>
          <SlidersHorizontal className="mr-1 h-4 w-4" />
          Lọc
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>

        <Select value={query.sort} onValueChange={(v) => setQuery({ sort: v as SortValue })}>
          <SelectTrigger className="h-10 w-full min-w-0 sm:w-[180px]">
            <SelectValue placeholder="Sắp xếp" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="hidden shrink-0 text-sm text-muted-foreground sm:block">{total} sản phẩm</p>
    </div>
  );
}

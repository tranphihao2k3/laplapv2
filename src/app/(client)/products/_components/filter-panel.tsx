"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { FilterOption, ProductFilters, ProductQuery } from "../_lib/types";

type Props = {
  filters?: ProductFilters;
  query: ProductQuery;
  setQuery: (patch: Partial<ProductQuery>) => void;
  reset: () => void;
  activeCount: number;
};

const COLLAPSED_LIMIT = 7;

function OptionList({
  options,
  selected,
  onSelect,
}: {
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">Không có dữ liệu</p>;
  }

  // Nếu mục đang chọn nằm ngoài phần thu gọn thì tự mở rộng để vẫn nhìn thấy.
  const selectedHidden =
    !expanded &&
    options.findIndex((o) => o.value === selected) >= COLLAPSED_LIMIT;
  const showAll = expanded || selectedHidden;
  const visible = showAll ? options : options.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = options.length - COLLAPSED_LIMIT;

  return (
    <div className="space-y-1">
      {visible.map((opt, idx) => {
        const active = selected === opt.value;
        return (
          <button
            key={`${opt.value}-${idx}`}
            type="button"
            onClick={() => onSelect(active ? "" : opt.value)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              active ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
            )}
          >
            <span className="line-clamp-1">{opt.label}</span>
            <span className="ml-2 shrink-0 text-xs text-muted-foreground">{opt.count}</span>
          </button>
        );
      })}

      {options.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-1 px-2 pt-1 text-xs font-medium text-primary hover:underline"
        >
          {showAll ? "Thu gọn" : `Xem thêm (${hiddenCount})`}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")}
          />
        </button>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function FilterPanel({ filters, query, setQuery, reset, activeCount }: Props) {
  // Giá nhập tay (debounce nhẹ khi blur/Enter để tránh push URL liên tục).
  const [minPrice, setMinPrice] = useState(query.minPrice ? String(query.minPrice) : "");
  const [maxPrice, setMaxPrice] = useState(query.maxPrice ? String(query.maxPrice) : "");

  useEffect(() => {
    setMinPrice(query.minPrice ? String(query.minPrice) : "");
    setMaxPrice(query.maxPrice ? String(query.maxPrice) : "");
  }, [query.minPrice, query.maxPrice]);

  const applyPrice = () => {
    setQuery({ minPrice: Number(minPrice) || 0, maxPrice: Number(maxPrice) || 0 });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Bộ lọc</h2>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={reset}>
            <X className="mr-1 h-3 w-3" /> Xóa ({activeCount})
          </Button>
        )}
      </div>

      {(filters?.needTags?.length ?? 0) > 0 && (
        <>
          <FilterGroup title="Nhu cầu sử dụng">
            <OptionList
              options={filters?.needTags ?? []}
              selected={query.tag}
              onSelect={(tag) => setQuery({ tag })}
            />
          </FilterGroup>
          <Separator />
        </>
      )}

      {(filters?.priceBuckets?.length ?? 0) > 0 && (
        <>
          <FilterGroup title="Mức giá">
            <OptionList
              options={filters?.priceBuckets ?? []}
              selected={query.priceBucket}
              onSelect={(priceBucket) => setQuery({ priceBucket })}
            />
          </FilterGroup>
          <Separator />
        </>
      )}

      <FilterGroup title="Khoảng giá (VND)">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Từ"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onBlur={applyPrice}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            className="h-9"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Đến"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onBlur={applyPrice}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            className="h-9"
          />
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={applyPrice}>
          Áp dụng giá
        </Button>
      </FilterGroup>

      <Separator />

      <FilterGroup title="Thương hiệu">
        <OptionList
          options={filters?.brands ?? []}
          selected={query.brand}
          onSelect={(brand) => setQuery({ brand })}
        />
      </FilterGroup>

      <Separator />

      <FilterGroup title="Danh mục">
        <OptionList
          options={filters?.categories ?? []}
          selected={query.category}
          onSelect={(category) => setQuery({ category })}
        />
      </FilterGroup>

      <Separator />

      <FilterGroup title="CPU">
        <OptionList options={filters?.cpu ?? []} selected={query.cpu} onSelect={(cpu) => setQuery({ cpu })} />
      </FilterGroup>

      <Separator />

      <FilterGroup title="RAM">
        <OptionList options={filters?.ram ?? []} selected={query.ram} onSelect={(ram) => setQuery({ ram })} />
      </FilterGroup>

      <Separator />

      <FilterGroup title="Ổ cứng">
        <OptionList
          options={filters?.storage ?? []}
          selected={query.storage}
          onSelect={(storage) => setQuery({ storage })}
        />
      </FilterGroup>
    </div>
  );
}

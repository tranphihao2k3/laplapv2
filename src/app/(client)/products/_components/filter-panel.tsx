"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X, Filter } from "lucide-react";
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

const COLLAPSED_LIMIT = 6;

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
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-200",
              active 
                ? "bg-gradient-to-r from-primary/10 to-cyan-400/10 font-medium text-primary border border-primary/20" 
                : "hover:bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="line-clamp-1">{opt.label}</span>
            <span className={cn(
              "ml-2 shrink-0 text-xs rounded-full px-1.5 py-0.5",
              active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {opt.count}
            </span>
          </button>
        );
      })}

      {options.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:underline"
        >
          {showAll ? "Thu gọn" : `Xem thêm (${hiddenCount})`}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-200", showAll && "rotate-180")}
          />
        </button>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function FilterPanel({ filters, query, setQuery, reset, activeCount }: Props) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-cyan-400/10">
            <Filter className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-semibold">Bộ lọc</h2>
        </div>
        {activeCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-3 text-xs rounded-lg hover:bg-destructive/10 hover:text-destructive" 
            onClick={reset}
          >
            <X className="mr-1 h-3 w-3" /> 
            <span className="hidden sm:inline">Xóa</span> ({activeCount})
          </Button>
        )}
      </div>

      {/* Filter Groups */}
      <div className="space-y-6">
        {(filters?.needTags?.length ?? 0) > 0 && (
          <>
            <FilterGroup title="Nhu cầu sử dụng">
              <OptionList
                options={filters?.needTags ?? []}
                selected={query.tag}
                onSelect={(tag) => setQuery({ tag })}
              />
            </FilterGroup>
            <Separator className="bg-border/50" />
          </>
        )}

        {(filters?.priceBuckets?.length ?? 0) > 0 && (
          <>
            <FilterGroup title="Mức giá phổ biến">
              <OptionList
                options={filters?.priceBuckets ?? []}
                selected={query.priceBucket}
                onSelect={(priceBucket) => setQuery({ priceBucket })}
              />
            </FilterGroup>
            <Separator className="bg-border/50" />
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
              className="h-10 rounded-xl border-border/50 bg-muted/30 focus:border-primary/50"
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
              className="h-10 rounded-xl border-border/50 bg-muted/30 focus:border-primary/50"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full rounded-xl border-primary/30 bg-primary/5 text-primary hover:bg-primary/10" 
            onClick={applyPrice}
          >
            Áp dụng
          </Button>
        </FilterGroup>

        <Separator className="bg-border/50" />

        <FilterGroup title="Thương hiệu">
          <OptionList
            options={filters?.brands ?? []}
            selected={query.brand}
            onSelect={(brand) => setQuery({ brand })}
          />
        </FilterGroup>

        <Separator className="bg-border/50" />

        <FilterGroup title="Danh mục">
          <OptionList
            options={(filters?.categories ?? []).map((c) => ({
              ...c,
              value: c.slug ?? c.value,
            }))}
            selected={query.category}
            onSelect={(category) => setQuery({ category })}
          />
        </FilterGroup>

        <Separator className="bg-border/50" />

        <FilterGroup title="CPU">
          <OptionList options={filters?.cpu ?? []} selected={query.cpu} onSelect={(cpu) => setQuery({ cpu })} />
        </FilterGroup>

        <Separator className="bg-border/50" />

        <FilterGroup title="RAM">
          <OptionList options={filters?.ram ?? []} selected={query.ram} onSelect={(ram) => setQuery({ ram })} />
        </FilterGroup>

        <Separator className="bg-border/50" />

        <FilterGroup title="Ổ cứng">
          <OptionList
            options={filters?.storage ?? []}
            selected={query.storage}
            onSelect={(storage) => setQuery({ storage })}
          />
        </FilterGroup>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { PackageX, Laptop, Cpu, ArrowRight } from "lucide-react";
import { HomeProductCard } from "@/components/client/home/home-product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useProductFilters,
  useProductQueryState,
  useProducts,
} from "../_lib/use-product-query";
import { FilterPanel } from "./filter-panel";
import { ProductToolbar } from "./product-toolbar";
import { Pagination } from "./pagination";
import { useAddToCart } from "@/components/client/cart/add-to-cart";
import { KIND_DESCRIPTION, KIND_LABEL, type ProductKind } from "@/lib/product-kind";

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border p-3">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

function KindSwitcher({ value, onChange }: { value: ProductKind; onChange: (k: ProductKind) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-card p-1 text-sm">
      <button
        type="button"
        onClick={() => onChange("laptop")}
        aria-pressed={value === "laptop"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
          value === "laptop"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Laptop className="h-4 w-4" /> Laptop
      </button>
      <button
        type="button"
        onClick={() => onChange("pc_component")}
        aria-pressed={value === "pc_component"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
          value === "pc_component"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Cpu className="h-4 w-4" /> Linh kiện PC
      </button>
    </div>
  );
}

export function ProductListing() {
  const { query, setQuery, setKind, reset, activeCount } = useProductQueryState();
  const { data: filters } = useProductFilters(query.kind);
  const { data, isLoading, isError, isFetching } = useProducts(query);
  const [sheetOpen, setSheetOpen] = useState(false);
  const addToCart = useAddToCart();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const kind = query.kind;
  const isPc = kind === "pc_component";

  const handleSetQueryMobile = (patch: Parameters<typeof setQuery>[0]) => {
    setQuery(patch);
  };

  return (
    <div className="container py-6">
      <div className="mb-4 sm:mb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              {isPc ? "Linh kiện PC" : "Tất cả sản phẩm"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{KIND_DESCRIPTION[kind]}</p>
          </div>
          <KindSwitcher value={kind} onChange={setKind} />
        </div>
      </div>

      {/* Banner nhỏ cho nhóm Linh kiện PC — gợi ý PC Builder. */}
      {isPc && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
          <div>
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">
              Tự chọn linh kiện để xây dựng cấu hình PC của bạn
            </p>
            <p className="text-xs text-violet-700/80 dark:text-violet-300/80">
              Hệ thống tự động kiểm tra tương thích main, CPU, RAM, VGA...
            </p>
          </div>
          <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-700">
            <Link href="/pc-builder">
              Mở PC Builder <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
        {/* Sidebar lọc — desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-xl border p-4">
            <FilterPanel
              filters={filters}
              query={query}
              setQuery={setQuery}
              reset={reset}
              activeCount={activeCount}
            />
          </div>
        </aside>

        <div className="space-y-4">
          <ProductToolbar
            query={query}
            setQuery={setQuery}
            total={total}
            activeCount={activeCount}
            kindLabel={KIND_LABEL[kind]}
            onOpenFilters={() => setSheetOpen(true)}
          />

          {/* Drawer lọc — mobile */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <span className="hidden" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] overflow-y-auto sm:w-[340px]">
              <SheetHeader>
                <SheetTitle>Bộ lọc</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <FilterPanel
                  filters={filters}
                  query={query}
                  setQuery={handleSetQueryMobile}
                  reset={reset}
                  activeCount={activeCount}
                />
              </div>
            </SheetContent>
          </Sheet>

          {isError ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
              <PackageX className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Đã xảy ra lỗi khi tải sản phẩm.</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Thử lại
              </Button>
            </div>
          ) : isLoading ? (
            <GridSkeleton />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
              <PackageX className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Không tìm thấy {KIND_LABEL[kind].toLowerCase()} phù hợp</p>
              <p className="text-sm text-muted-foreground">
                {isPc
                  ? "Thử chọn loại linh kiện khác hoặc bỏ bộ lọc."
                  : "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."}
              </p>
              {activeCount > 0 && (
                <Button variant="outline" onClick={reset}>
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          ) : (
            <div
              className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}
              aria-busy={isFetching}
            >
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((p) => (
                  <HomeProductCard key={p.id} product={p} onAddToCart={addToCart} />
                ))}
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="pt-4">
              <Pagination
                page={query.page}
                totalPages={totalPages}
                onChange={(page) => setQuery({ page }, { resetPage: false })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

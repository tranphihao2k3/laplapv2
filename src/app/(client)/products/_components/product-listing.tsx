"use client";

import { useState } from "react";
import { PackageX } from "lucide-react";
import { HomeProductCard } from "@/components/client/home/home-product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useProductFilters, useProductQueryState, useProducts } from "../_lib/use-product-query";
import { FilterPanel } from "./filter-panel";
import { ProductToolbar } from "./product-toolbar";
import { Pagination } from "./pagination";

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

export function ProductListing() {
  const { query, setQuery, reset, activeCount } = useProductQueryState();
  const { data: filters } = useProductFilters();
  const { data, isLoading, isError, isFetching } = useProducts(query);
  const [sheetOpen, setSheetOpen] = useState(false);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const handleSetQueryMobile = (patch: Parameters<typeof setQuery>[0]) => {
    setQuery(patch);
  };

  return (
    <div className="container py-6">
      <div className="mb-4 sm:mb-5">
        <h1 className="text-xl font-bold sm:text-2xl">Tất cả sản phẩm</h1>
        <p className="mt-1 text-sm text-muted-foreground">Laptop chính hãng tại LapLap Cần Thơ</p>
      </div>

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
              <p className="font-medium">Không tìm thấy sản phẩm phù hợp</p>
              <p className="text-sm text-muted-foreground">
                Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
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
                  <HomeProductCard key={p.id} product={p} />
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

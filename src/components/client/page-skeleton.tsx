import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton cho trang chi tiết sản phẩm /products/[slug]
 * Phản chiếu layout: gallery bên trái, info bên phải, tabs bên dưới.
 */
export function ProductDetailSkeleton() {
  return (
    <div className="container py-6 lg:py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Main grid: gallery + info */}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
        {/* Gallery */}
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Product info */}
        <div className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-5 w-3/5" />
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-11 flex-1 rounded-lg" />
            <Skeleton className="h-11 flex-1 rounded-lg" />
          </div>
          {/* Key specs */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex gap-2 border-b pb-2">
          {[100, 120, 140].map((w, i) => (
            <Skeleton key={i} className="h-9 rounded-md" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-4 w-full" style={{ width: `${95 - i * 8}%` }} />
          ))}
        </div>
      </div>

      {/* Related products */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton cho trang danh sách sản phẩm /products
 * Layout: filter sidebar + product grid.
 */
export function ProductListingSkeleton() {
  return (
    <div className="container py-6 space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {[120, 100, 90, 110, 80].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-full" style={{ width: w }} />
        ))}
        <Skeleton className="ml-auto h-9 w-32 rounded-md" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-3 space-y-3">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton cho trang chủ /
 * Phản chiếu hero + brand strip + product sections.
 */
export function HomePageSkeleton() {
  return (
    <div className="space-y-0">
      {/* Hero */}
      <Skeleton className="h-[420px] w-full rounded-none" />

      {/* Brand strip */}
      <div className="container py-6">
        <div className="flex gap-6 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-20 shrink-0 rounded-md" />
          ))}
        </div>
      </div>

      {/* Featured products section */}
      <div className="container py-6 space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-3 space-y-3">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-5 w-2/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

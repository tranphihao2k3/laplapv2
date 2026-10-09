import { cn } from "@/lib/utils";

type ProductCardSkeletonProps = {
  className?: string;
  withFooter?: boolean;
};

export function ProductCardSkeleton({
  className,
  withFooter = true,
}: ProductCardSkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-0",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-muted/40 to-background">
        <div className="absolute inset-3 rounded-lg bg-muted/80" />
        <div
          className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-background/60 to-transparent"
          style={{ backgroundSize: "200% 100%" }}
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="h-3.5 w-4/5 rounded bg-muted" />
        <div className="h-3.5 w-3/5 rounded bg-muted" />
        <div className="mt-1 flex items-center gap-2">
          <div className="h-3 w-12 rounded bg-muted" />
          <div className="h-3 w-px bg-border" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
        <div className="mt-2 h-4 w-2/3 rounded bg-muted" />
      </div>

      {withFooter && (
        <div className="p-3 pt-0 sm:p-4 sm:pt-0">
          <div className="h-8 w-full rounded-lg bg-muted" />
        </div>
      )}
    </div>
  );
}

export function ProductCardSkeletonGrid({
  count = 4,
  className,
  withFooter = true,
}: {
  count?: number;
  className?: string;
  withFooter?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} withFooter={withFooter} />
      ))}
    </div>
  );
}
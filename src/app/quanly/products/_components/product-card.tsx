"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, Package, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ProductCardData = {
  id: string;
  name: string;
  slug?: string | null;
  sku?: string | null;
  brand_name?: string | null;
  category_name?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  image_url?: string | null;
  stock_qty?: number | null;
  is_active?: boolean | null;
  status?: string | null;
};

type ProductCardProps = {
  product: ProductCardData;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
};

function formatVND(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!n) return null;
  return `${n.toLocaleString("vi-VN")}₫`;
}

export function ProductCard({ product, index, onEdit, onDelete }: ProductCardProps) {
  const brand = product.brand_name ?? null;
  const stock = product.stock_qty ?? null;
  const isArchived = product.status === "archived";
  const isInactive = product.is_active === false;
  const outOfStock = stock === 0;
  const price = formatVND(product.price);
  const compareAtPrice = formatVND(product.compare_at_price);
  const hasViewableSlug = typeof product.slug === "string" && product.slug.length > 0;

  function handleView() {
    if (!hasViewableSlug) {
      toast.warning("Sản phẩm chưa có slug");
      return;
    }
    window.open(`/products/${product.slug}`, "_blank", "noopener,noreferrer");
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Card
        className={cn(
          "group relative flex flex-col overflow-hidden transition-all duration-200",
          "hover:shadow-lg hover:-translate-y-0.5",
        )}
      >
        {/* Ảnh + overlay + hover actions */}
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              unoptimized
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Package className="h-12 w-12" />
            </div>
          )}

          {/* Gradient overlay phía dưới */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Badge trạng thái góc trên trái */}
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {outOfStock ? (
              <Badge variant="destructive" className="shadow-sm">
                Hết hàng
              </Badge>
            ) : isArchived || isInactive ? (
              <Badge variant="secondary" className="shadow-sm">
                Ngừng bán
              </Badge>
            ) : null}
          </div>

          {/* STT góc dưới trái (overlay trên gradient) */}
          <div className="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-mono text-white tabular-nums">
            #{index}
          </div>

          {/* Hover actions góc trên phải */}
          <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 shadow-md"
                  onClick={handleView}
                  disabled={!hasViewableSlug}
                  aria-label="Xem chi tiết"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {hasViewableSlug ? "Xem chi tiết" : "Sản phẩm chưa có slug"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 shadow-md"
                  onClick={onEdit}
                  aria-label="Sửa"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Sửa</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-7 w-7 shadow-md"
                  onClick={onDelete}
                  aria-label="Xoá"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Xoá</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Info dưới ảnh */}
        <CardContent className="flex flex-1 flex-col gap-1.5 p-3">
          {brand ? (
            <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {brand}
            </div>
          ) : null}
          <div
            className="line-clamp-2 text-sm font-semibold leading-snug"
            title={product.name}
          >
            {product.name}
          </div>
          {product.sku ? (
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {product.sku}
            </div>
          ) : null}

          {/* Giá */}
          <div className="mt-1 flex items-baseline gap-2">
            {price ? (
              <span className="text-base font-bold tabular-nums text-foreground">
                {price}
              </span>
            ) : (
              <span className="text-xs italic text-muted-foreground">Liên hệ</span>
            )}
            {compareAtPrice && product.compare_at_price && product.price &&
            Number(product.compare_at_price) > Number(product.price) ? (
              <span className="text-[11px] text-muted-foreground line-through tabular-nums">
                {compareAtPrice}
              </span>
            ) : null}
          </div>

          {/* Tồn kho */}
          <div className="mt-auto pt-1 text-[11px] text-muted-foreground">
            {outOfStock ? (
              <span className="font-semibold text-destructive">Hết hàng</span>
            ) : stock != null ? (
              <span>Tồn: {stock}</span>
            ) : (
              <span>Tồn: —</span>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square w-full animate-pulse bg-muted" />
      <CardContent className="space-y-2 p-3">
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-3 w-12 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

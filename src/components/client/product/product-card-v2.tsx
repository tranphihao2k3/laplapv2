import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  Heart,
  Eye,
  ShoppingCart,
  PackageX,
  ArrowUpRight,
  Cpu,
  Monitor,
  HardDrive,
  MemoryStick,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { CompareToggle } from "@/components/client/compare/compare-toggle";
import type { CompareItem } from "@/stores/compare-store";

export type ProductCardV2Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  image?: string | null;
  originalPrice?: number;
  inStock?: boolean;
  stockQty?: number;
  badge?: string;
  isNew?: boolean;
  isHot?: boolean;
  discountPercent?: number;
  variantId?: string;
  attributes?: string;
  specs?: Record<string, string>;
};

type ProductCardV2Props = {
  product: ProductCardV2Product;
  className?: string;
  hideAddToCart?: boolean;
  showWishlist?: boolean;
  showQuickView?: boolean;
  showCompare?: boolean;
  onAddToCart?: (product: ProductCardV2Product & {
    productId: string;
    variantId: string;
    image: string | null;
    attributes: string;
    stockQty?: number;
  }) => void;
  onWishlistToggle?: (productId: string, next: boolean) => void;
  onQuickView?: (product: ProductCardV2Product) => void;
};

const SPEC_PRIORITY_KEYS = ["cpu", "ram", "ssd", "storage", "screen", "display", "battery"] as const;
type SpecKey = (typeof SPEC_PRIORITY_KEYS)[number];

const SPEC_ICONS: Partial<Record<SpecKey, React.ComponentType<{ className?: string }>>> = {
  cpu: Cpu,
  ram: MemoryStick,
  ssd: HardDrive,
  storage: HardDrive,
  screen: Monitor,
  display: Monitor,
};

function getKeySpecs(specs: Record<string, string> = {}): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = [];
  for (const key of SPEC_PRIORITY_KEYS) {
    const value = specs[key];
    if (value && typeof value === "string" && value.trim()) {
      result.push({ key, value: value.trim() });
      if (result.length >= 3) break;
    }
  }
  return result;
}

function shortenSpecValue(value: string, maxLength = 16): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 1) + "…";
}

export function ProductCardV2({
  product,
  className,
  hideAddToCart = false,
  showWishlist = true,
  showQuickView = true,
  showCompare = true,
  onAddToCart,
  onWishlistToggle,
  onQuickView,
}: ProductCardV2Props) {
  const [wishlisted, setWishlisted] = useState(false);
  const [busy, setBusy] = useState(false);

  const computedDiscount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0;
  const discount =
    typeof product.discountPercent === "number" && product.discountPercent > 0
      ? Math.round(product.discountPercent)
      : computedDiscount;

  const keySpecs = getKeySpecs(product.specs);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !wishlisted;
    setWishlisted(next);
    onWishlistToggle?.(product.id, next);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      onAddToCart?.({
        ...product,
        productId: product.id,
        variantId: product.variantId ?? product.id,
        image: product.image ?? null,
        attributes: product.attributes ?? "",
        stockQty: product.stockQty,
      });
    } finally {
      window.setTimeout(() => setBusy(false), 350);
    }
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
  };

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden",
        "transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-0.5",
        className,
      )}
    >
      {/* Stretched link */}
      <Link
        href={`/products/${product.slug}`}
        aria-label={product.name}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      />

      {/* Image Area */}
      <div className="relative aspect-square overflow-hidden bg-muted/50">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-4 transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">No image</div>
        )}

        {/* Out of stock overlay */}
        {product.inStock === false && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-background/80">
            <span className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium">
              <PackageX className="h-3.5 w-3.5" />
              Hết hàng
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 z-20 flex flex-col gap-1">
          {discount > 0 && (
            <span className="inline-flex rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
              -{discount}%
            </span>
          )}
          {product.isNew && (
            <span className="inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              Mới về
            </span>
          )}
          {product.isHot && (
            <span className="inline-flex rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">
              Hot
            </span>
          )}
        </div>

        {/* Wishlist */}
        {showWishlist && (
          <button
            type="button"
            onClick={handleWishlist}
            aria-label={wishlisted ? "Bỏ yêu thích" : "Yêu thích"}
            className={cn(
              "absolute right-2 top-2 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-sm transition-all hover:scale-110",
              wishlisted ? "ring-2 ring-rose-500" : "ring-1 ring-border",
            )}
          >
            <Heart className={cn("h-4 w-4", wishlisted ? "fill-rose-500 text-rose-500" : "text-muted-foreground")} />
          </button>
        )}

        {showCompare && (
          <CompareToggle
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              image: product.image ?? null,
              price: product.price,
            } satisfies CompareItem}
          />
        )}

        {/* Quick view */}
        {showQuickView && onQuickView && (
          <>
            <div className="absolute inset-0 z-[6] bg-black/0 transition-colors group-hover:bg-black/5" />
            <button
              type="button"
              onClick={handleQuickView}
              className="absolute bottom-2 left-2 right-2 z-[7] flex items-center justify-center gap-1 rounded-lg bg-background/95 py-2 text-xs font-medium shadow-sm opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Eye className="h-3.5 w-3.5" />
              Xem nhanh
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <CardContent className="relative z-0 flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">
          {product.name}
        </h3>

        {/* Specs */}
        {keySpecs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {keySpecs.map(({ key, value }) => {
              const Icon = SPEC_ICONS[key as SpecKey];
              return (
                <Badge key={key} variant="secondary" className="text-[10px]">
                  {Icon && <Icon className="h-2.5 w-2.5 mr-0.5" />}
                  {shortenSpecValue(value, 10)}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Price */}
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold">
            {product.price > 0 ? formatCurrency(product.price) : "Liên hệ"}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(product.originalPrice)}
            </span>
          )}
        </div>
      </CardContent>

      {/* CTA */}
      {!hideAddToCart && (
        <CardFooter className="relative z-0 gap-2 p-4 pt-0">
          {product.variantId ? (
            <Button
              size="sm"
              variant={product.inStock === false || product.stockQty === 0 ? "outline" : "default"}
              disabled={product.inStock === false || product.stockQty === 0 || busy}
              onClick={handleAddToCart}
              className="w-full"
            >
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              <span>{product.inStock === false || product.stockQty === 0 ? "Hết hàng" : busy ? "Đã thêm!" : "Thêm vào giỏ"}</span>
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild className="w-full">
              <Link href={`/products/${product.slug}`}>
                <span>Chọn phiên bản</span>
                <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

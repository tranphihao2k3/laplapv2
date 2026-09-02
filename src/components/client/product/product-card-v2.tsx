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
  /** Giá gốc trước khi giảm (không bắt buộc). */
  originalPrice?: number;
  /** Còn hàng hay không — nếu false sẽ che ảnh bằng overlay "Hết hàng". */
  inStock?: boolean;
  /** Số tồn kho của variant — dùng để giới hạn không vượt quá khi add-to-cart. */
  stockQty?: number;
  /** Badge tuỳ biến (vd: "Mới về", "Hot", "Like new"). Ưu tiên sau cùng. */
  badge?: string;
  /** Bật badge "Mới về" xanh dương ở góc trên trái. */
  isNew?: boolean;
  /** Bật badge "Hot" đỏ ở góc trên trái. */
  isHot?: boolean;
  /** % giảm giá override — nếu không truyền sẽ tự tính từ price/originalPrice. */
  discountPercent?: number;
  /** product_variants.id — dùng để add-to-cart trực tiếp từ card. */
  variantId?: string;
  /** Thuộc tính variant hiển thị (vd: "16GB / 512GB / Đen"). */
  attributes?: string;
  /** Thông số kỹ thuật chính — hiển thị dạng tag nhỏ dưới tên sản phẩm. */
  specs?: Record<string, string>;
};

type ProductCardV2Props = {
  product: ProductCardV2Product;
  className?: string;
  /** Ẩn nút "Thêm vào giỏ" — vd khi dùng ở slider compact. */
  hideAddToCart?: boolean;
  /** Bật/tắt icon wishlist ở góc trên phải ảnh (mặc định bật). */
  showWishlist?: boolean;
  /** Bật/tắt overlay quick-view khi hover (mặc định bật). */
  showQuickView?: boolean;
  /** Bật/tắt nút so sánh sản phẩm (mặc định bật). */
  showCompare?: boolean;
  /** Callback khi bấm "Thêm vào giỏ". Truyền useAddToCart từ add-to-cart.tsx. */
  onAddToCart?: (product: ProductCardV2Product & {
    productId: string;
    variantId: string;
    image: string | null;
    attributes: string;
    stockQty?: number;
  }) => void;
  /** Callback khi bấm wishlist — truyền productId để parent quản lý state. */
  onWishlistToggle?: (productId: string, next: boolean) => void;
  /** Callback khi bấm quick-view. */
  onQuickView?: (product: ProductCardV2Product) => void;
};

/** Các key spec phổ biến cho laptop/electronics — thứ tự ưu tiên hiển thị. */
const SPEC_PRIORITY_KEYS = ["cpu", "ram", "ssd", "storage", "screen", "display", "battery"] as const;
type SpecKey = (typeof SPEC_PRIORITY_KEYS)[number];

/** Icon cho từng loại spec. */
const SPEC_ICONS: Partial<Record<SpecKey, React.ComponentType<{ className?: string }>>> = {
  cpu: Cpu,
  ram: MemoryStick,
  ssd: HardDrive,
  storage: HardDrive,
  screen: Monitor,
  display: Monitor,
} as const;

/** Label hiển thị cho từng loại spec. */
const SPEC_LABELS: Record<SpecKey, string> = {
  cpu: "CPU",
  ram: "RAM",
  ssd: "SSD",
  storage: "HDD",
  screen: "Màn",
  display: "Màn",
  battery: "Pin",
};

/**
 * Trích xuất danh sách specs quan trọng nhất để hiển thị trên card.
 * Lấy tối đa 4 spec theo thứ tự ưu tiên, bỏ qua giá trị rỗng.
 */
function getKeySpecs(specs: Record<string, string> = {}): Array<{ key: string; value: string }> {
  const result: Array<{ key: string; value: string }> = [];
  for (const key of SPEC_PRIORITY_KEYS) {
    const value = specs[key];
    if (value && typeof value === "string" && value.trim()) {
      result.push({ key, value: value.trim() });
      if (result.length >= 4) break;
    }
  }
  return result;
}

/** Rút gọn giá trị spec quá dài để hiển thị gọn card. */
function shortenSpecValue(value: string, maxLength = 18): string {
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
      // Build AddToCartOptions from ProductCardV2Product
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
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border-slate-200/80 bg-white p-0 shadow-none",
        "transition-all duration-300 ease-smooth",
        "hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.32)]",
        className,
      )}
    >
      {/* Stretched link phủ toàn bộ card — đảm bảo cả vùng ảnh + nội dung đều click được */}
      <Link
        href={`/products/${product.slug}`}
        aria-label={product.name}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
      />

      {/* ==== Vùng ảnh ==== */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              "object-contain p-3 transition-transform duration-[700ms] ease-glide will-change-transform",
              "group-hover:scale-[1.08]",
            )}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl font-semibold tracking-tight text-slate-200">
            LapLap
          </div>
        )}

        {/* Hết hàng: overlay che ảnh */}
        {product.inStock === false && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/85 px-3 py-1.5 text-[11px] font-medium text-white">
              <PackageX className="h-3.5 w-3.5" />
              Hết hàng
            </span>
          </div>
        )}

        {/* Góc trên trái: badge danh mục / giảm giá / new / hot */}
        <div className="pointer-events-none absolute left-2.5 top-2.5 z-20 flex flex-col items-start gap-1.5">
          {discount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground shadow-sm">
              -{discount}%
            </span>
          )}
          {product.isNew && (
            <span className="inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
              Mới về
            </span>
          )}
          {product.isHot && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-orange-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
              Hot
            </span>
          )}
          {!discount && !product.isNew && !product.isHot && product.badge && (
            <span className="inline-flex items-center rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
              {product.badge}
            </span>
          )}
        </div>

        {/* Góc trên phải: wishlist */}
        {showWishlist && (
          <button
            type="button"
            onClick={handleWishlist}
            aria-label={wishlisted ? `Bỏ yêu thích ${product.name}` : `Yêu thích ${product.name}`}
            aria-pressed={wishlisted}
            className={cn(
              "absolute right-2.5 top-2.5 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm transition-all duration-200",
              "hover:bg-white hover:ring-slate-300 hover:scale-105 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              wishlisted && "ring-rose-300 bg-rose-50",
            )}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                wishlisted ? "fill-rose-500 text-rose-500" : "text-slate-600",
              )}
            />
          </button>
        )}

        {showCompare && (
          <CompareToggle
            product={
              {
                id: product.id,
                name: product.name,
                slug: product.slug,
                image: product.image ?? null,
                price: product.price,
              } satisfies CompareItem
            }
          />
        )}

        {/* Hover overlay: gradient + nút quick view */}
        {showQuickView && onQuickView && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[6] bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            <button
              type="button"
              onClick={handleQuickView}
              aria-label={`Xem nhanh ${product.name}`}
              className={cn(
                "absolute inset-x-3 bottom-3 z-[7] flex items-center justify-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800 shadow-md ring-1 ring-slate-200 backdrop-blur-sm",
                "translate-y-2 opacity-0 transition-all duration-300 ease-smooth",
                "group-hover:translate-y-0 group-hover:opacity-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:opacity-100 focus-visible:translate-y-0",
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Xem nhanh
              <ArrowUpRight className="h-3 w-3 opacity-60" />
            </button>
          </>
        )}
      </div>

      {/* ==== Nội dung ==== */}
      <CardContent className="relative z-0 flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <h3 className="line-clamp-2 min-h-[2.5em] text-[13px] font-medium leading-snug text-slate-700 transition-colors group-hover:text-slate-900 sm:text-sm">
          {product.name}
        </h3>

        {/* Key specs row — hiển thị tối đa 4 thông số quan trọng */}
        {keySpecs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {keySpecs.map(({ key, value }) => {
              const Icon = SPEC_ICONS[key as SpecKey];
              return (
                <Badge
                  key={key}
                  variant="secondary"
                  className={cn(
                    "inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5",
                    "border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-600",
                    "transition-colors group-hover:border-slate-300 group-hover:bg-slate-100",
                  )}
                >
                  {Icon && <Icon className="h-2.5 w-2.5 flex-shrink-0 opacity-70" />}
                  <span className="max-w-[70px] truncate" title={value}>
                    {shortenSpecValue(value, 14)}
                  </span>
                </Badge>
              );
            })}
          </div>
        )}

        {/* Giá */}
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-1.5">
          <span className="text-[15px] font-bold tracking-tight text-slate-900 sm:text-base">
            {product.price > 0 ? formatCurrency(product.price) : "Liên hệ"}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-xs text-slate-400 line-through sm:text-sm">
              {formatCurrency(product.originalPrice)}
            </span>
          )}
        </div>
      </CardContent>

      {/* ==== CTA footer ==== */}
      {!hideAddToCart && (
        <CardFooter className="relative z-0 p-3 pt-0 sm:p-4 sm:pt-0">
          {product.variantId ? (
            <Button
              size="sm"
              variant="default"
              disabled={product.inStock === false || product.stockQty === 0 || busy}
              onClick={handleAddToCart}
              aria-label={`Thêm ${product.name} vào giỏ hàng`}
              className={cn(
                "w-full rounded-xl text-xs font-semibold sm:text-sm",
                "shadow-sm hover:shadow-md",
              )}
            >
              <ShoppingCart
                className={cn(
                  "h-4 w-4 transition-transform duration-300",
                  !busy && "group-hover:scale-110",
                )}
              />
              <span className="truncate">
                {product.inStock === false || product.stockQty === 0
                  ? "Hết hàng"
                  : busy
                    ? "Đã thêm!"
                    : "Thêm vào giỏ"}
              </span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              asChild
              aria-label={`Chọn phiên bản ${product.name}`}
              className="w-full rounded-xl text-xs font-semibold sm:text-sm"
            >
              <Link href={`/products/${product.slug}`}>
                <span className="truncate">Chọn phiên bản</span>
                <ArrowUpRight className="ml-1 h-3.5 w-3.5 opacity-60" />
              </Link>
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
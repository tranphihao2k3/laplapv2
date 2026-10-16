"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Heart,
  ShieldCheck,
  Truck,
  RotateCcw,
  Phone,
  Cpu,
  CircuitBoard,
  HardDrive,
  Monitor,
  Tag,
  Zap,
  Sparkles,
  Check,
  Star,
  Eye,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn, formatCurrency } from "@/lib/utils";
import { InstallmentCalculator } from "./installment-calculator";
import { useAddToCart } from "@/components/client/cart/add-to-cart";
import type { ProductWithVariants } from "./types";
import { TRUST_BADGE_ICONS, type TrustBadge } from "@/lib/trust-badges";

type Props = {
  product: ProductWithVariants;
  consultPhone?: string | null;
};

const HIGHLIGHT_KEYS: { key: string; label: string; icon: typeof Cpu }[] = [
  { key: "cpu", label: "CPU", icon: Cpu },
  { key: "ram", label: "RAM", icon: CircuitBoard },
  { key: "storage", label: "Ổ cứng", icon: HardDrive },
  { key: "gpu", label: "Card đồ họa", icon: Cpu },
  { key: "display", label: "Màn hình", icon: Monitor },
];

/** Pseudo-random but stable per product id — gives every product a deterministic "rating" feel. */
function deriveMeta(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const rating = 4.5 + ((Math.abs(hash) % 5) / 10); // 4.5 — 4.9
  const sold = 50 + (Math.abs(hash) % 950); // 50 — 999
  const views = 800 + (Math.abs(hash * 7) % 9200); // 800 — 9999
  return { rating, sold, views };
}

export function ProductInfo({ product, consultPhone }: Props) {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [priceAnimated, setPriceAnimated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [trustBadges, setTrustBadges] = useState<TrustBadge[] | null>(null);
  const addToCart = useAddToCart();
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setPriceAnimated(true), 250);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetch("/api/public/trust-badges")
      .then((r) => r.json())
      .then((data: TrustBadge[]) => setTrustBadges(data))
      .catch(() => setTrustBadges(null));
  }, []);

  const phone = consultPhone?.trim() || null;
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;

  const variants = product.variants ?? [];
  const selectedVariant = variants[selectedVariantIdx] ?? null;
  const price = selectedVariant?.selling_price ?? product.price ?? 0;
  const originalPrice = selectedVariant?.cost_price ?? undefined;
  const hasDiscount = originalPrice && originalPrice > price;
  const discount = hasDiscount ? Math.round((1 - price / originalPrice) * 100) : 0;
  const savings = hasDiscount ? originalPrice - price : 0;
  const stockQty = selectedVariant?.stock_qty ?? 0;
  const inStock = stockQty > 0;
  const isLowStock = stockQty > 0 && stockQty <= 5;

  const specs = (selectedVariant?.specs ?? variants[0]?.specs) as Record<string, string> | null;
  const highlights = specs
    ? HIGHLIGHT_KEYS.filter((h) => specs[h.key]?.trim()).slice(0, 4)
    : [];

  const meta = useMemo(() => deriveMeta(product.id), [product.id]);
  // Stock urgency visual: progress 0–100% based on qty (cap at 50).
  const stockProgress = inStock ? Math.min(100, Math.round((stockQty / 50) * 100)) : 0;

  const handleAddToCart = () => {
    if (!selectedVariant || !inStock) return;
    const attrLabel = selectedVariant.attributes
      ? Object.values(selectedVariant.attributes).join(" / ")
      : (selectedVariant.name ?? "");
    addToCart({
      variantId: selectedVariant.id,
      productId: product.id,
      name: product.name,
      slug: product.slug ?? "",
      image: product.thumbnail_url,
      price: selectedVariant.selling_price ?? price,
      attributes: attrLabel,
      quantity,
      stockQty,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div ref={sectionRef} className="space-y-4 sm:space-y-5 md:space-y-6">
      {/* Top row: status badges */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 transition-all duration-700",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
        )}
      >
        {inStock ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full dot-pulse rounded-full bg-emerald-500" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Còn hàng
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Hết hàng
          </span>
        )}
        {/* Chỉ hiện 1 tag trên mobile để tránh wrap */}
        {product.tags?.slice(0, 1).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:hidden"
          >
            <Tag className="h-3 w-3" />
            {tag}
          </span>
        ))}
        {product.tags?.slice(0, 3).map((tag) => (
          <span
            key={`sm-${tag}`}
            className="hidden items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:inline-flex"
          >
            <Tag className="h-3 w-3" />
            {tag}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-foreground">{meta.rating.toFixed(1)}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{meta.sold}+</span> đã bán
          </span>
          <span className="hidden items-center gap-1 sm:inline-flex">
            <Eye className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{meta.views.toLocaleString("vi-VN")}</span>
          </span>
        </span>
      </div>

      {/* Name */}
      <div
        className={cn(
          "space-y-2 transition-all duration-700 delay-100",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
        )}
      >
        <h1 className="bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-[22px] font-bold leading-[1.2] tracking-tight text-transparent sm:text-[34px] sm:leading-[1.1]">
          {product.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground sm:gap-x-4 sm:text-sm">
          {product.brand && (
            <span className="inline-flex items-center gap-1">
              <span className="text-muted-foreground/70">Thương hiệu</span>
              <span className="font-semibold text-foreground">{product.brand.name}</span>
            </span>
          )}
          {selectedVariant?.sku && (
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <span className="text-muted-foreground/60">SKU:</span>
              <span className="font-mono text-xs font-medium text-foreground">{selectedVariant.sku}</span>
            </span>
          )}
        </div>
      </div>

      {/* Price */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-3.5 transition-all duration-700 delay-150 sm:p-5",
          hasDiscount
            ? "border-rose-200/80 bg-gradient-to-br from-rose-50/80 via-orange-50/50 to-amber-50/40 dark:from-rose-950/40 dark:via-orange-950/30 dark:to-amber-950/30"
            : "border-border bg-gradient-to-br from-muted/40 via-background to-muted/30",
        )}
      >
        {/* Subtle gradient sweep — ẩn trên mobile để giảm noise */}
        {hasDiscount && (
          <div className="pointer-events-none absolute inset-0 hidden sm:block">
            <div className="absolute -left-1/2 top-0 h-full w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-2xl" />
          </div>
        )}

        <div className="relative space-y-2.5 sm:space-y-3">
          {hasDiscount && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Desktop: full badge cluster. Mobile: chỉ GIẢM% badge, bỏ "Giá sốc" + "Tiết kiệm" để gọn */}
              <span className="hidden animate-pulse-soft items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-md sm:inline-flex">
                <Zap className="h-3 w-3" />
                Giá sốc
              </span>
              <span className="hidden items-center gap-1 rounded-full border border-amber-200 bg-amber-100/80 px-2.5 py-1 text-xs font-semibold text-amber-700 sm:inline-flex">
                <Sparkles className="h-3 w-3" />
                Tiết kiệm {formatCurrency(savings)}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 sm:gap-x-3">
            <span
              className={cn(
                "price-shine inline-block text-[28px] font-extrabold leading-none tracking-tight sm:text-[48px]",
                hasDiscount
                  ? "bg-gradient-to-br from-rose-600 via-red-600 to-orange-500 bg-clip-text text-transparent"
                  : "text-foreground",
                priceAnimated ? "animate-number-pop" : "opacity-0",
              )}
            >
              {formatCurrency(price)}
            </span>
            {hasDiscount && (
              <span className="text-base text-muted-foreground line-through decoration-rose-300 sm:text-2xl">
                {formatCurrency(originalPrice)}
              </span>
            )}
            {hasDiscount && (
              <span className="inline-flex items-baseline gap-0.5 rounded-md bg-gradient-to-r from-rose-500 to-orange-500 px-2 py-0.5 text-xs font-extrabold text-white sm:hidden">
                <span className="text-[9px]">−</span>
                <span>{discount}%</span>
              </span>
            )}
          </div>

          {hasDiscount && (
            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              <span className="inline-flex items-baseline gap-1 rounded-lg bg-gradient-to-r from-rose-500 via-red-500 to-rose-600 px-3.5 py-1.5 text-base font-extrabold text-white shadow-md sm:text-lg">
                <span className="text-xs">GIẢM</span>
                <span>{discount}%</span>
              </span>
              <span className="text-sm text-muted-foreground">so với giá gốc</span>
            </div>
          )}

          {/* Stock urgency bar */}
          {inStock && (
            <div className="space-y-1.5 rounded-lg border border-foreground/[0.06] bg-background/70 p-2.5 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  {isLowStock
                    ? `🔥 Chỉ còn ${stockQty} sản phẩm — sắp cháy hàng!`
                    : `Đã bán ${meta.sold}+ sản phẩm`}
                </span>
                <span className="font-semibold text-foreground">{stockQty} có sẵn</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-1000 ease-out",
                    isLowStock
                      ? "bg-gradient-to-r from-rose-500 to-orange-500"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500",
                  )}
                  style={{ width: mounted ? `${Math.max(stockProgress, 8)}%` : "0%" }}
                />
              </div>
            </div>
          )}

          {/* "Bạn tiết kiệm được" — chỉ hiện trên sm+ */}
          {hasDiscount && (
            <div className="hidden items-center gap-2 rounded-lg border border-rose-200/80 bg-rose-50/70 p-2.5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 sm:flex">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>
                Bạn tiết kiệm được{" "}
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(savings)}
                </span>{" "}
                ngay hôm nay!
              </span>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground sm:text-xs">Giá đã bao gồm VAT</p>
        </div>
      </div>

      {/* Short description */}
      {product.short_description && (
        <p
          className={cn(
            "text-[15px] leading-relaxed text-muted-foreground transition-all duration-700 delay-200",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
          )}
        >
          {product.short_description}
        </p>
      )}

      {/* Quick spec highlights — 2-col grid để text wrap tự nhiên trên mobile */}
      {highlights.length > 0 && (
        <div
          className={cn(
            "grid grid-cols-2 gap-2.5 transition-all duration-700 delay-300",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
          )}
        >
          {highlights.map((h, i) => {
            const Icon = h.icon;
            return (
              <div
                key={h.key}
                style={{ animationDelay: `${300 + i * 80}ms` }}
                className="group/highlight hover-lift flex min-w-0 items-start gap-2 rounded-xl border bg-card p-2.5 transition-all hover:border-primary/40 hover:shadow-sm sm:gap-2.5 sm:p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-fuchsia-500/10 text-primary transition-transform group-hover/highlight:scale-110 group-hover/highlight:rotate-3">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {h.label}
                  </p>
                  <p className="break-words text-[12.5px] font-semibold leading-snug sm:text-sm" title={specs?.[h.key]}>
                    {specs?.[h.key]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Variants */}
      {variants.length > 0 && (
        <div
          className={cn(
            "space-y-3 transition-all duration-700 delay-400",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
          )}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Phiên bản</h3>
            <span className="text-xs text-muted-foreground">{variants.length} tuỳ chọn</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {variants.map((v, idx) => {
              const attrLabel = v.attributes
                ? Object.values(v.attributes as Record<string, string>).join(" / ")
                : v.name ?? v.sku;
              const isActive = idx === selectedVariantIdx;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedVariantIdx(idx);
                    setQuantity(1);
                  }}
                  className={cn(
                    "hover-lift group/variant relative flex flex-col items-start overflow-hidden rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all sm:px-4",
                    isActive
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "bg-card text-foreground hover:border-primary/40",
                  )}
                >
                  {isActive && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground animate-scale-in">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                  <span
                    className={cn(
                      "font-semibold",
                      isActive ? "text-primary" : "text-foreground",
                    )}
                  >
                    {attrLabel || `Phiên bản ${idx + 1}`}
                  </span>
                  {v.selling_price != null && (
                    <span
                      className={cn(
                        "text-xs",
                        isActive ? "text-primary/80" : "text-muted-foreground",
                      )}
                    >
                      {formatCurrency(v.selling_price)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {price > 0 && <InstallmentCalculator price={price} />}

      <Separator />

      {/* Quantity + Add to cart */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 transition-all duration-700 delay-500",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
        )}
      >
        <div className="flex items-center overflow-hidden rounded-xl border bg-card">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3.5 py-2.5 text-lg text-muted-foreground transition-all hover:bg-muted active:scale-90"
            aria-label="Giảm số lượng"
          >
            −
          </button>
          <span className="min-w-[3rem] border-x px-4 py-2 text-center text-sm font-bold tabular-nums">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity((q) => Math.min(stockQty, q + 1))}
            disabled={quantity >= stockQty}
            className="px-3.5 py-2.5 text-lg text-muted-foreground transition-all hover:bg-muted active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Tăng số lượng"
          >
            +
          </button>
        </div>
        <Button
          size="lg"
          className={cn(
            "hidden min-w-[10rem] flex-1 rounded-xl text-base font-bold transition-all duration-300 lg:flex",
            added
              ? "bg-emerald-500 text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.6)]"
              : inStock
                ? "bg-gradient-to-r from-primary to-blue-600 text-white shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)] hover:shadow-[0_14px_40px_-8px_hsl(var(--primary)/0.7)] hover:from-primary hover:to-blue-500 animate-pulse-glow"
                : "",
          )}
          onClick={handleAddToCart}
          disabled={!inStock || added}
        >
          {added ? (
            <>
              <Check className="mr-2 h-5 w-5 animate-scale-in" strokeWidth={3} />
              Đã thêm vào giỏ!
            </>
          ) : (
            <>
              <ShoppingCart className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
              {inStock ? "Thêm vào giỏ" : "Hết hàng"}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setFavorited((v) => !v)}
          className={cn(
            "h-11 w-11 shrink-0 rounded-xl border transition-all",
            favorited && "border-rose-300 bg-rose-50 text-rose-600",
          )}
          aria-label="Yêu thích"
        >
          <Heart
            className={cn(
              "h-5 w-5 transition-all",
              favorited && "scale-110 fill-rose-500 text-rose-500",
            )}
          />
        </Button>
      </div>

      {/* Consult CTA */}
      {telHref && (
        <a
          href={telHref}
          className="group/cta flex items-center justify-center gap-2.5 rounded-xl border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-gradient-to-r hover:from-primary/5 hover:to-fuchsia-500/5 hover:shadow-md"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-transform group-hover/cta:scale-110">
            <Phone className="h-4 w-4" />
          </span>
          <span className="flex-1 text-left">
            <span className="block text-xs font-normal text-muted-foreground">Cần tư vấn?</span>
            <span>Gọi ngay {phone}</span>
          </span>
        </a>
      )}

      {/* Trust badges — 1 cột dọc trên mobile (tránh tràn ngang), grid 3 cột trên sm+ */}
      {trustBadges !== null && trustBadges.length > 0 ? (
        <div className="grid grid-cols-1 gap-1.5 rounded-xl border bg-muted/20 p-2.5 sm:grid-cols-3 sm:gap-2.5 sm:p-3">
          {trustBadges.filter((b) => b.enabled).map((badge) => {
            const Icon = TRUST_BADGE_ICONS[badge.icon] ?? ShieldCheck;
            return (
              <div
                key={badge.id}
                className="group/badge flex min-w-0 items-center gap-2 rounded-lg p-2 text-sm transition-colors hover:bg-card"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border transition-all group-hover/badge:text-primary group-hover/badge:ring-primary/30">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold sm:text-sm">{badge.title}</span>
                  {badge.description && (
                    <p className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">{badge.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 rounded-xl border bg-muted/20 p-2.5 sm:grid-cols-3 sm:gap-2.5 sm:p-3">
          <div className="group/badge flex min-w-0 items-center gap-2 rounded-lg p-2 text-sm transition-colors hover:bg-card">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border transition-all group-hover/badge:text-primary group-hover/badge:ring-primary/30">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="truncate text-[13px] font-semibold sm:text-sm">Bảo hành chính hãng</span>
          </div>
          <div className="group/badge flex min-w-0 items-center gap-2 rounded-lg p-2 text-sm transition-colors hover:bg-card">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border transition-all group-hover/badge:text-primary group-hover/badge:ring-primary/30">
              <Truck className="h-4 w-4" />
            </span>
            <span className="truncate text-[13px] font-semibold sm:text-sm">Miễn phí vận chuyển</span>
          </div>
          <div className="group/badge flex min-w-0 items-center gap-2 rounded-lg p-2 text-sm transition-colors hover:bg-card">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border transition-all group-hover/badge:text-primary group-hover/badge:ring-primary/30">
              <RotateCcw className="h-4 w-4" />
            </span>
            <span className="truncate text-[13px] font-semibold sm:text-sm">Đổi trả 15 ngày</span>
          </div>
        </div>
      )}

      {/* Sticky mobile bar — chỉ hiện <lg, là CTA duy nhất trên mobile */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur-lg lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="container flex items-center gap-2.5 px-4 py-2.5 sm:gap-3 sm:p-3">
          {/* Left: variant label + price (compact) */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              {selectedVariant?.name ||
                (selectedVariant?.attributes
                  ? Object.values(selectedVariant.attributes as Record<string, string>).join(" / ")
                  : "Mặc định")}
            </p>
            <p
              className={cn(
                "truncate text-[15px] font-extrabold leading-tight tracking-tight sm:text-lg",
                hasDiscount
                  ? "bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent"
                  : "text-foreground",
              )}
            >
              {formatCurrency(price)}
            </p>
          </div>
          {telHref && (
            <a
              href={telHref}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground transition-all active:scale-95 sm:flex"
              aria-label="Gọi tư vấn"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          <Button
            size="lg"
            className={cn(
              "h-11 shrink-0 rounded-xl px-5 text-sm font-bold sm:flex-1 sm:px-6 sm:text-base",
              added
                ? "bg-emerald-500 text-white"
                : "bg-gradient-to-r from-primary to-blue-600 text-white",
            )}
            onClick={handleAddToCart}
            disabled={!inStock || added}
          >
            {added ? (
              <>
                <Check className="mr-1.5 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" strokeWidth={3} />
                Đã thêm
              </>
            ) : (
              <>
                <ShoppingCart className="mr-1.5 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" />
                Thêm vào giỏ
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

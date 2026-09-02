"use client";

import { useState, useEffect, useRef } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { InstallmentCalculator } from "./installment-calculator";
import { useAddToCart } from "@/components/client/cart/add-to-cart";
import type { ProductWithVariants } from "./types";
import {
  TRUST_BADGE_ICONS,
  type TrustBadge,
} from "@/lib/trust-badges";

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

export function ProductInfo({ product, consultPhone }: Props) {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [priceAnimated, setPriceAnimated] = useState(false);
  const addToCart = useAddToCart();
  const priceRef = useRef<HTMLDivElement>(null);
  const [trustBadges, setTrustBadges] = useState<TrustBadge[] | null>(null);

  // Fetch trust badges from settings API
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

  const specs = (selectedVariant?.specs ?? variants[0]?.specs) as Record<string, string> | null;
  const highlights = specs
    ? HIGHLIGHT_KEYS.filter((h) => specs[h.key]?.trim()).slice(0, 4)
    : [];

  // Animate price on load when there's a discount
  useEffect(() => {
    if (hasDiscount && !priceAnimated) {
      const timer = setTimeout(() => setPriceAnimated(true), 100);
      return () => clearTimeout(timer);
    }
  }, [hasDiscount, priceAnimated]);

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
    // Show "Đã thêm!" feedback for 1.5 seconds
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Tags + stock status */}
      <div className="flex flex-wrap items-center gap-2">
        {inStock ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Còn {stockQty} sản phẩm
          </span>
        ) : (
          <Badge variant="secondary">Hết hàng</Badge>
        )}
        {product.tags?.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500"
          >
            <Tag className="h-3 w-3" />
            {tag}
          </span>
        ))}
      </div>

      {/* Name */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-[32px] sm:leading-[1.15]">
          {product.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          {product.brand && (
            <span>
              Thương hiệu: <span className="font-medium text-slate-800">{product.brand.name}</span>
            </span>
          )}
          {selectedVariant?.sku && (
            <span>
              SKU: <span className="font-medium text-slate-800">{selectedVariant.sku}</span>
            </span>
          )}
        </div>
      </div>

      {/* Price - Enhanced for sale/discount */}
      <div
        ref={priceRef}
        className={`rounded-2xl border p-4 sm:p-5 transition-all duration-500 ${
          hasDiscount
            ? "border-red-200 bg-gradient-to-br from-red-50/80 via-orange-50/50 to-amber-50/30 shadow-lg shadow-red-100/50"
            : "border-slate-200/80 bg-slate-50/70"
        }`}
      >
        {hasDiscount ? (
          <div className="space-y-3">
            {/* Urgency badge row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-red-200 animate-pulse">
                <Zap className="h-3 w-3" />
                Giá sốc!
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <Sparkles className="h-3 w-3" />
                Tiết kiệm {formatCurrency(savings)}
              </span>
            </div>

            {/* Price display with animation */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className={`text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-500 sm:text-[44px] ${
                  priceAnimated
                    ? "animate-in slide-in-from-bottom-2 fade-in duration-500"
                    : "opacity-0"
                }`}
              >
                {formatCurrency(price)}
              </span>
              <span className="text-xl text-slate-400 line-through sm:text-2xl">
                {formatCurrency(originalPrice)}
              </span>
            </div>

            {/* Large discount badge */}
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-gradient-to-r from-red-500 to-rose-500 px-4 py-2 text-lg font-extrabold text-white shadow-lg shadow-red-200/50 sm:text-xl">
                -{discount}%
              </span>
              <span className="text-sm text-slate-500">
                So với giá gốc
              </span>
            </div>

            {/* Savings highlight */}
            <div className="rounded-lg bg-white/70 backdrop-blur-sm border border-red-100 p-2.5">
              <p className="text-sm text-red-600 font-medium">
                🎉 Bạn tiết kiệm được <span className="text-base font-bold">{formatCurrency(savings)}</span> ngay hôm nay!
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[40px]">
              {formatCurrency(price)}
            </span>
          </div>
        )}
        <p className="mt-1.5 text-xs text-slate-400">Giá đã bao gồm VAT</p>
      </div>

      {/* Short description */}
      {product.short_description && (
        <p className="text-[15px] leading-relaxed text-slate-600">{product.short_description}</p>
      )}

      {/* Quick spec highlights */}
      {highlights.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {highlights.map((h) => {
            const Icon = h.icon;
            return (
              <div
                key={h.key}
                className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{h.label}</p>
                  <p className="truncate text-sm font-medium text-slate-800" title={specs?.[h.key]}>
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
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Phiên bản</h3>
          <div className="flex flex-wrap gap-2">
            {variants.map((v, idx) => {
              const attrLabel = v.attributes
                ? Object.values(v.attributes as Record<string, string>).join(" / ")
                : v.name ?? v.sku;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedVariantIdx(idx);
                    setQuantity(1);
                  }}
                  className={`flex flex-col items-start rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all sm:px-4 ${
                    idx === selectedVariantIdx
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <span className="font-medium">{attrLabel || `Phiên bản ${idx + 1}`}</span>
                  {v.selling_price != null && (
                    <span
                      className={
                        idx === selectedVariantIdx ? "text-xs text-white/60" : "text-xs text-slate-400"
                      }
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

      {/* Trả góp — mở hộp thoại tính số tiền mỗi tháng */}
      {price > 0 && <InstallmentCalculator price={price} />}

      <Separator />

      {/* Quantity + Add to cart */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl border border-slate-200">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3.5 py-2.5 text-lg text-slate-600 transition-colors hover:bg-slate-50"
            aria-label="Giảm số lượng"
          >
            −
          </button>
          <span className="min-w-[3rem] px-4 py-2 text-center text-sm font-semibold text-slate-900">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity((q) => Math.min(stockQty, q + 1))}
            disabled={quantity >= stockQty}
            className="px-3.5 py-2.5 text-lg text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Tăng số lượng"
          >
            +
          </button>
        </div>
        {stockQty > 0 && stockQty <= 5 && (
          <span className="text-xs text-orange-500 font-medium">
            Chỉ còn {stockQty} sản phẩm
          </span>
        )}
        <Button size="lg" className="min-w-[10rem] flex-1 rounded-xl" onClick={handleAddToCart} disabled={!inStock || added}>
          <ShoppingCart className="mr-2 h-5 w-5" />
          {added ? "Đã thêm!" : "Thêm vào giỏ"}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl border-slate-200"
          aria-label="Yêu thích"
        >
          <Heart className="h-5 w-5" />
        </Button>
      </div>

      {/* Consult CTA */}
      {telHref && (
        <a
          href={telHref}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-900 hover:bg-slate-50"
        >
          <Phone className="h-4 w-4" />
          Cần tư vấn? Gọi ngay {phone}
        </a>
      )}

      {/* Trust badges — dynamic from store settings */}
      {trustBadges !== null && trustBadges.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 sm:grid-cols-3">
          {trustBadges
            .filter((b) => b.enabled)
            .map((badge) => {
              const Icon = TRUST_BADGE_ICONS[badge.icon] ?? ShieldCheck;
              return (
                <div key={badge.id} className="flex items-start gap-2.5 text-sm">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 flex-shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <span className="text-slate-700 font-medium">{badge.title}</span>
                    {badge.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{badge.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        /* Fallback: default hardcoded badges while loading or if no settings */
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 sm:grid-cols-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="text-slate-600">Bảo hành chính hãng</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="text-slate-600">Miễn phí vận chuyển</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <RotateCcw className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="text-slate-600">Đổi trả 15 ngày</span>
          </div>
        </div>
      )}

      {/* Thanh mua co dinh duoi man hinh - CHI hien tren mobile (< lg).
          Nhieu noi dung ben duoi nen luon giu gia + nut mua trong tam mat. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden">
        <div className="container flex items-center gap-3">
          <div className="min-w-0 shrink">
            <p className={`truncate font-semibold leading-tight tracking-tight ${hasDiscount ? "text-red-600 text-lg" : "text-slate-900 text-lg"}`}>
              {formatCurrency(price)}
            </p>
            {hasDiscount && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs leading-tight text-slate-400 line-through">
                  {formatCurrency(originalPrice)}
                </span>
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  -{discount}%
                </span>
              </div>
            )}
          </div>
          {telHref && (
            <a
              href={telHref}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
              aria-label="Goi tu van"
            >
              <Phone className="h-5 w-5" />
            </a>
          )}
          <Button size="lg" className="flex-1 rounded-xl" onClick={handleAddToCart} disabled={!inStock || added}>
            <ShoppingCart className="mr-2 h-5 w-5" />
            {added ? "Đã thêm!" : "Thêm vào giỏ"}
          </Button>
        </div>
      </div>
    </div>
  );
}

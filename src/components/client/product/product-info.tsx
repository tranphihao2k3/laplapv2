"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { InstallmentCalculator } from "./installment-calculator";
import type { ProductWithVariants } from "./types";

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

  const phone = consultPhone?.trim() || null;
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;

  const variants = product.variants ?? [];
  const selectedVariant = variants[selectedVariantIdx] ?? null;
  const price = selectedVariant?.selling_price ?? product.price ?? 0;
  const originalPrice = selectedVariant?.cost_price ?? undefined;
  const discount =
    originalPrice && originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;
  const inStock = variants.length > 0;

  const specs = (selectedVariant?.specs ?? variants[0]?.specs) as Record<string, string> | null;
  const highlights = specs
    ? HIGHLIGHT_KEYS.filter((h) => specs[h.key]?.trim()).slice(0, 4)
    : [];

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
            Còn hàng
          </span>
        ) : (
          <Badge variant="secondary">Liên hệ</Badge>
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

      {/* Price */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[40px]">
            {formatCurrency(price)}
          </span>
          {originalPrice && originalPrice > price && (
            <span className="text-lg text-slate-400 line-through">{formatCurrency(originalPrice)}</span>
          )}
          {discount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-sm font-semibold text-white">
              -{discount}%
            </span>
          )}
        </div>
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
                  onClick={() => setSelectedVariantIdx(idx)}
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
            onClick={() => setQuantity((q) => q + 1)}
            className="px-3.5 py-2.5 text-lg text-slate-600 transition-colors hover:bg-slate-50"
            aria-label="Tăng số lượng"
          >
            +
          </button>
        </div>
        <Button size="lg" className="min-w-[10rem] flex-1 rounded-xl">
          <ShoppingCart className="mr-2 h-5 w-5" />
          Thêm vào giỏ
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

      {/* Trust badges */}
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

      {/* Thanh mua co dinh duoi man hinh - CHI hien tren mobile (< lg).
          Nhieu noi dung ben duoi nen luon giu gia + nut mua trong tam mat. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden">
        <div className="container flex items-center gap-3">
          <div className="min-w-0 shrink">
            <p className="truncate text-lg font-semibold leading-tight tracking-tight text-slate-900">
              {formatCurrency(price)}
            </p>
            {discount > 0 && originalPrice && (
              <p className="text-xs leading-tight text-slate-400 line-through">
                {formatCurrency(originalPrice)}
              </p>
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
          <Button size="lg" className="flex-1 rounded-xl">
            <ShoppingCart className="mr-2 h-5 w-5" />
            Thêm vào giỏ
          </Button>
        </div>
      </div>
    </div>
  );
}

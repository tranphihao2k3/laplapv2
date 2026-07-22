"use client";

import { useState } from "react";
import {
  ShoppingCart,
  Heart,
  ShieldCheck,
  Truck,
  RotateCcw,
  CheckCircle2,
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
import type { ProductWithVariants } from "./types";

type Props = {
  product: ProductWithVariants;
};

const HIGHLIGHT_KEYS: { key: string; label: string; icon: typeof Cpu }[] = [
  { key: "cpu", label: "CPU", icon: Cpu },
  { key: "ram", label: "RAM", icon: CircuitBoard },
  { key: "storage", label: "Ổ cứng", icon: HardDrive },
  { key: "gpu", label: "Card đồ họa", icon: Cpu },
  { key: "display", label: "Màn hình", icon: Monitor },
];

export function ProductInfo({ product }: Props) {
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);

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
    <div className="space-y-4 sm:space-y-5">
      {/* Tags + stock status */}
      <div className="flex flex-wrap items-center gap-2">
        {inStock ? (
          <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Còn hàng
          </Badge>
        ) : (
          <Badge variant="secondary">Liên hệ</Badge>
        )}
        {product.tags?.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="outline" className="gap-1">
            <Tag className="h-3 w-3" />
            {tag}
          </Badge>
        ))}
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {product.brand && (
            <span>
              Thương hiệu: <span className="font-medium text-foreground">{product.brand.name}</span>
            </span>
          )}
          {selectedVariant?.sku && (
            <span>
              SKU: <span className="font-medium text-foreground">{selectedVariant.sku}</span>
            </span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="rounded-xl border bg-muted/30 p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-bold text-primary sm:text-4xl">{formatCurrency(price)}</span>
          {originalPrice && originalPrice > price && (
            <span className="text-lg text-muted-foreground line-through">{formatCurrency(originalPrice)}</span>
          )}
          {discount > 0 && (
            <Badge variant="destructive" className="text-sm">
              -{discount}%
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Giá đã bao gồm VAT</p>
      </div>

      {/* Short description */}
      {product.short_description && (
        <p className="leading-relaxed text-muted-foreground">{product.short_description}</p>
      )}

      {/* Quick spec highlights */}
      {highlights.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {highlights.map((h) => {
            const Icon = h.icon;
            return (
              <div key={h.key} className="flex items-start gap-2 rounded-lg border bg-card/50 p-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{h.label}</p>
                  <p className="truncate text-sm font-medium" title={specs?.[h.key]}>
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
          <h3 className="text-sm font-semibold">Phiên bản:</h3>
          <div className="flex flex-wrap gap-2">
            {variants.map((v, idx) => {
              const attrLabel = v.attributes
                ? Object.values(v.attributes as Record<string, string>).join(" / ")
                : v.name ?? v.sku;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariantIdx(idx)}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition-all sm:px-4 ${
                    idx === selectedVariantIdx
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input hover:border-muted-foreground/40"
                  }`}
                >
                  <span className="font-medium">{attrLabel || `Phiên bản ${idx + 1}`}</span>
                  {v.selling_price != null && (
                    <span className="text-xs text-muted-foreground">{formatCurrency(v.selling_price)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Separator />

      {/* Quantity + Add to cart */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3 py-2.5 text-lg transition-colors hover:bg-muted"
            aria-label="Giảm số lượng"
          >
            −
          </button>
          <span className="min-w-[3rem] px-4 py-2 text-center text-sm font-medium">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="px-3 py-2.5 text-lg transition-colors hover:bg-muted"
            aria-label="Tăng số lượng"
          >
            +
          </button>
        </div>
        <Button size="lg" className="min-w-[10rem] flex-1">
          <ShoppingCart className="mr-2 h-5 w-5" />
          Thêm vào giỏ
        </Button>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Yêu thích">
          <Heart className="h-5 w-5" />
        </Button>
      </div>

      {/* Consult CTA */}
      <a
        href="tel:0900000000"
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <Phone className="h-4 w-4" />
        Cần tư vấn? Gọi ngay 0900 000 000
      </a>

      {/* Trust badges */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card/50 p-3 sm:grid-cols-3 sm:p-4">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">Bảo hành chính hãng</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Truck className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">Miễn phí vận chuyển</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <RotateCcw className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">Đổi trả 15 ngày</span>
        </div>
      </div>

      {/* Thanh mua co dinh duoi man hinh - CHI hien tren mobile (< lg).
          Nhieu noi dung ben duoi nen luon giu gia + nut mua trong tam mat. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
        <div className="container flex items-center gap-3">
          <div className="min-w-0 shrink">
            <p className="truncate text-lg font-bold leading-tight text-primary">{formatCurrency(price)}</p>
            {discount > 0 && originalPrice && (
              <p className="text-xs text-muted-foreground line-through leading-tight">
                {formatCurrency(originalPrice)}
              </p>
            )}
          </div>
          <a
            href="tel:0900000000"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-primary"
            aria-label="Goi tu van"
          >
            <Phone className="h-5 w-5" />
          </a>
          <Button size="lg" className="flex-1">
            <ShoppingCart className="mr-2 h-5 w-5" />
            Thêm vào giỏ
          </Button>
        </div>
      </div>
    </div>
  );
}

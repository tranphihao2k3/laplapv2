"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore, type CartItem } from "@/stores/cart-store";

type AddToCartOptions = {
  variantId: string;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  price: number;
  attributes: string;
  quantity?: number;
  /** Số tồn kho — dùng để giới hạn không vượt quá. Mặc định 0 (không giới hạn). */
  stockQty?: number;
};

/**
 * Custom animated cart icon — bounce khi vừa thêm sản phẩm.
 * Dùng CSS keyframes bounce-cart.
 */
function CartBounceIcon({ className }: { className?: string }) {
  return (
    <span className="relative inline-flex" aria-hidden>
      <ShoppingCart className={`h-4 w-4 ${className ?? ""}`} />
      <span className="absolute -right-1 -top-1 flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
    </span>
  );
}

/** Hook trả về hàm thêm vào giỏ — dùng chung cho cả card lẫn detail page. */
export function useAddToCart() {
  const addItem = useCartStore((s) => s.addItem);

  return useCallback(
    (opts: AddToCartOptions) => {
      addItem(opts);
      toast.success(
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <ShoppingCart className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold">Đã thêm vào giỏ hàng</p>
            <p className="text-xs opacity-80">{opts.name}</p>
          </div>
        </div>,
        {
          action: {
            label: "Xem giỏ",
            onClick: () => (window.location.href = "/cart"),
          },
          duration: 3000,
        },
      );
    },
    [addItem],
  );
}

/** Wrapper button cho ProductCardV2 — kết nối cart store + toast. */
type CardAddButtonProps = {
  variantId: string;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  price: number;
  attributes?: string;
  /** Số tồn kho — dùng để giới hạn không vượt quá. */
  stockQty?: number;
  disabled?: boolean;
  className?: string;
};

export function CardAddToCart({
  variantId,
  productId,
  name,
  slug,
  image,
  price,
  attributes = "",
  stockQty,
  disabled,
  className,
}: CardAddButtonProps) {
  const addToCart = useAddToCart();

  return (
    <Button
      size="sm"
      variant="default"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart({ variantId, productId, name, slug, image, price, attributes, stockQty });
      }}
      className={className}
      aria-label={`Thêm ${name} vào giỏ hàng`}
    >
      <ShoppingCart className="h-4 w-4" />
      <span className="truncate">Thêm vào giỏ</span>
    </Button>
  );
}

/** Chuyển CartItem → options cho addToCart (dùng khi "mua lại"). */
export function cartItemToOptions(item: CartItem): AddToCartOptions {
  return {
    variantId: item.variantId,
    productId: item.productId,
    name: item.name,
    slug: item.slug,
    image: item.image,
    price: item.price,
    attributes: item.attributes,
    quantity: item.quantity,
    stockQty: item.stockQty,
  };
}

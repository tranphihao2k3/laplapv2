"use client";

/**
 * CartBadge — chỉ render số sản phẩm trong giỏ sau khi mount ở client.
 *
 * Tránh hydration mismatch vì cartCount đến từ localStorage (persist store).
 * Server render: null. Client first render: null. Client after useEffect: badge với count.
 *
 * Tách thành file riêng để tăng tính độc lập + dễ test.
 */
import { useEffect, useState } from "react";
import { useCartStore } from "@/stores/cart-store";
import { cn } from "@/lib/utils";

export function CartBadge() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cartCount = useCartStore((s) => s.totalItems());

  if (!mounted) return null;
  if (cartCount <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center",
        "rounded-full border-2 border-background bg-primary px-1 text-[10px] font-bold text-primary-foreground",
        "tabular-nums",
      )}
      aria-label={`${cartCount} sản phẩm trong giỏ`}
    >
      {cartCount > 9 ? "9+" : cartCount}
    </span>
  );
}

/**
 * Cart store — dùng Zustand với localStorage persistence.
 * Dùng chung cho cả guest (không login) lẫn logged-in user.
 *
 * Schema item:
 *   CartItem {
 *     variantId       — product_variants.id
 *     productId      — products.id
 *     name           — tên sản phẩm hiển thị
 *     slug           — dùng link đến trang sản phẩm
 *     image          — ảnh thumbnail
 *     price          — giá bán tại thời điểm thêm (number, VND)
 *     quantity       — số lượng (int ≥ 1)
 *     attributes     — label biến thể, VD "16GB / 512GB / Đen"
 *   }
 * 
 * Voucher:
 *   AppliedVoucher {
 *     id             — vouchers.id
 *     code           — mã voucher
 *     name           — tên voucher
 *     type           — 'percent' | 'fixed_amount' | 'free_shipping'
 *     value          — giá trị giảm (%)
 *     discount_amount— số tiền được giảm (calculated)
 *     max_discount_amount — giới hạn giảm tối đa (nullable)
 *   }
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppliedVoucher } from "@/types/voucher";

export type CartItem = {
  variantId: string;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  price: number;
  quantity: number;
  /** Số lượng tồn kho tại thời điểm load giỏ hàng. */
  stockQty: number;
  attributes: string;
};

export type CartStore = {
  items: CartItem[];
  hydrated: boolean;
  /** Trigger animation on cart icon (timestamp) */
  cartBounceAt: number | null;
  /** Voucher đang được áp dụng */
  appliedVoucher: AppliedVoucher | null;
  /** Thêm sản phẩm (tăng quantity nếu trùng variantId, không vượt quá stockQty). */
  addItem: (item: Omit<CartItem, "quantity" | "stockQty"> & { quantity?: number; stockQty?: number }) => void;
  /** Xoá toàn bộ variant khỏi giỏ. */
  removeItem: (variantId: string) => void;
  /** Cập nhật số lượng (quantity < 1 → xoá, không vượt quá stockQty). */
  setQuantity: (variantId: string, quantity: number) => void;
  /** Xoá hết giỏ hàng. */
  clearCart: () => void;
  /** Tổng số item (tổng quantity). */
  totalItems: () => number;
  /** Tổng tiền (sum price × quantity). */
  subtotal: () => number;
  /** Sync số tồn kho từ server cho các variant trong giỏ. */
  syncStock: (stockByVariant: Record<string, number>) => void;
  markHydrated: () => void;
  /** Áp dụng voucher */
  applyVoucher: (voucher: AppliedVoucher) => void;
  /** Xoá voucher đang áp dụng */
  removeVoucher: () => void;
  /** Tính số tiền được giảm sau voucher */
  discountAmount: () => number;
  /** Tính tổng tiền sau khi áp dụng voucher */
  totalAfterDiscount: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      cartBounceAt: null,
      appliedVoucher: null,

      addItem: (incoming) => {
        set((state) => {
          const qty = incoming.quantity ?? 1;
          const stockQty = incoming.stockQty ?? 0;
          const existing = state.items.find((i) => i.variantId === incoming.variantId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === incoming.variantId
                  ? { ...i, quantity: Math.min(i.quantity + qty, i.stockQty) }
                  : i,
              ),
              // Trigger bounce animation
              cartBounceAt: Date.now(),
            };
          }
          return { 
            items: [...state.items, { ...incoming, quantity: qty, stockQty }],
            // Trigger bounce animation for new items
            cartBounceAt: Date.now(),
          };
        });
      },

      removeItem: (variantId) =>
        set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),

      setQuantity: (variantId, quantity) => {
        if (quantity < 1) {
          get().removeItem(variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity: Math.min(quantity, i.stockQty) } : i,
          ),
        }));
      },

      clearCart: () => set({ items: [], appliedVoucher: null }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      syncStock: (stockByVariant) => {
        set((state) => ({
          items: state.items.map((i) => ({
            ...i,
            stockQty: stockByVariant[i.variantId] ?? 0,
            // Cap quantity về stock nếu đang vượt.
            quantity: Math.min(i.quantity, stockByVariant[i.variantId] ?? 0),
          })),
        }));
      },

      markHydrated: () => set({ hydrated: true }),

      applyVoucher: (voucher) => set({ appliedVoucher: voucher }),

      removeVoucher: () => set({ appliedVoucher: null }),

      discountAmount: () => {
        const state = get();
        if (!state.appliedVoucher) return 0;
        
        const subtotal = state.subtotal();
        const voucher = state.appliedVoucher;
        
        switch (voucher.type) {
          case "percent": {
            let discount = Math.round(subtotal * voucher.value / 100);
            if (voucher.max_discount_amount !== null) {
              discount = Math.min(discount, voucher.max_discount_amount);
            }
            return discount;
          }
          case "fixed_amount":
            return Math.min(voucher.value, subtotal);
          case "free_shipping":
            return 0; // Free shipping handled separately
          default:
            return 0;
        }
      },

      totalAfterDiscount: () => {
        const state = get();
        return Math.max(0, state.subtotal() - state.discountAmount());
      },
    }),
    {
      name: "laplap-cart-v1",     // key trong localStorage
      partialize: (s) => ({ items: s.items, appliedVoucher: s.appliedVoucher }), // chỉ persist items & voucher, not animation trigger
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

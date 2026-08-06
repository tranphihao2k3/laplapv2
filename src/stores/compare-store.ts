import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MAX_COMPARE } from "@/lib/compare/fetch-products";

/** Thông tin tối thiểu để vẽ thanh nổi mà không cần gọi API. */
export type CompareItem = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  price: number;
};

interface CompareState {
  items: CompareItem[];
  /**
   * false cho tới khi đọc xong localStorage.
   *
   * BẮT BUỘC phải có: store này render trên trang public được SSR — server thấy
   * items rỗng, client đọc localStorage thấy 3 máy → hydration mismatch, React
   * huỷ cả cây và re-render. Mọi component đọc store phải chờ cờ này.
   */
  hydrated: boolean;
  /** true nếu đã đạt giới hạn MAX_COMPARE. */
  isFull: () => boolean;
  has: (id: string) => boolean;
  /** Thêm máy. Trả false nếu đã đầy (caller hiện toast). */
  add: (item: CompareItem) => boolean;
  remove: (id: string) => void;
  /** Thêm nếu chưa có, bỏ nếu đã có. Trả false khi bị chặn vì đã đầy. */
  toggle: (item: CompareItem) => boolean;
  clear: () => void;
  /** Ghi đè toàn bộ — dùng khi trang /so-sanh đồng bộ từ URL. */
  setItems: (items: CompareItem[]) => void;
  markHydrated: () => void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,

      isFull: () => get().items.length >= MAX_COMPARE,
      has: (id) => get().items.some((i) => i.id === id),

      add: (item) => {
        const { items } = get();
        if (items.some((i) => i.id === item.id)) return true;
        if (items.length >= MAX_COMPARE) return false;
        set({ items: [...items, item] });
        return true;
      },

      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),

      toggle: (item) => {
        const { items } = get();
        if (items.some((i) => i.id === item.id)) {
          set({ items: items.filter((i) => i.id !== item.id) });
          return true;
        }
        if (items.length >= MAX_COMPARE) return false;
        set({ items: [...items, item] });
        return true;
      },

      clear: () => set({ items: [] }),
      setItems: (items) => set({ items: items.slice(0, MAX_COMPARE) }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "laplap-compare",
      // Chỉ lưu items — cờ hydrated phải luôn bắt đầu từ false ở mỗi lần tải trang.
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

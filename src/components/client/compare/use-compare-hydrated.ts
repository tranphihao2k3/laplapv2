"use client";

import { useEffect, useState } from "react";
import { useCompareStore } from "@/stores/compare-store";

/**
 * true khi store so sánh đã đọc xong localStorage → an toàn để render.
 *
 * Vì sao cần: các component đọc store nằm trên trang public được SSR. Server
 * render với items rỗng, client lại có sẵn dữ liệu trong localStorage → nếu
 * render ngay sẽ lệch HTML và React huỷ cả cây (hydration mismatch).
 *
 * Không tin mỗi cờ trong store: khi localStorage RỖNG, một số phiên bản zustand
 * không gọi onRehydrateStorage nên cờ mãi là false. Vì vậy kết hợp thêm
 * persist.hasHydrated() và một lần set ở effect (effect chỉ chạy ở client,
 * nên vẫn đảm bảo lần render đầu khớp server).
 */
export function useCompareHydrated(): boolean {
  const hydrated = useCompareStore((s) => s.hydrated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!useCompareStore.persist.hasHydrated()) return;
    if (!useCompareStore.getState().hydrated) {
      useCompareStore.getState().markHydrated();
    }
  }, []);

  return mounted && (hydrated || useCompareStore.persist.hasHydrated());
}

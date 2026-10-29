"use client";

import { useMemo } from "react";
import { useStoreSettings } from "@/components/client/layout/use-store-settings";

/**
 * Hook lấy brand name từ store settings, ưu tiên:
 *   1. Settings từ DB (đã cache localStorage trong useStoreSettings)
 *   2. Fallback cuối cùng: "Laptop Thành Võ"
 *
 * Đây là entry point duy nhất mọi client component nên dùng để hiển thị
 * tên thương hiệu. KHÔNG hard-code "Laptop Thành Võ" trong component.
 * 
 * ⚠️ fetchOnMount: true để tự động load khi mount lần đầu
 */
export function useBrandName(): string {
  const { settings } = useStoreSettings({ fetchOnMount: true });
  return useMemo(() => {
    const v = settings?.name?.trim();
    return v && v.length > 0 ? v : "Laptop Thành Võ";
  }, [settings?.name]);
}

/**
 * Hook lấy thông tin liên hệ từ store settings.
 * Trả về { email, phone, hotline, address } với fallback an toàn.
 */
export function useBrandContact() {
  const { settings } = useStoreSettings({ fetchOnMount: true });
  return useMemo(() => {
    return {
      email: settings?.email?.trim() || "info@laplap.vn",
      phone: settings?.phone?.trim() || "1900 1234",
      hotline: settings?.hotline?.trim() || settings?.phone?.trim() || "1900 1234",
      address: settings?.address?.trim() || "Cần Thơ",
    };
  }, [settings]);
}

/**
 * Hook lấy toàn bộ store settings (nếu component cần nhiều field).
 * Trả về { settings, isLoading, refresh } — wrapper gọn.
 */
export function useBrand() {
  const { settings, isLoading, refresh, clearCache } = useStoreSettings({
    fetchOnMount: true,
  });
  return { settings, isLoading, refresh, clearCache };
}

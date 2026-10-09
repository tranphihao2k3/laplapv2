"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { ProductFilterValue } from "./products-filters";
import { EMPTY_FILTER } from "./products-filters";

/**
 * Đồng bộ filter state với URL search params (?search=...&status=...).
 * - Ưu tiên URL làm nguồn truth (URL có thể share / bookmark).
 * - Khi mount, đọc URL một lần để khởi tạo state ban đầu.
 * - Khi filter thay đổi, ghi vào URL bằng history.replaceState (không push history, không scroll top).
 */
export function useUrlFilters(): {
  filters: ProductFilterValue;
  setFilters: (next: ProductFilterValue) => void;
  ready: boolean;
} {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [filters, setFiltersState] = useState<ProductFilterValue>(EMPTY_FILTER);

  // Hydrate from URL on mount
  useEffect(() => {
    const next: ProductFilterValue = {
      search: sp.get("search") ?? "",
      status: (sp.get("status") as ProductFilterValue["status"]) || "",
      brandId: sp.get("brand_id") ?? "",
      categoryId: sp.get("category_id") ?? "",
      sort: (sp.get("sort") as ProductFilterValue["sort"]) || "created_at:desc",
    };
    setFiltersState(next);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFilters = (next: ProductFilterValue) => {
    setFiltersState(next);
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status) params.set("status", next.status);
    if (next.brandId) params.set("brand_id", next.brandId);
    if (next.categoryId) params.set("category_id", next.categoryId);
    if (next.sort && next.sort !== "created_at:desc") params.set("sort", next.sort);
    const qs = params.toString();
    // replaceState thay vì router.push để không spam lịch sử + không scroll
    const url = qs ? `${pathname}?${qs}` : pathname;
    window.history.replaceState(null, "", url);
  };

  return { filters, setFilters, ready };
}

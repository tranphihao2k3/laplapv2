"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { parseProductKind, type ProductKind } from "@/lib/product-kind";
import {
  DEFAULT_QUERY,
  type ProductFilters,
  type ProductListResponse,
  type ProductQuery,
  type SortValue,
} from "./types";

const SORTS: SortValue[] = ["newest", "price_asc", "price_desc", "name_asc"];

function parseQuery(sp: URLSearchParams): ProductQuery {
  const sortParam = sp.get("sort");
  const rawMinPrice = sp.get("minPrice") ?? sp.get("price_min") ?? "";
  const rawMaxPrice = sp.get("maxPrice") ?? sp.get("price_max") ?? "";

  return {
    kind: parseProductKind(sp.get("kind")) ?? "laptop",
    q: sp.get("q") ?? "",
    brand: sp.get("brand") ?? "",
    category: sp.get("category") ?? "",
    tag: sp.get("tag") ?? "",
    priceBucket: sp.get("priceBucket") ?? "",
    minPrice: Number(rawMinPrice) || 0,
    maxPrice: Number(rawMaxPrice) || 0,
    ram: sp.get("ram") ?? "",
    cpu: sp.get("cpu") ?? "",
    storage: sp.get("storage") ?? "",
    sort: SORTS.includes(sortParam as SortValue) ? (sortParam as SortValue) : "newest",
    page: Math.max(1, Number(sp.get("page")) || 1),
  };
}

function toSearchString(q: ProductQuery): string {
  const sp = new URLSearchParams();
  // kind mặc định là "laptop" → chỉ ghi vào URL khi khác laptop để URL gọn.
  if (q.kind && q.kind !== "laptop") sp.set("kind", q.kind);
  if (q.q) sp.set("q", q.q);
  if (q.brand) sp.set("brand", q.brand);
  if (q.category) sp.set("category", q.category);
  if (q.tag) sp.set("tag", q.tag);
  if (q.priceBucket) sp.set("priceBucket", q.priceBucket);
  if (q.minPrice > 0) sp.set("minPrice", String(q.minPrice));
  if (q.maxPrice > 0) sp.set("maxPrice", String(q.maxPrice));
  if (q.ram) sp.set("ram", q.ram);
  if (q.cpu) sp.set("cpu", q.cpu);
  if (q.storage) sp.set("storage", q.storage);
  if (q.sort && q.sort !== "newest") sp.set("sort", q.sort);
  if (q.page > 1) sp.set("page", String(q.page));
  return sp.toString();
}

/** Đọc/ghi state lọc-sắp xếp qua URL để URL có thể chia sẻ & back/forward hoạt động. */
export function useProductQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useMemo(() => parseQuery(new URLSearchParams(searchParams.toString())), [searchParams]);

  const setQuery = useCallback(
    (patch: Partial<ProductQuery>, opts?: { resetPage?: boolean }) => {
      const next: ProductQuery = { ...query, ...patch };
      // Mọi thay đổi filter (trừ chính page) đều reset về trang 1.
      if (opts?.resetPage !== false && patch.page === undefined) next.page = 1;
      const qs = toSearchString(next);
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [query, pathname, router],
  );

  /**
   * Đổi cả nhóm kind (laptop ↔ pc_component) — luôn reset filter + page vì
   * brand/category/tag/ram/cpu/storage không tương thích giữa 2 nhóm.
   */
  const setKind = useCallback(
    (nextKind: ProductKind) => {
      const next: ProductQuery = {
        ...DEFAULT_QUERY,
        kind: nextKind,
        sort: query.sort,
      };
      const qs = toSearchString(next);
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, query.sort, router],
  );

  const reset = useCallback(() => {
    // Giữ nguyên kind, chỉ xoá filter trong nhóm.
    const next: ProductQuery = { ...DEFAULT_QUERY, kind: query.kind };
    const qs = toSearchString(next);
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, query.kind, router]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (query.brand) n++;
    if (query.category) n++;
    if (query.tag) n++;
    if (query.priceBucket) n++;
    if (query.minPrice > 0 || query.maxPrice > 0) n++;
    if (query.ram) n++;
    if (query.cpu) n++;
    if (query.storage) n++;
    return n;
  }, [query]);

  return { query, setQuery, setKind, reset, activeCount, defaults: DEFAULT_QUERY };
}

export function useProducts(query: ProductQuery) {
  const params = new URLSearchParams();
  params.set("kind", query.kind);
  params.set("sort", query.sort);
  params.set("page", String(query.page));
  params.set("limit", String(query.limit ?? 24));
  if (query.q) params.set("q", query.q);
  if (query.brand) params.set("brand", query.brand);
  if (query.category) params.set("category", query.category);
  if (query.tag) params.set("tag", query.tag);
  if (query.priceBucket) params.set("priceBucket", query.priceBucket);
  if (query.minPrice > 0) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice > 0) params.set("maxPrice", String(query.maxPrice));
  if (query.ram) params.set("ram", query.ram);
  if (query.cpu) params.set("cpu", query.cpu);
  if (query.storage) params.set("storage", query.storage);
  const key = params.toString();

  return useQuery<ProductListResponse>({
    queryKey: ["public-products", key],
    queryFn: async () => {
      const res = await fetch(`/api/public/products?${key}`);
      if (!res.ok) throw new Error("Không tải được danh sách sản phẩm");
      return res.json();
    },
    placeholderData: (prev) => prev,
  });
}

/**
 * Filters theo kind — trang /products gọi hook này thay vì useHomeFilters
 * để chỉ lấy đúng filter cho nhóm đang xem.
 * Nếu sau này dùng chung cho cả laptop & linh kiện (vd mega-menu), bỏ kind đi.
 */
export function useProductFilters(kind: ProductKind) {
  return useQuery<ProductFilters>({
    queryKey: ["public-product-filters", kind],
    queryFn: async () => {
      const res = await fetch(`/api/public/products/filters?kind=${kind}`);
      if (!res.ok) throw new Error("Không tải được bộ lọc");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

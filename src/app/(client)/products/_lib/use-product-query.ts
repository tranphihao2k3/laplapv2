"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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

  const reset = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [pathname, router]);

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

  return { query, setQuery, reset, activeCount, defaults: DEFAULT_QUERY };
}

export function useProducts(query: ProductQuery) {
  const qs = toSearchString({ ...query, sort: query.sort, page: query.page });
  const params = new URLSearchParams(qs);
  // Luôn gửi sort/page để API có giá trị tường minh.
  params.set("sort", query.sort);
  params.set("page", String(query.page));
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

export function useProductFilters() {
  return useQuery<ProductFilters>({
    queryKey: ["public-product-filters"],
    queryFn: async () => {
      const res = await fetch("/api/public/products/filters");
      if (!res.ok) throw new Error("Không tải được bộ lọc");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

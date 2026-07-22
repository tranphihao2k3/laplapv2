"use client";

import { useQuery } from "@tanstack/react-query";

export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  price: number;
  createdAt: string | null;
  brandId: string | null;
  categoryId: string | null;
  specs: Record<string, string>;
  inStock?: boolean;
};

type ProductListResponse = {
  items: PublicProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type FilterOption = { value: string; label: string; count: number };

export type ProductFilters = {
  brands: FilterOption[];
  categories: FilterOption[];
  needTags: FilterOption[];
  priceBuckets: FilterOption[];
  ram: FilterOption[];
  cpu: FilterOption[];
  storage: FilterOption[];
  priceRange: { min: number; max: number };
};

type Sort = "newest" | "price_asc" | "price_desc" | "name_asc";

type HomeProductParams = {
  sort?: Sort;
  brand?: string;
  category?: string;
  limit?: number;
};

function buildKey(params: HomeProductParams) {
  const sp = new URLSearchParams();
  sp.set("sort", params.sort ?? "newest");
  sp.set("limit", String(params.limit ?? 8));
  if (params.brand) sp.set("brand", params.brand);
  if (params.category) sp.set("category", params.category);
  return sp.toString();
}

export function useHomeProducts(params: HomeProductParams = {}) {
  const key = buildKey(params);
  return useQuery<ProductListResponse>({
    queryKey: ["home-products", key],
    queryFn: async () => {
      const res = await fetch(`/api/public/products?${key}`);
      if (!res.ok) throw new Error("Không tải được sản phẩm");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useHomeFilters() {
  return useQuery<ProductFilters>({
    queryKey: ["home-filters"],
    queryFn: async () => {
      const res = await fetch("/api/public/products/filters");
      if (!res.ok) throw new Error("Không tải được bộ lọc");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type HomeBrand = {
  id: string;
  name: string;
  slug: string | null;
  logo_url?: string | null;
  show_on_homepage: boolean;
};

export function useHomeBrands() {
  return useQuery<{ items: HomeBrand[] }>({
    queryKey: ["home-brands"],
    queryFn: async () => {
      const res = await fetch("/api/public/brands?showOnHomepage=true");
      if (!res.ok) throw new Error("Không tải được thương hiệu");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

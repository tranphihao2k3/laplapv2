"use client";

import { useQuery } from "@tanstack/react-query";
import { httpGet } from "./http";

/**
 * Hook: lấy Map<id, {name, slug?, href?}> cho 1 entity + danh sách ids.
 * Cache 5 phút qua React Query, merge ids trùng nhờ query key sort.
 *
 * Dùng để hiển thị tên (khách hàng, sản phẩm, shop, nhân viên...) thay cho raw UUID
 * trong các bảng admin.
 */
export type EntityKind =
  | "customers"
  | "shops"
  | "products"
  | "user-profiles"
  | "brands"
  | "categories"
  | "organizations"
  | "suppliers"
  | "warehouses"
  | "roles";

export type LookupEntry = {
  name: string;
  slug?: string;
  href?: string;
};

function buildHref(kind: EntityKind, id: string, slug?: string): string {
  const map: Record<EntityKind, string> = {
    customers: "/quanly/customers",
    shops: "/quanly/shops",
    products: "/quanly/products",
    "user-profiles": "/quanly/admin/users",
    brands: "/quanly/brands",
    categories: "/quanly/categories",
    organizations: "/quanly/organizations",
    suppliers: "/quanly/suppliers",
    warehouses: "/quanly/warehouses",
    roles: "/quanly/roles",
  };
  return slug ? `${map[kind]}/${id}` : `${map[kind]}/${id}`;
}

function pickName(it: Record<string, unknown>): string {
  const v = it.full_name ?? it.name ?? it.title ?? it.code;
  return v == null ? "" : String(v);
}

/** Hook: lấy Map<id, LookupEntry> cho 1 entity + danh sách ids. */
export function useLookupMap(kind: EntityKind, ids: Array<string | null | undefined>) {
  // Lọc bỏ null/undefined + loại trùng
  const uniqueIds = Array.from(new Set(ids.filter((x): x is string => !!x)));
  const sortedIds = [...uniqueIds].sort();
  return useQuery({
    queryKey: ["lookup", kind, sortedIds.join(",")],
    enabled: uniqueIds.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      const data = await httpGet<{ items: Array<Record<string, unknown>> }>(`/v1/${kind}`, {
        id__in: sortedIds.join(","),
        pageSize: Math.min(Math.max(sortedIds.length + 10, 50), 500),
      });
      const map = new Map<string, LookupEntry>();
      for (const it of data.items) {
        const id = String(it.id);
        const name = pickName(it);
        if (!id || !name) continue;
        const slug = it.slug ? String(it.slug) : undefined;
        map.set(id, { name, slug, href: buildHref(kind, id, slug) });
      }
      return map;
    },
  });
}

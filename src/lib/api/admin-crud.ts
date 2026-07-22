"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpDelete, httpGet, httpPatch, httpPost } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/response";

export type CrudListParams = {
  search?: string;
  page?: number;
  pageSize?: number;
  /** Filter bổ sung gửi thẳng làm query param (VD: { shop_id }) → API map thành .eq() */
  filters?: Record<string, string | number | boolean | undefined | null>;
};

/** Bỏ các filter rỗng để key ổn định & không gửi param thừa */
function cleanFilters(filters?: CrudListParams["filters"]) {
  if (!filters) return undefined;
  const entries = Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function buildCrudKey(entity: string, params: CrudListParams) {
  const filters = cleanFilters(params.filters);
  return [
    "admin-crud",
    entity,
    params.search ?? "",
    params.page ?? 1,
    params.pageSize ?? 20,
    filters ? JSON.stringify(filters) : "",
  ] as const;
}

// Cache settings cho admin pages (React Query v5 uses gcTime)
const STALE_TIME = 5 * 60 * 1000; // 5 phút
const GC_TIME = 10 * 60 * 1000; // 10 phút

export function useCrudList<T extends Record<string, unknown>>(
  entity: string,
  params: CrudListParams,
  enabled = true,
) {
  return useQuery({
    queryKey: buildCrudKey(entity, params),
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previousData) => previousData,
    queryFn: () =>
      httpGet<Paginated<T>>(`/v1/${entity}`, {
        search: params.search,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        ...cleanFilters(params.filters),
      }),
  });
}

export type MyShop = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
};

/** Danh sách cửa hàng của user đang đăng nhập (qua /v1/me/shops). */
export function useMyShops(enabled = true) {
  return useQuery({
    queryKey: ["me-shops"],
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    queryFn: () => httpGet<MyShop[]>("/v1/me/shops"),
  });
}

export function useCrudCreate<T extends Record<string, unknown>, TInput extends Record<string, unknown>>(
  entity: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => httpPost<T>(`/v1/${entity}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crud", entity] });
    },
  });
}

export function useCrudUpdate<T extends Record<string, unknown>, TInput extends Record<string, unknown>>(
  entity: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TInput }) => httpPatch<T>(`/v1/${entity}/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crud", entity] });
    },
  });
}

export function useCrudDelete(entity: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => httpDelete<{ id: string }>(`/v1/${entity}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crud", entity] });
    },
  });
}

export function useCrudBulkDelete(entity: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      httpPost<{ deleted: string[] }>(`/v1/${entity}/bulk-delete`, { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crud", entity] });
    },
  });
}

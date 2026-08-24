"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpGet, httpPost } from "@/lib/api/http";

export type PosSession = {
  id: string;
  shop_id: string | null;
  shop_name?: string | null;
  opened_by: string | null;
  opened_by_name?: string | null;
  opened_at: string | null;
  closed_at: string | null;
  opening_cash: number | null;
  closing_cash: number | null;
  expected_cash: number | null;
  difference_cash: number | null;
};

type OpenSessionInput = { shop_id: string; opening_cash: number };
type CloseSessionInput = { session_id: string; closing_cash: number };

type PosSessionContextValue = {
  /** Session hiện đang mở (nếu có) */
  current: PosSession | null;
  /** Danh sách tất cả session (dùng cho trang admin list) */
  sessions: PosSession[];
  isLoadingList: boolean;

  /** Hàm thao tác */
  refresh: () => Promise<void>;
  refreshList: () => Promise<void>;

  /** Mở ca mới — trả về session vừa tạo */
  openSession: (input: OpenSessionInput) => Promise<PosSession | null>;
  /** Đóng ca hiện tại */
  closeSession: (input: CloseSessionInput) => Promise<PosSession | null>;
  /** Tìm session đang mở của user cho 1 shop (nếu có) */
  findOpenSession: (shopId: string) => PosSession | null;
};

const PosSessionContext = createContext<PosSessionContextValue | null>(null);

export function PosSessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // Danh sách tất cả ca
  const listQuery = useQuery({
    queryKey: ["pos-sessions", "all"],
    queryFn: async () => {
      const res = await httpGet<{ items?: PosSession[] }>(
        "/v1/pos-sessions?page=1&pageSize=200",
      );
      return res.items ?? [];
    },
    staleTime: 30_000,
  });

  const sessions = listQuery.data ?? [];
  // Tự chọn session đang mở mới nhất
  const current: PosSession | null = useMemo(() => {
    const open = sessions
      .filter((s) => !s.closed_at && s.shop_id)
      .sort((a, b) =>
        String(b.opened_at ?? "").localeCompare(String(a.opened_at ?? "")),
      );
    return open[0] ?? null;
  }, [sessions]);

  const openMutation = useMutation({
    mutationFn: (input: OpenSessionInput) =>
      httpPost<PosSession>("/v1/pos-sessions", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pos-sessions"] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (input: CloseSessionInput) =>
      httpPost<PosSession>(`/v1/pos-sessions/${input.session_id}/close`, {
        closing_cash: input.closing_cash,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pos-sessions"] });
    },
  });

  const refresh = useCallback(async () => {
    await listQuery.refetch();
  }, [listQuery]);

  const refreshList = useCallback(async () => {
    await listQuery.refetch();
  }, [listQuery]);

  const openSession = useCallback(
    async (input: OpenSessionInput): Promise<PosSession | null> => {
      try {
        const res = await openMutation.mutateAsync(input);
        // Cập nhật cache local luôn
        await listQuery.refetch();
        return res;
      } catch {
        return null;
      }
    },
    [openMutation, listQuery],
  );

  const closeSession = useCallback(
    async (input: CloseSessionInput): Promise<PosSession | null> => {
      try {
        const res = await closeMutation.mutateAsync(input);
        await listQuery.refetch();
        return res;
      } catch {
        return null;
      }
    },
    [closeMutation, listQuery],
  );

  const findOpenSession = useCallback(
    (shopId: string): PosSession | null => {
      const open = sessions
        .filter((s) => !s.closed_at && s.shop_id === shopId)
        .sort((a, b) =>
          String(b.opened_at ?? "").localeCompare(String(a.opened_at ?? "")),
        );
      return open[0] ?? null;
    },
    [sessions],
  );

  const value: PosSessionContextValue = {
    current,
    sessions,
    isLoadingList: listQuery.isLoading,
    refresh,
    refreshList,
    openSession,
    closeSession,
    findOpenSession,
  };

  return (
    <PosSessionContext.Provider value={value}>
      {children}
    </PosSessionContext.Provider>
  );
}

export function usePosSession(): PosSessionContextValue {
  const ctx = useContext(PosSessionContext);
  if (!ctx) {
    throw new Error("usePosSession phải dùng trong <PosSessionProvider>");
  }
  return ctx;
}

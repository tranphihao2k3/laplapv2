"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type AccountProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  customerId: string | null;
  tier: string | null;
  loyaltyPoints: number;
  birthday: string | null;
  gender: string | null;
};

/**
 * GET /api/v1/account/me — profile hiện tại (dùng cho client components).
 * Tự động invalidate khi mutation profile thành công.
 */
export function useAccountProfile() {
  return useQuery({
    queryKey: ["account", "me"],
    queryFn: async (): Promise<AccountProfile> => {
      const res = await fetch("/api/v1/account/me", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) throw new Error("UNAUTHENTICATED");
        throw new Error("Không tải được hồ sơ");
      }
      const data = await res.json();
      const u = data.user ?? data.data ?? data;
      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName ?? u.full_name ?? null,
        phone: u.phone ?? null,
        avatarUrl: u.avatarUrl ?? u.avatar_url ?? null,
        customerId: u.customerId ?? u.customer_id ?? null,
        tier: u.tier ?? "bronze",
        loyaltyPoints: u.loyaltyPoints ?? u.loyalty_points ?? 0,
        birthday: u.birthday ?? null,
        gender: u.gender ?? null,
      };
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export type UpdateProfileInput = {
  fullName?: string;
  phone?: string | null;
  birthday?: string | null;
  gender?: "male" | "female" | "other" | null;
  avatarUrl?: string | null;
};

/**
 * PATCH /api/v1/account/me — cập nhật profile + invalidate cache.
 */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const res = await fetch("/api/v1/account/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Cập nhật thất bại");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "me"] });
    },
  });
}

/**
 * Đăng xuất: gọi POST /auth/signout rồi redirect về home.
 */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
    },
    onSuccess: () => {
      qc.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/account/login?logged_out=1";
      }
    },
  });
}

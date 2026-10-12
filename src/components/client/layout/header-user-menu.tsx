"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User, LogOut, ShoppingBag, Award, Ticket, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLogout } from "@/lib/hooks/use-account-profile";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Me = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  customerId: string | null;
  tier: string | null;
  loyaltyPoints: number;
};

function initials(name: string | null, email: string) {
  const src = (name ?? email ?? "?").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/**
 * User menu cho header store. Nếu đã đăng nhập → dropdown (avatar + menu).
 * Nếu chưa → button dẫn sang /account/login.
 */
export function HeaderUserMenu() {
  const logout = useLogout();
  const qc = useQueryClient();

  // Lấy user nhanh qua Supabase client (không cần API) để hiển thị tên + email.
  const { data: me } = useQuery({
    queryKey: ["header", "me"],
    queryFn: async (): Promise<Me | null> => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [c, p] = await Promise.all([
        db
          .from("customers")
          .select("id, full_name, tier, loyalty_points, avatar_url, deleted_at")
          .eq("auth_user_id", data.user.id)
          .is("deleted_at", null)
          .maybeSingle(),
        db
          .from("user_profiles")
          .select("full_name, avatar_url")
          .eq("id", data.user.id)
          .maybeSingle(),
      ]);
      return {
        id: data.user.id,
        email: data.user.email ?? "",
        fullName:
          c?.full_name ??
          p?.full_name ??
          (data.user.user_metadata?.full_name as string | undefined) ??
          null,
        avatarUrl: c?.avatar_url ?? p?.avatar_url ?? null,
        customerId: c?.id ?? null,
        tier: c?.tier ?? "bronze",
        loyaltyPoints: c?.loyalty_points ?? 0,
      };
    },
    staleTime: 60 * 1000,
  });

  // Re-fetch khi auth state thay đổi
  if (typeof window !== "undefined") {
    const supabase = createClient();
    supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries({ queryKey: ["header", "me"] });
    });
  }

  if (!me) {
    return (
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="hidden sm:flex"
        aria-label="Đăng nhập"
      >
        <Link href="/account/login">
          <User className="h-5 w-5" />
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-9 w-9 sm:flex"
          aria-label="Tài khoản"
        >
          <Avatar className="h-8 w-8">
            {me.avatarUrl ? (
              <AvatarImage src={me.avatarUrl} alt={me.fullName ?? me.email} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials(me.fullName, me.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate text-sm font-semibold">
            {me.fullName ?? "Khách hàng"}
          </p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {me.email}
          </p>
          {me.customerId && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              <Award className="h-2.5 w-2.5" />
              {me.loyaltyPoints.toLocaleString("vi-VN")} điểm · {me.tier}
            </p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account" className="cursor-pointer">
            <User className="h-4 w-4" />
            Tài khoản của tôi
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/orders" className="cursor-pointer">
            <ShoppingBag className="h-4 w-4" />
            Đơn hàng
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/loyalty" className="cursor-pointer">
            <Award className="h-4 w-4" />
            Điểm thưởng
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/vouchers" className="cursor-pointer">
            <Ticket className="h-4 w-4" />
            Voucher
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/settings" className="cursor-pointer">
            <Settings className="h-4 w-4" />
            Cài đặt
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {logout.isPending ? "Đang đăng xuất..." : "Đăng xuất"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

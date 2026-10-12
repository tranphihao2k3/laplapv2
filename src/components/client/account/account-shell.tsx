"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, LogOut, Sparkles, Crown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLogout } from "@/lib/hooks/use-account-profile";
import { AccountNavList, AccountNavMobile } from "./account-nav";
import { cn } from "@/lib/utils";

export type AccountShellUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  customerId: string | null;
  tier: string | null;
  loyaltyPoints: number;
};

const TIER_META: Record<string, { label: string; gradient: string; ring: string }> = {
  bronze: {
    label: "Đồng",
    gradient: "from-amber-700 via-amber-600 to-yellow-700",
    ring: "ring-amber-300/60",
  },
  silver: {
    label: "Bạc",
    gradient: "from-slate-400 via-slate-300 to-slate-500",
    ring: "ring-slate-300/60",
  },
  gold: {
    label: "Vàng",
    gradient: "from-yellow-500 via-amber-400 to-orange-500",
    ring: "ring-amber-300/60",
  },
  platinum: {
    label: "Bạch kim",
    gradient: "from-indigo-500 via-violet-500 to-fuchsia-500",
    ring: "ring-violet-300/60",
  },
};

function tierKey(tier: string | null | undefined) {
  const k = (tier ?? "bronze").toLowerCase();
  return TIER_META[k] ? k : "bronze";
}

function initials(name: string | null | undefined, email: string) {
  const src = (name ?? email ?? "?").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function AccountShell({
  user,
  children,
}: {
  user: AccountShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = useLogout();
  const tier = tierKey(user.tier);
  const tierMeta = TIER_META[tier];

  return (
    <div className="container mx-auto px-4 pb-16 pt-6 md:pt-8">
      {/* Mobile top bar: avatar + menu */}
      <div className="mb-6 flex items-center justify-between gap-3 md:hidden">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {user.fullName ?? user.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Mở menu tài khoản">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex h-full w-[300px] flex-col sm:max-w-[300px]"
          >
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base">Tài khoản</SheetTitle>
            </SheetHeader>
            <Separator className="mb-3" />
            <AccountNavMobile
              pathname={pathname}
              onLogout={() => {
                setMobileOpen(false);
                logout.mutate();
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <UserCard user={user} tierMeta={tierMeta} />
            <Card className="rounded-2xl border-border/60 p-3">
              <AccountNavList pathname={pathname} />
              <Separator className="my-3" />
              <form
                action="/auth/signout"
                method="post"
                onSubmit={(e) => {
                  e.preventDefault();
                  logout.mutate();
                }}
              >
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  disabled={logout.isPending}
                  className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {logout.isPending ? "Đang đăng xuất..." : "Đăng xuất"}
                </Button>
              </form>
            </Card>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0">
          <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
            <div className="px-5 py-6 md:px-7 md:py-7">{children}</div>
          </Card>
        </main>
      </div>
    </div>
  );
}

function UserCard({
  user,
  tierMeta,
}: {
  user: AccountShellUser;
  tierMeta: { label: string; gradient: string; ring: string };
}) {
  const tierKeyValue = tierKey(user.tier);
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60">
      <div
        className={cn(
          "relative h-16 bg-gradient-to-br",
          tierMeta.gradient,
        )}
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent)]" />
      </div>
      <div className="flex flex-col items-center px-4 pb-4 -mt-8">
        <UserAvatar user={user} size="lg" className={cn("ring-4 ring-card", tierMeta.ring)} />
        <p className="mt-3 truncate text-sm font-semibold" title={user.fullName ?? user.email}>
          {user.fullName ?? user.email}
        </p>
        <p className="truncate text-[11px] text-muted-foreground" title={user.email}>
          {user.email}
        </p>
        <div className="mt-3 flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
          {tierKeyValue === "gold" || tierKeyValue === "platinum" ? (
            <Crown className="h-3 w-3 text-amber-500" />
          ) : (
            <Sparkles className="h-3 w-3 text-amber-500" />
          )}
          <span>Hạng {tierMeta.label}</span>
          <span className="text-muted-foreground">·</span>
          <span>{user.loyaltyPoints ?? 0} điểm</span>
        </div>
        <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0 text-xs">
          <Link href="/account/profile">
            Xem & sửa hồ sơ <ChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function UserAvatar({
  user,
  size = "md",
  className,
}: {
  user: AccountShellUser;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "lg" ? "h-16 w-16" : size === "md" ? "h-10 w-10" : "h-8 w-8";
  return (
    <Avatar className={cn(sizeClass, className)}>
      {user.avatarUrl ? (
        <AvatarImage src={user.avatarUrl} alt={user.fullName ?? user.email} />
      ) : null}
      <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
        {initials(user.fullName, user.email)}
      </AvatarFallback>
    </Avatar>
  );
}

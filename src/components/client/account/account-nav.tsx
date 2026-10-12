"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingBag,
  MapPin,
  ShieldCheck,
  Wrench,
  Star,
  Award,
  Ticket,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  badge?: number;
};

export const ACCOUNT_NAV: NavItem[] = [
  { href: "/account", label: "Tổng quan", icon: LayoutDashboard, description: "Tóm tắt tài khoản" },
  { href: "/account/orders", label: "Đơn hàng", icon: ShoppingBag, description: "Lịch sử đơn hàng" },
  { href: "/account/addresses", label: "Sổ địa chỉ", icon: MapPin, description: "Địa chỉ giao hàng" },
  { href: "/account/warranties", label: "Bảo hành", icon: ShieldCheck, description: "Bảo hành của tôi" },
  { href: "/account/repair-tickets", label: "Phiếu sửa", icon: Wrench, description: "Yêu cầu sửa chữa" },
  { href: "/account/reviews", label: "Đánh giá", icon: Star, description: "Đánh giá sản phẩm" },
  { href: "/account/loyalty", label: "Loyalty", icon: Award, description: "Điểm & hạng" },
  { href: "/account/vouchers", label: "Voucher", icon: Ticket, description: "Kho voucher" },
  { href: "/account/notifications", label: "Thông báo", icon: Bell, description: "Cập nhật đơn" },
  { href: "/account/settings", label: "Cài đặt", icon: Settings, description: "Bảo mật & tuỳ chọn" },
];

export function isAccountNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/account") return pathname === "/account";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountNavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-0.5">
      {ACCOUNT_NAV.map((item) => {
        const Active = isAccountNavActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
              Active
                ? "bg-primary/10 text-primary font-semibold shadow-sm ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={Active ? "page" : undefined}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                Active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:bg-background",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex-1 truncate">{item.label}</span>
            {Active && <ChevronRight className="h-4 w-4" />}
            {!Active && item.badge ? (
              <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AccountNavMobile({
  pathname,
  onLogout,
}: {
  pathname: string;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 px-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Menu tài khoản
        </p>
      </div>
      <AccountNavList pathname={pathname} />
      <div className="mt-auto border-t pt-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
            <LogOut className="h-4 w-4" />
          </span>
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

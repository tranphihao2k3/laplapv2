"use client";

/**
 * QuickActions — Grid 6 nút tắt tới form tạo nhanh.
 * Hiển thị ngay sau header Dashboard. Mỗi card có icon + label + sub-text + gradient hover.
 */
import Link from "next/link";
import {
  ShoppingCartIcon,
  WrenchIcon,
  TruckIcon,
  PackagePlusIcon,
  UserPlusIcon,
  TicketIcon,
  PlusIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ACTIONS = [
  {
    label: "Tạo đơn POS",
    sub: "Bán hàng tại quầy",
    url: "/quanly/pos",
    icon: ShoppingCartIcon,
    gradient: "from-emerald-500/15 to-emerald-500/0",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    border: "hover:border-emerald-300/60",
  },
  {
    label: "Tạo phiếu sửa",
    sub: "Tiếp nhận máy",
    url: "/quanly/repair-tickets",
    icon: WrenchIcon,
    gradient: "from-sky-500/15 to-sky-500/0",
    iconColor: "text-sky-600 dark:text-sky-400",
    border: "hover:border-sky-300/60",
  },
  {
    label: "Nhập kho (PO)",
    sub: "Phiếu nhập hàng",
    url: "/quanly/purchase-orders",
    icon: TruckIcon,
    gradient: "from-amber-500/15 to-amber-500/0",
    iconColor: "text-amber-600 dark:text-amber-400",
    border: "hover:border-amber-300/60",
  },
  {
    label: "Thêm sản phẩm",
    sub: "Laptop / linh kiện",
    url: "/quanly/products",
    icon: PackagePlusIcon,
    gradient: "from-violet-500/15 to-violet-500/0",
    iconColor: "text-violet-600 dark:text-violet-400",
    border: "hover:border-violet-300/60",
  },
  {
    label: "Thêm khách hàng",
    sub: "Hồ sơ mới",
    url: "/quanly/customers",
    icon: UserPlusIcon,
    gradient: "from-rose-500/15 to-rose-500/0",
    iconColor: "text-rose-600 dark:text-rose-400",
    border: "hover:border-rose-300/60",
  },
  {
    label: "Tạo voucher",
    sub: "Mã giảm giá",
    url: "/quanly/vouchers",
    icon: TicketIcon,
    gradient: "from-primary/15 to-primary/0",
    iconColor: "text-primary",
    border: "hover:border-primary/40",
  },
] as const;

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
      {ACTIONS.map((a) => (
        <Link key={a.url} href={a.url} className="group block">
          <Card
            className={cn(
              "relative h-full overflow-hidden border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
              a.border,
            )}
          >
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity group-hover:opacity-100",
                a.gradient,
              )}
            />
            <CardContent className="relative flex h-full flex-col items-start justify-between gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
              <div className="flex items-center gap-2.5 sm:flex-col sm:items-start sm:gap-2">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80 backdrop-blur sm:h-10 sm:w-10",
                  )}
                >
                  <a.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", a.iconColor)} />
                </div>
                <div className="min-w-0 sm:flex-1">
                  <p className="text-xs font-semibold leading-tight sm:text-sm">{a.label}</p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground sm:text-xs">{a.sub}</p>
                </div>
              </div>
              <div
                className={cn(
                  "ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background/80 backdrop-blur transition-transform group-hover:translate-x-0.5 sm:ml-0 sm:self-end",
                )}
              >
                <ArrowRightIcon className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

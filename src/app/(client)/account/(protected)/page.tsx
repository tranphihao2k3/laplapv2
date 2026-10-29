import type { Metadata } from "next";
import Link from "next/link";
import {
  ShoppingBag,
  MapPin,
  ShieldCheck,
  Wrench,
  Award,
  Ticket,
  Star,
  Bell,
  ArrowRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { OverviewRecentOrders } from "./_sections/overview-recent-orders";
import { OverviewStats } from "./_sections/overview-stats";
import { OverviewLoyalty } from "./_sections/overview-loyalty";
import { OverviewNotifications } from "./_sections/overview-notifications";
import { OverviewOnboardingBanner } from "./_sections/overview-onboarding-banner";

export const metadata: Metadata = {
  title: "Tổng quan tài khoản",
};

export default async function AccountOverviewPage() {
  const me = await requireCustomer();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Parallel fetch
  const [ordersRes, warrantiesRes, repairsRes, reviewsRes, notifsRes] = await Promise.all([
    db
      .from("orders")
      .select("id, order_number, status, payment_status, total_amount, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    db.from("warranties").select("id", { count: "exact", head: true }),
    db
      .from("repair_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
    db
      .from("product_reviews")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", me.customerId ?? ""),
    db
      .from("notifications")
      .select("id, type, title, body, href, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const recentOrders = ordersRes.data ?? [];
  const totalSpent = recentOrders.reduce(
    (s: number, o: { total_amount: number | null }) => s + (o.total_amount ?? 0),
    0,
  );
  const completedCount = recentOrders.filter(
    (o: { status: string | null }) => o.status === "completed" || o.status === "fulfilled",
  ).length;

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title={`Xin chào, ${me.fullName?.split(" ").slice(-1)[0] ?? "bạn"}`}
        description="Tóm tắt hoạt động gần đây của bạn trên Laptop Thành Võ."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/products">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Tiếp tục mua sắm
            </Link>
          </Button>
        }
      />

      {!me.customerId && <OverviewOnboardingBanner />}

      {/* Stats row */}
      <OverviewStats
        orderCount={recentOrders.length}
        totalSpent={totalSpent}
        warrantyCount={warrantiesRes.count ?? 0}
        repairCount={repairsRes.count ?? 0}
        reviewCount={reviewsRes.count ?? 0}
        loyaltyPoints={me.customer?.loyaltyPoints ?? 0}
        tier={me.customer?.tier ?? "bronze"}
        completedCount={completedCount}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {/* Recent orders */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Đơn hàng gần đây</CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href="/account/orders">
                  Xem tất cả <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <OverviewRecentOrders orders={recentOrders} />
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Thông báo mới</CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href="/account/notifications">
                  Xem tất cả <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <OverviewNotifications items={notifsRes.data ?? []} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Loyalty */}
          <Card className="rounded-2xl border-border/60">
            <CardContent className="p-5">
              <OverviewLoyalty
                points={me.customer?.loyaltyPoints ?? 0}
                tier={me.customer?.tier ?? "bronze"}
              />
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Truy cập nhanh</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <QuickAction href="/account/orders" icon={ShoppingBag} label="Đơn hàng" />
              <QuickAction href="/account/addresses" icon={MapPin} label="Địa chỉ" />
              <QuickAction href="/account/warranties" icon={ShieldCheck} label="Bảo hành" />
              <QuickAction href="/account/repair-tickets" icon={Wrench} label="Phiếu sửa" />
              <QuickAction href="/account/reviews" icon={Star} label="Đánh giá" />
              <QuickAction href="/account/loyalty" icon={Award} label="Loyalty" />
              <QuickAction href="/account/vouchers" icon={Ticket} label="Voucher" />
              <QuickAction href="/account/notifications" icon={Bell} label="Thông báo" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Button
      asChild
      variant="ghost"
      className="h-auto flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/20 py-3 text-xs hover:border-primary/30 hover:bg-primary/5"
    >
      <Link href={href}>
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-foreground">{label}</span>
      </Link>
    </Button>
  );
}

import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { requireCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";
import { NotificationsList } from "./_sections/notifications-list";

export const metadata: Metadata = {
  title: "Thông báo",
};

export default async function NotificationsPage() {
  const me = await requireCustomer();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data } = await db
    .from("notifications")
    .select("id, type, title, body, href, is_read, read_at, created_at, data")
    .eq("customer_id", me.customerId ?? "")
    .order("created_at", { ascending: false })
    .limit(100);

  const items = data ?? [];
  const unread = items.filter((n: { is_read: boolean }) => !n.is_read).length;

  return (
    <div className="space-y-5">
      <AccountPageHeader
        title="Thông báo"
        description={
          unread > 0 ? `${unread} thông báo chưa đọc` : "Đã đọc tất cả"
        }
      />
      {items.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold">Chưa có thông báo nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cập nhật đơn hàng và khuyến mãi sẽ hiện ở đây.
            </p>
          </CardContent>
        </Card>
      ) : (
        <NotificationsList items={items} />
      )}
    </div>
  );
}

import type { Metadata } from "next";

import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { requireCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";
import { OrdersToolbar } from "./_sections/orders-toolbar";
import { OrdersList } from "./_sections/orders-list";

export const metadata: Metadata = {
  title: "Đơn hàng của tôi",
};

type Props = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

const PAGE_SIZE = 20;

export default async function OrdersPage({ searchParams }: Props) {
  const me = await requireCustomer();
  const sp = await searchParams;
  const status = sp.status;
  const q = sp.q ?? "";

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  let query = db
    .from("orders")
    .select(
      "id, order_number, status, payment_status, fulfillment_status, channel, subtotal, discount_amount, total_amount, created_at, note",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (q.trim()) query = query.ilike("order_number", `%${q.trim()}%`);

  const { data, count } = await query;
  const orders = data ?? [];

  return (
    <div className="space-y-5">
      <AccountPageHeader
        title="Đơn hàng của tôi"
        description={`${count ?? 0} đơn hàng`}
      />
      <OrdersToolbar
        currentStatus={status}
        currentQuery={q}
      />
      <OrdersList
        initial={orders}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        initialQuery={q}
        initialStatus={status}
      />
    </div>
  );
}

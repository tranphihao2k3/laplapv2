import type { Metadata } from "next";
import { Award } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { requireCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";
import { LoyaltyView } from "./_sections/loyalty-view";

export const metadata: Metadata = {
  title: "Điểm thưởng & Hạng thành viên",
};

export default async function LoyaltyPage() {
  const me = await requireCustomer();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data } = await db
    .from("loyalty_transactions")
    .select("id, points, type, order_id, created_at, order:orders(id, order_number)")
    .eq("customer_id", me.customerId ?? "")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-5">
      <AccountPageHeader
        title="Điểm thưởng & Hạng"
        description="Tích điểm sau mỗi đơn hàng và đổi lấy ưu đãi độc quyền."
      />
      <LoyaltyView
        points={me.customer?.loyaltyPoints ?? 0}
        tier={me.customer?.tier ?? "bronze"}
        transactions={data ?? []}
      />
    </div>
  );
}

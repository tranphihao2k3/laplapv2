import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { requireCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";
import { WarrantiesList } from "./_sections/warranties-list";

export const metadata: Metadata = {
  title: "Bảo hành của tôi",
};

type Props = {
  searchParams: Promise<{ order?: string }>;
};

export default async function WarrantiesPage({ searchParams }: Props) {
  const me = await requireCustomer();
  const sp = await searchParams;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data } = await db
    .from("warranties")
    .select(
      "id, serial_number, product_name, product_sku, order_number, purchase_date, warranty_start, warranty_end, warranty_months, status, note, order_id",
    )
    .order("warranty_end", { ascending: false });

  const items = (data ?? []).map(
    (w: { warranty_end: string; status: string }) => {
      const days = Math.ceil(
        (new Date(w.warranty_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      let derivedStatus: "active" | "expiring" | "expired" | "voided" | "claimed" =
        "active";
      if (w.status === "voided") derivedStatus = "voided";
      else if (w.status === "claimed") derivedStatus = "claimed";
      else if (days < 0) derivedStatus = "expired";
      else if (days <= 30) derivedStatus = "expiring";
      return { ...w, days_left: days, derived_status: derivedStatus };
    },
  );

  return (
    <div className="space-y-5">
      <AccountPageHeader
        title="Bảo hành của tôi"
        description={`${items.length} phiếu bảo hành`}
      />
      {items.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ShieldCheck className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold">Chưa có bảo hành nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bảo hành sẽ được tạo tự động khi đơn hàng hoàn tất.
            </p>
          </CardContent>
        </Card>
      ) : (
        <WarrantiesList items={items} filterOrderId={sp.order} />
      )}
    </div>
  );
}

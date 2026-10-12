import type { Metadata } from "next";
import { Wrench } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { requireCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";
import { RepairTicketList } from "./_sections/repair-list";
import { RepairTicketCreate } from "./_sections/repair-create";

export const metadata: Metadata = {
  title: "Phiếu sửa chữa",
};

type Props = {
  searchParams: Promise<{ order?: string; warranty?: string; create?: string }>;
};

export default async function RepairTicketsPage({ searchParams }: Props) {
  const me = await requireCustomer();
  const sp = await searchParams;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data } = await db
    .from("repair_tickets")
    .select(
      "id, ticket_code, device_name, issue_description, serial_number, status, created_at, completed_at, estimated_cost, actual_cost, shop:shops(id, name)",
    )
    .eq("customer_id", me.customerId ?? "")
    .order("created_at", { ascending: false });

  const items = data ?? [];

  return (
    <div className="space-y-5">
      <AccountPageHeader
        title="Phiếu sửa chữa"
        description={`${items.length} phiếu — tạo mới để gửi thiết bị sửa chữa/bảo hành.`}
      />

      {sp.create === "1" ? (
        <RepairTicketCreate
          defaultDeviceName={sp.warranty ? "" : ""}
          onCancelHref="/account/repair-tickets"
        />
      ) : (
        <RepairTicketCreateToggle />
      )}

      {items.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Wrench className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold">Chưa có phiếu sửa nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tạo phiếu sửa mới khi thiết bị gặp vấn đề hoặc cần bảo hành.
            </p>
          </CardContent>
        </Card>
      ) : (
        <RepairTicketList items={items} />
      )}
    </div>
  );
}

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

function RepairTicketCreateToggle() {
  return (
    <Link href="/account/repair-tickets?create=1">
      <Button variant="outline" className="w-full sm:w-auto">
        <Plus className="mr-1.5 h-4 w-4" />
        Tạo phiếu sửa mới
      </Button>
    </Link>
  );
}

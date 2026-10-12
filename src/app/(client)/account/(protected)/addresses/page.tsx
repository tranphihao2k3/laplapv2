import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { requireCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";
import { AddressList } from "./_sections/address-list";

export const metadata: Metadata = {
  title: "Sổ địa chỉ giao hàng",
};

export default async function AddressesPage() {
  const me = await requireCustomer();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data } = await db
    .from("customer_addresses")
    .select("id, label, recipient_name, phone, province, district, ward, street, is_default, note, created_at, updated_at")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  const addresses = data ?? [];

  return (
    <div className="space-y-5">
      <AccountPageHeader
        title="Sổ địa chỉ"
        description="Lưu các địa chỉ giao hàng thường dùng để đặt đơn nhanh hơn."
        actions={
          <AddressCreateButton disabled={!me.customerId} />
        }
      />
      <AddressList initial={addresses} canEdit={!!me.customerId} />
    </div>
  );
}

function AddressCreateButton({ disabled }: { disabled: boolean }) {
  return (
    <Button size="sm" disabled={disabled} formAction="">
      <Plus className="mr-1.5 h-3.5 w-3.5" />
      Thêm địa chỉ
    </Button>
  );
}

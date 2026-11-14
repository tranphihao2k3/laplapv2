import type { Metadata } from "next";
import { Ticket } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { requireCustomer } from "@/lib/account/customer";
import { createAdminClient } from "@/lib/supabase/admin";
import { VoucherWallet } from "./_sections/voucher-wallet";

export const metadata: Metadata = {
  title: "Voucher của tôi",
};

export default async function VouchersPage() {
  const me = await requireCustomer();
  // Voucher definitions là dữ liệu công khai; đọc bằng service-role để không
  // phụ thuộc RLS và luôn thấy cả voucher admin vừa tạo.
  const db = createAdminClient() as any;
  const now = new Date().toISOString();

  const [claimsRes, publicRes] = await Promise.all([
    db
      .from("voucher_claims")
      .select(
        "id, voucher_id, claimed_at, used_at, order_id, voucher:vouchers(id, code, name, type, value, min_order_amount, max_discount_amount, start_date, end_date, quantity_total, quantity_used, description, is_active)",
      )
      .eq("customer_id", me.customerId ?? "")
      .order("claimed_at", { ascending: false }),
    db
      .from("vouchers")
      .select("id, code, name, type, value, min_order_amount, max_discount_amount, start_date, end_date, quantity_total, quantity_used, description, is_active")
      .eq("is_active", true)
      .lte("start_date", now)
      .gte("end_date", now)
      .order("end_date", { ascending: true }),
  ]);

  const claims = claimsRes.data ?? [];
  const publicActive = publicRes.data ?? [];
  const claimedIds = new Set(claims.map((c: { voucher_id: string }) => c.voucher_id));
  const available = publicActive.filter(
    (v: { id: string }) => !claimedIds.has(v.id),
  );

  return (
    <div className="space-y-5">
      <AccountPageHeader
        title="Voucher của tôi"
        description="Lưu voucher để dùng khi thanh toán. Mỗi voucher có thể có điều kiện riêng."
      />
      <VoucherWallet available={available} claimed={claims} />
    </div>
  );
}

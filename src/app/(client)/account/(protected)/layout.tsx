/**
 * Layout cho các trang /account/* (protected).
 * - Yêu cầu login (middleware đã chặn trước).
 * - Fetch current customer + render AccountShell với sidebar.
 *
 * Lưu ý về "orphan" user (auth.users có nhưng customers.row chưa tạo):
 *   - Trigger `handle_new_customer` đã tự động tạo khi signup — nhưng nếu trigger
 *     chưa chạy (DB cũ chưa apply migration), customerId sẽ null.
 *   - Layout vẫn render shell, để profile page tự show banner "Hoàn tất hồ sơ".
 */
import { requireCustomer } from "@/lib/account/customer";
import { AccountShell } from "@/components/client/account/account-shell";

export default async function AccountProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireCustomer();

  return (
    <AccountShell
      user={{
        id: me.id,
        email: me.email,
        fullName: me.fullName,
        avatarUrl: me.avatarUrl,
        phone: me.phone,
        customerId: me.customerId,
        tier: me.customer?.tier ?? "bronze",
        loyaltyPoints: me.customer?.loyaltyPoints ?? 0,
      }}
    >
      {children}
    </AccountShell>
  );
}

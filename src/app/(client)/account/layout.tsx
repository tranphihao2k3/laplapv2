/**
 * Layout wrapper cho /account (passthrough).
 *
 * Route groups trong thư mục con:
 *   - (protected)/ -> AccountShell với sidebar (yêu cầu auth)
 *   - login, signup, forgot-password -> public (không có shell)
 *
 * Vì middleware đã chặn /account/* chưa login (xem `lib/supabase/middleware.ts`),
 * route bên trong (protected)/ có thể gọi `requireCustomer()` trong layout.
 */
import { Suspense } from "react";

export default function AccountRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

/**
 * Layout cho các trang auth công khai:
 *   /account/login
 *   /account/signup
 *   /account/forgot-password
 *   /account/verify-email
 *   /account/reset-password
 *
 * Full-screen, không có sidebar AccountShell.
 * Vẫn nằm trong (client) layout nên có header + footer của store.
 */
export default function AccountPublicAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-280px)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

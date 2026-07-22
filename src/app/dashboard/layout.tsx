import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware đã gọi getUser() và refresh token rồi nên ở đây dùng getSession()
  // là đủ — session đã được set vào cookie bởi middleware, không cần round-trip thêm.
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;

  const shellUser = {
    name: user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "Admin",
    email: user?.email ?? "",
    avatar: (user?.user_metadata?.avatar_url as string | undefined) ?? undefined,
  };

  return <AdminShell user={shellUser}>{children}</AdminShell>;
}

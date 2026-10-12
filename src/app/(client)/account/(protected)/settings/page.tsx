import type { Metadata } from "next";
import { Bell, LockKeyhole, Trash2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { requireCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";
import { NewsletterToggle } from "./_sections/newsletter-toggle";
import { ChangePasswordForm } from "./_sections/change-password-form";
import { DeleteAccountSection } from "./_sections/delete-account-section";

export const metadata: Metadata = {
  title: "Cài đặt tài khoản",
};

export default async function SettingsPage() {
  const me = await requireCustomer();

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Newsletter status
  const { data: nl } = await db
    .from("newsletter_subscribers")
    .select("is_active, confirmed, brand_ids")
    .eq("email", (me.email ?? "").toLowerCase())
    .maybeSingle();

  return (
    <div className="space-y-5">
      <AccountPageHeader
        title="Cài đặt"
        description="Quản lý thông báo, bảo mật và tuỳ chọn tài khoản."
      />

      <Card className="rounded-2xl border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Bản tin email
          </CardTitle>
          <CardDescription>
            Nhận thông báo sản phẩm mới, khuyến mãi và tin tức từ LapLap qua email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewsletterToggle
            initial={!!(nl?.is_active && nl?.confirmed)}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LockKeyhole className="h-4 w-4 text-primary" />
            Đổi mật khẩu
          </CardTitle>
          <CardDescription>
            Đổi mật khẩu định kỳ để bảo vệ tài khoản. Mật khẩu tối thiểu 8 ký tự.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-rose-200/80 bg-rose-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-rose-700">
            <Trash2 className="h-4 w-4" />
            Vô hiệu hoá tài khoản
          </CardTitle>
          <CardDescription>
            Tài khoản sẽ bị ẩn khỏi đăng nhập nhưng lịch sử đơn hàng, bảo hành vẫn
            được bảo toàn cho các yêu cầu tra cứu sau này.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountSection />
        </CardContent>
      </Card>
    </div>
  );
}

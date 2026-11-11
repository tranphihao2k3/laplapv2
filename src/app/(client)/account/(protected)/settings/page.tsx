import type { Metadata } from "next";
import { LockKeyhole, Trash2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { requireCustomer } from "@/lib/account/customer";
import { ChangePasswordForm } from "./_sections/change-password-form";
import { DeleteAccountSection } from "./_sections/delete-account-section";

export const metadata: Metadata = {
  title: "Cài đặt tài khoản",
};

export default async function SettingsPage() {
  await requireCustomer();

  return (
    <div className="space-y-5">
      <AccountPageHeader
        title="Cài đặt"
        description="Quản lý bảo mật và tuỳ chọn tài khoản."
      />

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

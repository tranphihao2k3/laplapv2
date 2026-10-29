import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/client/account/auth/forgot-password-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { KeyRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Quên mật khẩu | Tài khoản Laptop Thành Võ",
};

export default function ForgotPasswordPage() {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-lg">
      <CardHeader className="bg-gradient-to-br from-primary/5 to-transparent p-6 pb-4">
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Quên mật khẩu?</h1>
        <p className="text-sm text-muted-foreground">
          Nhập email đăng ký — chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
        </p>
      </CardHeader>
      <CardContent className="p-6 pt-3">
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}

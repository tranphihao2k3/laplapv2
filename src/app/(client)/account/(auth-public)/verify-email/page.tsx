import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Xác nhận email | Tài khoản Laptop Thành Võ",
};

type Props = {
  searchParams: Promise<{ email?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const sp = await searchParams;
  const email = sp.email;
  return (
    <Card className="rounded-2xl border-border/60 shadow-lg">
      <CardContent className="p-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Kiểm tra email của bạn</h1>
        {email && (
          <p className="mt-2 text-sm text-muted-foreground">
            Chúng tôi đã gửi liên kết xác nhận đến{" "}
            <strong className="text-foreground">{email}</strong>.
          </p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Bấm vào liên kết trong email (kể cả thư mục spam) để hoàn tất đăng ký,
          sau đó bạn sẽ được đăng nhập và đưa về trang tài khoản.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="outline">
            <Link href="/account/login">Về trang đăng nhập</Link>
          </Button>
          <Button asChild>
            <Link href="/">Tiếp tục mua sắm</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

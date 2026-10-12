import type { Metadata } from "next";
import { Suspense } from "react";
import { UserPlus } from "lucide-react";

import { AccountSignupForm } from "@/components/client/account/auth/signup-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Đăng ký tài khoản | LapLap",
  description:
    "Tạo tài khoản để tích điểm, theo dõi đơn hàng, tra cứu bảo hành và nhận ưu đãi riêng.",
};

type Props = {
  searchParams: Promise<{ redirectTo?: string }>;
};

export default async function SignupPage({ searchParams }: Props) {
  const sp = await searchParams;
  const redirectTo = sp.redirectTo ?? "/account";
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-lg">
      <CardHeader className="bg-gradient-to-br from-primary/5 via-primary/[0.03] to-transparent p-6 pb-5">
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Tạo tài khoản khách hàng</h1>
        <p className="text-sm text-muted-foreground">
          Tích điểm sau mỗi đơn hàng, nhận thông báo đơn nhanh hơn và ưu đãi sinh nhật.
        </p>
      </CardHeader>
      <CardContent className="p-6 pt-3">
        <Suspense fallback={null}>
          <AccountSignupForm redirectTo={redirectTo} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

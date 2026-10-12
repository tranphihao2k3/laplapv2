import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";

import { AccountLoginForm } from "@/components/client/account/auth/login-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Đăng nhập | Tài khoản khách hàng",
  description: "Đăng nhập vào tài khoản khách hàng để theo dõi đơn hàng, bảo hành, điểm loyalty.",
};

type Props = {
  searchParams: Promise<{ redirectTo?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const redirectTo = sp.redirectTo ?? "/account";
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-lg">
      <CardHeader className="bg-gradient-to-br from-primary/5 via-primary/[0.03] to-transparent p-6 pb-5">
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Đăng nhập tài khoản</h1>
        <p className="text-sm text-muted-foreground">
          Theo dõi đơn hàng, bảo hành, điểm thưởng và nhiều hơn nữa.
        </p>
      </CardHeader>
      <CardContent className="p-6 pt-3">
        <Suspense fallback={null}>
          <AccountLoginForm redirectTo={redirectTo} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

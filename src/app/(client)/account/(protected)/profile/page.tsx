import type { Metadata } from "next";
import { Suspense } from "react";

import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { requireCustomer } from "@/lib/account/customer";
import { ProfileForm } from "./_sections/profile-form";

export const metadata: Metadata = {
  title: "Hồ sơ cá nhân",
  description: "Cập nhật thông tin cá nhân và tuỳ chọn tài khoản.",
};

type Props = {
  searchParams: Promise<{ onboarding?: string }>;
};

export default async function ProfilePage({ searchParams }: Props) {
  const me = await requireCustomer();
  const sp = await searchParams;
  const onboarding = sp.onboarding === "1";

  return (
    <div>
      <AccountPageHeader
        title="Hồ sơ cá nhân"
        description="Cập nhật thông tin cá nhân, ngày sinh và giới tính để nhận ưu đãi sinh nhật và tích điểm tốt hơn."
      />
      <Suspense fallback={null}>
        <ProfileForm
          initial={{
            fullName: me.fullName ?? "",
            phone: me.phone ?? "",
            email: me.email,
            birthday: me.customer?.birthday ?? null,
            gender: me.customer?.gender ?? null,
            tier: me.customer?.tier ?? "bronze",
            loyaltyPoints: me.customer?.loyaltyPoints ?? 0,
          }}
          onboarding={onboarding}
        />
      </Suspense>
    </div>
  );
}

import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function OverviewOnboardingBanner() {
  return (
    <Card className="rounded-2xl border-amber-200/80 bg-amber-50/50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-900">Hoàn tất hồ sơ của bạn</p>
          <p className="mt-0.5 text-sm text-amber-800/80">
            Tài khoản của bạn vừa được tạo. Hãy cập nhật số điện thoại và họ tên
            để có thể mua hàng, tra cứu bảo hành và nhận điểm thưởng.
          </p>
          <Button asChild size="sm" className="mt-2 bg-amber-600 hover:bg-amber-700">
            <Link href="/account/profile?onboarding=1">
              Cập nhật hồ sơ <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

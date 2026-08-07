import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { CompareClient } from "./_components/compare-client";

export const metadata: Metadata = {
  title: "So sánh laptop",
  description:
    "So sánh chi tiết cấu hình nhiều mẫu laptop cùng lúc: CPU, RAM, ổ cứng, card đồ hoạ, màn hình, pin và giá bán. Xem máy nào mạnh hơn ở từng hạng mục.",
};

export default function ComparePage() {
  return (
    <div className="container py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold sm:text-2xl">So sánh laptop</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Đặt các máy cạnh nhau để xem máy nào mạnh hơn ở từng hạng mục.
        </p>
      </div>

      {/* useSearchParams bắt buộc nằm trong Suspense, nếu không build sẽ lỗi CSR bailout. */}
      <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-xl" />}>
        <CompareClient />
      </Suspense>
    </div>
  );
}

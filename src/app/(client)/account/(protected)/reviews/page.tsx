import type { Metadata } from "next";
import { Star } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AccountPageHeader } from "@/components/client/account/account-page-header";
import { requireCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";
import { ReviewList } from "./_sections/review-list";

export const metadata: Metadata = {
  title: "Đánh giá của tôi",
};

export default async function ReviewsPage() {
  const me = await requireCustomer();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data } = await db
    .from("product_reviews")
    .select(
      "id, product_id, rating, comment, status, created_at, product:products(id, name, slug, thumbnail_url)",
    )
    .eq("customer_id", me.customerId ?? "")
    .order("created_at", { ascending: false });

  const items = data ?? [];

  return (
    <div className="space-y-5">
      <AccountPageHeader
        title="Đánh giá của tôi"
        description={`${items.length} đánh giá — phản hồi giúp cửa hàng cải thiện dịch vụ.`}
      />
      {items.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Star className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold">Bạn chưa viết đánh giá nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sau khi đơn hoàn tất, hãy vào chi tiết đơn để đánh giá sản phẩm.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ReviewList items={items} />
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { getStoreInfoForRequest } from "@/lib/request-shop";
import { ProductListing } from "./_components/product-listing";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreInfoForRequest();
  return {
    title: "Tất cả sản phẩm",
    description: `Danh sách laptop chính hãng tại ${store.name} Cần Thơ — lọc theo cấu hình, giá và thương hiệu.`,
  };
}

export default function ProductListingPage() {
  return (
    <Suspense fallback={<div className="container py-10 text-sm text-muted-foreground">Đang tải...</div>}>
      <ProductListing />
    </Suspense>
  );
}

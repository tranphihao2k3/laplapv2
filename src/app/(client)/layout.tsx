import type { Metadata } from "next";
import { getBrandNameAsync } from "@/lib/brand";
import { getShopIdFromRequest } from "@/lib/request-shop";
import { ClientHeader } from "@/components/client/layout/client-header";
import { ClientFooter } from "@/components/client/layout/client-footer";
import { CompareBar } from "@/components/client/compare/compare-bar";

export async function generateMetadata(): Promise<Metadata> {
  const shopId = await getShopIdFromRequest();
  const brandName = await getBrandNameAsync(shopId);
  return {
    title: {
      default: `${brandName} - Laptop Cần Thơ`,
      template: `%s | ${brandName}`,
    },
    description: `${brandName} - Cửa hàng laptop uy tín tại Cần Thơ`,
  };
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ClientHeader />
      <main className="flex-1 animate-fade-in">{children}</main>
      <ClientFooter />
      {/* Thanh so sánh nổi đáy màn hình — tự ẩn khi chưa chọn máy nào. */}
      <CompareBar />
    </div>
  );
}

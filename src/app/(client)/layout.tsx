import { ClientHeader } from "@/components/client/layout/client-header";
import { ClientFooter } from "@/components/client/layout/client-footer";
import { CompareBar } from "@/components/client/compare/compare-bar";
import { VoucherFloatingWidget } from "@/components/client/vouchers/voucher-floating-widget";
import { PageViewTracker } from "@/components/client/analytics/page-view-tracker";

/**
 * PHẢI render động cho toàn bộ nhóm route (client).
 *
 * Lý do: `<ClientFooter />` là server component đọc thông tin cửa hàng (giờ mở
 * cửa, hotline, địa chỉ…) từ bảng `settings` qua `getStoreInfo()` — hàm này
 * dùng Supabase service-role key nên chỉ chạy được ở RUNTIME.
 *
 * Nếu route được prerender lúc `next build` (Docker builder KHÔNG có
 * SUPABASE_SERVICE_ROLE_KEY) → `getStoreInfo()` throw → fallback về DEFAULTS →
 * giờ mở cửa mặc định ("8:00 - 21:00") bị BAKE vào static HTML và phục vụ
 * tới hết TTL. Kết quả: admin sửa giờ mở cửa ở /quanly/settings → tab
 * Liên hệ → footer vẫn hiện giá trị cũ mãi mãi (dù đã sửa đúng parser).
 *
 * Đã kiểm chứng: `next build` xuất `/`, `/contact`, `/products`… vào
 * `.next/prerender-manifest.json` (static) và giờ mở cửa được bake thẳng vào
 * `.next/server/app/contact.html`. `revalidateTag("store-info")` KHÔNG gỡ được
 * static shell này vì route không có tag data-cache nào (chỉ có implicit
 * `_N_T_/...` tag theo path).
 *
 * `force-dynamic` ở đây chỉ ảnh hưởng HTML shell của route group (client):
 * mỗi request render lại footer + header server-side. Phần nội dung sản
 * phẩm vẫn được fetch client-side như trước nên không tăng tải DB đáng kể
 * (footer đọc qua `unstable_cache` nên chỉ query DB khi cache bị miss).
 */
export const dynamic = "force-dynamic";

// Metadata (title/description/OG) lấy từ root `src/app/layout.tsx`.
// Không khai báo lại ở đây — nếu set `title.default` thêm lần nữa, template
// `%s | brand` của root sẽ bọc thành "Brand - Laptop Cần Thơ | Brand".

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ClientHeader />
      <main className="flex-1 animate-fade-in">{children}</main>
      <ClientFooter />
      {/* Thanh so sánh nổi đáy màn hình — tự ẩn khi chưa chọn máy nào. */}
      <CompareBar />
      {/* Banner voucher góc dưới phải — tự ẩn khi không có voucher. */}
      <VoucherFloatingWidget />
      <PageViewTracker />
    </div>
  );
}

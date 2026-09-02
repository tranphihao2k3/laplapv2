import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { getStoreInfo } from "@/lib/store-info";
import { getFooterSettings } from "@/lib/footer-settings";
import { telHref } from "@/lib/shop-info";
import { StoreContactInfo } from "@/components/shared/store-contact-info";

export async function ClientFooter() {
  // Dùng getStoreInfo() — đã bao gồm legal info (MST, ĐKKD, GCN...).
  // Dùng getFooterSettings() — lấy footer links, description, payment methods từ settings.
  const [store, footerSettings] = await Promise.all([
    getStoreInfo(),
    getFooterSettings(),
  ]);
  const tel = telHref(store.phone);

  const paymentMethods = footerSettings.payment_methods ?? ["Visa", "MasterCard", "COD", "MoMo", "VNPay", "Trả góp 0%"];
  const footerDescription = footerSettings.description ?? "Hệ thống bán lẻ laptop chính hãng hàng đầu tại Cần Thơ. Cam kết sản phẩm chính hãng, giá tốt nhất.";
  const footerColumns = footerSettings.columns ?? [];

  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand + contact + legal */}
          <div className="space-y-4 sm:col-span-2 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
              <span className="text-primary">Lap</span>
              <span className="text-foreground">Lap</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {footerDescription}
            </p>

            <StoreContactInfo compact />

            <p className="text-xs leading-relaxed text-muted-foreground/80">
              <strong className="text-foreground">{store.legal.business_name}</strong>
              <br />
              MST: <strong className="text-foreground">{store.legal.tax_id}</strong> · ĐKKD:{" "}
              <strong className="text-foreground">
                {store.legal.business_registration_number}
              </strong>
              <br />
              Người chịu trách nhiệm nội dung:{" "}
              <strong className="text-foreground">{store.legal.legal_representative}</strong>
            </p>
          </div>

          {/* Link columns - loaded from settings */}
          {footerColumns.map((column) => (
            <div key={column.id} className="space-y-4">
              <h4 className="text-sm font-semibold">{column.title}</h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              © {new Date().getFullYear()} {store.name}. Tất cả quyền được bảo lưu.
            </p>
            <p className="text-xs">
              Đã thông báo/đăng ký với{" "}
              <strong className="text-foreground">Bộ Công Thương</strong> theo Nghị định
              52/2013/NĐ-CP (sửa đổi bởi Nghị định 85/2021/NĐ-CP).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Thanh toán:</span>
            {paymentMethods.map((method) => (
              <span
                key={method}
                className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
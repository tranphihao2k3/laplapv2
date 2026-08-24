import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { getStoreInfo } from "@/lib/store-info";
import { telHref } from "@/lib/shop-info";
import { StoreContactInfo } from "@/components/shared/store-contact-info";

const FOOTER_LINKS = {
  "Về LapLap": [
    { href: "/about", label: "Giới thiệu" },
    { href: "/contact", label: "Liên hệ" },
    { href: "/cau-hoi-thuong-gap", label: "Câu hỏi thường gặp" },
    { href: "/about#tuyen-dung", label: "Tuyển dụng" },
  ],
  "Chính sách": [
    { href: "/chinh-sach-bao-hanh", label: "Chính sách bảo hành" },
    { href: "/chinh-sach-doi-tra", label: "Chính sách đổi trả" },
    { href: "/chinh-sach-giao-hang", label: "Chính sách giao hàng" },
    { href: "/chinh-sach-thanh-toan", label: "Chính sách thanh toán" },
    { href: "/chinh-sach-bao-mat", label: "Chính sách bảo mật" },
  ],
  "Pháp lý": [
    { href: "/dieu-khoan-su-dung", label: "Điều khoản sử dụng" },
    { href: "/chinh-sach-giai-quyet-khieu-nai", label: "Giải quyết khiếu nại" },
  ],
  "Hỗ trợ": [
    { href: "/cau-hoi-thuong-gap", label: "Hướng dẫn mua hàng" },
    { href: "/chinh-sach-thanh-toan", label: "Thanh toán & vận chuyển" },
    { href: "/tra-cuu-bao-hanh", label: "Tra cứu bảo hành" },
    { href: "/dich-vu-sua-chua", label: "Dịch vụ sửa chữa" },
    { href: "/contact", label: "Liên hệ hỗ trợ" },
  ],
};


export async function ClientFooter() {
  // Dùng getStoreInfo() — đã bao gồm legal info (MST, ĐKKD, GCN...).
  const store = await getStoreInfo();
  const tel = telHref(store.phone);

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
              Hệ thống bán lẻ laptop chính hãng hàng đầu tại Cần Thơ. Cam kết sản phẩm chính
              hãng, giá tốt nhất.
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

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title} className="space-y-4">
              <h4 className="text-sm font-semibold">{title}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
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
            {["Visa", "Master", "COD", "MoMo", "VNPay", "Trả góp 0%"].map((m) => (
              <span
                key={m}
                className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
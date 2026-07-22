import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const FOOTER_LINKS = {
  "Về LapLap": [
    { href: "/about", label: "Giới thiệu" },
    { href: "/contact", label: "Liên hệ" },
    { href: "/about", label: "Tuyển dụng" },
  ],
  "Chính sách": [
    { href: "#", label: "Chính sách bảo hành" },
    { href: "#", label: "Chính sách đổi trả" },
    { href: "#", label: "Chính sách giao hàng" },
    { href: "#", label: "Chính sách bảo mật" },
  ],
  "Hỗ trợ": [
    { href: "#", label: "Hướng dẫn mua hàng" },
    { href: "#", label: "Thanh toán & vận chuyển" },
    { href: "/tra-cuu-bao-hanh", label: "Tra cứu bảo hành" },
    { href: "/dich-vu-sua-chua", label: "Dịch vụ sửa chữa" },
    { href: "#", label: "Câu hỏi thường gặp" },
  ],
};


export function ClientFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
              <span className="text-primary">Lap</span>
              <span>Lap</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Hệ thống bán lẻ laptop chính hãng hàng đầu tại Cần Thơ. Cam kết sản phẩm chính hãng, giá tốt nhất.
            </p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>📍 123 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ</p>
              <p>📞 1900 1234</p>
              <p>✉️ info@laplap.vn</p>
            </div>
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

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} LapLap. Tất cả quyền được bảo lưu.</p>
          <div className="flex items-center gap-4">
            <span>Chấp nhận thanh toán:</span>
            <span className="text-xs bg-muted px-2 py-1 rounded">Visa</span>
            <span className="text-xs bg-muted px-2 py-1 rounded">Mastercard</span>
            <span className="text-xs bg-muted px-2 py-1 rounded">COD</span>
            <span className="text-xs bg-muted px-2 py-1 rounded">Banking</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

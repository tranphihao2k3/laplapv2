import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { env } from "@/lib/env";
import { PolicyPage, type PolicySection } from "@/components/shared/policy-page";

const SITE = env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  title: "Chính sách thanh toán",
  description:
    "Chính sách thanh toán tại LapLap - tiền mặt, chuyển khoản, thẻ tín dụng, trả góp 0%, ví điện tử. An toàn, bảo mật PCI DSS.",
  alternates: { canonical: `${SITE}/chinh-sach-thanh-toan` },
};

const sections: PolicySection[] = [
  {
    id: "phuong-thuc",
    title: "Các phương thức thanh toán",
    content: (
      <>
        <p>
          LapLap hỗ trợ đa dạng phương thức thanh toán để khách hàng thuận tiện lựa chọn:
        </p>
        <table>
          <thead>
            <tr>
              <th>Phương thức</th>
              <th>Phạm vi</th>
              <th>Phí</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Tiền mặt tại showroom</td>
              <td>Tại cửa hàng</td>
              <td>Miễn phí</td>
            </tr>
            <tr>
              <td>Thanh toán khi nhận hàng (COD)</td>
              <td>Toàn quốc (đơn &lt; 30 triệu)</td>
              <td>Miễn phí</td>
            </tr>
            <tr>
              <td>Chuyển khoản ngân hàng</td>
              <td>Toàn quốc</td>
              <td>Miễn phí</td>
            </tr>
            <tr>
              <td>Quẹt thẻ (POS) - Visa/Master/JCB</td>
              <td>Tại showroom</td>
              <td>Miễn phí</td>
            </tr>
            <tr>
              <td>Ví MoMo, ZaloPay, VNPay QR</td>
              <td>Toàn quốc</td>
              <td>Miễn phí</td>
            </tr>
            <tr>
              <td>Trả góp 0% qua thẻ tín dụng</td>
              <td>Đơn từ 5 triệu</td>
              <td>Miễn phí (tuỳ ngân hàng)</td>
            </tr>
            <tr>
              <td>Trả góp qua công ty tài chính</td>
              <td>Đơn từ 3 triệu</td>
              <td>Tuỳ đối tác</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "bao-mat",
    title: "Bảo mật thanh toán",
    content: (
      <>
        <p>
          Mọi giao dịch thanh toán tại LapLap đều được bảo vệ bởi các tiêu chuẩn bảo mật quốc
          tế:
        </p>
        <ul>
          <li>
            <strong>PCI DSS</strong> — Tiêu chuẩn bảo mật dữ liệu thẻ thanh toán.
          </li>
          <li>
            <strong>3D Secure</strong> — Xác thực giao dịch qua OTP từ ngân hàng phát hành thẻ.
          </li>
          <li>
            <strong>SSL/TLS 256-bit</strong> — Mã hoá toàn bộ đường truyền từ trình duyệt đến máy
            chủ.
          </li>
          <li>
            <strong>VNPay/MoMo</strong> — Cổng thanh toán được NHNN Việt Nam cấp phép.
          </li>
        </ul>
        <p>
          LapLap <strong>không bao giờ</strong> lưu trữ thông tin thẻ tín dụng của khách hàng.
          Mọi giao dịch thẻ đều do cổng thanh toán xử lý và tuân thủ quy chuẩn bảo mật của
          ngân hàng.
        </p>
      </>
    ),
  },
  {
    id: "tra-gop",
    title: "Trả góp 0% lãi suất",
    content: (
      <>
        <h3>Trả góp qua thẻ tín dụng</h3>
        <ul>
          <li>Áp dụng cho đơn hàng từ 5 triệu đồng.</li>
          <li>Kỳ hạn: 3, 6, 9, 12 tháng (tuỳ ngân hàng).</li>
          <li>Lãi suất 0% trong suốt kỳ hạn trả góp.</li>
          <li>Phí chuyển đổi (nếu có): tuỳ chính sách ngân hàng, thường 1 - 3% giá trị đơn.</li>
        </ul>
        <h3>Trả góp qua công ty tài chính</h3>
        <ul>
          <li>Hợp tác với Home Credit, FE Credit, Mcredit, Mirae Asset…</li>
          <li>Duyệt nhanh trong 15 phút qua CCCD/CMND.</li>
          <li>Trả trước từ 10 - 30% tuỳ đối tác.</li>
          <li>Hỗ trợ kỳ hạn 6 - 24 tháng.</li>
        </ul>
        <blockquote>
          <strong>Mẹo:</strong> Trả góp qua thẻ tín dụng thường có lãi suất thấp hơn qua công ty
          tài chính, nhưng yêu cầu thẻ đủ hạn mức. So sánh cả 2 trước khi quyết định.
        </blockquote>
      </>
    ),
  },
  {
    id: "xuat-hoa-don",
    title: "Xuất hoá đơn VAT",
    content: (
      <>
        <p>
          LapLap hỗ trợ xuất <strong>hoá đơn điện tử VAT</strong> cho khách hàng là doanh nghiệp
          hoặc cá nhân có nhu cầu.
        </p>
        <ul>
          <li>
            Cung cấp thông tin xuất hoá đơn ngay khi đặt hàng (tên công ty, MST, địa chỉ).
          </li>
          <li>Hoá đơn điện tử được phát hành trong vòng 24 giờ sau khi thanh toán.</li>
          <li>Gửi qua email đăng ký — khách có thể tra cứu trên hệ thống hoá đơn điện tử TCT.</li>
        </ul>
        <p>
          Hoá đơn VAT là bằng chứng quan trọng cho mục đích kế toán doanh nghiệp và bảo hành,
          nên chúng tôi khuyến khích khách hàng yêu cầu xuất hoá đơn khi mua hàng.
        </p>
      </>
    ),
  },
  {
    id: "hoan-tien",
    title: "Hoàn tiền & điều chỉnh",
    content: (
      <>
        <p>
          Trường hợp cần hoàn tiền (đổi trả, huỷ đơn, sai giá…), quy trình hoàn tiền:
        </p>
        <ol>
          <li>LapLap duyệt yêu cầu hoàn tiền trong 24 giờ.</li>
          <li>Tiến hành hoàn qua đúng phương thức thanh toán ban đầu.</li>
          <li>Thời gian nhận tiền: 3 - 7 ngày làm việc (tuỳ ngân hàng).</li>
        </ol>
        <p>
          Mọi thắc mắc về hoàn tiền, vui lòng liên hệ bộ phận CSKH qua email hoặc hotline.
        </p>
      </>
    ),
  },
];

export default function ThanhToanPage() {
  return (
    <PolicyPage
      title="Chính sách thanh toán"
      description="Đa dạng phương thức thanh toán an toàn, bảo mật theo chuẩn PCI DSS. Hỗ trợ trả góp 0% lãi suất và xuất hoá đơn VAT."
      updatedAt="01/01/2026"
      icon={<CreditCard className="h-7 w-7" />}
      sections={sections}
    />
  );
}
import type { Metadata } from "next";
import { Gavel } from "lucide-react";
import { env } from "@/lib/env";
import { getStoreInfo } from "@/lib/store-info";
import { PolicyPage, type PolicySection } from "@/components/shared/policy-page";

const SITE = env.NEXT_PUBLIC_APP_URL;

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreInfo();
  return {
    title: "Chính sách giải quyết khiếu nại",
    description: `Quy trình tiếp nhận và giải quyết khiếu nại tại ${store.name} - theo Luật Bảo vệ quyền lợi người tiêu dùng 2010 và Nghị định 52/2013/NĐ-CP.`,
    alternates: { canonical: `${SITE}/chinh-sach-giai-quyet-khieu-nai` },
  };
}

const sections: PolicySection[] = [
  {
    id: "khai-niem",
    title: "Khiếu nại là gì?",
    content: (
      <>
        <p>
          Khiếu nại là phản ánh của khách hàng về sản phẩm/dịch vụ không đúng cam kết, có lỗi kỹ
          thuật, sai mô tả, hoặc chất lượng không như mong đợi. LapLap cam kết tiếp nhận và
          phản hồi mọi khiếu nại một cách công bằng, minh bạch.
        </p>
      </>
    ),
  },
  {
    id: "kenh-tiep-nhan",
    title: "Kênh tiếp nhận khiếu nại",
    content: (
      <>
        <p>Khách hàng có thể gửi khiếu nại qua các kênh sau:</p>
        <ul>
          <li>
            <strong>Hotline:</strong> 1900 1234 (8:00 - 21:00 hàng ngày)
          </li>
          <li>
            <strong>Email:</strong>{" "}
            <a href="mailto:cskh@laplap.vn">cskh@laplap.vn</a>
          </li>
          <li>
            <strong>Form liên hệ:</strong>{" "}
            <a href="/contact">laplapcantho.store/contact</a>
          </li>
          <li>
            <strong>Trực tiếp:</strong> Showroom tại 123 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ
          </li>
          <li>
            <strong>Đường bưu điện:</strong> Gửi về địa chỉ trên kèm tiêu đề &ldquo;Khiếu nại&rdquo;
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "noi-dung",
    title: "Nội dung khiếu nại cần có",
    content: (
      <>
        <p>Để khiếu nại được xử lý nhanh chóng, vui lòng cung cấp:</p>
        <ol>
          <li>Họ tên, SĐT, email liên hệ.</li>
          <li>Mã đơn hàng hoặc số serial sản phẩm.</li>
          <li>Mô tả chi tiết vấn đề kèm ảnh chụp/video (nếu có).</li>
          <li>Phương án xử lý mong muốn (đổi trả, hoàn tiền, sửa chữa…).</li>
        </ol>
      </>
    ),
  },
  {
    id: "quy-trinh",
    title: "Quy trình xử lý khiếu nại",
    content: (
      <>
        <table>
          <thead>
            <tr>
              <th>Bước</th>
              <th>Thời gian</th>
              <th>Nội dung</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1. Tiếp nhận</td>
              <td>Ngay khi nhận được</td>
              <td>LapLap gửi mã khiếu nại + xác nhận đã tiếp nhận qua email/SĐT</td>
            </tr>
            <tr>
              <td>2. Xác minh</td>
              <td>24 - 48 giờ làm việc</td>
              <td>Kiểm tra lịch sử đơn hàng, tình trạng sản phẩm, liên hệ bên liên quan</td>
            </tr>
            <tr>
              <td>3. Phản hồi</td>
              <td>Sau khi xác minh</td>
              <td>Thông báo kết quả + phương án xử lý cho khách hàng</td>
            </tr>
            <tr>
              <td>4. Giải quyết</td>
              <td>3 - 7 ngày làm việc</td>
              <td>Thực hiện đổi trả/sửa chữa/hoàn tiền theo phương án đã thoả thuận</td>
            </tr>
            <tr>
              <td>5. Đóng khiếu nại</td>
              <td>Sau khi khách xác nhận hài lòng</td>
              <td>Ghi nhận feedback, lưu hồ sơ</td>
            </tr>
          </tbody>
        </table>
        <blockquote>
          <strong>Cam kết:</strong> 100% khiếu nại hợp lệ sẽ được giải quyết trong vòng{" "}
          <strong>7 ngày làm việc</strong>.
        </blockquote>
      </>
    ),
  },
  {
    id: "phuong-an",
    title: "Phương án giải quyết",
    content: (
      <>
        <p>Tuỳ theo tính chất vụ việc, LapLap có thể áp dụng:</p>
        <ul>
          <li>
            <strong>Đổi mới 100%</strong> — khi sản phẩm có lỗi từ nhà sản xuất.
          </li>
          <li>
            <strong>Hoàn tiền 100%</strong> — khi không thể khắc phục hoặc khách không đồng ý
            phương án khác.
          </li>
          <li>
            <strong>Sửa chữa miễn phí</strong> — đối với lỗi kỹ thuật trong bảo hành.
          </li>
          <li>
            <strong>Bồi thường thỏa đáng</strong> — khi sai sót do LapLap, bằng voucher/phiếu
            mua hàng hoặc hoàn tiền một phần.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "khong-hai-long",
    title: "Nếu khách hàng chưa hài lòng",
    content: (
      <>
        <p>
          Nếu phương án giải quyết chưa thoả đáng, khách hàng có quyền:
        </p>
        <ul>
          <li>
            Yêu cầu <strong>xem xét lại</strong> bởi cấp quản lý cao hơn.
          </li>
          <li>
            Gửi khiếu nại đến <strong>Sở Công Thương Cần Thơ</strong> hoặc cơ quan chức năng
            có thẩm quyền.
          </li>
          <li>
            Liên hệ <strong>Hội Bảo vệ quyền lợi người tiêu dùng</strong> tại địa phương.
          </li>
          <li>
            Khởi kiện tại <strong>Toà án nhân dân có thẩm quyền</strong>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "lien-he",
    title: "Liên hệ khiếu nại",
    content: (
      <>
        <p>
          Mọi khiếu nại, vui lòng liên hệ bộ phận Chăm sóc khách hàng:
        </p>
        <ul>
          <li>Hotline: <strong>1900 1234</strong></li>
          <li>Email: <a href="mailto:cskh@laplap.vn">cskh@laplap.vn</a></li>
          <li>Giờ làm việc: 8:00 - 21:00 (Thứ 2 - CN)</li>
        </ul>
      </>
    ),
  },
];

export default async function KhieuNaiPage() {
  const store = await getStoreInfo();
  return (
    <PolicyPage
      title="Chính sách giải quyết khiếu nại"
      description={`Quy trình tiếp nhận và xử lý khiếu nại tại ${store.name} - theo Luật Bảo vệ quyền lợi người tiêu dùng 2010. Cam kết phản hồi 100% trong 7 ngày làm việc.`}
      updatedAt="01/01/2026"
      icon={<Gavel className="h-7 w-7" />}
      sections={sections}
    />
  );
}
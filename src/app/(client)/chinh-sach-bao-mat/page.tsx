import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { env } from "@/lib/env";
import { PolicyPage, type PolicySection } from "@/components/shared/policy-page";

const SITE = env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  title: "Chính sách bảo mật",
  description:
    "Chính sách bảo mật thông tin tại LapLap - tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân và Luật An toàn thông tin mạng 2015.",
  alternates: { canonical: `${SITE}/chinh-sach-bao-mat` },
};

const sections: PolicySection[] = [
  {
    id: "thu-thap",
    title: "Thông tin chúng tôi thu thập",
    content: (
      <>
        <p>
          Để cung cấp dịch vụ tốt nhất, LapLap thu thập các loại thông tin sau:
        </p>
        <h3>1. Thông tin khách hàng cung cấp</h3>
        <ul>
          <li>Họ tên, số điện thoại, email khi đăng ký tài khoản hoặc đặt hàng.</li>
          <li>Địa chỉ giao hàng.</li>
          <li>Thông tin thanh toán (qua cổng VNPay/MoMo — không lưu thẻ).</li>
          <li>Nội dung trao đổi qua form liên hệ, đánh giá sản phẩm.</li>
        </ul>
        <h3>2. Thông tin tự động</h3>
        <ul>
          <li>Địa chỉ IP, loại trình duyệt, hệ điều hành.</li>
          <li>Thời gian truy cập, các trang đã xem.</li>
          <li>Cookie và công nghệ theo dõi tương tự.</li>
        </ul>
      </>
    ),
  },
  {
    id: "muc-dich",
    title: "Mục đích sử dụng",
    content: (
      <>
        <p>Thông tin của bạn được sử dụng cho các mục đích sau:</p>
        <ul>
          <li>Xử lý đơn hàng, giao hàng, thanh toán.</li>
          <li>Liên hệ hỗ trợ khách hàng, bảo hành, đổi trả.</li>
          <li>Gửi thông báo về đơn hàng, chương trình khuyến mãi (nếu đăng ký nhận tin).</li>
          <li>Cải thiện chất lượng website, phân tích hành vi người dùng.</li>
          <li>Tuân thủ nghĩa vụ pháp luật (thuế, kế toán, phòng chống gian lận).</li>
        </ul>
        <blockquote>
          <strong>Cam kết:</strong> LapLap không bán, trao đổi hoặc cho thuê thông tin cá nhân
          của khách hàng cho bên thứ ba vì mục đích thương mại.
        </blockquote>
      </>
    ),
  },
  {
    id: "chia-se",
    title: "Chia sẻ thông tin với bên thứ ba",
    content: (
      <>
        <p>
          Chúng tôi chỉ chia sẻ thông tin trong các trường hợp cần thiết sau:
        </p>
        <ul>
          <li>
            <strong>Đơn vị vận chuyển:</strong> Tên, SĐT, địa chỉ giao hàng (GHTK, GHN, Viettel
            Post…).
          </li>
          <li>
            <strong>Cổng thanh toán:</strong> Thông tin cần thiết để xử lý giao dịch (VNPay,
            MoMo…).
          </li>
          <li>
            <strong>Cơ quan nhà nước:</strong> Khi có yêu cầu bằng văn bản theo quy định pháp
            luật.
          </li>
        </ul>
        <p>
          Tất cả bên thứ ba đều ký cam kết bảo mật thông tin và chỉ sử dụng cho mục đích đã
          thỏa thuận.
        </p>
      </>
    ),
  },
  {
    id: "cookie",
    title: "Cookie và công nghệ theo dõi",
    content: (
      <>
        <p>
          Website sử dụng cookie để nâng cao trải nghiệm người dùng. Bạn có thể tắt cookie
          trong cài đặt trình duyệt, tuy nhiên một số tính năng có thể bị giới hạn.
        </p>
        <ul>
          <li>
            <strong>Cookie cần thiết:</strong> Giỏ hàng, đăng nhập, bảo mật — không thể tắt.
          </li>
          <li>
            <strong>Cookie phân tích:</strong> Google Analytics, giúp chúng tôi hiểu cách bạn
            sử dụng website.
          </li>
          <li>
            <strong>Cookie quảng cáo:</strong> Facebook Pixel (nếu có) để đo lường hiệu quả
            quảng cáo.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "quyen",
    title: "Quyền của khách hàng",
    content: (
      <>
        <p>Theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân, bạn có các quyền:</p>
        <ul>
          <li>
            <strong>Quyền được biết:</strong> Biết thông tin nào được thu thập và mục đích sử
            dụng.
          </li>
          <li>
            <strong>Quyền đồng ý:</strong> Đồng ý hoặc từ chối việc xử lý dữ liệu cá nhân.
          </li>
          <li>
            <strong>Quyền truy cập:</strong> Yêu cầu xem thông tin cá nhân của mình.
          </li>
          <li>
            <strong>Quyền chỉnh sửa:</strong> Yêu cầu cập nhật, sửa đổi thông tin sai.
          </li>
          <li>
            <strong>Quyền xoá:</strong> Yêu cầu xoá dữ liệu cá nhân khi không còn cần thiết.
          </li>
          <li>
            <strong>Quyền hạn chế:</strong> Yêu cầu tạm dừng xử lý dữ liệu trong một số
            trường hợp.
          </li>
          <li>
            <strong>Quyền khiếu nại:</strong> Khiếu nại về việc xử lý dữ liệu cá nhân.
          </li>
        </ul>
        <p>
          Để thực hiện các quyền trên, vui lòng liên hệ:{" "}
          <a href="mailto:privacy@laplap.vn">privacy@laplap.vn</a>
        </p>
      </>
    ),
  },
  {
    id: "bao-mat-ky-thuat",
    title: "Bảo mật kỹ thuật",
    content: (
      <>
        <p>Chúng tôi áp dụng các biện pháp kỹ thuật để bảo vệ dữ liệu của bạn:</p>
        <ul>
          <li>
            <strong>Mã hoá SSL/TLS:</strong> Toàn bộ dữ liệu truyền tải giữa trình duyệt và
            máy chủ được mã hoá.
          </li>
          <li>
            <strong>Hash mật khẩu:</strong> Mật khẩu được hash bằng bcrypt, không lưu dạng plain
            text.
          </li>
          <li>
            <strong>Supabase RLS:</strong> Row Level Security đảm bảo dữ liệu chỉ được truy cập
            bởi người có quyền.
          </li>
          <li>
            <strong>Backup định kỳ:</strong> Database được backup hàng ngày, lưu trữ phân tán.
          </li>
          <li>
            <strong>Giám sát 24/7:</strong> Hệ thống log + alert khi phát hiện truy cập bất
            thường.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "luu-tru",
    title: "Thời gian lưu trữ",
    content: (
      <>
        <p>Thông tin cá nhân được lưu trữ trong các khoảng thời gian sau:</p>
        <table>
          <thead>
            <tr>
              <th>Loại dữ liệu</th>
              <th>Thời gian lưu trữ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Tài khoản khách hàng</td>
              <td>Cho đến khi khách yêu cầu xoá</td>
            </tr>
            <tr>
              <td>Lịch sử đơn hàng</td>
              <td>Tối thiểu 5 năm (theo quy định kế toán)</td>
            </tr>
            <tr>
              <td>Log truy cập</td>
              <td>12 tháng</td>
            </tr>
            <tr>
              <td>Phiên đăng nhập</td>
              <td>30 ngày</td>
            </tr>
            <tr>
              <td>Cookie phân tích</td>
              <td>13 tháng (theo Google)</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "lien-he",
    title: "Liên hệ về bảo mật",
    content: (
      <>
        <p>
          Nếu bạn có bất kỳ câu hỏi nào về Chính sách bảo mật, hoặc phát hiện vấn đề bảo mật,
          vui lòng liên hệ:
        </p>
        <ul>
          <li>
            Email: <a href="mailto:privacy@laplap.vn">privacy@laplap.vn</a>
          </li>
          <li>Hotline: 1900 1234</li>
          <li>Địa chỉ: 123 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ</li>
        </ul>
        <p>
          Cam kết phản hồi trong vòng <strong>48 giờ làm việc</strong>.
        </p>
      </>
    ),
  },
];

export default function BaoMatPage() {
  return (
    <PolicyPage
      title="Chính sách bảo mật"
      description="Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân, Luật An toàn thông tin mạng 2015. Mã hoá SSL, PCI DSS, RLS Supabase."
      updatedAt="01/01/2026"
      icon={<Lock className="h-7 w-7" />}
      sections={sections}
    />
  );
}
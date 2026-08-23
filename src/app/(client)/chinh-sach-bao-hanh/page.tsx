import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { env } from "@/lib/env";
import { getStoreInfo } from "@/lib/store-info";
import { PolicyPage, type PolicySection } from "@/components/shared/policy-page";

const SITE = env.NEXT_PUBLIC_APP_URL;

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreInfo();
  return {
    title: "Chính sách bảo hành",
    description: `Chính sách bảo hành laptop chính hãng tại ${store.name} - điều kiện, thời hạn, quy trình bảo hành tại Cần Thơ.`,
    alternates: { canonical: `${SITE}/chinh-sach-bao-hanh` },
  };
}

const sections: PolicySection[] = [
  {
    id: "dieu-kien",
    title: "Điều kiện bảo hành",
    content: (
      <>
        <p>
          Sản phẩm được bảo hành khi đáp ứng đầy đủ các điều kiện dưới đây. Mọi trường hợp ngoài
          các điều kiện này sẽ được hỗ trợ sửa chữa tính phí (nếu khách hàng có nhu cầu).
        </p>
        <ul>
          <li>Sản phẩm còn trong thời hạn bảo hành (tính từ ngày mua trên hoá đơn).</li>
          <li>Tem bảo hành, số serial còn nguyên vẹn, không bị rách, tẩy xóa.</li>
          <li>Lỗi kỹ thuật do nhà sản xuất, không do tác động bên ngoài.</li>
          <li>Phiếu bảo hành / hoá đơn mua hàng còn lưu giữ.</li>
        </ul>
        <h3>Các trường hợp KHÔNG được bảo hành</h3>
        <ul>
          <li>Sản phẩm bị rơi, va đập, vào nước, cháy nổ hoặc tác động vật lý khác.</li>
          <li>Tự ý tháo, sửa chữa, can thiệp phần cứng/phần mềm.</li>
          <li>Hư hỏng do thiên tai, hoả hoạn, nguồn điện không ổn định.</li>
          <li>Không còn phiếu bảo hành, tem bảo hành bị can thiệp.</li>
          <li>Phụ kiện tiêu hao: pin chai trên 20% so với dung lượng thiết kế sau 12 tháng.</li>
        </ul>
      </>
    ),
  },
  {
    id: "thoi-han",
    title: "Thời hạn bảo hành",
    content: (
      <>
        <p>
          Thời hạn bảo hành áp dụng theo chính sách của hãng hoặc thời hạn ghi trên phiếu bảo
          hành. Tham khảo nhanh:
        </p>
        <table>
          <thead>
            <tr>
              <th>Loại sản phẩm</th>
              <th>Thời hạn</th>
              <th>Hình thức</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Laptop chính hãng (Apple, Dell, ASUS, Lenovo, HP…)</td>
              <td>12 - 24 tháng</td>
              <td>Tại trung tâm bảo hành hãng</td>
            </tr>
            <tr>
              <td>Laptop refurbished</td>
              <td>6 - 12 tháng</td>
              <td>Tại LapLap</td>
            </tr>
            <tr>
              <td>Phụ kiện (sạc, cáp, chuột, balo)</td>
              <td>3 - 12 tháng</td>
              <td>Đổi mới trong 30 ngày đầu</td>
            </tr>
            <tr>
              <td>Pin laptop</td>
              <td>6 - 12 tháng</td>
              <td>Đổi mới nếu chai &gt; 20%</td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>Lưu ý:</strong> Một số dòng máy có chính sách bảo hành toàn cầu (ví dụ Apple
          Care, Dell ProSupport) — khách hàng có thể yêu cầu bảo hành tại các trung tâm uỷ
          quyền trên toàn quốc.
        </p>
      </>
    ),
  },
  {
    id: "quy-trinh",
    title: "Quy trình bảo hành",
    content: (
      <>
        <ol>
          <li>
            <strong>Liên hệ trước:</strong> Gọi hotline hoặc chat Zalo để được hướng dẫn nhanh.
            Mô tả triệu chứng lỗi kèm ảnh chụp/video (nếu có).
          </li>
          <li>
            <strong>Mang máy đến:</strong> Đem máy + phiếu bảo hành + phụ kiện kèm theo đến
            showroom hoặc gửi qua đơn vị vận chuyển (COD 2 chiều).
          </li>
          <li>
            <strong>Tiếp nhận & chẩn đoán:</strong> Kỹ thuật viên tiếp nhận, kiểm tra trong 24 -
            48 giờ làm việc. Thông báo tình trạng lỗi và phương án xử lý.
          </li>
          <li>
            <strong>Sửa chữa / đổi mới:</strong> Thời gian xử lý 3 - 7 ngày làm việc tuỳ tình
            trạng. Trường hợp cần đặt linh kiện, chúng tôi sẽ thông báo thời gian dự kiến.
          </li>
          <li>
            <strong>Trả máy:</strong> Liên hệ khi máy sẵn sàng. Khách kiểm tra tại chỗ và ký
            xác nhận trước khi nhận.
          </li>
        </ol>
        <blockquote>
          <strong>Mẹo:</strong> Trước khi mang đi bảo hành, hãy sao lưu toàn bộ dữ liệu quan
          trọng. Trong quá trình sửa chữa, hệ điều hành có thể được cài đặt lại và dữ liệu có
          thể bị xoá.
        </blockquote>
      </>
    ),
  },
  {
    id: "phi",
    title: "Phí vận chuyển & sửa chữa ngoài bảo hành",
    content: (
      <>
        <p>
          Trường hợp sản phẩm hết bảo hành hoặc không đủ điều kiện bảo hành, chúng tôi cung cấp
          dịch vụ sửa chữa tính phí với báo giá trước khi thực hiện:
        </p>
        <ul>
          <li>
            <strong>Báo giá miễn phí:</strong> Khách hàng chỉ trả phí khi đồng ý phương án sửa.
          </li>
          <li>
            <strong>Vận chuyển 2 chiều:</strong> Miễn phí gửi máy về trung tâm bảo hành đối với
            sản phẩm trong bảo hành. Trường hợp ngoài bảo hành, khách chịu phí vận chuyển.
          </li>
          <li>
            <strong>Phụ kiện thay thế:</strong> Sử dụng linh kiện chính hãng hoặc tương đương
            theo thỏa thuận.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "cam-ket",
    title: "Cam kết của LapLap",
    content: (
      <>
        <p>Chúng tôi cam kết:</p>
        <ul>
          <li>
            Trung thực 100% về tình trạng lỗi — không &ldquo;phạt khách&rdquo; khi máy lỗi do nhà sản xuất.
          </li>
          <li>
            Tốc độ xử lý nhanh nhất — ưu tiên trả máy sớm cho khách hàng.
          </li>
          <li>
            Linh kiện thay thế chính hãng hoặc tương đương chất lượng OEM.
          </li>
          <li>
            Hỗ trợ kỹ thuật miễn phí qua điện thoại/Zalo ngay cả sau khi hết bảo hành.
          </li>
        </ul>
      </>
    ),
  },
];

export default async function BaoHanhPage() {
  const store = await getStoreInfo();
  return (
    <PolicyPage
      title="Chính sách bảo hành"
      description={`Cam kết bảo hành chính hãng và hỗ trợ kỹ thuật tận tâm tại ${store.name}. Mọi sản phẩm đều được bảo hành theo đúng tiêu chuẩn hãng.`}
      updatedAt="01/01/2026"
      icon={<ShieldCheck className="h-7 w-7" />}
      sections={sections}
    />
  );
}
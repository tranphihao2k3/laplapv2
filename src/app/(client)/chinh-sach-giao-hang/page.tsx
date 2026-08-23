import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { env } from "@/lib/env";
import { PolicyPage, type PolicySection } from "@/components/shared/policy-page";

const SITE = env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  title: "Chính sách giao hàng",
  description:
    "Chính sách giao hàng của LapLap - ship nội thành Cần Thơ 2 giờ, ship toàn quốc 2-5 ngày. Miễn phí vận chuyển cho đơn từ 5 triệu.",
  alternates: { canonical: `${SITE}/chinh-sach-giao-hang` },
};

const sections: PolicySection[] = [
  {
    id: "pham-vi",
    title: "Phạm vi giao hàng",
    content: (
      <>
        <p>
          LapLap giao hàng trên phạm vi toàn quốc. Thời gian và phí vận chuyển được tính theo
          khu vực:
        </p>
        <table>
          <thead>
            <tr>
              <th>Khu vực</th>
              <th>Thời gian</th>
              <th>Phí vận chuyển</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nội thành Cần Thơ (các quận Ninh Kiều, Bình Thủy, Cái Răng)</td>
              <td>2 giờ (giờ hành chính)</td>
              <td>Miễn phí (đơn từ 1 triệu)</td>
            </tr>
            <tr>
              <td>Ngoại thành Cần Thơ & tỉnh lân cận (Hậu Giang, Vĩnh Long…)</td>
              <td>1 - 2 ngày</td>
              <td>30.000 - 50.000đ</td>
            </tr>
            <tr>
              <td>Miền Tây (các tỉnh ĐBSCL)</td>
              <td>2 - 3 ngày</td>
              <td>50.000 - 80.000đ</td>
            </tr>
            <tr>
              <td>TP.HCM, Hà Nội, miền Trung</td>
              <td>3 - 5 ngày</td>
              <td>80.000 - 150.000đ</td>
            </tr>
            <tr>
              <td>Đơn hàng từ 5 triệu đồng</td>
              <td>Toàn quốc</td>
              <td>
                <strong>Miễn phí</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "thoi-gian",
    title: "Thời gian giao hàng",
    content: (
      <>
        <ul>
          <li>
            <strong>Đơn đặt trước 14h:</strong> Giao trong ngày (nội thành Cần Thơ) hoặc gửi đi
            trong ngày (tỉnh khác).
          </li>
          <li>
            <strong>Đơn đặt sau 14h:</strong> Giao trong ngày kế tiếp.
          </li>
          <li>
            <strong>Thứ 7, Chủ nhật:</strong> Vẫn nhận đơn nhưng giao hàng từ 9h - 18h.
          </li>
          <li>
            <strong>Ngày lễ, Tết:</strong> Có thể chậm hơn 1 - 2 ngày, sẽ thông báo trước.
          </li>
        </ul>
        <p>
          Trường hợp giao hàng chậm so với cam kết (trừ bất khả kháng), LapLap sẽ miễn phí vận
          chuyển cho đơn hàng đó như một lời xin lỗi.
        </p>
      </>
    ),
  },
  {
    id: "kiem-hang",
    title: "Kiểm hàng trước khi nhận",
    content: (
      <>
        <p>
          Khách hàng được quyền <strong>kiểm tra sản phẩm trước khi thanh toán</strong>. Cụ thể:
        </p>
        <ol>
          <li>Kiểm tra ngoại quan: hộp không móp méo, seal nguyên vẹn.</li>
          <li>Kiểm tra serial trên thân máy khớp với hoá đơn.</li>
          <li>Mở hộp, kiểm tra phụ kiện đầy đủ theo danh sách.</li>
          <li>Bật máy, kiểm tra màn hình, bàn phím, loa, cổng kết nối.</li>
          <li>
            Nếu phát hiện lỗi hoặc thiếu phụ kiện: từ chối nhận hàng và yêu cầu đổi trả ngay
            tại chỗ.
          </li>
        </ol>
        <blockquote>
          <strong>Quan trọng:</strong> Sau khi đã ký xác nhận nhận hàng, mọi khiếu nại về ngoại
          quan và phụ kiện thiếu sẽ không được hỗ trợ. Lỗi kỹ thuật vẫn được bảo hành bình
          thường.
        </blockquote>
      </>
    ),
  },
  {
    id: "don-vi-van-chuyen",
    title: "Đơn vị vận chuyển",
    content: (
      <>
        <p>
          LapLap hợp tác với các đơn vị vận chuyển uy tín để đảm bảo giao hàng nhanh và an toàn:
        </p>
        <ul>
          <li>
            <strong>Nội thành:</strong> Đội ngũ shipper riêng, hỗ trợ kiểm hàng tận nơi.
          </li>
          <li>
            <strong>Liên tỉnh:</strong> GHTK, GHN, Viettel Post, J&T Express.
          </li>
        </ul>
        <p>
          Khách hàng có thể yêu cầu đơn vị vận chuyển cụ thể khi đặt hàng. Trường hợp đơn vị
          vận chuyển làm hư hỏng sản phẩm, LapLap chịu trách nhiệm đổi mới 100%.
        </p>
      </>
    ),
  },
  {
    id: "thanh-toan-cod",
    title: "Thanh toán khi nhận hàng (COD)",
    content: (
      <>
        <p>
          Hỗ trợ thanh toán COD (Cash On Delivery) cho đơn hàng dưới 30 triệu đồng. Quy trình:
        </p>
        <ol>
          <li>Khách đặt hàng, chọn hình thức COD.</li>
          <li>
            LapLap xác nhận đơn và gửi hàng. Khách chỉ thanh toán khi nhận được hàng và kiểm
            tra xong.
          </li>
          <li>Đơn từ 30 triệu: yêu cầu đặt cọc tối thiểu 10% để giữ hàng.</li>
        </ol>
        <p>
          <strong>Lưu ý:</strong> Đơn COD có thể chậm hơn đơn chuyển khoản trước 1 - 2 ngày vì
          cần xác nhận trước khi gửi.
        </p>
      </>
    ),
  },
];

export default function GiaoHangPage() {
  return (
    <PolicyPage
      title="Chính sách giao hàng"
      description="Giao hàng nhanh chóng, an toàn trên toàn quốc. Nội thành Cần Thơ trong 2 giờ, miễn phí ship đơn từ 5 triệu."
      updatedAt="01/01/2026"
      icon={<Truck className="h-7 w-7" />}
      sections={sections}
    />
  );
}
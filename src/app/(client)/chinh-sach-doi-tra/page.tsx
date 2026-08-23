import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { env } from "@/lib/env";
import { PolicyPage, type PolicySection } from "@/components/shared/policy-page";

const SITE = env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  title: "Chính sách đổi trả",
  description:
    "Chính sách đổi trả laptop tại LapLap - đổi trả trong 30 ngày, thu cũ đổi mới, hoàn tiền minh bạch.",
  alternates: { canonical: `${SITE}/chinh-sach-doi-tra` },
};

const sections: PolicySection[] = [
  {
    id: "doi-moi-30-ngay",
    title: "Đổi mới trong 30 ngày đầu",
    content: (
      <>
        <p>
          Áp dụng cho sản phẩm laptop chính hãng mới mua tại <strong>LapLap</strong>. Khách hàng
          có quyền đổi sản phẩm mới trong vòng <strong>30 ngày</strong> kể từ ngày mua nếu đáp
          ứng đồng thời các điều kiện:
        </p>
        <ul>
          <li>Sản phẩm còn nguyên vẹn, không trầy xước, không có dấu hiệu sử dụng ngoài kiểm tra.</li>
          <li>Đầy đủ hộp, phụ kiện, sách hướng dẫn, hoá đơn mua hàng.</li>
          <li>Chưa cài đặt phần mềm, chưa kích hoạt bản quyền vĩnh viễn (vd Microsoft Office).</li>
          <li>Lý do đổi: không ưng ý màu sắc/kiểu dáng, không phù hợp nhu cầu, hoặc lỗi kỹ thuật.</li>
        </ul>
        <p>
          <strong>Giá trị đổi:</strong> Sản phẩm mới có giá trị bằng hoặc cao hơn. Trường hợp
          đổi sang sản phẩm giá thấp hơn, khách được hoàn lại phần chênh lệch (trừ phí vận
          chuyển nếu có).
        </p>
      </>
    ),
  },
  {
    id: "thu-cu-doi-moi",
    title: "Thu cũ đổi mới (Trade-in)",
    content: (
      <>
        <p>
          Chương trình <strong>thu cũ đổi mới</strong> giúp khách hàng lên đời laptop dễ dàng với
          mức định giá minh bạch, cạnh tranh nhất khu vực.
        </p>
        <h3>Quy trình thu cũ</h3>
        <ol>
          <li>Đem máy đến showroom để kỹ thuật viên đánh giá (mất ~15 phút).</li>
          <li>Nhận báo giá thu mua dựa trên: model, năm sản xuất, tình trạng, phụ kiện.</li>
          <li>Chọn máy mới muốn đổi, trừ thẳng giá trị máy cũ vào đơn hàng.</li>
          <li>Hoàn tất thủ tục, nhận máy mới ngay trong ngày.</li>
        </ol>
        <h3>Tiêu chí định giá</h3>
        <ul>
          <li>Máy hoạt động bình thường, không sửa chữa lớn.</li>
          <li>Ngoại hình còn đẹp (không nứt vỡ, không mất phím).</li>
          <li>Có phụ kiện cơ bản: sạc, pin còn tốt.</li>
        </ul>
        <blockquote>
          Mức thu mua thường từ 50% - 80% giá trị ban đầu tuỳ tình trạng. Cam kết báo giá
          công khai, không ép giá.
        </blockquote>
      </>
    ),
  },
  {
    id: "hoan-tien",
    title: "Chính sách hoàn tiền",
    content: (
      <>
        <p>
          Hoàn tiền áp dụng khi khách hàng không muốn đổi sản phẩm khác. Quy trình hoàn tiền:
        </p>
        <ol>
          <li>Yêu cầu hoàn tiền trong vòng 7 ngày kể từ ngày mua.</li>
          <li>Sản phẩm phải còn nguyên trạng như lúc giao (không trầy xước, không sử dụng).</li>
          <li>Đầy đủ hộp, phụ kiện, hoá đơn.</li>
          <li>
            Hoàn tiền trong vòng <strong>5 - 7 ngày làm việc</strong> qua cùng phương thức thanh
            toán ban đầu.
          </li>
        </ol>
        <h3>Phương thức hoàn tiền</h3>
        <table>
          <thead>
            <tr>
              <th>Phương thức thanh toán ban đầu</th>
              <th>Hình thức hoàn tiền</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Tiền mặt</td>
              <td>Tiền mặt tại showroom</td>
              <td>Ngay khi hoàn tất</td>
            </tr>
            <tr>
              <td>Chuyển khoản ngân hàng</td>
              <td>Chuyển khoản cùng tài khoản</td>
              <td>3 - 5 ngày</td>
            </tr>
            <tr>
              <td>Quẹt thẻ (POS)</td>
              <td>Hoàn qua POS cùng thẻ</td>
              <td>5 - 7 ngày (tuỳ ngân hàng)</td>
            </tr>
            <tr>
              <td>Trả góp</td>
              <td>Tất toán hợp đồng với công ty tài chính</td>
              <td>5 - 7 ngày</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "doi-loi",
    title: "Đổi trả do lỗi kỹ thuật",
    content: (
      <>
        <p>
          Nếu sản phẩm phát sinh lỗi kỹ thuật do nhà sản xuất trong vòng <strong>30 ngày</strong>{" "}
          đầu, khách hàng có quyền chọn một trong các phương án:
        </p>
        <ul>
          <li>
            <strong>Đổi mới 100%</strong> sang sản phẩm cùng model (hoặc model tương đương nếu
            hết hàng).
          </li>
          <li>
            <strong>Hoàn tiền 100%</strong> giá trị sản phẩm.
          </li>
          <li>
            <strong>Sửa chữa</strong> miễn phí (xem Chính sách bảo hành).
          </li>
        </ul>
        <p>
          Sau 30 ngày, các lỗi kỹ thuật sẽ được xử lý theo chính sách bảo hành tiêu chuẩn.
        </p>
      </>
    ),
  },
  {
    id: "phi",
    title: "Phí vận chuyển đổi trả",
    content: (
      <>
        <table>
          <thead>
            <tr>
              <th>Trường hợp</th>
              <th>Phí vận chuyển</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Lỗi kỹ thuật do nhà sản xuất</td>
              <td>Miễn phí 2 chiều</td>
            </tr>
            <tr>
              <td>Đổi mới do không ưng ý</td>
              <td>Khách chịu phí ship 1 chiều (~30.000đ)</td>
            </tr>
            <tr>
              <td>Thu cũ đổi mới</td>
              <td>Miễn phí khi đổi tại showroom</td>
            </tr>
            <tr>
              <td>Hoàn tiền</td>
              <td>Trừ phí vận chuyển ban đầu (nếu có)</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "lien-he",
    title: "Liên hệ đổi trả",
    content: (
      <>
        <p>
          Mọi yêu cầu đổi trả, vui lòng liên hệ trước qua hotline <strong>1900 1234</strong>{" "}
          hoặc Zalo <strong>0901 234 567</strong> để được hướng dẫn nhanh nhất. Đem theo sản
          phẩm, hoá đơn và giấy tờ tuỳ thân khi đến showroom.
        </p>
      </>
    ),
  },
];

export default function DoiTraPage() {
  return (
    <PolicyPage
      title="Chính sách đổi trả"
      description="Đổi mới trong 30 ngày, thu cũ đổi mới, hoàn tiền minh bạch. Cam kết quy trình rõ ràng, chi phí hợp lý."
      updatedAt="01/01/2026"
      icon={<RefreshCw className="h-7 w-7" />}
      sections={sections}
    />
  );
}
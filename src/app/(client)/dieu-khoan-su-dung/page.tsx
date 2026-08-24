import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { env } from "@/lib/env";
import { getStoreInfo } from "@/lib/store-info";
import { PolicyPage, type PolicySection } from "@/components/shared/policy-page";

const SITE = env.NEXT_PUBLIC_APP_URL;

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreInfo();
  return {
    title: "Điều khoản sử dụng",
    description: `Điều khoản sử dụng website ${store.name} - quyền và nghĩa vụ của người dùng khi truy cập, mua hàng và sử dụng dịch vụ.`,
    alternates: { canonical: `${SITE}/dieu-khoan-su-dung` },
  };
}

const sections: PolicySection[] = [
  {
    id: "chap-nhan",
    title: "Chấp nhận điều khoản",
    content: (
      <>
        <p>
          Bằng việc truy cập và sử dụng website <strong>laplapcantho.store</strong> (sau đây gọi là
          &ldquo;Website&rdquo;) của <strong>CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ LAPLAP</strong> (sau đây gọi là
          &ldquo;LapLap&rdquo;, &ldquo;chúng tôi&rdquo;), bạn đồng ý tuân thủ các điều khoản và điều kiện sử dụng được
          nêu dưới đây.
        </p>
        <p>
          Nếu bạn <strong>không đồng ý</strong> với bất kỳ điều khoản nào, vui lòng ngừng sử dụng
          Website ngay lập tức.
        </p>
      </>
    ),
  },
  {
    id: "thay-doi",
    title: "Thay đổi điều khoản",
    content: (
      <>
        <p>
          LapLap có quyền sửa đổi, bổ sung điều khoản bất kỳ lúc nào. Phiên bản mới nhất luôn
          được đăng tại đây với ngày cập nhật. Việc bạn tiếp tục sử dụng Website sau khi có
          thay đổi đồng nghĩa với việc chấp nhận điều khoản mới.
        </p>
      </>
    ),
  },
  {
    id: "tai-khoan",
    title: "Tài khoản người dùng",
    content: (
      <>
        <ul>
          <li>
            Khi đăng ký tài khoản, bạn cam kết cung cấp thông tin chính xác, đầy đủ và cập nhật.
          </li>
          <li>
            Bạn chịu trách nhiệm bảo mật mật khẩu và mọi hoạt động diễn ra dưới tài khoản của
            mình.
          </li>
          <li>
            Thông báo ngay cho chúng tôi nếu phát hiện truy cập trái phép vào tài khoản.
          </li>
          <li>
            LapLap có quyền khoá hoặc xoá tài khoản vi phạm điều khoản mà không cần báo trước.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "su-dung",
    title: "Sử dụng website hợp pháp",
    content: (
      <>
        <p>Khi sử dụng Website, bạn <strong>không được</strong>:</p>
        <ul>
          <li>
            Đăng tải nội dung vi phạm pháp luật, xuyên tạc, phỉ báng, kích động bạo lực, phân
            biệt vùng miền/sắc tộc/tôn giáo.
          </li>
          <li>
            Tấn công, phá hoại hệ thống, phát tán mã độc, lừa đảo, đánh cắp dữ liệu.
          </li>
          <li>
            Can thiệp vào trải nghiệm người dùng khác (spam, quảng cáo trái phép, bình luận không
            liên quan).
          </li>
          <li>
            Thu thập thông tin người dùng khác mà không có sự đồng ý.
          </li>
          <li>
            Sử dụng Website vào mục đích thương mại mà không có thoả thuận bằng văn bản với
            LapLap.
          </li>
          <li>
            Mạo danh cá nhân/tổ chức khác.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "so-huu-tri-tue",
    title: "Sở hữu trí tuệ",
    content: (
      <>
        <p>
          Toàn bộ nội dung trên Website (văn bản, hình ảnh, logo, biểu tượng, video, mã
          nguồn…) thuộc quyền sở hữu của <strong>LapLap</strong> hoặc các đối tác được cấp
          phép, được bảo vệ bởi Luật Sở hữu trí tuệ Việt Nam và các điều ước quốc tế.
        </p>
        <p>
          Bạn được phép xem, tải về và in các nội dung cho mục đích cá nhân, phi thương mại.
          Mọi hành vi sao chép, phân phối, sửa đổi, tái xuất bản vì mục đích thương mại đều cần
          văn bản đồng ý trước của chúng tôi.
        </p>
      </>
    ),
  },
  {
    id: "dat-hang",
    title: "Đặt hàng & thanh toán",
    content: (
      <>
        <ol>
          <li>
            Đơn hàng được xác nhận qua email/SĐT trong vòng 2 giờ làm việc (trừ ngoài giờ).
          </li>
          <li>
            LapLap có quyền từ chối đơn hàng nếu phát hiện dấu hiệu gian lận, sai giá, hoặc không
            đủ tồn kho.
          </li>
          <li>
            Giá hiển thị đã bao gồm VAT (nếu có). Phí vận chuyển được tính riêng theo khu vực.
          </li>
          <li>
            Hợp đồng mua bán chính thức được xác lập khi hai bên xác nhận thanh toán/giao hàng
            thành công.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "tu-choi-trach-nhiem",
    title: "Giới hạn trách nhiệm",
    content: (
      <>
        <p>
          LapLap <strong>không chịu trách nhiệm</strong> cho các thiệt hại gián tiếp, ngẫu
          nhiên, đặc biệt phát sinh từ việc sử dụng hoặc không thể sử dụng Website.
        </p>
        <p>
          Trong phạm vi pháp luật cho phép, tổng trách nhiệm của LapLap không vượt quá giá
          trị đơn hàng của bạn.
        </p>
      </>
    ),
  },
  {
    id: "phap-luat",
    title: "Luật áp dụng & giải quyết tranh chấp",
    content: (
      <>
        <p>
          Điều khoản này được điều chỉnh bởi <strong>pháp luật Việt Nam</strong>. Mọi tranh chấp
          phát sinh liên quan đến việc sử dụng Website sẽ được giải quyết tại Toà án có thẩm
          quyền tại thành phố Cần Thơ.
        </p>
        <p>
          Hai bên ưu tiên giải quyết tranh chấp thông qua thương lượng. Nếu không đạt được thoả
          thuận, vụ việc sẽ được đưa ra Toà án theo quy định pháp luật.
        </p>
      </>
    ),
  },
  {
    id: "lien-he",
    title: "Liên hệ",
    content: (
      <>
        <p>Mọi câu hỏi về Điều khoản sử dụng, vui lòng liên hệ:</p>
        <ul>
          <li>CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ LAPLAP</li>
          <li>Địa chỉ: 123 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ</li>
          <li>Email: info@laplap.vn</li>
          <li>Hotline: 1900 1234</li>
        </ul>
      </>
    ),
  },
];

export default async function DieuKhoanPage() {
  const store = await getStoreInfo();
  return (
    <PolicyPage
      title="Điều khoản sử dụng"
      description={`Quy định về quyền và nghĩa vụ khi truy cập, mua hàng và sử dụng dịch vụ tại ${store.name}.`}
      updatedAt="01/01/2026"
      icon={<FileText className="h-7 w-7" />}
      sections={sections}
    />
  );
}
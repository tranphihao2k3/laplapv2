import type { Metadata } from "next";
import Link from "next/link";
import {
  HelpCircle,
  ShoppingCart,
  ShieldCheck,
  RefreshCw,
  Truck,
  CreditCard,
  Wrench,
  ArrowRight,
} from "lucide-react";
import { env } from "@/lib/env";
import { getStoreInfo } from "@/lib/store-info";
import { Reveal } from "@/components/client/home/reveal";
import { FaqList, type FaqGroup } from "@/components/shared/faq-list";

const SITE = env.NEXT_PUBLIC_APP_URL;

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreInfo();
  return {
    title: "Câu hỏi thường gặp",
    description: `Tổng hợp câu hỏi thường gặp về mua hàng, bảo hành, đổi trả, trả góp tại ${store.name}.`,
    alternates: { canonical: `${SITE}/cau-hoi-thuong-gap` },
  };
}

const GROUPS: FaqGroup[] = [
  {
    id: "mua-hang",
    title: "Mua hàng & Sản phẩm",
    icon: <ShoppingCart className="h-5 w-5" />,
    items: [
      {
        q: "Làm sao để đặt mua laptop trên website LapLap?",
        a: "Bạn có thể đặt mua theo 3 cách: (1) Đặt trực tuyến trên website — chọn sản phẩm, thêm vào giỏ hàng và thanh toán; (2) Gọi hotline 1900 1234 để được tư vấn và đặt hàng qua điện thoại; (3) Đến trực tiếp showroom tại 123 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ để xem máy và mua tại cửa hàng.",
      },
      {
        q: "Sản phẩm trên website có phải chính hãng 100% không?",
        a: "Cam kết 100% chính hãng. Mọi sản phẩm đều có hoá đơn VAT, phiếu bảo hành chính hãng từ hãng. Chúng tôi nói không với hàng nhập lậu, hàng refurbished bán như mới. Nếu phát hiện hàng không chính hãng, LapLap hoàn tiền 200% giá trị đơn hàng.",
      },
      {
        q: "Tôi có thể đặt hàng nhưng chưa muốn thanh toán ngay được không?",
        a: "Có. Bạn có thể đặt cọc giữ hàng (10-30% giá trị) trong vòng 24-48 giờ, sau đó hoàn tất thanh toán khi sẵn sàng nhận máy. Đặc biệt phù hợp với các dòng máy cao cấp hoặc khi bạn cần xin ý kiến gia đình.",
      },
      {
        q: "Làm sao biết máy còn hàng?",
        a: "Trên website, sản phẩm có nút 'Thêm vào giỏ' nghĩa là còn hàng. Trường hợp hết hàng tạm thời, hệ thống sẽ hiển thị 'Hết hàng' và cho phép bạn đăng ký nhận thông báo khi có hàng lại. Bạn cũng có thể gọi hotline để được kiểm tra tồn kho thực tế.",
      },
    ],
  },
  {
    id: "gia-thanh-toan",
    title: "Giá & Thanh toán",
    icon: <CreditCard className="h-5 w-5" />,
    items: [
      {
        q: "Giá trên website đã bao gồm VAT chưa?",
        a: "Giá hiển thị đã bao gồm VAT (10%). Xuất hoá đơn VAT điện tử cho doanh nghiệp hoàn toàn miễn phí. Bạn chỉ cần cung cấp thông tin công ty khi đặt hàng.",
      },
      {
        q: "LapLap có hỗ trợ trả góp 0% không?",
        a: "Có. Hỗ trợ trả góp 0% lãi suất qua thẻ tín dụng (Visa/Master/JCB) cho đơn từ 5 triệu, kỳ hạn 3-12 tháng tuỳ ngân hàng. Ngoài ra còn hỗ trợ trả góp qua Home Credit, FE Credit với thủ tục nhanh gọn qua CCCD.",
      },
      {
        q: "Các hình thức thanh toán được hỗ trợ?",
        a: "Tiền mặt, chuyển khoản ngân hàng, quẹt thẻ (POS), ví MoMo/ZaloPay/VNPay, COD (nhận hàng trả tiền), và trả góp. Xem chi tiết tại trang Chính sách thanh toán.",
      },
      {
        q: "Tôi muốn xuất hoá đơn đỏ cho công ty thì làm thế nào?",
        a: "Khi đặt hàng, chọn 'Xuất hoá đơn VAT' và điền thông tin: tên công ty, MST, địa chỉ. Hoá đơn điện tử sẽ được gửi qua email trong vòng 24 giờ sau khi thanh toán. Hoàn toàn miễn phí.",
      },
    ],
  },
  {
    id: "giao-hang",
    title: "Giao hàng & Lắp đặt",
    icon: <Truck className="h-5 w-5" />,
    items: [
      {
        q: "Thời gian giao hàng là bao lâu?",
        a: "Nội thành Cần Thơ: 2 giờ (nếu đặt trước 14h). Ngoại thành & tỉnh lân cận: 1-2 ngày. Miền Tây: 2-3 ngày. HCM/Hà Nội: 3-5 ngày. Đơn từ 5 triệu được miễn phí vận chuyển toàn quốc.",
      },
      {
        q: "Tôi có được kiểm tra hàng trước khi thanh toán không?",
        a: "Hoàn toàn có. Đây là quyền của bạn. Bạn có thể kiểm tra ngoại quan hộp, mở hộp xem máy, bật máy test trước khi ký nhận. Nếu phát hiện lỗi hoặc thiếu phụ kiện, bạn có quyền từ chối nhận.",
      },
      {
        q: "Phí vận chuyển được tính thế nào?",
        a: "Nội thành Cần Thơ: miễn phí (đơn từ 1 triệu). Ngoại thành: 30-50k. Miền Tây: 50-80k. HCM/Hà Nội: 80-150k. Đơn từ 5 triệu: miễn phí toàn quốc. Xem chi tiết tại Chính sách giao hàng.",
      },
    ],
  },
  {
    id: "bao-hanh",
    title: "Bảo hành & Sửa chữa",
    icon: <ShieldCheck className="h-5 w-5" />,
    items: [
      {
        q: "Thời hạn bảo hành laptop là bao lâu?",
        a: "Laptop chính hãng mới: 12-24 tháng tuỳ hãng (Apple 12 tháng, Dell/HP/Lenovo/ASUS 12-24 tháng). Phụ kiện: 3-12 tháng. Bảo hành tại trung tâm uỷ quyền của hãng trên toàn quốc.",
      },
      {
        q: "Máy bị lỗi trong 30 ngày đầu xử lý thế nào?",
        a: "Bạn có 3 lựa chọn: (1) Đổi mới 100% sang sản phẩm cùng model; (2) Hoàn tiền 100% không cần lý do; (3) Sửa chữa miễn phí. LapLap hỗ trợ đổi trả tận nơi, miễn phí vận chuyển 2 chiều.",
      },
      {
        q: "Pin laptop bị chai có được bảo hành không?",
        a: "Pin được bảo hành 6-12 tháng. Điều kiện: dung lượng thực tế chai > 20% so với thiết kế. Nếu đạt điều kiện, được đổi pin mới miễn phí. Sau thời hạn bảo hành, vẫn hỗ trợ thay pin tính phí với giá ưu đãi.",
      },
      {
        q: "Sửa laptop ở đâu là chính hãng?",
        a: "Sản phẩm bảo hành được sửa tại trung tâm uỷ quyền của hãng (Apple Authorized, Dell Service Center…). LapLap là cầu nối tiếp nhận và chuyển máy đi, đồng thời hỗ trợ kỹ thuật nhanh các lỗi phần mềm/thường gặp ngay tại showroom.",
      },
    ],
  },
  {
    id: "doi-tra",
    title: "Đổi trả & Hoàn tiền",
    icon: <RefreshCw className="h-5 w-5" />,
    items: [
      {
        q: "Chính sách đổi trả như thế nào?",
        a: "Đổi mới trong 30 ngày nếu không ưng ý. Sản phẩm cần còn nguyên vẹn, đầy đủ hộp phụ kiện, chưa qua sử dụng. Lỗi kỹ thuật được đổi mới 100% trong 30 ngày đầu, hoặc hoàn tiền nếu khách không muốn đổi.",
      },
      {
        q: "Thu cũ đổi mới được định giá thế nào?",
        a: "Mức thu mua dao động 50-80% giá trị ban đầu, tuỳ model, năm sản xuất, tình trạng. Báo giá công khai tại showroom trong 15 phút. Trừ thẳng vào đơn mua máy mới.",
      },
      {
        q: "Hoàn tiền mất bao lâu?",
        a: "Sau khi duyệt yêu cầu, thời gian nhận tiền tuỳ phương thức: Tiền mặt ngay tại shop; Chuyển khoản 3-5 ngày; Thẻ POS 5-7 ngày; Trả góp tất toán trong 5-7 ngày.",
      },
    ],
  },
  {
    id: "tai-khoan",
    title: "Tài khoản & Bảo mật",
    icon: <HelpCircle className="h-5 w-5" />,
    items: [
      {
        q: "Đăng ký tài khoản có bắt buộc không?",
        a: "Không bắt buộc. Bạn có thể mua hàng với tư cách khách (guest). Tuy nhiên, đăng ký tài khoản giúp theo dõi đơn hàng, tích điểm, nhận ưu đãi sinh nhật và đăng ký nhận thông báo sản phẩm mới.",
      },
      {
        q: "Tôi quên mật khẩu thì làm sao?",
        a: "Trang đăng nhập có nút 'Quên mật khẩu'. Nhập email đăng ký, hệ thống sẽ gửi link đặt lại mật khẩu qua email trong vài phút. Link có hiệu lực 1 giờ. Nếu không nhận được, kiểm tra thư mục spam.",
      },
      {
        q: "Thông tin cá nhân của tôi có được bảo mật không?",
        a: "Cam kết bảo mật theo Nghị định 13/2023/NĐ-CP. Mật khẩu hash bcrypt, thanh toán qua cổng PCI DSS, dữ liệu truyền mã hoá SSL/TLS. LapLap không bán thông tin khách hàng cho bên thứ ba.",
      },
    ],
  },
];

export default async function FaqPage() {
  const store = await getStoreInfo();

  return (
    <div className="bg-white pb-20">
      {/* Hero */}
      <section className="container pt-6 md:pt-10">
        <Reveal variant="clip-up">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-8 py-16 text-center md:px-16 md:py-24">
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-400/30 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-indigo-400/30 blur-[100px]" />

            <div className="relative z-10 mx-auto max-w-3xl">
              <Reveal variant="fade-up" delay={150}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-100 backdrop-blur-md">
                  <HelpCircle className="h-3.5 w-3.5" /> Hỗ trợ nhanh
                </span>
              </Reveal>
              <Reveal variant="slide-split" delay={250}>
                <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-6xl">
                  Câu hỏi thường gặp
                </h1>
              </Reveal>
              <Reveal variant="fade-up" delay={350}>
                <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-blue-100 md:text-lg">
                  Tổng hợp các câu hỏi phổ biến nhất về mua hàng, bảo hành, đổi trả và dịch vụ
                  tại {store.name}. Tìm kiếm nhanh phía dưới.
                </p>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ list */}
      <section className="container pt-12 md:pt-16">
        <div className="mx-auto max-w-4xl">
          <FaqList groups={GROUPS} />
        </div>
      </section>

      {/* CTA */}
      <section className="container pt-16 md:pt-20">
        <Reveal variant="fade-up">
          <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 text-center md:p-12">
            <Wrench className="mx-auto mb-4 h-10 w-10 text-slate-700" />
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Vẫn chưa tìm được câu trả lời?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 md:text-base">
              Đội ngũ CSKH của {store.name} luôn sẵn sàng hỗ trợ bạn qua hotline, Zalo hoặc
              email. Phản hồi trong vòng 24 giờ làm việc.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-6 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Liên hệ CSKH <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="tel:19001234"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Gọi 1900 1234
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
import { ShieldCheck, Truck, RotateCcw, Headphones, CreditCard, PackageCheck } from "lucide-react";

const POLICIES = [
  {
    icon: ShieldCheck,
    title: "Bảo hành chính hãng",
    desc: "Sản phẩm được bảo hành chính hãng theo tiêu chuẩn nhà sản xuất. Hỗ trợ 1 đổi 1 trong thời gian quy định nếu lỗi phần cứng.",
  },
  {
    icon: Truck,
    title: "Miễn phí vận chuyển",
    desc: "Miễn phí giao hàng nội thành Cần Thơ. Giao hàng toàn quốc nhanh chóng, đóng gói cẩn thận, kiểm tra trước khi nhận.",
  },
  {
    icon: RotateCcw,
    title: "Đổi trả trong 15 ngày",
    desc: "Đổi trả miễn phí trong vòng 15 ngày nếu sản phẩm lỗi do nhà sản xuất hoặc không đúng mô tả.",
  },
  {
    icon: CreditCard,
    title: "Thanh toán linh hoạt",
    desc: "Hỗ trợ trả góp 0% qua thẻ tín dụng và các đối tác tài chính. Thanh toán khi nhận hàng (COD).",
  },
  {
    icon: Headphones,
    title: "Tư vấn tận tâm",
    desc: "Đội ngũ kỹ thuật giàu kinh nghiệm tư vấn cấu hình phù hợp nhu cầu. Hỗ trợ kỹ thuật trọn đời sản phẩm.",
  },
  {
    icon: PackageCheck,
    title: "Cam kết hàng chính hãng",
    desc: "100% sản phẩm nguyên seal, đầy đủ phụ kiện và hóa đơn VAT. Hoàn tiền nếu phát hiện hàng giả.",
  },
];

export function WarrantyPolicy() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {POLICIES.map((p) => {
        const Icon = p.icon;
        return (
          <div
            key={p.title}
            className="flex gap-3 rounded-xl border bg-card/50 p-4 transition-colors hover:bg-card"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

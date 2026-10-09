"use client";

import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { Star, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const REVIEWS = [
  {
    name: "Nguyễn Minh Tuấn",
    role: "Kỹ sư phần mềm",
    avatar: "NM",
    rating: 5,
    text: "Mua MacBook Pro M3 tại LapLap, giá tốt hơn nơi khác 2 triệu mà hàng chính hãng 100%. Nhân viên tư vấn nhiệt tình, giao hàng đúng hẹn.",
    product: "MacBook Pro M3",
  },
  {
    name: "Trần Thị Lan",
    role: "Giáo viên",
    avatar: "TL",
    rating: 5,
    text: "Lần đầu mua laptop trả góp rất lo lắng, nhưng nhân viên hỗ trợ hết sức chu đáo. Thủ tục đơn giản, duyệt nhanh 30 phút.",
    product: "Dell Inspiron 15",
  },
  {
    name: "Lê Văn Phúc",
    role: "Sinh viên CNTT",
    avatar: "LP",
    rating: 5,
    text: "Laptop cũ mang lên được định giá rất hợp lý, không bị ép giá như mấy chỗ khác. Đổi ASUS ZenBook mới tinh, được tặng thêm 2 triệu.",
    product: "ASUS ZenBook 14",
  },
  {
    name: "Phạm Thu Hương",
    role: "Designer freelance",
    avatar: "PH",
    rating: 5,
    text: "Cần máy mạnh cho Illustrator và Premiere. Nhân viên tư vấn rất sâu, giúp mình chọn được MSI Creator phù hợp ngân sách.",
    product: "MSI Creator M16",
  },
];

function StarRating({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("h-3.5 w-3.5", i < n ? "fill-amber-400 text-amber-400" : "text-muted")} />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="container py-12 sm:py-16">
      <SectionHeader
        align="center"
        eyebrow="Đánh giá khách hàng"
        title="Khách hàng nói gì về chúng tôi"
      />
      <div className="-mt-3 mb-8 flex items-center justify-center gap-2">
        <StarRating n={5} />
        <span className="text-sm font-semibold">4.9/5</span>
        <span className="text-sm text-muted-foreground">· 1.200+ đánh giá</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {REVIEWS.map((r, i) => (
          <Reveal key={r.name} variant="fade-up" delay={i * 70} threshold={0.05}>
            <div className="flex h-full flex-col rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-6">
              <div className="flex items-center justify-between">
                <StarRating n={r.rating} />
                <Quote className="h-5 w-5 text-muted" />
              </div>

              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{r.text}&rdquo;
              </p>

              <div className="mt-5 flex items-center gap-3 border-t pt-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {r.avatar}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{r.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.role}</p>
                </div>
              </div>
              <div className="mt-3">
                <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Đã mua: {r.product}
                </span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
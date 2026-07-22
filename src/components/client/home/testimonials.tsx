"use client";

import { Reveal } from "./reveal";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const REVIEWS = [
  {
    name: "Nguyễn Minh Tuấn",
    role: "Kỹ sư phần mềm",
    avatar: "NM",
    rating: 5,
    text: "Mua MacBook Pro M3 tại LapLap, giá tốt hơn nơi khác 2 triệu mà hàng chính hãng 100%. Nhân viên tư vấn nhiệt tình, giao hàng đúng hẹn. Sẽ quay lại mua tiếp.",
    product: "MacBook Pro M3",
    color: "bg-blue-50 border-blue-100",
    avatarColor: "bg-blue-600",
  },
  {
    name: "Trần Thị Lan",
    role: "Giáo viên",
    avatar: "TL",
    rating: 5,
    text: "Lần đầu mua laptop trả góp rất lo lắng, nhưng nhân viên hỗ trợ hết sức chu đáo. Thủ tục đơn giản, duyệt nhanh 30 phút. Dell Inspiron chạy ổn định, hài lòng lắm.",
    product: "Dell Inspiron 15",
    color: "bg-emerald-50 border-emerald-100",
    avatarColor: "bg-emerald-600",
  },
  {
    name: "Lê Văn Phúc",
    role: "Sinh viên CNTT",
    avatar: "LP",
    rating: 5,
    text: "Laptop cũ mang lên được định giá rất hợp lý, không bị ép giá như mấy chỗ khác. Đổi ASUS ZenBook mới tinh, được tặng thêm 2 triệu ưu đãi. Quá đỉnh!",
    product: "ASUS ZenBook 14",
    color: "bg-violet-50 border-violet-100",
    avatarColor: "bg-violet-600",
  },
  {
    name: "Phạm Thu Hương",
    role: "Designer freelance",
    avatar: "PH",
    rating: 5,
    text: "Cần máy mạnh cho Illustrator và Premiere. Nhân viên tư vấn rất sâu, giúp mình chọn được MSI Creator phù hợp ngân sách. Máy chạy cực mượt, cảm ơn LapLap!",
    product: "MSI Creator M16",
    color: "bg-amber-50 border-amber-100",
    avatarColor: "bg-amber-600",
  },
];

function StarRating({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn("h-3.5 w-3.5", i < n ? "fill-amber-400 text-amber-400" : "text-slate-200")}
        />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="container pt-10 sm:pt-16">
      <Reveal variant="slide-split" threshold={0.08}>
        <div className="mb-5 text-center sm:mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Đánh giá khách hàng
          </p>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Khách hàng nói gì về chúng tôi</h2>
          <div className="mx-auto mt-3 flex items-center justify-center gap-2">
            <StarRating n={5} />
            <span className="text-sm font-semibold text-slate-700">4.9/5</span>
            <span className="text-sm text-slate-400">· 1.200+ đánh giá</span>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {REVIEWS.map((r, i) => (
          <Reveal
            key={r.name}
            variant={i % 3 === 0 ? "fade-up" : i % 3 === 1 ? "flip-x" : "fade-right"}
            delay={i * 100}
            threshold={0.05}
          >
            <div
              className={cn(
                "flex h-full flex-col rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:p-5",
                r.color
              )}
            >
              {/* Stars */}
              <StarRating n={r.rating} />

              {/* Quote */}
              <p className="mt-3 flex-1 text-xs leading-relaxed text-slate-600">&ldquo;{r.text}&rdquo;</p>

              {/* Footer */}
              <div className="mt-4 flex items-center gap-3 border-t border-current/10 pt-4">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                    r.avatarColor
                  )}
                >
                  {r.avatar}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{r.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{r.role}</p>
                </div>
              </div>
              <div className="mt-2">
                <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
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

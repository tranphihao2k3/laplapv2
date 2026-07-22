"use client";

import { ShieldCheck, Truck, RefreshCw, PhoneCall } from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    Icon: ShieldCheck,
    title: "Hàng chính hãng 100%",
    sub: "Hoàn tiền nếu hàng giả",
    accent: "text-blue-600",
    bar: "bg-blue-600",
  },
  {
    Icon: Truck,
    title: "Giao hàng nhanh",
    sub: "Nội thành Cần Thơ trong 2h",
    accent: "text-emerald-600",
    bar: "bg-emerald-600",
  },
  {
    Icon: RefreshCw,
    title: "Đổi trả 30 ngày",
    sub: "Miễn phí không cần lý do",
    accent: "text-amber-600",
    bar: "bg-amber-500",
  },
  {
    Icon: PhoneCall,
    title: "Hỗ trợ 24/7",
    sub: "1900 1234 miễn phí",
    accent: "text-violet-600",
    bar: "bg-violet-600",
  },
];

export function TrustBar() {
  return (
    <section className="container pt-10 sm:pt-16">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 md:grid-cols-4 md:divide-y-0">
          {ITEMS.map(({ Icon, title, sub, accent, bar }, i) => (
            <Reveal key={title} variant="fade-up" delay={i * 80} threshold={0.05}>
              <div className="group relative flex h-full flex-col gap-2 p-4 transition-colors duration-300 hover:bg-slate-50/70 sm:p-6">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                    accent
                  )}
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800 sm:text-sm">{title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">{sub}</p>
                </div>

                {/* Bottom accent line */}
                <div
                  className={cn(
                    "absolute bottom-0 left-0 h-0.5 w-0 rounded-full transition-all duration-500 group-hover:w-full",
                    bar
                  )}
                />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

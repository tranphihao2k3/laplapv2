"use client";

import { ShieldCheck, Truck, RefreshCw, PhoneCall } from "lucide-react";
import { Reveal } from "./reveal";

const ITEMS = [
  { Icon: ShieldCheck, title: "Hàng chính hãng 100%", sub: "Hoàn tiền nếu hàng giả" },
  { Icon: Truck,       title: "Giao hàng nhanh",       sub: "Nội thành Cần Thơ trong 2h" },
  { Icon: RefreshCw,   title: "Đổi trả 30 ngày",       sub: "Miễn phí không cần lý do" },
  { Icon: PhoneCall,   title: "Hỗ trợ 24/7",           sub: "1900 1234 miễn phí" },
];

export function TrustBar() {
  return (
    <section className="container pt-14 sm:pt-24">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 md:grid-cols-4 md:divide-y-0">
          {ITEMS.map(({ Icon, title, sub }, i) => (
            <Reveal key={title} variant="fade-up" delay={i * 70} threshold={0.05}>
              <div className="group relative flex h-full flex-col gap-2.5 p-5 transition-colors duration-300 hover:bg-slate-50/70 sm:p-6">
                <Icon className="h-5 w-5 text-slate-400 transition-colors duration-300 group-hover:text-slate-900" />
                <div>
                  <p className="text-[13px] font-semibold text-slate-800 sm:text-sm">{title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">{sub}</p>
                </div>

                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-0 h-0.5 w-0 rounded-full bg-slate-900 transition-all duration-500 group-hover:w-full" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

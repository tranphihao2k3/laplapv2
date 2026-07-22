"use client";

import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";
import { Users, Package, Star, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STATS = [
  { icon: Users,   value: 12000, suffix: "+", label: "Khách hàng tin tùng",    color: "text-blue-600",   bg: "bg-blue-50" },
  { icon: Package, value: 500,   suffix: "+", label: "Sản phẩm đang bán",       color: "text-emerald-600",bg: "bg-emerald-50" },
  { icon: Star,    value: 4.9,   suffix: "/5", label: "Đánh giá trung bình",    color: "text-amber-500",  bg: "bg-amber-50" },
  { icon: Wrench,  value: 8,     suffix: " năm", label: "Kinh nghiệm hoạt động", color: "text-violet-600", bg: "bg-violet-50" },
];

function Counter({ target, suffix, decimals = 0 }: { target: number; suffix: string; decimals?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1800;
        const start = performance.now();
        function step(now: number) {
          const t = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
          setCount(+(ease * target).toFixed(decimals));
          if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        io.disconnect();
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [target, decimals]);

  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString("vi-VN")}
      {suffix}
    </span>
  );
}

export function StatsBar() {
  return (
    <section className="container pt-8 sm:pt-12">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        {STATS.map(({ icon: Icon, value, suffix, label, color, bg }, i) => (
          <Reveal key={label} variant="scale-up" delay={i * 80} threshold={0.1}>
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:gap-3 sm:p-5">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10", bg)}>
                <Icon className={cn("h-5 w-5", color)} />
              </div>
              <div>
                <p className={cn("text-xl font-extrabold tracking-tight sm:text-2xl", color)}>
                  <Counter
                    target={value}
                    suffix={suffix}
                    decimals={value % 1 !== 0 ? 1 : 0}
                  />
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{label}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

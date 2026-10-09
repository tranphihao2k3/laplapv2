"use client";

import { Reveal } from "./reveal";
import { Users, Package, Star, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STATS = [
  { icon: Users,   value: 12000, suffix: "+",    label: "Khách hàng tin tưởng" },
  { icon: Package, value: 500,   suffix: "+",    label: "Sản phẩm đang bán" },
  { icon: Star,    value: 4.9,   suffix: "/5",   label: "Đánh giá trung bình" },
  { icon: Wrench,  value: 8,     suffix: " năm", label: "Kinh nghiệm hoạt động" },
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
          const ease = 1 - Math.pow(1 - t, 3);
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
    <section className="container py-12 sm:py-16">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-4 md:divide-y-0">
          {STATS.map(({ icon: Icon, value, suffix, label }, i) => (
            <Reveal key={label} variant="fade-up" delay={i * 70} threshold={0.1}>
              <div className="flex flex-col gap-3 p-5 transition-colors hover:bg-muted/50 sm:p-7">
                <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                <div>
                  <p className="text-2xl font-bold tracking-tight sm:text-[28px]">
                    <Counter target={value} suffix={suffix} decimals={value % 1 !== 0 ? 1 : 0} />
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{label}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
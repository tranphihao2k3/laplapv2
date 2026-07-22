"use client";

import Link from "next/link";
import { Gamepad2, Briefcase, Palette, Feather, ArrowUpRight, type LucideIcon } from "lucide-react";
import { useHomeFilters } from "./use-home-data";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

// Style theo từng nhóm nhu cầu (slug khớp src/lib/product-collections.ts).
const NEED_META: Record<
  string,
  { icon: LucideIcon; desc: string; gradient: string; badge: string; iconColor: string }
> = {
  gaming: {
    icon: Gamepad2,
    desc: "Card rời mạnh, chiến game mượt ở thiết lập cao",
    gradient: "from-red-50 to-orange-50/50 border-red-200",
    badge: "bg-red-100 text-red-700",
    iconColor: "text-red-600",
  },
  "van-phong": {
    icon: Briefcase,
    desc: "Gọn nhẹ, pin bền cho công việc & học tập",
    gradient: "from-blue-50 to-sky-50/50 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    iconColor: "text-blue-600",
  },
  "do-hoa": {
    icon: Palette,
    desc: "CPU/GPU mạnh, màn màu chuẩn cho sáng tạo nội dung",
    gradient: "from-violet-50 to-purple-50/50 border-violet-200",
    badge: "bg-violet-100 text-violet-700",
    iconColor: "text-violet-600",
  },
  "mong-nhe": {
    icon: Feather,
    desc: "Siêu nhẹ, mỏng, dễ mang theo cả ngày dài",
    gradient: "from-emerald-50 to-teal-50/50 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    iconColor: "text-emerald-600",
  },
};

export function NeedCollections() {
  const { data } = useHomeFilters();
  const needTags = data?.needTags ?? [];

  // Không có dữ liệu need-tag nào (chưa gán) → ẩn hẳn section.
  if (needTags.length === 0) return null;

  return (
    <section className="container pt-10 sm:pt-16">
      <Reveal variant="fade-left" threshold={0.08}>
        <div className="mb-5 sm:mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Chọn theo nhu cầu
          </p>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Bạn cần laptop để làm gì?</h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {needTags.map((tag, i) => {
          const meta = NEED_META[tag.value] ?? NEED_META["van-phong"];
          const Icon = meta.icon;
          return (
            <Reveal key={tag.value} variant="fade-up" delay={i * 80} threshold={0.05}>
              <Link
                href={`/products?tag=${tag.value}`}
                className={cn(
                  "group flex h-full flex-col rounded-2xl border bg-gradient-to-br p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-6",
                  meta.gradient,
                )}
              >
                <div className="mb-3 flex items-center justify-between sm:mb-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 shadow-sm transition-transform duration-300 group-hover:scale-110",
                    )}
                  >
                    <Icon className={cn("h-5 w-5", meta.iconColor)} />
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", meta.badge)}>
                    {tag.count}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800 sm:text-base">{tag.label}</p>
                <p className="mt-1 flex-1 text-xs text-slate-600 leading-relaxed sm:text-sm">{meta.desc}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-700 transition-colors group-hover:text-slate-900">
                  Xem sản phẩm
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

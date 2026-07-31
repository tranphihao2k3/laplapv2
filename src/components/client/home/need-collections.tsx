"use client";

import Link from "next/link";
import { Gamepad2, Briefcase, Palette, Feather, ArrowUpRight, type LucideIcon } from "lucide-react";
import { useHomeFilters } from "./use-home-data";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { cn } from "@/lib/utils";

// Style theo từng nhóm nhu cầu (slug khớp src/lib/product-collections.ts).
const NEED_META: Record<string, { icon: LucideIcon; desc: string }> = {
  gaming: {
    icon: Gamepad2,
    desc: "Card rời mạnh, chiến game mượt ở thiết lập cao",
  },
  "van-phong": {
    icon: Briefcase,
    desc: "Gọn nhẹ, pin bền cho công việc & học tập",
  },
  "do-hoa": {
    icon: Palette,
    desc: "CPU/GPU mạnh, màn màu chuẩn cho sáng tạo nội dung",
  },
  "mong-nhe": {
    icon: Feather,
    desc: "Siêu nhẹ, mỏng, dễ mang theo cả ngày dài",
  },
};

export function NeedCollections() {
  const { data } = useHomeFilters();
  const needTags = data?.needTags ?? [];

  // Không có dữ liệu need-tag nào (chưa gán) → ẩn hẳn section.
  if (needTags.length === 0) return null;

  return (
    <section className="container pt-14 sm:pt-24">
      <SectionHeader eyebrow="Chọn theo nhu cầu" title="Bạn cần laptop để làm gì?" />

      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {needTags.map((tag, i) => {
          const meta = NEED_META[tag.value] ?? NEED_META["van-phong"];
          const Icon = meta.icon;
          return (
            <Reveal key={tag.value} variant="fade-up" delay={i * 70} threshold={0.05}>
              <Link
                href={`/products?tag=${tag.value}`}
                className={cn(
                  "group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-300 sm:p-6",
                  "hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_20px_50px_-28px_rgba(15,23,42,0.4)]",
                )}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-700 transition-colors duration-300 group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    {tag.count}
                  </span>
                </div>
                <p className="text-[15px] font-semibold text-slate-900">{tag.label}</p>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-slate-500">{meta.desc}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-400 transition-colors group-hover:text-slate-900">
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

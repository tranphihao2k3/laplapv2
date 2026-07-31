"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

/**
 * Header dùng chung cho mọi section trang chủ.
 * Một khuôn duy nhất: eyebrow (gạch nhấn) · tiêu đề · mô tả · link "Xem tất cả".
 * Giữ nhịp & phong cách nhất quán thay cho mỗi section tự bịa một kiểu.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <Reveal variant="fade-up" threshold={0.08}>
      <div
        className={cn(
          "mb-6 gap-4 sm:mb-9",
          centered
            ? "flex flex-col items-center text-center"
            : "flex flex-col sm:flex-row sm:items-end sm:justify-between",
          className,
        )}
      >
        <div className={cn("max-w-2xl", centered && "flex flex-col items-center")}>
          {eyebrow && (
            <div className={cn("mb-2.5 flex items-center gap-2", centered && "justify-center")}>
              <span className="h-px w-6 bg-slate-900" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {eyebrow}
              </span>
            </div>
          )}
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px] sm:leading-[1.15]">
            {title}
          </h2>
          {description && (
            <p className="mt-2.5 text-sm leading-relaxed text-slate-500 sm:text-[15px]">
              {description}
            </p>
          )}
        </div>

        {action && (
          <Link
            href={action.href}
            className="group inline-flex shrink-0 items-center gap-1.5 self-start text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 sm:self-auto"
          >
            {action.label}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </Reveal>
  );
}

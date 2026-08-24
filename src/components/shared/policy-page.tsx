/**
 * PolicyPage — Layout chung cho các trang chính sách pháp lý.
 * Sidebar TOC + nội dung bên phải, có anchor + scroll-spy.
 *
 * Dùng cho: chính sách bảo hành, đổi trả, giao hàng, thanh toán, bảo mật,
 * điều khoản sử dụng, chính sách giải quyết khiếu nại.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/client/home/reveal";

export type PolicySection = {
  id: string;
  title: string;
  content: React.ReactNode;
};

interface Props {
  /** Tiêu đề trang — to, nổi bật. */
  title: string;
  /** Mô tả ngắn dưới tiêu đề. */
  description?: string;
  /** Ngày cập nhật gần nhất — hiển thị để tăng độ tin cậy. */
  updatedAt?: string;
  /** Hero icon trang trí (optional). */
  icon?: React.ReactNode;
  /** Nội dung các section. */
  sections: PolicySection[];
  /** Link trở về trang liên quan (vd trang chính sách tổng hợp). */
  backLink?: { href: string; label: string };
}

export function PolicyPage({
  title,
  description,
  updatedAt,
  icon,
  sections,
  backLink,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  // Scroll spy: theo dõi section nào đang ở giữa viewport để highlight TOC.
  useEffect(() => {
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [sections]);

  return (
    <div>
      {/* Hero */}
      <section className="container pt-8 md:pt-12">
        <Reveal variant="clip-up">
          <div className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-slate-50 via-card to-slate-50 px-6 py-12 dark:from-slate-900 dark:via-card dark:to-slate-900 md:px-12 md:py-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
              style={{
                backgroundImage:
                  "radial-gradient(currentColor 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="relative z-10 mx-auto max-w-3xl">
              {backLink && (
                <Link
                  href={backLink.href}
                  className="mb-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="h-3 w-3 rotate-180" />
                  {backLink.label}
                </Link>
              )}
              {icon && (
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-foreground shadow-sm">
                  {icon}
                </div>
              )}
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl lg:text-5xl">
                {title}
              </h1>
              {description && (
                <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                  {description}
                </p>
              )}
              {updatedAt && (
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Cập nhật lần cuối: {updatedAt}
                </p>
              )}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Body: sidebar TOC + nội dung */}
      <section className="container py-12 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* TOC (sticky) */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-muted/40 p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Mục lục
              </p>
              <nav className="space-y-1">
                {sections.map((s, i) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={cn(
                      "flex items-start gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      activeId === s.id
                        ? "bg-card font-semibold text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
                    )}
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 leading-snug">{s.title}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Nội dung */}
          <article className="min-w-0 space-y-10 md:space-y-14">
            {sections.map((s, i) => (
              <Reveal
                key={s.id}
                variant="fade-up"
                delay={i * 30}
                threshold={0.05}
              >
                <section
                  id={s.id}
                  className="scroll-mt-28 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm md:p-10"
                >
                  <div className="mb-5 flex items-baseline gap-3 border-b border-border pb-4">
                    <span className="font-mono text-sm font-bold text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="text-xl font-bold text-foreground md:text-2xl">
                      {s.title}
                    </h2>
                  </div>
                  <div className="policy-prose text-foreground">{s.content}</div>
                </section>
              </Reveal>
            ))}

            {/* Footer notice */}
            <Reveal variant="fade-up">
              <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground md:p-8">
                <p>
                  Mọi thắc mắc liên quan đến chính sách này, vui lòng liên hệ bộ phận CSKH qua
                  email hoặc hotline hiển thị tại{" "}
                  <Link href="/contact" className="font-semibold text-foreground underline">
                    trang Liên hệ
                  </Link>
                  . Chính sách có thể được cập nhật theo quy định pháp luật; phiên bản mới nhất
                  luôn được đăng tại đây.
                </p>
              </div>
            </Reveal>
          </article>
        </div>
      </section>
    </div>
  );
}
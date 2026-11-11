"use client";

import Link from "next/link";
import { ArrowRight, Headphones, MessageCircle, PhoneCall } from "lucide-react";
import { Reveal } from "./reveal";

export function ContactCta() {
  return (
    <section className="container py-12 sm:py-16">
      <Reveal variant="fade-up" threshold={0.1}>
        <div className="relative overflow-hidden rounded-2xl border bg-primary p-8 sm:p-12 md:p-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-white/5 blur-[90px]" />

          <div className="relative z-10 mx-auto max-w-2xl text-center text-primary-foreground">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <Headphones className="h-6 w-6" />
            </div>

            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Cần tư vấn chọn laptop phù hợp?
            </h2>
            <p className="mt-3 text-sm leading-relaxed opacity-90 md:text-base">
              Đội ngũ Laptop Thành Võ sẵn sàng hỗ trợ bạn chọn cấu hình, báo giá và giải đáp
              thắc mắc về sản phẩm, bảo hành, trả góp.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:bg-background/90 sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" />
                Liên hệ tư vấn
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-white/20 sm:w-auto"
              >
                <PhoneCall className="h-4 w-4" />
                Xem sản phẩm
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

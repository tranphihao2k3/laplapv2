"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ArrowRight, Mail } from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "./reveal";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600)); // Simulate async
    toast.success("Đăng ký thành công! Cảm ơn bạn.");
    setEmail("");
    setLoading(false);
  }

  return (
    <section className="container py-12 sm:py-20">
      <Reveal variant="scale-up" threshold={0.1}>
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-5 py-10 sm:px-8 sm:py-14 md:px-16 md:py-20">
          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {/* Radial gradient top-right */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-blue-600/20 blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-slate-700/40 blur-[80px]" />

          <div className="relative z-10 mx-auto max-w-xl text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Mail className="h-6 w-6 text-white/70" />
            </div>

            <h2 className="text-xl font-bold text-white sm:text-2xl md:text-3xl">
              Nhận ưu đãi trước nhất
            </h2>
            <p className="mt-3 text-sm text-white/50 md:text-base">
              Đăng ký để nhận thông báo về khuyến mãi và sản phẩm mới nhất.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Input
                type="email"
                placeholder="Email của bạn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 flex-1 rounded-xl border-white/10 bg-white/8 text-white placeholder:text-white/30 focus-visible:ring-white/20 focus-visible:border-white/30"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-100 disabled:opacity-60 active:scale-[0.98]"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-slate-900" />
                ) : (
                  <>
                    Đăng ký
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-4 text-xs text-white/30">
              Không spam. Hủy đăng ký bất kỳ lúc nào.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

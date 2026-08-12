"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { ArrowRight, Mail, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "./reveal";

type Brand = { id: string; name: string; slug: string | null; logo_url: string | null };

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"all" | "selected">("all");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [showBrands, setShowBrands] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Lazy-load brands khi user chuyen sang mode "selected".
  useEffect(() => {
    if (mode !== "selected" || brands.length > 0) return;
    let cancelled = false;
    fetch("/api/public/brands")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setBrands((j?.items ?? []) as Brand[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, brands.length]);

  function toggleBrand(id: string) {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (mode === "selected" && selectedBrands.size === 0) {
      toast.error("Vui lòng chọn ít nhất 1 hãng hoặc chọn 'Tất cả sản phẩm'.");
      return;
    }
    setLoading(true);

    try {
      const brandIds = mode === "all" ? [] : Array.from(selectedBrands);
      const res = await fetch("/api/v1/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), brandIds }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? `Lỗi ${res.status}`);
      }
      toast.success(json.data?.message ?? "Đăng ký thành công! Kiểm tra email để xác nhận.");
      setEmail("");
      setSelectedBrands(new Set());
      setMode("all");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Đăng ký thất bại";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="container py-16 sm:py-28">
      <Reveal variant="fade-up" threshold={0.1}>
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-5 py-12 sm:px-8 sm:py-16 md:px-16 md:py-20">
          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {/* Soft ambient glows */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/[0.05] blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-white/[0.04] blur-[90px]" />

          <div className="relative z-10 mx-auto max-w-xl text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Mail className="h-6 w-6 text-white/70" />
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Nhận thông báo sản phẩm mới
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/50 md:text-base">
              Đăng ký email để nhận thông báo khi có laptop mới về — hoặc chọn đúng
              hãng bạn quan tâm để khỏi bỏ lỡ.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
              {/* Toggle mode */}
              <div className="flex gap-1 rounded-xl bg-white/5 p-1 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setMode("all")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    mode === "all"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Tất cả sản phẩm
                </button>
                <button
                  type="button"
                  onClick={() => setMode("selected")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    mode === "selected"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Chỉ chọn hãng
                </button>
              </div>

              {/* Brand picker - chi hien khi mode=selected */}
              {mode === "selected" && (
                <div className="rounded-xl border border-white/10 bg-white/5 text-left">
                  <button
                    type="button"
                    onClick={() => setShowBrands((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm text-white/80 hover:text-white"
                  >
                    <span>
                      {selectedBrands.size === 0
                        ? "Chọn hãng bạn quan tâm…"
                        : `Đã chọn ${selectedBrands.size} hãng`}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showBrands ? "rotate-180" : ""}`}
                    />
                  </button>
                  {showBrands && (
                    <div className="max-h-60 overflow-y-auto border-t border-white/10 p-2">
                      {brands.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-white/40">Đang tải danh sách hãng…</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                          {brands.map((b) => {
                            const checked = selectedBrands.has(b.id);
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => toggleBrand(b.id)}
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                  checked
                                    ? "bg-white text-slate-900"
                                    : "text-white/70 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    checked
                                      ? "border-slate-900 bg-slate-900 text-white"
                                      : "border-white/30"
                                  }`}
                                >
                                  {checked && <Check className="h-3 w-3" />}
                                </span>
                                <span className="truncate">{b.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Email + submit */}
              <div className="flex flex-col gap-3 sm:flex-row">
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
              </div>
            </form>

            <p className="mt-4 text-xs text-white/30">
              Không spam. Hủy đăng ký bất kỳ lúc nào qua link trong email.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

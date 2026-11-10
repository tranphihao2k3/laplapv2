"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Cpu,
  HardDrive,
  Loader2,
  MemoryStick,
  Monitor,
  Search,
  X,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { extractQuickSpecs } from "@/lib/products/quick-specs";

type SearchItem = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  price: number;
  specs?: Record<string, string>;
  inStock?: boolean;
  kind?: string;
};

const SPEC_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  cpu: Cpu,
  ram: MemoryStick,
  storage: HardDrive,
  display: Monitor,
  gpu: Cpu,
};

export function HeroSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setActive(-1);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["hero-search", debounced],
    queryFn: async (): Promise<SearchItem[]> => {
      const params = new URLSearchParams({ q: debounced, limit: "6" });
      const res = await fetch(`/api/public/products?${params.toString()}`);
      if (!res.ok) throw new Error("search failed");
      const json = (await res.json()) as { items?: SearchItem[] };
      return json.items ?? [];
    },
    enabled: debounced.length >= 1,
    staleTime: 30_000,
  });

  const items = useMemo(() => (debounced ? data ?? [] : []), [data, debounced]);
  const showPanel = open && (debounced.length >= 1 || isFetching);

  useEffect(() => {
    setActive(-1);
  }, [debounced, open]);

  const goSearchPage = (q: string) => {
    const query = q.trim();
    setOpen(false);
    setActive(-1);
    if (query) router.push(`/products?q=${encodeURIComponent(query)}`);
    else router.push("/products");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && active < items.length) {
      const item = items[active];
      setOpen(false);
      router.push(`/products/${item.slug}`);
      return;
    }
    goSearchPage(term);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showPanel) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    }
  };

  const quickTags = [
    { label: "Laptop gaming", q: "gaming" },
    { label: "Văn phòng", q: "văn phòng" },
    { label: "MacBook", q: "macbook" },
  ];

  return (
    <div
      ref={rootRef}
      className="mt-8 w-full max-w-2xl"
      style={{ animation: "fadeSlideUp 0.6s ease-out 260ms both" }}
    >
      <form onSubmit={onSubmit} className="relative">
        <div
          className={cn(
            "group relative flex items-center rounded-2xl border bg-background/95 shadow-lg shadow-primary/5 ring-1 ring-black/[0.03] backdrop-blur transition-all sm:rounded-full",
            open && debounced ? "rounded-b-none sm:rounded-b-2xl sm:rounded-t-2xl border-b-transparent shadow-xl" : "hover:shadow-xl hover:shadow-primary/10",
            "focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10",
          )}
        >
          <div className="pointer-events-none absolute left-4 flex items-center text-muted-foreground">
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Search className="h-4 w-4 transition-colors group-focus-within:text-primary" />
            )}
          </div>
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            type="text"
            autoComplete="off"
            placeholder="Tìm laptop, linh kiện, CPU, RAM, hãng..."
            className="h-12 w-full rounded-2xl bg-transparent pl-11 pr-24 text-sm outline-none placeholder:text-muted-foreground sm:h-14 sm:rounded-full sm:pr-28 sm:text-base"
            aria-label="Tìm kiếm sản phẩm"
            aria-expanded={showPanel}
          />
          <div className="absolute right-1.5 flex items-center gap-1 sm:right-2">
            {term && (
              <button
                type="button"
                onClick={() => {
                  setTerm("");
                  setDebounced("");
                  setActive(-1);
                  inputRef.current?.focus();
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Xoá tìm kiếm"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:h-10 sm:rounded-full sm:px-5"
            >
              <span className="hidden sm:inline">Tìm kiếm</span>
              <Search className="h-4 w-4 sm:hidden" />
            </button>
          </div>
        </div>

        {showPanel && (
          <div className="absolute left-0 right-0 top-full z-30 overflow-hidden rounded-b-2xl border border-t-0 bg-background/98 shadow-xl shadow-primary/5 backdrop-blur">
            {debounced.length >= 1 && !isFetching && items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">Không tìm thấy sản phẩm phù hợp</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Thử từ khoá khác hoặc xem tất cả sản phẩm.
                </p>
                <button
                  type="button"
                  onClick={() => goSearchPage("")}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Xem tất cả sản phẩm <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                {isFetching && items.length === 0 ? (
                  <div className="space-y-2 p-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3 rounded-xl p-2">
                        <div className="h-16 w-16 animate-pulse rounded-lg bg-muted" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="max-h-[420px] overflow-y-auto p-2">
                    {items.map((item, idx) => {
                      const specs = extractQuickSpecs(item.specs ?? {}, 20).slice(0, 4);
                      return (
                        <li key={item.id}>
                          <Link
                            href={`/products/${item.slug}`}
                            onClick={() => setOpen(false)}
                            onMouseEnter={() => setActive(idx)}
                            className={cn(
                              "flex gap-3 rounded-xl p-2.5 transition-colors sm:p-3",
                              idx === active ? "bg-primary/5" : "hover:bg-muted/70",
                            )}
                          >
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted/40 sm:h-20 sm:w-20">
                              {item.image ? (
                                <Image
                                  src={item.image}
                                  alt={item.name}
                                  fill
                                  sizes="80px"
                                  className="object-contain p-1.5"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                                  No image
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                                  {item.name}
                                </p>
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                    item.inStock === false
                                      ? "bg-slate-100 text-slate-500"
                                      : "bg-emerald-50 text-emerald-700",
                                  )}
                                >
                                  {item.inStock === false ? "Hết hàng" : "Còn hàng"}
                                </span>
                              </div>
                              <p className="mt-0.5 text-sm font-semibold text-red-600">
                                {item.price > 0 ? formatCurrency(item.price) : "Liên hệ"}
                              </p>
                              {specs.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {specs.map((s) => {
                                    const Icon = SPEC_ICON[s.id] ?? Cpu;
                                    return (
                                      <span
                                        key={s.id}
                                        className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                                        title={`${s.label}: ${s.raw}`}
                                      >
                                        <Icon className="h-3 w-3 shrink-0" />
                                        <span className="truncate">
                                          <span className="font-medium text-foreground/80">{s.label}:</span>{" "}
                                          {s.value}
                                        </span>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {items.length > 0 && (
                  <div className="border-t bg-muted/30 px-3 py-2 sm:px-4">
                    <button
                      type="button"
                      onClick={() => goSearchPage(term)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary/5"
                    >
                      <span>Xem tất cả kết quả cho “{debounced}”</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </form>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Gợi ý:</span>
        {quickTags.map((t) => (
          <button
            key={t.q}
            type="button"
            onClick={() => {
              setTerm(t.q);
              setDebounced(t.q);
              setOpen(true);
            }}
            className="rounded-full border bg-background/70 px-2.5 py-1 transition-colors hover:border-primary/30 hover:text-foreground"
          >
            {t.label}
          </button>
        ))}
        <Link
          href="/products?kind=pc_component"
          className="rounded-full border bg-background/70 px-2.5 py-1 transition-colors hover:border-primary/30 hover:text-foreground"
        >
          Linh kiện PC
        </Link>
      </div>
    </div>
  );
}

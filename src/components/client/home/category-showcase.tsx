"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Reveal } from "./reveal";
import { useHomeFilters } from "./use-home-data";
import { cn } from "@/lib/utils";
import {
  Cpu,
  CircuitBoard,
  MemoryStick,
  MonitorPlay,
  HardDrive,
  Disc,
  Zap,
  Server,
  Thermometer,
  Apple,
  Gamepad2,
  Feather,
  Briefcase,
  Monitor,
  Laptop,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

function iconFor(label: string, slug: string, parentSlug: string | null): LucideIcon {
  const s = (label + " " + slug).toLowerCase();
  // PC components
  if (parentSlug === "pc-parts") {
    if (s.includes("cpu") || s.includes("vi xử lý") || s.includes("processor")) return Cpu;
    if (s.includes("bo mạch") || s.includes("mainboard")) return CircuitBoard;
    if (s.includes("ram") || s.includes("bộ nhớ")) return MemoryStick;
    if (s.includes("vga") || s.includes("card màn hình") || s.includes("gpu")) return MonitorPlay;
    if (s === "ssd" || s.includes("ổ ssd") || s.includes("ổ cứng ssd")) return HardDrive;
    if (s === "hdd" || s.includes("hdd") || s.includes("ổ cứng")) return Disc;
    if (s.includes("nguồn") || s.includes("psu")) return Zap;
    if (s.includes("vỏ") || s.includes("case") || s.includes("thùng máy")) return Server;
    if (s.includes("tản nhiệt") || s.includes("cooler") || s.includes("fan")) return Thermometer;
    return CircuitBoard;
  }
  // Laptop
  if (s.includes("macbook") || s.includes("apple")) return Apple;
  if (s.includes("gaming")) return Gamepad2;
  if (s.includes("ultrabook") || s.includes("mỏng nhẹ") || s.includes("feather")) return Feather;
  if (s.includes("văn phòng") || s.includes("office") || s.includes("sinh viên")) return Briefcase;
  if (s.includes("màn hình") || s.includes("display") || s.includes("monitor")) return Monitor;
  return Laptop;
}

function categoryHref(slug: string | null | undefined, value: string, kind: "laptop" | "pc_component") {
  const id = slug ? `category=${encodeURIComponent(slug)}` : `category=${encodeURIComponent(value)}`;
  return `/products?kind=${kind}&${id}`;
}

export function CategoryShowcase() {
  const { data, isLoading } = useHomeFilters();
  const categories = data?.categories ?? [];

  const laptopTop = useMemo(
    () =>
      categories
        .filter((c) => c.parentSlug !== "pc-parts" && (c.count ?? 0) > 0)
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, 6),
    [categories],
  );

  const pcTop = useMemo(
    () =>
      categories
        .filter((c) => c.parentSlug === "pc-parts" && (c.count ?? 0) > 0)
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, 8),
    [categories],
  );

  if (!isLoading && laptopTop.length === 0 && pcTop.length === 0) return null;

  return (
    <section className="container py-12 sm:py-16">
      <Reveal variant="fade-up" threshold={0.05}>
        <div className="space-y-10">
          {/* Laptop categories */}
          {laptopTop.length > 0 && (
            <div>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-px w-6 bg-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Danh mục Laptop
                    </span>
                  </div>
                  <h2 className="text-xl font-bold sm:text-2xl">Chọn laptop theo nhu cầu</h2>
                </div>
                <Link
                  href="/products?kind=laptop"
                  className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
                >
                  Xem tất cả <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {laptopTop.map((cat, i) => {
                  const Icon = iconFor(cat.label, cat.slug ?? "", cat.parentSlug ?? null);
                  return (
                    <Reveal key={cat.value} variant="fade-up" delay={i * 50} threshold={0.05}>
                      <Link
                        href={categoryHref(cat.slug, cat.value, "laptop")}
                        className="group flex h-full flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.15)]"
                      >
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full bg-primary/10 opacity-0 blur-md transition-opacity group-hover:opacity-100" />
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                            <Icon className="h-6 w-6" strokeWidth={1.75} />
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold">{cat.label}</p>
                          <p className="text-[11px] text-muted-foreground">{cat.count} sản phẩm</p>
                        </div>
                      </Link>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          )}

          {/* PC component categories */}
          {pcTop.length > 0 && (
            <div>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-px w-6 bg-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Danh mục Linh kiện PC
                    </span>
                  </div>
                  <h2 className="text-xl font-bold sm:text-2xl">Linh kiện cho bộ PC của bạn</h2>
                </div>
                <Link
                  href="/products?kind=pc_component"
                  className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
                >
                  Xem tất cả <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {pcTop.map((cat, i) => {
                  const Icon = iconFor(cat.label, cat.slug ?? "", cat.parentSlug ?? null);
                  return (
                    <Reveal key={cat.value} variant="fade-up" delay={i * 40} threshold={0.05}>
                      <Link
                        href={categoryHref(cat.slug, cat.value, "pc_component")}
                        className="group flex h-full flex-col items-center gap-2.5 rounded-xl border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.15)]"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon className="h-5 w-5" strokeWidth={1.75} />
                        </div>
                        <p className="text-xs font-medium leading-tight">{cat.label}</p>
                        <p className="text-[10px] text-muted-foreground">{cat.count}</p>
                      </Link>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Reveal>
    </section>
  );
}

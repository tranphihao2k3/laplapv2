"use client";

import Link from "next/link";
import {
  Laptop,
  Gamepad2,
  Apple,
  Feather,
  Briefcase,
  Monitor,
  ArrowRight,
  Wrench,
  CircuitBoard,
  Cpu,
  MemoryStick,
  HardDrive,
  type LucideIcon,
} from "lucide-react";
import { useHomeFilters, type FilterOption } from "./use-home-data";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";
import { PC_PARTS_PARENT_SLUG } from "@/lib/product-kind";

const ACCENT_MAP: Record<string, { bg: string; icon: string; ring: string }> = {
  default: { bg: "bg-muted", icon: "text-muted-foreground", ring: "" },
  apple: { bg: "bg-zinc-100", icon: "text-zinc-600", ring: "" },
  gaming: { bg: "bg-red-50", icon: "text-red-600", ring: "" },
  ultra: { bg: "bg-sky-50", icon: "text-sky-600", ring: "" },
  office: { bg: "bg-blue-50", icon: "text-blue-600", ring: "" },
  builder: { bg: "bg-violet-50", icon: "text-violet-600", ring: "" },
  pc: { bg: "bg-violet-50", icon: "text-violet-600", ring: "" },
};

function getAccent(label: string, isPc = false) {
  if (isPc) return ACCENT_MAP.pc;
  const s = label.toLowerCase();
  if (s.includes("macbook") || s.includes("apple")) return ACCENT_MAP.apple;
  if (s.includes("gaming")) return ACCENT_MAP.gaming;
  if (s.includes("ultrabook")) return ACCENT_MAP.ultra;
  if (s.includes("văn phòng")) return ACCENT_MAP.office;
  return ACCENT_MAP.default;
}

function CardCategoryIcon({ label, className, isPc = false }: { label: string; className?: string; isPc?: boolean }) {
  const s = label.toLowerCase();
  let Icon: LucideIcon = Laptop;
  if (isPc) {
    if (s.includes("cpu") || s.includes("vi xử lý")) Icon = Cpu;
    else if (s.includes("bo mạch") || s.includes("mainboard")) Icon = CircuitBoard;
    else if (s.includes("ram") || s.includes("bộ nhớ")) Icon = MemoryStick;
    else if (s.includes("ổ cứng") || s.includes("ssd") || s.includes("hdd")) Icon = HardDrive;
    else Icon = CircuitBoard;
  } else {
    if (s.includes("macbook") || s.includes("apple")) Icon = Apple;
    else if (s.includes("gaming")) Icon = Gamepad2;
    else if (s.includes("ultrabook")) Icon = Feather;
    else if (s.includes("văn phòng") || s.includes("office")) Icon = Briefcase;
    else if (s.includes("màn")) Icon = Monitor;
  }
  return <Icon className={className} />;
}

function CategoryCard({
  cat,
  index,
  isPc = false,
}: {
  cat: FilterOption;
  index: number;
  isPc?: boolean;
}) {
  const accent = getAccent(cat.label, isPc);
  const href = isPc
    ? `/products?kind=pc_component&category=${cat.slug ?? cat.value}`
    : `/products?category=${cat.slug ?? cat.value}`;

  return (
    <Reveal variant="fade-up" delay={index * 50} threshold={0.05}>
      <Link
        href={href}
        className={cn(
          "group flex flex-col rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
        )}
      >
        <div className={cn("mb-3 flex h-12 w-12 items-center justify-center rounded-xl", accent.bg)}>
          <CardCategoryIcon label={cat.label} isPc={isPc} className={cn("h-6 w-6", accent.icon)} />
        </div>
        <p className="font-medium text-sm">{cat.label}</p>
        <p className="text-xs text-muted-foreground">{cat.count} sản phẩm</p>
      </Link>
    </Reveal>
  );
}

function PcBuilderCard({ index }: { index: number }) {
  return (
    <Reveal variant="fade-up" delay={index * 50} threshold={0.05}>
      <Link
        href="/pc-builder"
        className="group relative flex flex-col overflow-hidden rounded-xl border bg-gradient-to-br from-violet-50 to-white p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
          <Wrench className="h-6 w-6 text-violet-600" />
        </div>
        <p className="font-medium text-sm text-violet-900">Xây dựng PC</p>
        <p className="text-xs text-violet-600">Tự chọn linh kiện</p>
        <ArrowRight className="absolute right-3 top-3 h-4 w-4 text-violet-400 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Reveal>
  );
}

export function CategoryGrid() {
  const { data, isLoading } = useHomeFilters();
  const categories = data?.categories ?? [];

  // Tách rõ theo parent_slug để tránh trộn linh kiện PC vào section Laptop.
  // Convention khớp với mega-menu header: parentSlug === "pc-parts" → linh kiện.
  const laptopCats = categories.filter((c) => c.parentSlug !== PC_PARTS_PARENT_SLUG);
  const pcCats = categories.filter((c) => c.parentSlug === PC_PARTS_PARENT_SLUG);

  if (!isLoading && categories.length === 0) return null;

  return (
    <section className="container py-12 sm:py-16">
      <Reveal variant="fade-up">
        <div className="mb-6 flex items-center justify-between sm:mb-8">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <CircuitBoard className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Danh mục</span>
            </div>
            <h2 className="text-xl font-bold sm:text-2xl">Tìm theo loại sản phẩm</h2>
          </div>
          <Link href="/products" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Xem tất cả <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>

      {/* ---- Laptop ---- */}
      <div className="mb-2 flex items-center gap-2">
        <Laptop className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Laptop</h3>
        <span className="text-xs text-muted-foreground">({laptopCats.length} danh mục)</span>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={`l-${i}`} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))
          : laptopCats.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">Chưa có danh mục laptop.</p>
          ) : (
            laptopCats.map((cat, i) => (
              <CategoryCard key={`l-${cat.value}`} cat={cat} index={i} />
            ))
          )}
      </div>

      {/* ---- Linh kiện PC ---- */}
      <div className="mb-2 flex items-center gap-2">
        <Cpu className="h-4 w-4 text-violet-600" />
        <h3 className="text-sm font-semibold text-foreground">Linh kiện PC</h3>
        <span className="text-xs text-muted-foreground">({pcCats.length} loại)</span>
        <Link
          href="/products?kind=pc_component"
          className="ml-auto text-xs font-medium text-violet-600 hover:underline"
        >
          Xem tất cả linh kiện →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={`p-${i}`} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))
          : pcCats.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">Chưa có linh kiện PC.</p>
          ) : (
            <>
              {pcCats.map((cat, i) => (
                <CategoryCard key={`p-${cat.value}`} cat={cat} index={i} isPc />
              ))}
              {/* Thẻ PC Builder — nổi bật ở cuối nhóm Linh kiện */}
              <PcBuilderCard index={pcCats.length} />
            </>
          )}
      </div>
    </section>
  );
}

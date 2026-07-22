"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Cpu,
  Wrench,
  MonitorSmartphone,
  Sparkles,
  Phone,
  MessageCircle,
  ChevronRight,
  CheckCircle,
  Star,
  Clock,
  Shield,
  Zap,
  ArrowRight,
  Tag,
} from "lucide-react";
import type { PublicRepairService } from "@/app/api/public/repair-services/route";
import {
  REPAIR_SERVICE_CATEGORIES,
  formatServicePrice,
} from "@/lib/repair-services";

/* ------------------------------------------------------------------ */
/* Types & helpers                                                       */
/* ------------------------------------------------------------------ */

type ServiceWithPosition = PublicRepairService & { position?: number };

const CATEGORY_ICONS = {
  Cpu,
  Wrench,
  MonitorSmartphone,
  Sparkles,
} as const;

const CATEGORY_COLORS: Record<
  string,
  {
    gradient: string;
    accent: string;
    badge: string;
    border: string;
    iconBg: string;
    iconColor: string;
    priceBg: string;
    priceText: string;
  }
> = {
  "thay-linh-kien": {
    gradient: "from-blue-600 to-indigo-700",
    accent: "blue",
    badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    border: "border-blue-100 hover:border-blue-300",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    priceBg: "bg-blue-600",
    priceText: "text-blue-700",
  },
  "sua-phan-cung": {
    gradient: "from-orange-500 to-red-600",
    accent: "orange",
    badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    border: "border-orange-100 hover:border-orange-300",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    priceBg: "bg-orange-600",
    priceText: "text-orange-700",
  },
  "sua-phan-mem": {
    gradient: "from-violet-600 to-purple-700",
    accent: "violet",
    badge: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    border: "border-violet-100 hover:border-violet-300",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    priceBg: "bg-violet-600",
    priceText: "text-violet-700",
  },
  "ve-sinh-nang-cap": {
    gradient: "from-emerald-500 to-teal-600",
    accent: "emerald",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    border: "border-emerald-100 hover:border-emerald-300",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    priceBg: "bg-emerald-600",
    priceText: "text-emerald-700",
  },
};

const TRUST_BADGES = [
  {
    icon: Shield,
    title: "Bảo hành sau sửa chữa",
    desc: "Cam kết bảo hành linh kiện & công thợ",
  },
  {
    icon: Zap,
    title: "Sửa nhanh trong ngày",
    desc: "Hầu hết các lỗi thường trả máy trong ngày",
  },
  {
    icon: CheckCircle,
    title: "Giá niêm yết — Không phụ thu",
    desc: "Báo giá trước khi làm, không phát sinh chi phí ẩn",
  },
  {
    icon: Star,
    title: "Kỹ thuật viên được chứng nhận",
    desc: "Đội ngũ kinh nghiệm 5+ năm, sửa mọi hãng laptop",
  },
];

function PriceChip({ service, colors }: { service: ServiceWithPosition; colors: (typeof CATEGORY_COLORS)[string] }) {
  const label = formatServicePrice(service);
  const isContact = service.price_type === "contact" || label === "Liên hệ";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
        isContact
          ? "bg-zinc-100 text-zinc-500"
          : `${colors.priceBg} text-white`
      }`}
    >
      {!isContact && <Tag className="h-3 w-3 shrink-0" />}
      {label}
      {service.unit && !isContact && (
        <span className="font-normal opacity-80">/{service.unit}</span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Service Row                                                        */
/* ------------------------------------------------------------------ */
function ServiceRow({
  service,
  catSlug,
}: {
  service: ServiceWithPosition;
  catSlug: string;
}) {
  const colors = CATEGORY_COLORS[catSlug] ?? CATEGORY_COLORS["thay-linh-kien"];

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:px-6 transition-colors hover:bg-zinc-50">
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-2">
          {service.is_featured && (
            <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" />
          )}
          <h3 className="truncate text-sm font-semibold text-zinc-900 sm:text-base">
            {service.name}
          </h3>
        </div>
        {(service.description || service.warranty_text) && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 sm:gap-3">
            {service.description && <span className="truncate">{service.description}</span>}
            {service.description && service.warranty_text && <span className="hidden sm:block h-1 w-1 rounded-full bg-zinc-300 shrink-0" />}
            {service.warranty_text && (
              <span className="flex items-center gap-1 shrink-0 font-medium text-emerald-600">
                <Clock className="h-3.5 w-3.5" />
                Bảo hành: {service.warranty_text}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="shrink-0 text-left sm:text-right">
        <PriceChip service={service} colors={colors} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category Section                                                       */
/* ------------------------------------------------------------------ */
function CategorySection({
  cat,
  services,
  isActive,
  onSelect,
}: {
  cat: (typeof REPAIR_SERVICE_CATEGORIES)[number];
  services: ServiceWithPosition[];
  isActive: boolean;
  onSelect: () => void;
}) {
  const colors = CATEGORY_COLORS[cat.slug] ?? CATEGORY_COLORS["thay-linh-kien"];
  const Icon = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] ?? Wrench;

  if (services.length === 0) return null;

  return (
    <section id={`cat-${cat.slug}`} className="scroll-mt-24">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md">
        {/* Category header */}
        <div
          className={`relative flex items-center gap-4 bg-gradient-to-r ${colors.gradient} px-5 py-5 sm:px-6 text-white`}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 90% 10%, white 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight sm:text-xl">{cat.label}</h2>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                {services.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-white/80 sm:text-sm">{cat.blurb}</p>
          </div>
        </div>

        {/* Service list */}
        <div className="divide-y divide-zinc-100">
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} catSlug={cat.slug} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton loader                                                       */
/* ------------------------------------------------------------------ */
function SkeletonGrid() {
  return (
    <div className="space-y-12">
      {[1, 2, 3].map((g) => (
        <div key={g} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="h-24 bg-zinc-100 animate-pulse" />
          <div className="divide-y divide-zinc-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 sm:px-6">
                <div className="space-y-2">
                  <div className="h-5 w-40 rounded bg-zinc-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-zinc-100 animate-pulse" />
                </div>
                <div className="h-8 w-24 rounded-full bg-zinc-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                        */
/* ------------------------------------------------------------------ */
export function RepairServicesClient() {
  const [activeTab, setActiveTab] = useState<string | "all">("all");

  const { data, isLoading } = useQuery<{ items: ServiceWithPosition[] }>({
    queryKey: ["public-repair-services"],
    queryFn: async () => {
      const res = await fetch("/api/public/repair-services");
      if (!res.ok) return { items: [] };
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const services = data?.items ?? [];

  // Group by category + filter featured
  const grouped = useMemo(() => {
    return REPAIR_SERVICE_CATEGORIES.map((cat) => ({
      ...cat,
      items: services
        .filter((s) => s.category === cat.slug)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    })).filter((g) => g.items.length > 0);
  }, [services]);

  const filteredGroups = useMemo(() => {
    if (activeTab === "all") return grouped;
    return grouped.filter((g) => g.slug === activeTab);
  }, [grouped, activeTab]);

  const totalServices = services.length;

  return (
    <div className="bg-white">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        {/* subtle grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
        {/* gradient orbs */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600 opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-violet-600 opacity-20 blur-3xl" />

        <div className="container relative mx-auto max-w-5xl px-4 pb-24 pt-16 text-center sm:pb-28 sm:pt-20">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium ring-1 ring-white/20">
            <Wrench className="h-4 w-4 text-blue-400" />
            Trung tâm sửa chữa chuyên nghiệp
          </div>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Bảng giá{" "}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              sửa chữa laptop
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/70 sm:text-lg">
            Giá niêm yết minh bạch — Báo giá trước khi làm — Bảo hành sau sửa
            chữa. Kỹ thuật viên kinh nghiệm 5+ năm, sửa tất cả hãng laptop tại
            Cần Thơ.
          </p>

          {/* CTA buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="tel:19001234"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-zinc-900 shadow-lg transition hover:bg-zinc-100 hover:scale-105"
            >
              <Phone className="h-4 w-4" />
              Gọi ngay: 1900 1234
            </a>
            <a
              href="https://zalo.me/19001234"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-6 py-3 text-sm font-semibold text-white ring-1 ring-blue-400/40 transition hover:bg-blue-500/30 hover:scale-105"
            >
              <MessageCircle className="h-4 w-4" />
              Chat Zalo
            </a>
          </div>

          {/* Stats bar */}
          <div className="mx-auto mt-12 grid max-w-xl grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/5 ring-1 ring-white/10">
            {[
              { value: "5+", label: "Năm kinh nghiệm" },
              { value: "10.000+", label: "Thiết bị đã sửa" },
              { value: "99%", label: "Khách hài lòng" },
            ].map((s) => (
              <div key={s.label} className="py-4 text-center">
                <p className="text-2xl font-extrabold text-white">{s.value}</p>
                <p className="mt-0.5 text-xs text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST BADGES ── */}
      <section className="border-b bg-zinc-50">
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_BADGES.map((b) => (
              <div
                key={b.title}
                className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 transition hover:ring-zinc-300"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                  <b.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{b.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <div className="container mx-auto max-w-5xl px-4 py-12">
        {/* Category tab bar */}
        <div className="mb-10 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === "all"
                ? "bg-zinc-900 text-white shadow"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Tất cả ({totalServices})
          </button>
          {REPAIR_SERVICE_CATEGORIES.map((cat) => {
            const count = services.filter((s) => s.category === cat.slug).length;
            if (count === 0) return null;
            const colors = CATEGORY_COLORS[cat.slug];
            const Icon = CATEGORY_ICONS[cat.icon as keyof typeof CATEGORY_ICONS] ?? Wrench;
            return (
              <button
                key={cat.slug}
                onClick={() => {
                  setActiveTab(cat.slug);
                  setTimeout(() => {
                    document.getElementById(`cat-${cat.slug}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 50);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === cat.slug
                    ? `bg-gradient-to-r ${colors.gradient} text-white shadow`
                    : `${colors.badge} hover:brightness-95`
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Service sections */}
        {isLoading ? (
          <SkeletonGrid />
        ) : filteredGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-20 text-center text-zinc-400">
            <Wrench className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="font-medium">Chưa có dịch vụ nào</p>
            <p className="mt-1 text-sm">Vui lòng liên hệ để được tư vấn trực tiếp.</p>
          </div>
        ) : (
          <div className="space-y-16">
            {filteredGroups.map((cat) => (
              <CategorySection
                key={cat.slug}
                cat={cat}
                services={cat.items}
                isActive={activeTab === cat.slug}
                onSelect={() => setActiveTab(cat.slug)}
              />
            ))}
          </div>
        )}

        {/* Note block */}
        {!isLoading && (
          <div className="mt-14 rounded-2xl bg-amber-50 p-6 ring-1 ring-amber-200">
            <h3 className="mb-2 flex items-center gap-2 font-bold text-amber-900">
              <CheckCircle className="h-5 w-5 text-amber-600" />
              Lưu ý quan trọng
            </h3>
            <ul className="space-y-1.5 text-sm text-amber-800">
              <li>• Giá trên là giá dịch vụ (công thợ). Giá linh kiện thay thế sẽ được báo thêm sau khi kiểm tra máy.</li>
              <li>• Chúng tôi sẽ <strong>báo giá và được đồng ý trước</strong> khi tiến hành sửa chữa.</li>
              <li>• Bảo hành linh kiện và công thợ theo từng loại dịch vụ (xem chi tiết tại mỗi hạng mục).</li>
              <li>• Mang máy đến cửa hàng để được kiểm tra miễn phí và báo giá chính xác.</li>
            </ul>
          </div>
        )}
      </div>

      {/* ── CTA SECTION ── */}
      <section className="relative overflow-hidden bg-zinc-950 py-20 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 50%, white 1px, transparent 1px), radial-gradient(circle at 70% 50%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="container relative mx-auto max-w-3xl px-4 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <Wrench className="h-8 w-8 text-blue-400" />
          </div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Laptop hỏng? Mang đến ngay!
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/60">
            Kiểm tra & báo giá miễn phí. Sửa xong trong ngày với hầu hết các lỗi
            thường gặp. Bảo hành rõ ràng, không phát sinh chi phí ẩn.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="tel:19001234"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-zinc-900 shadow-xl transition hover:bg-zinc-100 hover:scale-105"
            >
              <Phone className="h-4 w-4" />
              Gọi: 1900 1234
            </a>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-7 py-3.5 text-sm font-semibold ring-1 ring-white/20 transition hover:bg-white/20 hover:scale-105"
            >
              Xem địa chỉ cửa hàng
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── FLOATING MOBILE CTA ── */}
      <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center gap-3 px-4 sm:hidden">
        <a
          href="tel:19001234"
          className="flex-1 max-w-xs inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-3.5 text-sm font-bold text-white shadow-2xl"
        >
          <Phone className="h-4 w-4" />
          Gọi ngay
        </a>
        <a
          href="https://zalo.me/19001234"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 max-w-xs inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-2xl"
        >
          <MessageCircle className="h-4 w-4" />
          Zalo
        </a>
      </div>
    </div>
  );
}

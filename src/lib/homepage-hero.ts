import type { ComponentType } from "react";
import { Cpu, Gamepad2, ShieldCheck, Sparkles, Wrench, Zap } from "lucide-react";

export type HomepageHeroTemplate = {
  id: number;
  name: string;
  label: string;
  accent: string;
  bg: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  defaults: {
    eyebrow: string;
    title: string[];
    sub: string;
    cta: string;
    href: string;
  };
};

export const HERO_TEMPLATES: HomepageHeroTemplate[] = [
  {
    id: 0,
    name: "Laptop phổ thông",
    label: "Mẫu 1 — Giá tốt",
    accent: "bg-blue-600",
    bg: "bg-gradient-to-br from-slate-50 via-white to-blue-50/40",
    Icon: Sparkles,
    defaults: {
      eyebrow: "Bộ sưu tập 2026",
      title: ["Laptop chính hãng,", "Giá tốt nhất Cần Thơ."],
      sub: "Apple · Dell · ASUS · Lenovo — bảo hành chính hãng, trả góp 0% 12 tháng.",
      cta: "Khám phá ngay",
      href: "/products",
    },
  },
  {
    id: 1,
    name: "Ultrabook",
    label: "Mẫu 2 — Ultrabook premium",
    accent: "bg-slate-900",
    bg: "bg-gradient-to-br from-slate-50 via-slate-100/60 to-slate-50",
    Icon: Cpu,
    defaults: {
      eyebrow: "Ultrabook premium",
      title: ["Mỏng nhẹ tuyệt đối,", "Mạnh mẽ không giới hạn."],
      sub: "Màn OLED 4K, pin trọn ngày, chip thế hệ mới — hoàn hảo cho người sáng tạo.",
      cta: "Xem Ultrabook",
      href: "/products?category=ultrabook",
    },
  },
  {
    id: 2,
    name: "Gaming",
    label: "Mẫu 3 — Gaming",
    accent: "bg-red-600",
    bg: "bg-gradient-to-br from-white via-red-50/30 to-slate-50",
    Icon: Gamepad2,
    defaults: {
      eyebrow: "Gaming series",
      title: ["Chiến mọi tựa game,", "Mượt tuyệt với 144Hz+."],
      sub: "GPU RTX series, tản nhiệt thông minh, màn hình cao tần — đỉnh cao trải nghiệm.",
      cta: "Xem Gaming Laptop",
      href: "/products?category=gaming",
    },
  },
  {
    id: 3,
    name: "Deal hot",
    label: "Mẫu 4 — Deal hot",
    accent: "bg-amber-500",
    bg: "bg-gradient-to-br from-amber-50 via-amber-100 to-slate-50",
    Icon: Zap,
    defaults: {
      eyebrow: "Flash Sale",
      title: ["Giảm sốc mỗi ngày,", "Săn deal nhanh tay."],
      sub: "Giá tốt, quà tặng hấp dẫn, giao nhanh tận nhà. Thời gian giới hạn.",
      cta: "Xem ưu đãi",
      href: "/products?promo=deal",
    },
  },
  {
    id: 4,
    name: "Bảo hành",
    label: "Mẫu 5 — Bảo hành",
    accent: "bg-emerald-600",
    bg: "bg-gradient-to-br from-emerald-50 via-emerald-100 to-slate-50",
    Icon: ShieldCheck,
    defaults: {
      eyebrow: "Bảo hành an tâm",
      title: ["Hỗ trợ chính hãng,", "Bảo hành 1 đổi 1."],
      sub: "Linh kiện chính hãng, dịch vụ sửa chữa nhanh, đổi mới trong thời gian bảo hành.",
      cta: "Xem chính sách",
      href: "/about#warranty",
    },
  },
  {
    id: 5,
    name: "Dịch vụ",
    label: "Mẫu 6 — Dịch vụ",
    accent: "bg-slate-800",
    bg: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950",
    Icon: Wrench,
    defaults: {
      eyebrow: "Dịch vụ nhanh chóng",
      title: ["Sửa chữa chuyên nghiệp,", "Hoàn thiện trong ngày."],
      sub: "Đặt lịch sửa, kiểm tra nhanh, linh kiện chuẩn hãng — dịch vụ tận tâm cho máy của bạn.",
      cta: "Đặt lịch ngay",
      href: "/contact",
    },
  },
];

export type HomepageHeroSetting = {
  template: number;
  eyebrow?: string;
  title?: string[];
  sub?: string;
  cta?: string;
  href?: string;
  image?: string;
};

export function buildHeroSlide(setting?: HomepageHeroSetting) {
  const template = HERO_TEMPLATES[setting?.template ?? 0] ?? HERO_TEMPLATES[0];
  const title = setting?.title?.length
    ? setting.title
    : template.defaults.title;

  return {
    id: template.id,
    eyebrow: setting?.eyebrow || template.defaults.eyebrow,
    title,
    sub: setting?.sub || template.defaults.sub,
    cta: setting?.cta || template.defaults.cta,
    href: setting?.href || template.defaults.href,
    accent: template.accent,
    bg: template.bg,
    Icon: template.Icon,
    image: setting?.image,
  };
}

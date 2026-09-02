/**
 * Trust Badges — types, defaults, and icon registry.
 * Used on the product detail page to show store commitments
 * (warranty, free shipping, returns, etc.).
 */

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Shield,
  ShieldCheck,
  BadgeCheck,
  Award,
  Medal,
  Star,
  Crown,
  Gem,
  Lock,
  LockKeyhole,
  Truck,
  Package,
  RefreshCw,
  RotateCcw,
  Headphones,
  Phone,
  MessageCircle,
  Heart,
  ThumbsUp,
  CheckCircle,
  Badge,
  Bookmark,
  Flag,
  Target,
  Zap,
  Leaf,
  CreditCard,
  Wallet,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

export type TrustBadge = {
  id: string;
  /** Lucide icon component name (e.g. "ShieldCheck", "Truck") */
  icon: string;
  title: string;
  description?: string;
  enabled: boolean;
  order: number;
};

export type TrustBadgeSetting = TrustBadge[];

/** Map of known icon names → Lucide component */
export const TRUST_BADGE_ICONS: Record<string, LucideIcon> = {
  Shield,
  ShieldCheck,
  BadgeCheck,
  Award,
  Medal,
  Star,
  Crown,
  Gem,
  Lock,
  LockKeyhole,
  Truck,
  Package,
  RefreshCw,
  RotateCcw,
  Headphones,
  Phone,
  MessageCircle,
  Heart,
  ThumbsUp,
  CheckCircle,
  Badge,
  Bookmark,
  Flag,
  Target,
  Zap,
  Leaf,
  CreditCard,
  Wallet,
  PackageCheck,
};

export const TRUST_BADGE_ICON_OPTIONS = [
  { value: "Shield", label: "🛡️ Shield — Lá chắn" },
  { value: "ShieldCheck", label: "🛡️ ShieldCheck — Bảo hành" },
  { value: "BadgeCheck", label: "✅ BadgeCheck — Xác nhận" },
  { value: "Award", label: "🏆 Award — Giải thưởng" },
  { value: "Medal", label: "🏅 Medal — Huy hiệu" },
  { value: "Star", label: "⭐ Star — Sao" },
  { value: "Crown", label: "👑 Crown — Vương miện" },
  { value: "Gem", label: "💎 Gem — Đá quý" },
  { value: "Lock", label: "🔒 Lock — Khóa bảo mật" },
  { value: "LockKeyhole", label: "🔐 LockKeyhole — Khóa" },
  { value: "Truck", label: "🚚 Truck — Vận chuyển" },
  { value: "Package", label: "📦 Package — Gói hàng" },
  { value: "RefreshCw", label: "🔄 RefreshCw — Làm mới" },
  { value: "RotateCcw", label: "🔃 RotateCcw — Đổi trả" },
  { value: "Headphones", label: "🎧 Headphones — Hỗ trợ" },
  { value: "Phone", label: "📞 Phone — Điện thoại" },
  { value: "MessageCircle", label: "💬 MessageCircle — Tin nhắn" },
  { value: "Heart", label: "❤️ Heart — Yêu thích" },
  { value: "ThumbsUp", label: "👍 ThumbsUp — Đánh giá" },
  { value: "CheckCircle", label: "✅ CheckCircle — Hoàn thành" },
  { value: "Badge", label: "🎖️ Badge — Huy hiệu" },
  { value: "Bookmark", label: "🔖 Bookmark — Đánh dấu" },
  { value: "Flag", label: "🚩 Flag — Cờ" },
  { value: "Target", label: "🎯 Target — Mục tiêu" },
  { value: "Zap", label: "⚡ Zap — Tốc độ" },
  { value: "Leaf", label: "🍃 Leaf — Xanh" },
  { value: "CreditCard", label: "💳 CreditCard — Thẻ" },
  { value: "Wallet", label: "👛 Wallet — Ví" },
  { value: "PackageCheck", label: "📋 PackageCheck — Kiểm tra" },
];

export const DEFAULT_TRUST_BADGES: TrustBadge[] = [
  {
    id: "warranty",
    icon: "ShieldCheck",
    title: "Hàng chính hãng",
    description: "Hoàn tiền nếu hàng giả",
    enabled: true,
    order: 0,
  },
  {
    id: "shipping",
    icon: "Truck",
    title: "Giao hàng toàn quốc",
    description: "Miễn phí vận chuyển",
    enabled: true,
    order: 1,
  },
  {
    id: "returns",
    icon: "RotateCcw",
    title: "Bảo hành 12 tháng",
    description: "Đổi trả miễn phí",
    enabled: true,
    order: 2,
  },
];

/**
 * Server-side function to fetch trust badges from settings.
 * Falls back to default badges if no settings exist.
 * Cached per request using React's cache().
 */
export const getTrustBadges = cache(async (): Promise<TrustBadge[]> => {
  return _getTrustBadges();
});

/**
 * Cached version using Next.js unstable_cache is in trust-badges-cached.ts
 */

async function _getTrustBadges(): Promise<TrustBadge[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "trust_badges")
      .single();

    if (error || !data) {
      return DEFAULT_TRUST_BADGES;
    }

    let badges: TrustBadge[] = DEFAULT_TRUST_BADGES;

    if (typeof data.value === "string") {
      try {
        badges = JSON.parse(data.value) as TrustBadge[];
      } catch {
        badges = DEFAULT_TRUST_BADGES;
      }
    } else if (Array.isArray(data.value)) {
      badges = data.value as TrustBadge[];
    }

    // Sort by order and filter enabled ones
    return [...badges].sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_TRUST_BADGES;
  }
}

/**
 * Get only enabled trust badges
 */
export async function getEnabledTrustBadges(): Promise<TrustBadge[]> {
  const badges = await getTrustBadges();
  return badges.filter((b) => b.enabled);
}

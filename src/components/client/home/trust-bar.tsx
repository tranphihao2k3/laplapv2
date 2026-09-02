"use client";

import { useEffect, useState } from "react";
import { Reveal } from "./reveal";
import { useStoreSettings } from "@/components/client/layout/use-store-settings";
import type { LucideIcon } from "lucide-react";

// Import icons statically for the default fallback rendering
import { ShieldCheck, Truck, RotateCcw, Headphones, Shield, Phone } from "lucide-react";

const staticIcons: Record<string, LucideIcon> = {
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
  Shield,
  Phone,
};

type TrustBadgeItem = {
  id: string;
  icon: string;
  title: string;
  description?: string;
  enabled: boolean;
  order: number;
};

export function TrustBar() {
  const { settings, isLoading } = useStoreSettings();
  const [badges, setBadges] = useState<TrustBadgeItem[]>([]);
  const [isLoadingBadges, setIsLoadingBadges] = useState(true);

  // Fetch trust badges from API
  useEffect(() => {
    async function fetchBadges() {
      try {
        const response = await fetch("/api/public/trust-badges", {
          cache: "no-store", // Don't use Next.js fetch cache, rely on API revalidation
        });
        if (response.ok) {
          const data: TrustBadgeItem[] = await response.json();
          setBadges(data.filter((b) => b.enabled));
        }
      } catch {
        // Silently fail, use empty badges
      } finally {
        setIsLoadingBadges(false);
      }
    }
    fetchBadges();
  }, []);

  // Build items from trust badges, filling in dynamic content from settings
  const items = badges.length > 0
    ? badges.map((badge) => {
        // Allow dynamic substitution for certain badges
        let title = badge.title;
        let description = badge.description;

        // Replace placeholders with dynamic settings
        if (title.includes("{return_policy_days}")) {
          title = title.replace("{return_policy_days}", String(settings?.return_policy_days ?? 30));
        }
        if (description?.includes("{shipping_info}")) {
          description = description.replace("{shipping_info}", settings?.shipping_info ?? "Nội thành Cần Thơ trong 2h");
        }
        if (description?.includes("{hotline}")) {
          description = description.replace("{hotline}", settings?.hotline ?? settings?.phone ?? "1900 1234");
        }

        return {
          badge,
          title,
          description,
        };
      })
    : // Fallback to hardcoded items when no badges configured
      [
        {
          badge: { id: "fallback-warranty", icon: "ShieldCheck", title: "Hàng chính hãng 100%", description: "Hoàn tiền nếu hàng giả", enabled: true, order: 0 },
          title: "Hàng chính hãng 100%",
          description: "Hoàn tiền nếu hàng giả",
        },
        {
          badge: { id: "fallback-shipping", icon: "Truck", title: "Giao hàng nhanh", description: settings?.shipping_info ?? "Nội thành Cần Thơ trong 2h" },
          title: "Giao hàng nhanh",
          description: settings?.shipping_info ?? "Nội thành Cần Thơ trong 2h",
        },
        {
          badge: { id: "fallback-returns", icon: "RotateCcw", title: `Đổi trả ${settings?.return_policy_days ?? 30} ngày`, description: "Miễn phí không cần lý do" },
          title: `Đổi trả ${settings?.return_policy_days ?? 30} ngày`,
          description: "Miễn phí không cần lý do",
        },
        {
          badge: { id: "fallback-support", icon: "Headphones", title: "Hỗ trợ 24/7", description: isLoading ? "Đang tải..." : `${settings?.hotline ?? settings?.phone ?? "1900 1234"} miễn phí` },
          title: "Hỗ trợ 24/7",
          description: isLoading ? "Đang tải..." : `${settings?.hotline ?? settings?.phone ?? "1900 1234"} miễn phí`,
        },
      ];

  // Render icon dynamically - use static fallback for common icons
  function getIconComponent(iconName: string): LucideIcon {
    return staticIcons[iconName] ?? ShieldCheck;
  }

  return (
    <section className="container pt-14 sm:pt-24">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 md:grid-cols-4 md:divide-y-0">
          {items.map(({ badge, title, description }, i) => {
            const Icon = getIconComponent(badge.icon);
            return (
              <Reveal key={badge.id} variant="fade-up" delay={i * 70} threshold={0.05}>
                <div className="group relative flex h-full flex-col gap-2.5 p-5 transition-colors duration-300 hover:bg-slate-50/70 sm:p-6">
                  <Icon className="h-5 w-5 text-slate-400 transition-colors duration-300 group-hover:text-slate-900" />
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800 sm:text-sm">{title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">{description}</p>
                  </div>

                  {/* Bottom accent line */}
                  <div className="absolute bottom-0 left-0 h-0.5 w-0 rounded-full bg-slate-900 transition-all duration-500 group-hover:w-full" />
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

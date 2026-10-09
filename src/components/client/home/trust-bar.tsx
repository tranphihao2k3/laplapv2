"use client";

import { useEffect, useState } from "react";
import { Reveal } from "./reveal";
import { useStoreSettings } from "@/components/client/layout/use-store-settings";
import { ShieldCheck, Truck, RotateCcw, Headphones, BadgeCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const staticIcons: Record<string, LucideIcon> = {
  ShieldCheck, Truck, RotateCcw, Headphones, BadgeCheck,
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

  useEffect(() => {
    async function fetchBadges() {
      try {
        const response = await fetch("/api/public/trust-badges", { cache: "no-store" });
        if (response.ok) {
          const data: TrustBadgeItem[] = await response.json();
          setBadges(data.filter((b) => b.enabled));
        }
      } catch { /* silent */ }
      finally { setIsLoadingBadges(false); }
    }
    fetchBadges();
  }, []);

  const items = badges.length > 0
    ? badges.map((badge) => {
        let title = badge.title;
        let description = badge.description;
        if (title.includes("{return_policy_days}")) {
          title = title.replace("{return_policy_days}", String(settings?.return_policy_days ?? 30));
        }
        if (description?.includes("{shipping_info}")) {
          description = description.replace("{shipping_info}", settings?.shipping_info ?? "Nội thành Cần Thơ trong 2h");
        }
        if (description?.includes("{hotline}")) {
          description = description.replace("{hotline}", settings?.hotline ?? settings?.phone ?? "1900 1234");
        }
        return { badge, title, description };
      })
    : [
        { badge: { id: "1", icon: "ShieldCheck", title: "", description: "", enabled: true, order: 0 }, title: "Hàng chính hãng 100%", description: "Hoàn tiền nếu hàng giả" },
        { badge: { id: "2", icon: "Truck", title: "", description: "", enabled: true, order: 1 }, title: "Giao hàng nhanh", description: settings?.shipping_info ?? "Nội thành Cần Thơ trong 2h" },
        { badge: { id: "3", icon: "RotateCcw", title: "", description: "", enabled: true, order: 2 }, title: `Đổi trả ${settings?.return_policy_days ?? 30} ngày`, description: "Miễn phí không cần lý do" },
        { badge: { id: "4", icon: "Headphones", title: "", description: "", enabled: true, order: 3 }, title: "Hỗ trợ 24/7", description: isLoading ? "Đang tải..." : `${settings?.hotline ?? settings?.phone ?? "1900 1234"} miễn phí` },
      ];

  function getIconComponent(iconName: string): LucideIcon {
    return staticIcons[iconName] ?? ShieldCheck;
  }

  return (
    <section className="container py-12 sm:py-16">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0">
          {items.map(({ badge, title, description }, i) => {
            const Icon = getIconComponent(badge.icon);
            return (
              <Reveal key={badge.id} variant="fade-up" delay={i * 60} threshold={0.05}>
                <div className="flex h-full flex-col gap-3 p-5 text-center transition-colors hover:bg-muted/50 sm:p-6">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

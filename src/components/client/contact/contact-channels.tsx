"use client";

import {
  Phone,
  Headphones,
  MessageCircle,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/client/home/reveal";
import { useStoreSettings } from "@/components/client/layout/use-store-settings";
import { cn } from "@/lib/utils";

/** Map icon name to Lucide component */
function getIcon(iconName: string): LucideIcon {
  switch (iconName) {
    case "phone":
      return Phone;
    case "headphones":
      return Headphones;
    case "message-circle":
      return MessageCircle;
    case "mail":
      return Mail;
    default:
      return Phone;
  }
}

/** Channel card accent colors by type */
const ACCENT_BY_TYPE: Record<string, string> = {
  phone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  hotline: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  zalo: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  whatsapp: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
  email: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  messenger: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  telegram: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  other: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/40 dark:text-slate-300 dark:border-slate-800",
};

export function ContactChannels() {
  const { settings, isLoading } = useStoreSettings();

  // Use dynamic contact_channels if available, otherwise fall back to phone/hotline/email
  const channels = settings?.contact_channels ?? [
    {
      icon: "phone",
      label: "Hotline bán hàng",
      value: settings?.phone ?? "1900 1234",
      type: "phone" as const,
    },
    {
      icon: "headphones",
      label: "Hỗ trợ kỹ thuật",
      value: settings?.hotline ?? settings?.phone ?? "1900 1234",
      type: "phone" as const,
    },
    {
      icon: "message-circle",
      label: "Zalo / WhatsApp",
      value: settings?.hotline ?? settings?.phone ?? "0901 234 567",
      type: "zalo" as const,
    },
    {
      icon: "mail",
      label: "Email",
      value: settings?.email ?? "info@laplap.vn",
      type: "email" as const,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {channels.map((channel, i) => {
        const Icon = getIcon(channel.icon);
        const accent = ACCENT_BY_TYPE[channel.type] ?? ACCENT_BY_TYPE.other;

        return (
          <Reveal key={channel.label} variant="fade-up" delay={i * 80} threshold={0.1}>
            <div className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 text-card-foreground transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div
                className={cn(
                  "mb-4 flex h-12 w-12 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110",
                  accent,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {channel.label}
              </h3>
              <p className="mt-1.5 text-lg font-bold text-foreground">
                {isLoading ? "Đang tải..." : channel.value}
              </p>
              {channel.link && (
                <a
                  href={channel.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Liên kết →
                </a>
              )}
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

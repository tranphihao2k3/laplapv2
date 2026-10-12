"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  CheckCheck,
  Package,
  Truck,
  Gift,
  Tag,
  Megaphone,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

const TYPE_ICON: Record<string, { icon: typeof Bell; bg: string; text: string }> = {
  order: { icon: Package, bg: "bg-blue-50", text: "text-blue-600" },
  shipping: { icon: Truck, bg: "bg-violet-50", text: "text-violet-600" },
  promo: { icon: Tag, bg: "bg-pink-50", text: "text-pink-600" },
  gift: { icon: Gift, bg: "bg-amber-50", text: "text-amber-600" },
  system: { icon: Megaphone, bg: "bg-zinc-100", text: "text-zinc-600" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

export function NotificationsList({ items }: { items: Item[] }) {
  const router = useRouter();
  const qc = useQueryClient();

  const markAll = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/account/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
      if (!res.ok) throw new Error("Lỗi");
    },
    onSuccess: () => {
      toast.success("Đã đánh dấu tất cả là đã đọc");
      router.refresh();
    },
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/v1/account/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error("Lỗi");
    },
    onSuccess: () => router.refresh(),
  });

  const unread = items.filter((i) => !i.is_read).length;

  return (
    <>
      {unread > 0 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Đánh dấu tất cả đã đọc
          </Button>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((n) => {
          const tInfo = TYPE_ICON[n.type] ?? { icon: Bell, bg: "bg-muted", text: "text-muted-foreground" };
          const Icon = tInfo.icon;
          const Inner = (
            <div
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-3.5 transition-colors",
                n.is_read
                  ? "border-border/60 bg-card"
                  : "border-primary/20 bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  tInfo.bg,
                  tInfo.text,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "truncate text-sm",
                      n.is_read ? "font-medium text-foreground" : "font-semibold text-foreground",
                    )}
                  >
                    {n.title}
                  </p>
                  {!n.is_read && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                {n.body && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {n.body}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {timeAgo(n.created_at)}
                </p>
              </div>
              {n.href && (
                <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
              )}
            </div>
          );
          return (
            <li key={n.id}>
              {n.href ? (
                <Link
                  href={n.href}
                  onClick={() => !n.is_read && markOne.mutate(n.id)}
                  className="block"
                >
                  {Inner}
                </Link>
              ) : (
                <div onClick={() => !n.is_read && markOne.mutate(n.id)} className="cursor-pointer">
                  {Inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

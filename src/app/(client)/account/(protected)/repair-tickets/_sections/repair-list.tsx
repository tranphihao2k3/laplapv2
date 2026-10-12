"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Wrench, Loader2, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";

type Item = {
  id: string;
  ticket_code: string;
  device_name: string | null;
  issue_description: string | null;
  serial_number: string | null;
  status: string | null;
  created_at: string;
  completed_at: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  shop: { id: string; name: string } | null;
};

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: "Vừa tiếp nhận", bg: "bg-blue-50", text: "text-blue-700" },
  in_progress: { label: "Đang sửa", bg: "bg-amber-50", text: "text-amber-700" },
  awaiting_parts: { label: "Chờ linh kiện", bg: "bg-violet-50", text: "text-violet-700" },
  ready: { label: "Sẵn sàng trả", bg: "bg-emerald-50", text: "text-emerald-700" },
  completed: { label: "Đã trả", bg: "bg-emerald-50", text: "text-emerald-700" },
  cancelled: { label: "Đã huỷ", bg: "bg-rose-50", text: "text-rose-700" },
};

export function RepairTicketList({ items }: { items: Item[] }) {
  return (
    <div className="space-y-3">
      {items.map((it) => {
        const status = STATUS_MAP[it.status ?? ""] ?? {
          label: it.status ?? "—",
          bg: "bg-muted",
          text: "text-muted-foreground",
        };
        return (
          <Link
            key={it.id}
            href={`/account/repair-tickets/${it.id}`}
            className="block"
          >
            <Card className="rounded-2xl border-border/60 transition-all hover:border-primary/30 hover:shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-foreground">
                        #{it.ticket_code}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          status.bg,
                          status.text,
                        )}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {it.device_name ?? "Thiết bị"}
                    </p>
                    {it.issue_description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {it.issue_description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Gửi lúc{" "}
                      {new Date(it.created_at).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {it.shop && ` · ${it.shop.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {(it.estimated_cost || it.actual_cost) && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {it.actual_cost ? "Thực tế" : "Dự kiến"}
                        </p>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(it.actual_cost ?? it.estimated_cost ?? 0)}
                        </p>
                      </div>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

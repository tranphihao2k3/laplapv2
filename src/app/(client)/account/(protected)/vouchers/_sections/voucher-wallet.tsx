"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ticket,
  Copy,
  CheckCircle2,
  Plus,
  Sparkles,
  Calendar,
  ShoppingBag,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";

type Voucher = {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  start_at: string;
  end_at: string;
  total_quantity: number | null;
  used_quantity: number | null;
  description: string | null;
  is_active: boolean;
};

type Claim = {
  id: string;
  voucher_id: string;
  claimed_at: string;
  used_at: string | null;
  order_id: string | null;
  voucher: Voucher | null;
};

function voucherValueLabel(v: Voucher): string {
  if (v.type === "percent") return `Giảm ${v.value}%`;
  if (v.type === "fixed_amount") return `Giảm ${formatCurrency(v.value)}`;
  if (v.type === "free_shipping") return "Miễn phí vận chuyển";
  return "Ưu đãi";
}

export function VoucherWallet({
  available,
  claimed,
}: {
  available: Voucher[];
  claimed: Claim[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"available" | "saved" | "used" | "expired">(
    "available",
  );

  const claim = useMutation({
    mutationFn: async (voucherId: string) => {
      const res = await fetch("/api/v1/account/vouchers/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucher_id: voucherId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Lưu thất bại");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Đã lưu voucher vào kho");
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Lưu thất bại"),
  });

  const savedActive = claimed.filter((c) => !c.used_at && c.voucher && new Date(c.voucher.end_at) > new Date());
  const used = claimed.filter((c) => c.used_at);
  const expired = claimed.filter((c) => !c.used_at && c.voucher && new Date(c.voucher.end_at) <= new Date());

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="available" className="flex-1 sm:flex-none">
          Có thể dùng ({available.length})
        </TabsTrigger>
        <TabsTrigger value="saved" className="flex-1 sm:flex-none">
          Đã lưu ({savedActive.length})
        </TabsTrigger>
        <TabsTrigger value="used" className="flex-1 sm:flex-none">
          Đã dùng ({used.length})
        </TabsTrigger>
        <TabsTrigger value="expired" className="flex-1 sm:flex-none">
          Hết hạn ({expired.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="available" className="mt-4">
        <VoucherList
          vouchers={available.map((v) => ({
            voucher: v,
            actionLabel: "Lưu voucher",
            actionIcon: Plus,
            onAction: () => claim.mutate(v.id),
            busy: claim.isPending && claim.variables === v.id,
          }))}
          emptyTitle="Không có voucher khả dụng"
          emptyHint="Hãy theo dõi fanpage/email để nhận voucher mới."
        />
      </TabsContent>

      <TabsContent value="saved" className="mt-4">
        <VoucherList
          vouchers={savedActive.map((c) => ({
            voucher: c.voucher!,
            actionLabel: "Sao chép mã",
            actionIcon: Copy,
            code: c.voucher?.code,
          }))}
          emptyTitle="Chưa lưu voucher nào"
          emptyHint="Lưu voucher ở tab Có thể dùng để dùng sau."
        />
      </TabsContent>

      <TabsContent value="used" className="mt-4">
        <VoucherList
          vouchers={used.map((c) => ({
            voucher: c.voucher!,
            actionLabel: "Đã dùng",
            disabled: true,
            code: c.voucher?.code,
          }))}
          emptyTitle="Chưa dùng voucher nào"
        />
      </TabsContent>

      <TabsContent value="expired" className="mt-4">
        <VoucherList
          vouchers={expired.map((c) => ({
            voucher: c.voucher!,
            actionLabel: "Hết hạn",
            disabled: true,
            code: c.voucher?.code,
          }))}
          emptyTitle="Không có voucher hết hạn"
        />
      </TabsContent>
    </Tabs>
  );
}

type VoucherCardProps = {
  voucher: Voucher;
  actionLabel: string;
  actionIcon?: React.ComponentType<{ className?: string }>;
  onAction?: () => void;
  busy?: boolean;
  disabled?: boolean;
  code?: string;
};

function VoucherCard({
  voucher,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  busy,
  disabled,
  code,
}: VoucherCardProps) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60">
      <div className="flex">
        <div
          className={cn(
            "flex w-24 shrink-0 flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/15 to-primary/5 p-4 text-primary",
            disabled && "from-muted to-muted/50 text-muted-foreground",
          )}
        >
          <Ticket className="h-7 w-7" />
          <span className="text-center text-xs font-semibold">
            {voucherValueLabel(voucher)}
          </span>
        </div>
        <CardContent className="flex flex-1 items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-semibold">{voucher.name}</p>
            {voucher.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {voucher.description}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {voucher.min_order_amount ? (
                <Badge variant="outline" className="text-[10px]">
                  Đơn tối thiểu {formatCurrency(voucher.min_order_amount)}
                </Badge>
              ) : null}
              {voucher.max_discount_amount ? (
                <Badge variant="outline" className="text-[10px]">
                  Tối đa {formatCurrency(voucher.max_discount_amount)}
                </Badge>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Đến {new Date(voucher.end_at).toLocaleDateString("vi-VN")}
              </span>
            </div>
            {code && (
              <p className="mt-1 inline-flex items-center gap-1 font-mono text-xs">
                Mã: <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">{code}</span>
              </p>
            )}
          </div>
          {ActionIcon ? (
            <Button
              size="sm"
              onClick={onAction}
              disabled={disabled || busy}
              className="shrink-0"
            >
              <ActionIcon className="mr-1 h-3.5 w-3.5" />
              {actionLabel}
            </Button>
          ) : (
            <Badge
              variant="secondary"
              className={cn(
                "shrink-0",
                disabled && "bg-muted text-muted-foreground",
              )}
            >
              {disabled ? (
                <CheckCircle2 className="mr-1 h-3 w-3" />
              ) : (
                <Sparkles className="mr-1 h-3 w-3" />
              )}
              {actionLabel}
            </Badge>
          )}
        </CardContent>
      </div>
    </Card>
  );
}

function VoucherList({
  vouchers,
  emptyTitle,
  emptyHint,
}: {
  vouchers: VoucherCardProps[];
  emptyTitle: string;
  emptyHint?: string;
}) {
  if (vouchers.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Ticket className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold">{emptyTitle}</p>
          {emptyHint && (
            <p className="mt-1 text-sm text-muted-foreground">{emptyHint}</p>
          )}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {vouchers.map((v, i) => (
        <VoucherCard key={v.voucher.id + i} {...v} />
      ))}
    </div>
  );
}

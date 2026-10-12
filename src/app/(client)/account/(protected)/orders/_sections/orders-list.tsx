"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingBag, ArrowRight, RefreshCcw, X, Eye, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";

type OrderRow = {
  id: string;
  order_number: string;
  status: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  channel: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  created_at: string | null;
  note: string | null;
};

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Nháp", bg: "bg-zinc-100", text: "text-zinc-700" },
  pending: { label: "Chờ xử lý", bg: "bg-amber-50", text: "text-amber-700" },
  confirmed: { label: "Đã xác nhận", bg: "bg-blue-50", text: "text-blue-700" },
  processing: { label: "Đang xử lý", bg: "bg-indigo-50", text: "text-indigo-700" },
  shipping: { label: "Đang giao", bg: "bg-violet-50", text: "text-violet-700" },
  fulfilled: { label: "Đã giao", bg: "bg-emerald-50", text: "text-emerald-700" },
  completed: { label: "Hoàn tất", bg: "bg-emerald-50", text: "text-emerald-700" },
  cancelled: { label: "Đã huỷ", bg: "bg-rose-50", text: "text-rose-700" },
};

const PAYMENT_MAP: Record<string, { label: string; bg: string; text: string }> = {
  unpaid: { label: "Chưa thanh toán", bg: "bg-amber-50", text: "text-amber-700" },
  partial: { label: "Trả một phần", bg: "bg-orange-50", text: "text-orange-700" },
  paid: { label: "Đã thanh toán", bg: "bg-emerald-50", text: "text-emerald-700" },
  refunded: { label: "Đã hoàn tiền", bg: "bg-slate-50", text: "text-slate-700" },
};

function canCancel(status: string | null, createdAt: string | null): boolean {
  if (!status || !createdAt) return false;
  if (!["draft", "pending"].includes(status)) return false;
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

export function OrdersList({
  initial,
  total,
  pageSize,
  initialQuery,
  initialStatus,
}: {
  initial: OrderRow[];
  total: number;
  pageSize: number;
  initialQuery: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<OrderRow | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const cartBounce = useCartStore((s) => s.cartBounceAt);

  const cancel = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await fetch(`/api/v1/account/orders/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Huỷ thất bại");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Đã huỷ đơn hàng");
      setCancelling(null);
      router.refresh();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Huỷ thất bại");
      setCancelling(null);
    },
  });

  const reorder = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/account/orders/${id}/reorder`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Không thể mua lại");
      return res.json();
    },
    onSuccess: (data) => {
      const items: Array<{
        variantId: string;
        quantity: number;
        name: string;
        slug: string;
        image: string | null;
        price: number;
      }> = data.items ?? [];
      items.forEach((it) => {
        addItem({
          variantId: it.variantId,
          productId: it.variantId.split("-")[0] ?? it.variantId,
          name: it.name,
          slug: it.slug,
          image: it.image,
          price: it.price,
          attributes: "",
          stockQty: 999,
          quantity: it.quantity,
        });
      });
      if (items.length === 0) {
        toast.info("Sản phẩm đã ngừng bán");
        return;
      }
      toast.success(
        `Đã thêm ${items.length} sản phẩm vào giỏ hàng${data.skipped ? ` (bỏ qua ${data.skipped} sản phẩm hết hàng)` : ""}`,
      );
      router.push("/cart");
    },
    onError: () => toast.error("Không thể mua lại"),
  });

  if (initial.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ShoppingBag className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold">
            {initialQuery || initialStatus
              ? "Không có đơn nào khớp bộ lọc"
              : "Bạn chưa có đơn hàng nào"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Khám phá các laptop và phụ kiện phù hợp với nhu cầu của bạn.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/products">Mua sắm ngay</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {initial.map((o) => {
          const status = STATUS_MAP[o.status ?? ""] ?? {
            label: o.status ?? "—",
            bg: "bg-muted",
            text: "text-muted-foreground",
          };
          const pay = PAYMENT_MAP[o.payment_status ?? ""];
          const showCancel = canCancel(o.status, o.created_at);
          const showReorder = ["completed", "fulfilled", "cancelled"].includes(
            o.status ?? "",
          );

          return (
            <Card
              key={o.id}
              className="group rounded-2xl border-border/60 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/account/orders/${o.id}`}
                        className="font-mono text-sm font-bold text-foreground hover:text-primary"
                      >
                        #{o.order_number}
                      </Link>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          status.bg,
                          status.text,
                        )}
                      >
                        {status.label}
                      </span>
                      {pay && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            pay.bg,
                            pay.text,
                          )}
                        >
                          {pay.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {o.created_at
                        ? new Date(o.created_at).toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:text-right">
                    <p className="text-lg font-bold tabular-nums">
                      {formatCurrency(o.total_amount ?? 0)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/account/orders/${o.id}`}>
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      Chi tiết
                    </Link>
                  </Button>
                  {showReorder && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reorder.mutate(o.id)}
                      disabled={reorder.isPending}
                    >
                      <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                      Mua lại
                    </Button>
                  )}
                  {showCancel && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCancelling(o)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Huỷ đơn
                    </Button>
                  )}
                  <Link
                    href={`/account/orders/${o.id}`}
                    className="ml-auto text-xs text-muted-foreground hover:text-primary sm:hidden"
                  >
                    Xem <ArrowRight className="inline h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-center pt-2 text-sm text-muted-foreground">
          Hiển thị {initial.length}/{total} đơn. Liên hệ CSKH nếu cần xem nhiều hơn.
        </div>
      )}

      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Huỷ đơn #{cancelling?.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Nếu đã thanh toán, CSKH sẽ hoàn tiền
              trong 1-3 ngày làm việc.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Đóng</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelling && cancel.mutate({ id: cancelling.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancel.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Huỷ đơn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

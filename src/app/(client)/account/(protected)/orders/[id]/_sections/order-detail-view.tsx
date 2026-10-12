"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  Store,
  CreditCard,
  Receipt,
  RefreshCcw,
  X,
  Loader2,
  ShieldCheck,
  MapPin,
  Wrench,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type Order = {
  id: string;
  order_number: string;
  status: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  channel: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  note: string | null;
  created_at: string;
  shop_id: string | null;
  shop?: { id: string; name: string; phone: string | null; address: string | null } | null;
};

/** Thông tin thiết bị sửa — lấy từ repair_tickets (preferred) hoặc product_snapshot. */
export type RepairInfo = {
  device_name: string | null;
  device_brand: string | null;
  device_model: string | null;
  device_serial: string | null;
  device_condition: string | null;
  issue_description: string | null;
  accessories: string | null;
  technician_name: string | null;
  estimated_completion: string | null;
};

type Item = {
  id: string;
  product_variant_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_snapshot: unknown;
  product_variant: {
    id: string;
    name: string;
    sku: string | null;
    product: {
      id: string;
      name: string;
      slug: string;
      thumbnail_url: string | null;
    } | null;
  } | null;
};

type Payment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  paid_at: string | null;
  note: string | null;
};

type Log = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
  actor: string | null;
};

const STATUS_INFO: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Nháp", bg: "bg-zinc-100", text: "text-zinc-700", icon: Clock },
  pending: { label: "Chờ xử lý", bg: "bg-amber-50", text: "text-amber-700", icon: Clock },
  confirmed: { label: "Đã xác nhận", bg: "bg-blue-50", text: "text-blue-700", icon: CheckCircle2 },
  processing: { label: "Đang xử lý", bg: "bg-indigo-50", text: "text-indigo-700", icon: Package },
  shipping: { label: "Đang giao", bg: "bg-violet-50", text: "text-violet-700", icon: Truck },
  fulfilled: { label: "Đã giao", bg: "bg-emerald-50", text: "text-emerald-700", icon: CheckCircle2 },
  completed: { label: "Hoàn tất", bg: "bg-emerald-50", text: "text-emerald-700", icon: CheckCircle2 },
  cancelled: { label: "Đã huỷ", bg: "bg-rose-50", text: "text-rose-700", icon: XCircle },
};

const TIMELINE: Array<{ key: string; label: string; icon: typeof CheckCircle2 }> = [
  { key: "pending", label: "Đặt hàng thành công", icon: CheckCircle2 },
  { key: "confirmed", label: "Đã xác nhận", icon: CheckCircle2 },
  { key: "processing", label: "Đang chuẩn bị", icon: Package },
  { key: "shipping", label: "Đang giao", icon: Truck },
  { key: "fulfilled", label: "Đã giao", icon: CheckCircle2 },
];

function getTimelineIndex(status: string | null) {
  if (!status) return 0;
  if (status === "cancelled") return -1;
  const i = TIMELINE.findIndex((t) => t.key === status);
  if (i >= 0) return i;
  // Map completed -> fulfilled index
  if (status === "completed") return TIMELINE.length - 1;
  return 0;
}

function canCancel(status: string | null, createdAt: string): boolean {
  if (!status) return false;
  if (!["draft", "pending"].includes(status)) return false;
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

export function OrderDetailView({
  order,
  items,
  payments,
  statusLogs,
  returns,
  repair,
}: {
  order: Order;
  items: Item[];
  payments: Payment[];
  statusLogs: Log[];
  returns: { id: string; status: string; reason: string | null; created_at: string; refund_amount: number | null }[];
  repair: RepairInfo | null;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const statusInfo = STATUS_INFO[order.status ?? ""];
  const StatusIcon = statusInfo?.icon ?? Clock;
  const showCancel = canCancel(order.status, order.created_at);
  const showReorder = ["completed", "fulfilled", "cancelled"].includes(order.status ?? "");

  const cancel = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/account/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Huỷ thất bại");
      }
    },
    onSuccess: () => {
      toast.success("Đã huỷ đơn hàng");
      router.refresh();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Huỷ thất bại");
    },
    onSettled: () => setCancelling(false),
  });

  const reorder = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/account/orders/${order.id}/reorder`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Không thể mua lại");
      return res.json();
    },
    onSuccess: (data) => {
      const list: Array<{
        variantId: string;
        quantity: number;
        name: string;
        slug: string;
        image: string | null;
        price: number;
      }> = data.items ?? [];
      list.forEach((it) => {
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
      if (list.length === 0) {
        toast.info("Sản phẩm đã ngừng bán");
        return;
      }
      toast.success(
        `Đã thêm ${list.length} sản phẩm vào giỏ${data.skipped ? ` (bỏ qua ${data.skipped} hết hàng)` : ""}`,
      );
      router.push("/cart");
    },
  });

  return (
    <>
      {/* Header */}
      <Card className="rounded-2xl border-border/60">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-lg font-bold">
                  Đơn #{order.order_number}
                </h1>
                {statusInfo && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      statusInfo.bg,
                      statusInfo.text,
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusInfo.label}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Đặt lúc{" "}
                {new Date(order.created_at).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {showCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelling(true)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Huỷ đơn
                </Button>
              )}
              {showReorder && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reorder.mutate()}
                  disabled={reorder.isPending}
                >
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                  Mua lại
                </Button>
              )}
              {order.status === "fulfilled" || order.status === "completed" ? (
                <Button asChild size="sm">
                  <Link href={`/account/repair-tickets?order=${order.id}`}>
                    <Wrench className="mr-1.5 h-3.5 w-3.5" />
                    Yêu cầu sửa
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Timeline */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Trạng thái đơn hàng</CardTitle>
            </CardHeader>
            <CardContent>
              {order.status === "cancelled" ? (
                <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-rose-700">
                  <XCircle className="h-5 w-5" />
                  <p className="text-sm font-medium">Đơn hàng đã bị huỷ.</p>
                </div>
              ) : (
                <ol className="relative space-y-3">
                  {TIMELINE.map((step, idx) => {
                    const activeIdx = getTimelineIndex(order.status);
                    const active = idx <= activeIdx;
                    const isCurrent = idx === activeIdx;
                    return (
                      <li key={step.key} className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted bg-background text-muted-foreground",
                            isCurrent && "ring-4 ring-primary/20",
                          )}
                        >
                          <step.icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 pt-1">
                          <p
                            className={cn(
                              "text-sm font-medium",
                              active ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {step.label}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {statusLogs.length > 0 && (
                <div className="mt-4 space-y-1.5 border-t pt-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Lịch sử
                  </p>
                  {statusLogs.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                      <div>
                        <span className="font-medium text-foreground">
                          {STATUS_INFO[l.status]?.label ?? l.status}
                        </span>
                        {l.note ? ` — ${l.note}` : ""}
                        <span className="ml-1">
                          ({new Date(l.created_at).toLocaleString("vi-VN")})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items - product list OR repair device info */}
          {items.length > 0 ? (
            <Card className="rounded-2xl border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Sản phẩm ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border/60">
                  {items.map((it) => {
                    const product = it.product_variant?.product;
                    const snapshot = (it.product_snapshot as {
                      name?: string;
                      image?: string;
                      device_name?: string;
                      serial_number?: string;
                    }) ?? {};
                    // Fallback chain: product name -> snapshot.name -> snapshot.device_name (repair) -> "Sản phẩm"
                    const displayName =
                      product?.name ??
                      snapshot.name ??
                      snapshot.device_name ??
                      "Sản phẩm";
                    const image =
                      product?.thumbnail_url ?? snapshot.image ?? null;
                    return (
                      <li key={it.id} className="flex items-center gap-3 py-3">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                          {image ? (
                            <Image
                              src={image}
                              alt={displayName}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                              No img
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {product ? (
                            <Link
                              href={`/products/${product.slug}`}
                              className="line-clamp-2 text-sm font-medium hover:text-primary"
                            >
                              {displayName}
                            </Link>
                          ) : (
                            <p className="line-clamp-2 text-sm font-medium">
                              {displayName}
                            </p>
                          )}
                          {it.product_variant?.name && (
                            <p className="text-xs text-muted-foreground">
                              {it.product_variant.name}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            SL: {it.quantity} ·{" "}
                            {formatCurrency(it.unit_price)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(it.total_price)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* Repair device info (luôn hiện khi có data) */}
          {repair &&
          (repair.device_name ||
            repair.device_brand ||
            repair.device_model ||
            repair.issue_description) ? (
            <Card className="rounded-2xl border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  Thông tin thiết bị sửa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                  {repair.device_name && (
                    <InfoRow
                      label="Thiết bị"
                      value={repair.device_name}
                    />
                  )}
                  {repair.device_brand && (
                    <InfoRow
                      label="Hãng"
                      value={repair.device_brand}
                    />
                  )}
                  {repair.device_model && (
                    <InfoRow
                      label="Model"
                      value={repair.device_model}
                    />
                  )}
                  {repair.device_serial && (
                    <InfoRow
                      label="Serial"
                      value={repair.device_serial}
                    />
                  )}
                  {repair.device_condition && (
                    <InfoRow
                      label="Tình trạng máy"
                      value={repair.device_condition}
                    />
                  )}
                  {repair.technician_name && (
                    <InfoRow
                      label="Kỹ thuật viên"
                      value={repair.technician_name}
                    />
                  )}
                  {repair.estimated_completion && (
                    <InfoRow
                      label="Dự kiến xong"
                      value={new Date(
                        repair.estimated_completion,
                      ).toLocaleDateString("vi-VN")}
                    />
                  )}
                </div>
                {repair.issue_description && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Mô tả lỗi
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                      {repair.issue_description}
                    </p>
                  </div>
                )}
                {repair.accessories && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Phụ kiện kèm theo
                    </p>
                    <p className="text-sm">{repair.accessories}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Returns */}
          {returns.length > 0 && (
            <Card className="rounded-2xl border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Yêu cầu trả hàng</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {returns.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start gap-3 rounded-xl border border-border/60 p-3"
                    >
                      <Badge variant="outline">{r.status}</Badge>
                      <div className="flex-1 text-sm">
                        <p className="font-medium">{r.reason ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          Gửi lúc {new Date(r.created_at).toLocaleString("vi-VN")}
                          {r.refund_amount
                            ? ` · Hoàn ${formatCurrency(r.refund_amount)}`
                            : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {/* Summary */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tóm tắt thanh toán</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Tạm tính" value={formatCurrency(order.subtotal ?? 0)} />
              {!!(order.discount_amount ?? 0) && (
                <Row
                  label="Giảm giá"
                  value={`-${formatCurrency(order.discount_amount ?? 0)}`}
                  className="text-emerald-600"
                />
              )}
              <div className="my-2 h-px bg-border" />
              <Row
                label="Tổng cộng"
                value={formatCurrency(order.total_amount ?? 0)}
                bold
                large
              />
            </CardContent>
          </Card>

          {/* Payments */}
          {payments.length > 0 && (
            <Card className="rounded-2xl border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Thanh toán</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-border/60 p-3 text-sm"
                  >
                    <div className="flex items-start gap-2">
                      <CreditCard className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{p.method}</p>
                        {p.note && (
                          <p className="text-xs text-muted-foreground">{p.note}</p>
                        )}
                        {p.paid_at && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(p.paid_at).toLocaleString("vi-VN")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">
                        {formatCurrency(p.amount)}
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Shop */}
          {order.shop && (
            <Card className="rounded-2xl border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Cửa hàng xử lý</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{order.shop.name}</span>
                </div>
                {order.shop.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{order.shop.address}</span>
                  </div>
                )}
                {order.shop.phone && (
                  <a
                    href={`tel:${order.shop.phone}`}
                    className="flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <Receipt className="h-4 w-4" />
                    {order.shop.phone}
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Related links */}
          <Card className="rounded-2xl border-border/60">
            <CardContent className="divide-y divide-border/60 p-0">
              {order.status === "fulfilled" || order.status === "completed" ? (
                <Link
                  href={`/account/warranties?order=${order.id}`}
                  className="flex items-center gap-3 p-3 text-sm hover:bg-muted"
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="flex-1">Xem bảo hành của đơn này</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ) : null}
              {order.note && (
                <div className="p-3 text-xs text-muted-foreground">
                  <strong className="text-foreground">Ghi chú:</strong> {order.note}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={cancelling} onOpenChange={setCancelling}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Huỷ đơn #{order.order_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Nếu đã thanh toán, CSKH sẽ hoàn tiền
              trong 1-3 ngày làm việc.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Đóng</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancel.mutate()}
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

function Row({
  label,
  value,
  bold,
  large,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          bold && "font-semibold",
          large && "text-lg",
          className,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

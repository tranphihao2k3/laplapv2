"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Package,
  CreditCard,
  Undo2,
  User,
  Store,
  StickyNote,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { httpGet } from "@/lib/api/http";

type OrderFull = {
  order: {
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
    created_at: string | null;
    customer_id: string | null;
    shop_id: string | null;
  } | null;
  items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    product_variant_id: string;
    product_snapshot: unknown;
    product_variant: {
      id: string;
      sku: string;
      name: string | null;
      product: { id: string; name: string; slug: string; thumbnail_url: string | null } | null;
    } | null;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    status: string;
    transaction_code: string | null;
    paid_at: string | null;
  }>;
  status_logs: Array<{
    id: string;
    from_status: string | null;
    to_status: string | null;
    from_payment_status: string | null;
    to_payment_status: string | null;
    from_fulfillment_status: string | null;
    to_fulfillment_status: string | null;
    note: string | null;
    created_at: string;
  }>;
  returns: Array<{
    id: string;
    return_number: string;
    status: string;
    refund_amount: number | null;
    created_at: string;
  }>;
  customer: { id: string; full_name: string | null; phone: string | null; email: string | null; tier: string | null } | null;
  shop: { id: string; name: string; code: string | null; phone: string | null; address: string | null } | null;
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Nháp" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "processing", label: "Đang xử lý" },
  { value: "shipping", label: "Đang giao" },
  { value: "fulfilled", label: "Đã giao" },
  { value: "completed", label: "Hoàn tất" },
  { value: "cancelled", label: "Đã huỷ" },
];
const PAYMENT_OPTIONS = [
  { value: "unpaid", label: "Chưa thanh toán" },
  { value: "partial", label: "Trả một phần" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "refunded", label: "Đã hoàn tiền" },
];
const FULFILLMENT_OPTIONS = [
  { value: "unfulfilled", label: "Chưa giao" },
  { value: "partial", label: "Giao một phần" },
  { value: "fulfilled", label: "Đã giao" },
  { value: "returned", label: "Đã trả" },
];

function vnd(n: number | null | undefined) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n ?? 0);
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["order-full", id],
    queryFn: () => httpGet<OrderFull>(`/v1/orders/${id}/full`),
    enabled: !!id,
  });

  // ==== Đổi trạng thái thủ công ====
  const [statusOpen, setStatusOpen] = useState(false);
  const [toStatus, setToStatus] = useState<string>("");
  const [toPayment, setToPayment] = useState<string>("");
  const [toFulfillment, setToFulfillment] = useState<string>("");
  const [statusNote, setStatusNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // ==== Tạo đơn trả ====
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnMethod, setReturnMethod] = useState<string>("cash");
  const [returnItems, setReturnItems] = useState<Map<string, number>>(new Map());
  const [savingReturn, setSavingReturn] = useState(false);

  const order = data?.order;
  const items = data?.items ?? [];
  const payments = data?.payments ?? [];
  const statusLogs = data?.status_logs ?? [];
  const returns = data?.returns ?? [];

  const refundTotal = useMemo(() => {
    let total = 0;
    items.forEach((it) => {
      const qty = returnItems.get(it.id) ?? 0;
      if (qty > 0) total += qty * Number(it.unit_price);
    });
    return total;
  }, [items, returnItems]);

  const openStatusDialog = () => {
    setToStatus(order?.status ?? "");
    setToPayment(order?.payment_status ?? "");
    setToFulfillment(order?.fulfillment_status ?? "");
    setStatusNote("");
    setStatusOpen(true);
  };

  const submitStatus = async () => {
    if (!order) return;
    const body: Record<string, string | undefined> = {};
    if (toStatus && toStatus !== order.status) body.to_status = toStatus;
    if (toPayment && toPayment !== order.payment_status) body.to_payment_status = toPayment;
    if (toFulfillment && toFulfillment !== order.fulfillment_status) body.to_fulfillment_status = toFulfillment;
    if (statusNote) body.note = statusNote;
    if (Object.keys(body).length === 0) {
      toast.error("Chưa thay đổi trạng thái nào");
      return;
    }
    try {
      setSavingStatus(true);
      const res = await fetch(`/api/v1/orders/${order.id}/change-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Đổi trạng thái thất bại");
      toast.success("Đã đổi trạng thái");
      setStatusOpen(false);
      qc.invalidateQueries({ queryKey: ["order-full", id] });
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Đổi trạng thái thất bại");
    } finally {
      setSavingStatus(false);
    }
  };

  const openReturnDialog = () => {
    const m = new Map<string, number>();
    items.forEach((it) => m.set(it.id, 0));
    setReturnItems(m);
    setReturnReason("");
    setReturnMethod("cash");
    setReturnOpen(true);
  };

  const submitReturn = async () => {
    if (!order) return;
    const itemPayload: Array<Record<string, unknown>> = [];
    items.forEach((it) => {
      const qty = returnItems.get(it.id) ?? 0;
      if (qty > 0) {
        itemPayload.push({
          order_item_id: it.id,
          product_variant_id: it.product_variant_id,
          quantity: qty,
          unit_price: Number(it.unit_price),
          restock: true,
        });
      }
    });
    if (itemPayload.length === 0) {
      toast.error("Chưa chọn món nào để trả");
      return;
    }
    try {
      setSavingReturn(true);
      const res = await fetch("/api/v1/return-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          reason: returnReason || null,
          refund_amount: refundTotal,
          refund_method: returnMethod,
          items: itemPayload,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Tạo đơn trả thất bại");
      toast.success("Đã tạo đơn trả hàng");
      setReturnOpen(false);
      qc.invalidateQueries({ queryKey: ["order-full", id] });
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tạo đơn trả thất bại");
    } finally {
      setSavingReturn(false);
    }
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Đang tải...</div>;
  if (error) return <div className="p-6 text-destructive">Lỗi: {(error as Error).message}</div>;
  if (!order) return <div className="p-6 text-muted-foreground">Không tìm thấy đơn hàng</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <Button variant="ghost" size="sm" className="self-start" onClick={() => router.push("/quanly/orders")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại danh sách
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={openStatusDialog}>
            <Clock className="h-4 w-4 mr-1" /> Đổi trạng thái
          </Button>
          <Button variant="outline" size="sm" onClick={openReturnDialog} disabled={items.length === 0}>
            <Undo2 className="h-4 w-4 mr-1" /> Tạo đơn trả
          </Button>
        </div>
      </div>

      {/* Tóm tắt đơn */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg sm:text-xl">Đơn {order.order_number}</CardTitle>
              <CardDescription>
                {order.created_at ? new Date(order.created_at).toLocaleString("vi-VN") : ""} · Kênh: {order.channel ?? "-"}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">{order.status ?? "-"}</span>
              <span className="text-[10px] text-muted-foreground">TT: {order.payment_status ?? "-"} · Giao: {order.fulfillment_status ?? "-"}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1 rounded-md border p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3" /> Khách hàng</div>
            <div className="font-medium">{data?.customer?.full_name ?? "Khách lẻ"}</div>
            <div className="text-xs text-muted-foreground">{data?.customer?.phone ?? "-"}</div>
            <div className="text-xs text-muted-foreground">{data?.customer?.email ?? ""}</div>
            {data?.customer?.tier && <div className="text-xs">Hạng: {data.customer.tier}</div>}
          </div>
          <div className="space-y-1 rounded-md border p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Store className="h-3 w-3" /> Cửa hàng</div>
            <div className="font-medium">{data?.shop?.name ?? "-"}</div>
            <div className="text-xs text-muted-foreground">{data?.shop?.code ?? ""}</div>
            <div className="text-xs text-muted-foreground">{data?.shop?.address ?? ""}</div>
          </div>
          <div className="space-y-1 rounded-md border p-3 bg-muted/30">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">Tổng quan</div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tạm tính</span><span>{vnd(order.subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Giảm giá</span><span>-{vnd(order.discount_amount)}</span></div>
            <div className="flex justify-between text-base font-bold pt-1 border-t"><span>Tổng cộng</span><span>{vnd(order.total_amount)}</span></div>
          </div>
        </CardContent>
        {order.note && (
          <CardContent className="border-t pt-3">
            <div className="flex items-start gap-2 text-sm">
              <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <div className="text-xs text-muted-foreground">Ghi chú</div>
                <div>{order.note}</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" /> Sản phẩm trong đơn ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">Số lượng</TableHead>
                <TableHead className="text-right">Đơn giá</TableHead>
                <TableHead className="text-right">Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Chưa có item</TableCell></TableRow>
              ) : (
                items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {it.product_variant?.product?.thumbnail_url ? (
                          <Image src={it.product_variant.product.thumbnail_url} alt="" width={36} height={36} className="rounded border object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded border bg-muted" />
                        )}
                        <div>
                          <div className="font-medium text-sm">{it.product_variant?.product?.name ?? "—"}</div>
                          <div className="text-[10px] text-muted-foreground">{it.product_variant?.name ?? ""}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{it.product_variant?.sku ?? "-"}</TableCell>
                    <TableCell className="text-center">{it.quantity}</TableCell>
                    <TableCell className="text-right">{vnd(it.unit_price)}</TableCell>
                    <TableCell className="text-right font-semibold">{vnd(it.total_price)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4" /> Thanh toán ({payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có giao dịch thanh toán</p>
            ) : (
              <ul className="space-y-2">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between items-center border rounded p-2">
                    <div>
                      <div className="text-sm font-medium uppercase">{p.method}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.paid_at ? new Date(p.paid_at).toLocaleString("vi-VN") : "—"} · {p.transaction_code ?? "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{vnd(p.amount)}</div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.status === "paid" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {p.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Status timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Lịch sử trạng thái</CardTitle>
            <CardDescription>{statusLogs.length} thay đổi</CardDescription>
          </CardHeader>
          <CardContent>
            {statusLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có thay đổi nào</p>
            ) : (
              <ol className="space-y-2 max-h-80 overflow-auto">
                {statusLogs.map((log) => (
                  <li key={log.id} className="relative pl-4 border-l-2 border-muted">
                    <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("vi-VN")}</div>
                    <div className="text-sm">
                      {log.from_status !== log.to_status && (
                        <span><strong>{log.from_status ?? "—"}</strong> → <strong>{log.to_status ?? "—"}</strong></span>
                      )}
                      {log.from_payment_status !== log.to_payment_status && (
                        <span className="ml-2 text-xs">TT: {log.from_payment_status ?? "—"}→{log.to_payment_status ?? "—"}</span>
                      )}
                      {log.from_fulfillment_status !== log.to_fulfillment_status && (
                        <span className="ml-2 text-xs">Giao: {log.from_fulfillment_status ?? "—"}→{log.to_fulfillment_status ?? "—"}</span>
                      )}
                    </div>
                    {log.note && <div className="text-xs text-muted-foreground italic">{log.note}</div>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Returns list */}
      {returns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Đơn trả hàng liên quan</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã đơn trả</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Số tiền hoàn</TableHead>
                  <TableHead>Tạo lúc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/quanly/return-orders?id=${r.id}`} className="text-primary hover:underline font-mono text-sm">
                        {r.return_number}
                      </Link>
                    </TableCell>
                    <TableCell><span className="text-xs px-2 py-0.5 rounded bg-muted">{r.status}</span></TableCell>
                    <TableCell className="text-right">{vnd(r.refund_amount)}</TableCell>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("vi-VN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog đổi trạng thái */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Đổi trạng thái đơn</DialogTitle>
            <DialogDescription>Hệ thống sẽ tự ghi log thay đổi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Trạng thái đơn</Label>
              <Select value={toStatus} onValueChange={setToStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Thanh toán</Label>
              <Select value={toPayment} onValueChange={setToPayment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Giao hàng</Label>
              <Select value={toFulfillment} onValueChange={setToFulfillment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FULFILLMENT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ghi chú</Label>
              <Input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Lý do thay đổi..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Huỷ</Button>
            <Button onClick={submitStatus} disabled={savingStatus}>Lưu thay đổi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog tạo đơn trả */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo đơn trả từ {order.order_number}</DialogTitle>
            <DialogDescription>Chọn số lượng từng món muốn trả, hệ thống sẽ tự cộng lại tồn kho khi duyệt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-center">Đã mua</TableHead>
                  <TableHead className="text-center">SL trả</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{it.product_variant?.product?.name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{it.product_variant?.sku}</div>
                    </TableCell>
                    <TableCell className="text-center">{it.quantity}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        max={it.quantity}
                        value={returnItems.get(it.id) ?? 0}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(it.quantity, Number(e.target.value) || 0));
                          const m = new Map(returnItems);
                          m.set(it.id, v);
                          setReturnItems(m);
                        }}
                        className="h-8 w-20 text-center mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right">{vnd(it.unit_price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Lý do trả</Label>
                <Input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="VD: SP lỗi, đổi cấu hình..." />
              </div>
              <div className="space-y-1">
                <Label>Phương thức hoàn</Label>
                <Select value={returnMethod} onValueChange={setReturnMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tiền mặt</SelectItem>
                    <SelectItem value="card">Thẻ</SelectItem>
                    <SelectItem value="transfer">Chuyển khoản</SelectItem>
                    <SelectItem value="ewallet">Ví điện tử</SelectItem>
                    <SelectItem value="store_credit">Credit cửa hàng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between items-center bg-muted/40 p-3 rounded">
              <span className="text-sm text-muted-foreground">Tổng hoàn dự kiến</span>
              <span className="text-lg font-bold">{vnd(refundTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Huỷ</Button>
            <Button onClick={submitReturn} disabled={savingReturn || refundTotal <= 0}>Tạo đơn trả</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

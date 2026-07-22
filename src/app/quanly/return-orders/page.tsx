"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCrudList } from "@/lib/api/admin-crud";

type ReturnOrder = {
  id: string;
  return_number: string;
  order_id: string;
  status: string;
  reason: string | null;
  refund_amount: number | null;
  refund_method: string | null;
  refund_status: string | null;
  note: string | null;
  created_at: string;
  approved_at: string | null;
};

type Warehouse = { id: string; name: string; code: string | null };

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: "Chờ duyệt", cls: "bg-yellow-100 text-yellow-800" },
  approved: { text: "Đã duyệt", cls: "bg-green-100 text-green-800" },
  rejected: { text: "Từ chối", cls: "bg-red-100 text-red-800" },
  refunded: { text: "Đã hoàn", cls: "bg-blue-100 text-blue-800" },
  completed: { text: "Hoàn tất", cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { text: "Huỷ", cls: "bg-gray-100 text-gray-700" },
};

function vnd(n: number | null | undefined) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n ?? 0);
}

export default function ReturnOrdersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [approveTarget, setApproveTarget] = useState<ReturnOrder | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [processing, setProcessing] = useState(false);

  const listQuery = useCrudList<ReturnOrder>("return-orders", { search, page, pageSize: 25 });
  const warehousesQuery = useCrudList<Warehouse>("warehouses", { pageSize: 100 });
  const warehouses = warehousesQuery.data?.items ?? [];
  const items = listQuery.data?.items ?? [];
  const totalPages = listQuery.data?.totalPages ?? 1;
  const total = listQuery.data?.total ?? 0;

  const approve = async () => {
    if (!approveTarget) return;
    try {
      setProcessing(true);
      const res = await fetch(`/api/v1/return-orders/${approveTarget.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_id: warehouseId || undefined }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Duyệt thất bại");
      toast.success("Đã duyệt + cộng lại tồn kho");
      setApproveTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-crud", "return-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duyệt thất bại");
    } finally {
      setProcessing(false);
    }
  };

  const reject = async (rt: ReturnOrder) => {
    if (!confirm(`Từ chối đơn trả ${rt.return_number}?`)) return;
    try {
      const res = await fetch(`/api/v1/return-orders/${rt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Từ chối thất bại");
      toast.success("Đã từ chối đơn trả");
      qc.invalidateQueries({ queryKey: ["admin-crud", "return-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Từ chối thất bại");
    }
  };

  const markRefunded = async (rt: ReturnOrder) => {
    try {
      const res = await fetch(`/api/v1/return-orders/${rt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "refunded", refund_status: "paid" }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Cập nhật thất bại");
      toast.success("Đã đánh dấu hoàn tiền");
      qc.invalidateQueries({ queryKey: ["admin-crud", "return-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cập nhật thất bại");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Đơn trả hàng & hoàn tiền</CardTitle>
            <CardDescription>
              {total > 0 ? `${total} đơn trả` : "Quản lý đơn trả hàng từ khách"} — tạo đơn trả từ trang chi tiết đơn gốc
            </CardDescription>
          </div>
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Tìm mã đơn trả, lý do..."
            className="w-full sm:w-72"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn trả</TableHead>
                <TableHead>Đơn gốc</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>PT hoàn</TableHead>
                <TableHead className="text-right">Tiền hoàn</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Tạo lúc</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {listQuery.isLoading ? "Đang tải..." : "Chưa có đơn trả nào. Tạo đơn trả từ trang chi tiết đơn hàng."}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((rt) => {
                  const s = STATUS_LABEL[rt.status] ?? { text: rt.status, cls: "bg-muted" };
                  return (
                    <TableRow key={rt.id}>
                      <TableCell className="font-mono text-xs">{rt.return_number}</TableCell>
                      <TableCell>
                        <Link href={`/quanly/orders/${rt.order_id}`} className="text-primary hover:underline text-xs">
                          Xem đơn
                        </Link>
                      </TableCell>
                      <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${s.cls}`}>{s.text}</span></TableCell>
                      <TableCell className="text-xs uppercase">{rt.refund_method ?? "-"}</TableCell>
                      <TableCell className="text-right font-semibold">{vnd(rt.refund_amount)}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{rt.reason ?? "-"}</TableCell>
                      <TableCell className="text-xs">{new Date(rt.created_at).toLocaleString("vi-VN")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild size="sm" variant="ghost" title="Xem đơn gốc">
                            <Link href={`/quanly/orders/${rt.order_id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {rt.status === "pending" && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => { setApproveTarget(rt); setWarehouseId(warehouses[0]?.id ?? ""); }} title="Duyệt + hoàn kho">
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => reject(rt)} title="Từ chối">
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {rt.status === "approved" && rt.refund_status !== "paid" && (
                            <Button size="sm" variant="outline" onClick={() => markRefunded(rt)}>
                              Đánh dấu đã hoàn tiền
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3">
              <span className="text-xs text-muted-foreground">Trang {page}/{totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Trước</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau →</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duyệt đơn trả {approveTarget?.return_number}</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ cộng lại tồn kho cho các sản phẩm được tick &quot;restock&quot;. Chọn kho đích.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Kho hoàn về</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Chọn kho..." /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}{w.code ? ` (${w.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {warehouses.length === 0 && (
                <p className="text-xs text-amber-600">Chưa có kho — tạo ở mục Kho hàng trước. Nếu bỏ trống, RPC sẽ tự chọn kho đầu tiên của tổ chức.</p>
              )}
            </div>
            <div className="rounded border p-3 bg-muted/30 text-sm">
              <div>Số tiền hoàn dự kiến: <strong>{vnd(approveTarget?.refund_amount)}</strong></div>
              <div className="text-xs text-muted-foreground">PT hoàn: {approveTarget?.refund_method ?? "-"}</div>
              {approveTarget?.reason && <div className="text-xs italic mt-1">{approveTarget.reason}</div>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Huỷ</Button>
            <Button onClick={approve} disabled={processing}>
              <Check className="h-4 w-4 mr-1" /> Duyệt
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

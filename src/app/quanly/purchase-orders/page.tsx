"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCrudList } from "@/lib/api/admin-crud";
import { httpPost, httpPatch, httpDelete } from "@/lib/api/http";

type PurchaseOrder = {
  id: string;
  supplier_id: string | null;
  warehouse_id: string | null;
  po_number: string;
  status: string | null;
  ordered_at: string | null;
  expected_at: string | null;
  created_at: string | null;
};

type Supplier = { id: string; name: string | null };
type Warehouse = { id: string; name: string | null };
type Variant = { id: string; sku: string | null; name: string | null; cost_price: number | null };
type POItem = {
  id: string;
  purchase_order_id: string;
  product_variant_id: string;
  quantity: number;
  unit_cost: number;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Nháp", cls: "bg-slate-500" },
  sent: { label: "Đã gửi NCC", cls: "bg-blue-600" },
  partial: { label: "Nhận một phần", cls: "bg-amber-500" },
  received: { label: "Đã nhận", cls: "bg-emerald-600" },
  cancelled: { label: "Huỷ", cls: "bg-rose-600" },
};

function fmtCurrency(v: number | null | undefined) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v ?? 0);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("vi-VN"); } catch { return d; }
}
function getApiMsg(e: unknown) {
  return (e as { error?: { message?: string } })?.error?.message ?? "Có lỗi xảy ra";
}

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const poQ = useCrudList<PurchaseOrder>("purchase-orders", { search, page: 1, pageSize: 100 });
  const supplierQ = useCrudList<Supplier>("suppliers", { page: 1, pageSize: 200 });
  const warehouseQ = useCrudList<Warehouse>("warehouses", { page: 1, pageSize: 200 });

  const supplierMap = useMemo(() => new Map((supplierQ.data?.items ?? []).map((s) => [s.id, s])), [supplierQ.data]);
  const warehouseMap = useMemo(() => new Map((warehouseQ.data?.items ?? []).map((w) => [w.id, w])), [warehouseQ.data]);

  const rows = (poQ.data?.items ?? []).filter((r) => status === "all" || r.status === status);

  // Create
  const [newForm, setNewForm] = useState<Partial<PurchaseOrder>>({ status: "draft" });
  const createPO = useMutation({
    mutationFn: (body: Partial<PurchaseOrder>) => httpPost<PurchaseOrder>("/v1/purchase-orders", body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-crud", "purchase-orders"] });
      toast.success("Đã tạo phiếu nhập");
      setOpenNew(false);
      setNewForm({ status: "draft" });
      setDetailId(data.id);
    },
    onError: (e) => toast.error(getApiMsg(e)),
  });

  // Update status
  const updatePO = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<PurchaseOrder> }) => httpPatch(`/v1/purchase-orders/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crud", "purchase-orders"] });
      toast.success("Đã cập nhật");
    },
    onError: (e) => toast.error(getApiMsg(e)),
  });

  // Receive
  const receivePO = useMutation({
    mutationFn: (id: string) => httpPost(`/v1/purchase-orders/${id}/receive`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crud", "purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["po-items"] });
      toast.success("Đã nhập kho phiếu này — tồn kho được cập nhật");
    },
    onError: (e) => toast.error(getApiMsg(e)),
  });

  const deletePO = useMutation({
    mutationFn: (id: string) => httpDelete(`/v1/purchase-orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crud", "purchase-orders"] });
      toast.success("Đã xoá");
    },
    onError: (e) => toast.error(getApiMsg(e)),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Phiếu nhập hàng</CardTitle>
            <CardDescription>
              Tạo phiếu nhập từ nhà cung cấp, thêm sản phẩm, sau đó bấm "Nhập kho" để cộng tồn kho và sinh serial.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mã PO..." className="w-full sm:w-56" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="draft">Nháp</SelectItem>
                <SelectItem value="sent">Đã gửi NCC</SelectItem>
                <SelectItem value="partial">Nhận một phần</SelectItem>
                <SelectItem value="received">Đã nhận</SelectItem>
                <SelectItem value="cancelled">Huỷ</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setOpenNew(true)} className="w-full sm:w-auto">+ Tạo phiếu nhập</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã PO</TableHead>
                <TableHead>Nhà cung cấp</TableHead>
                <TableHead>Kho nhập</TableHead>
                <TableHead>Ngày đặt</TableHead>
                <TableHead>Dự kiến</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {poQ.isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có phiếu nhập nào</TableCell></TableRow>
              ) : (
                rows.map((po) => {
                  const sup = po.supplier_id ? supplierMap.get(po.supplier_id) : null;
                  const wh = po.warehouse_id ? warehouseMap.get(po.warehouse_id) : null;
                  const st = STATUS_LABELS[po.status ?? "draft"] ?? STATUS_LABELS.draft;
                  return (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono font-medium">{po.po_number}</TableCell>
                      <TableCell>{sup?.name ?? "—"}</TableCell>
                      <TableCell>{wh?.name ?? "—"}</TableCell>
                      <TableCell>{fmtDate(po.ordered_at)}</TableCell>
                      <TableCell>{fmtDate(po.expected_at)}</TableCell>
                      <TableCell><Badge className={`${st.cls} hover:${st.cls}`}>{st.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setDetailId(po.id)}>Chi tiết</Button>
                          {po.status !== "received" && po.status !== "cancelled" ? (
                            <Button
                              size="sm"
                              onClick={() => {
                                if (confirm("Nhập kho phiếu này? Hành động này sẽ cộng tồn kho và không thể hoàn tác dễ dàng.")) {
                                  receivePO.mutate(po.id);
                                }
                              }}
                              disabled={receivePO.isPending}
                            >Nhập kho</Button>
                          ) : null}
                          {po.status === "draft" ? (
                            <Button size="sm" variant="destructive" onClick={() => {
                              if (confirm("Xoá phiếu nhập này?")) deletePO.mutate(po.id);
                            }}>Xoá</Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog tạo mới */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo phiếu nhập</DialogTitle>
            <DialogDescription>Tạo phiếu rồi mở chi tiết để thêm sản phẩm.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Mã PO *</Label>
              <Input value={newForm.po_number ?? ""} onChange={(e) => setNewForm((p) => ({ ...p, po_number: e.target.value }))} placeholder="PO-202605-001" />
            </div>
            <div className="space-y-2">
              <Label>Nhà cung cấp</Label>
              <Select value={newForm.supplier_id ?? ""} onValueChange={(v) => setNewForm((p) => ({ ...p, supplier_id: v || null }))}>
                <SelectTrigger><SelectValue placeholder="Chọn NCC" /></SelectTrigger>
                <SelectContent>
                  {(supplierQ.data?.items ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name ?? s.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kho nhập *</Label>
              <Select value={newForm.warehouse_id ?? ""} onValueChange={(v) => setNewForm((p) => ({ ...p, warehouse_id: v || null }))}>
                <SelectTrigger><SelectValue placeholder="Chọn kho" /></SelectTrigger>
                <SelectContent>
                  {(warehouseQ.data?.items ?? []).map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name ?? w.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ngày đặt</Label>
              <Input type="date" value={newForm.ordered_at?.slice(0, 10) ?? ""} onChange={(e) => setNewForm((p) => ({ ...p, ordered_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
            </div>
            <div className="space-y-2">
              <Label>Dự kiến nhận</Label>
              <Input type="date" value={newForm.expected_at?.slice(0, 10) ?? ""} onChange={(e) => setNewForm((p) => ({ ...p, expected_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Huỷ</Button>
            <Button
              disabled={!newForm.po_number || !newForm.warehouse_id || createPO.isPending}
              onClick={() => createPO.mutate(newForm)}
            >Tạo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog chi tiết */}
      {detailId ? (
        <PODetailDialog
          id={detailId}
          onClose={() => setDetailId(null)}
          onStatusChange={(body) => updatePO.mutate({ id: detailId, body })}
        />
      ) : null}
    </div>
  );
}

function PODetailDialog({
  id,
  onClose,
  onStatusChange,
}: {
  id: string;
  onClose: () => void;
  onStatusChange: (body: Partial<PurchaseOrder>) => void;
}) {
  const qc = useQueryClient();
  const itemsQ = useQuery({
    queryKey: ["po-items", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/purchase-order-items?purchase_order_id=${id}&pageSize=200`);
      const json = await res.json();
      if (!json.ok) throw json;
      return json.data as { items: POItem[] };
    },
  });
  const variantQ = useCrudList<Variant>("product-variants", { page: 1, pageSize: 500 });
  const variantMap = useMemo(() => new Map((variantQ.data?.items ?? []).map((v) => [v.id, v])), [variantQ.data]);

  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);

  const addItem = useMutation({
    mutationFn: (body: { purchase_order_id: string; product_variant_id: string; quantity: number; unit_cost: number }) =>
      httpPost("/v1/purchase-order-items", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po-items", id] });
      toast.success("Đã thêm sản phẩm");
      setVariantId("");
      setQuantity(1);
      setUnitCost(0);
    },
    onError: (e) => toast.error(getApiMsg(e)),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => httpDelete(`/v1/purchase-order-items/${itemId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po-items", id] });
      toast.success("Đã xoá dòng");
    },
    onError: (e) => toast.error(getApiMsg(e)),
  });

  const items = itemsQ.data?.items ?? [];
  const total = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_cost ?? 0), 0);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Chi tiết phiếu nhập</DialogTitle>
          <DialogDescription>Thêm/xoá sản phẩm. Sau khi đủ, bấm "Nhập kho" ở danh sách để hoàn tất.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <Select value={variantId} onValueChange={(v) => {
              setVariantId(v);
              const cost = variantMap.get(v)?.cost_price ?? 0;
              if (cost) setUnitCost(cost);
            }}>
              <SelectTrigger><SelectValue placeholder="Chọn biến thể sản phẩm" /></SelectTrigger>
              <SelectContent>
                {(variantQ.data?.items ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name ?? v.sku ?? v.id} {v.sku ? `· ${v.sku}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} placeholder="SL" />
            <Input type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value) || 0)} placeholder="Giá nhập" />
            <Button disabled={!variantId || addItem.isPending} onClick={() => addItem.mutate({ purchase_order_id: id, product_variant_id: variantId, quantity, unit_cost: unitCost })}>
              Thêm
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead className="text-right">Giá nhập</TableHead>
                <TableHead className="text-right">Thành tiền</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsQ.isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có dòng nào</TableCell></TableRow>
              ) : (
                items.map((it) => {
                  const v = variantMap.get(it.product_variant_id);
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        <div>{v?.name ?? "(Không xác định)"}</div>
                        <div className="text-xs text-muted-foreground">{v?.sku}</div>
                      </TableCell>
                      <TableCell className="text-right">{it.quantity}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(it.unit_cost)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtCurrency(Number(it.quantity) * Number(it.unit_cost ?? 0))}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="destructive" onClick={() => removeItem.mutate(it.id)}>Xoá</Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {items.length > 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-semibold">Tổng giá trị</TableCell>
                  <TableCell className="text-right font-semibold">{fmtCurrency(total)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onStatusChange({ status: "sent" })}>Đánh dấu "Đã gửi NCC"</Button>
          <Button variant="outline" onClick={() => onStatusChange({ status: "cancelled" })}>Huỷ phiếu</Button>
          <Button onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

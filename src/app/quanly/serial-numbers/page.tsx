"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrudList, useCrudCreate, useCrudUpdate, useCrudDelete } from "@/lib/api/admin-crud";
import { httpPost } from "@/lib/api/http";

type SerialNumber = {
  id: string;
  serial: string | null;
  imei: string | null;
  product_variant_id: string | null;
  warehouse_id: string | null;
  status: string;
  imported_at: string | null;
  sold_at: string | null;
};

type SerialNumberInput = {
  product_variant_id: string;
  warehouse_id?: string | null;
  serial?: string | null;
  imei?: string | null;
  status: string;
};

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  in_stock: { label: "Tồn kho", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" },
  reserved: { label: "Đã giữ", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" },
  sold: { label: "Đã bán", className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100" },
  returned: { label: "Trả lại", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" },
  damaged: { label: "Hỏng", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" },
  in_repair: { label: "Đang sửa", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" },
};

function getErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const payload = error as { error?: { message?: string; fields?: Record<string, string[] | undefined>; requestId?: string } };
    const msg = payload.error?.message;
    const fieldMsg = Object.values(payload.error?.fields ?? {}).flat().filter(Boolean).join(" · ");
    const requestId = payload.error?.requestId;
    if (msg || fieldMsg || requestId) {
      return [msg, fieldMsg, requestId ? `requestId=${requestId}` : ""].filter(Boolean).join(" | ");
    }
  }
  return "Đã xảy ra lỗi";
}

export default function SerialNumbersAdminPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SerialNumber | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [productVariantId, setProductVariantId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [serial, setSerial] = useState("");
  const [imei, setImei] = useState("");
  const [status, setStatus] = useState("in_stock");

  const [bulkProductVariantId, setBulkProductVariantId] = useState("");
  const [bulkWarehouseId, setBulkWarehouseId] = useState("");
  const [bulkText, setBulkText] = useState("");

  const params = useMemo(() => ({ search, page: 1, pageSize: 50 }), [search]);
  const allParams = useMemo(() => ({ search, page: 1, pageSize: 100 }), [search]);

  const listQuery = useCrudList<SerialNumber>("serial-numbers", params);
  const allQuery = useCrudList<SerialNumber>("serial-numbers", allParams);

  const createMutation = useCrudCreate<SerialNumber, SerialNumberInput>("serial-numbers");
  const updateMutation = useCrudUpdate<SerialNumber, SerialNumberInput>("serial-numbers");
  const deleteMutation = useCrudDelete("serial-numbers");

  const items = listQuery.data?.items ?? [];
  const allItems = allQuery.data?.items ?? [];

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const statusOptions = useMemo(() => {
    const set = new Set(allItems.map((i) => i.status));
    return Array.from(set).sort();
  }, [allItems]);

  const resetForm = () => {
    setProductVariantId("");
    setWarehouseId("");
    setSerial("");
    setImei("");
    setStatus("in_stock");
  };

  const startCreate = () => {
    setEditingItem(null);
    resetForm();
    setOpen(true);
  };

  const startEdit = (item: SerialNumber) => {
    setEditingItem(item);
    setProductVariantId(item.product_variant_id ?? "");
    setWarehouseId(item.warehouse_id ?? "");
    setSerial(item.serial ?? "");
    setImei(item.imei ?? "");
    setStatus(item.status);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!productVariantId) {
      toast.error("Vui lòng nhập Product Variant ID");
      return;
    }

    const payload: SerialNumberInput = {
      product_variant_id: productVariantId,
      warehouse_id: warehouseId || null,
      serial: serial || null,
      imei: imei || null,
      status,
    };

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, input: payload });
        toast.success("Đã cập nhật serial number");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã tạo serial number");
      }
      setOpen(false);
      resetForm();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (item: SerialNumber) => {
    if (!confirm(`Xác nhận xoá serial "${item.serial ?? item.imei ?? item.id}" khỏi hệ thống?`)) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      toast.success("Đã xoá thành công");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleBulkCreate = async () => {
    if (!bulkProductVariantId) {
      toast.error("Vui lòng nhập Product Variant ID");
      return;
    }
    if (!bulkWarehouseId) {
      toast.error("Vui lòng nhập Warehouse ID");
      return;
    }
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error("Vui lòng nhập ít nhất một serial hoặc IMEI");
      return;
    }

    const items = lines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      return {
        serial: parts[0] || null,
        imei: parts[1] || null,
      };
    });

    try {
      await httpPost("/v1/serial-numbers/bulk", {
        product_variant_id: bulkProductVariantId,
        warehouse_id: bulkWarehouseId,
        items,
      });
      toast.success(`Đã tạo ${items.length} serial number`);
      setBulkOpen(false);
      setBulkText("");
      setBulkProductVariantId("");
      setBulkWarehouseId("");
      listQuery.refetch();
      allQuery.refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="text-xl font-bold">Serial / IMEI</CardTitle>
            <CardDescription>Quản lý serial number và IMEI của từng sản phẩm</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm serial / IMEI..."
                className="w-full sm:w-56 pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Lọc trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_MAP[s]?.label ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setBulkOpen(true)} className="w-full sm:w-auto">
              <Upload className="mr-2 h-4 w-4" /> Nhập hàng loạt
            </Button>
            <Button onClick={startCreate} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Thêm serial
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial</TableHead>
                <TableHead>IMEI</TableHead>
                <TableHead>Product Variant ID</TableHead>
                <TableHead>Warehouse ID</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày nhập</TableHead>
                <TableHead>Ngày bán</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {listQuery.isLoading ? "Đang tải dữ liệu..." : "Không tìm thấy serial number nào"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const statusInfo = STATUS_MAP[item.status] ?? { label: item.status, className: "border" };
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.serial ?? "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{item.imei ?? "-"}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate" title={item.product_variant_id ?? ""}>{item.product_variant_id ?? "-"}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate" title={item.warehouse_id ?? ""}>{item.warehouse_id ?? "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{item.imported_at ? new Date(item.imported_at).toLocaleDateString("vi-VN") : "-"}</TableCell>
                      <TableCell className="text-xs">{item.sold_at ? new Date(item.sold_at).toLocaleDateString("vi-VN") : "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(item)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Chỉnh sửa serial number" : "Thêm serial number"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Cập nhật thông tin serial number" : "Nhập thông tin cho serial number mới"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Product Variant ID <span className="text-destructive">*</span></Label>
              <Input value={productVariantId} onChange={(e) => setProductVariantId(e.target.value)} placeholder="UUID của biến thể sản phẩm" />
            </div>
            <div className="space-y-2">
              <Label>Warehouse ID</Label>
              <Input value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} placeholder="UUID của kho hàng (tuỳ chọn)" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Serial</Label>
                <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Số serial" />
              </div>
              <div className="space-y-2">
                <Label>IMEI</Label>
                <Input value={imei} onChange={(e) => setImei(e.target.value)} placeholder="Số IMEI" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">Tồn kho</SelectItem>
                  <SelectItem value="reserved">Đã giữ</SelectItem>
                  <SelectItem value="sold">Đã bán</SelectItem>
                  <SelectItem value="returned">Trả lại</SelectItem>
                  <SelectItem value="damaged">Hỏng</SelectItem>
                  <SelectItem value="in_repair">Đang sửa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
            <Button onClick={handleSave}>{editingItem ? "Cập nhật" : "Tạo mới"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nhập hàng loạt serial / IMEI</DialogTitle>
            <DialogDescription>
              Dán danh sách serial hoặc IMEI vào ô bên dưới, mỗi dòng một mục.
              Định dạng: <code>serial</code> hoặc <code>serial,imei</code>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Product Variant ID <span className="text-destructive">*</span></Label>
              <Input value={bulkProductVariantId} onChange={(e) => setBulkProductVariantId(e.target.value)} placeholder="UUID của biến thể sản phẩm" />
            </div>
            <div className="space-y-2">
              <Label>Warehouse ID <span className="text-destructive">*</span></Label>
              <Input value={bulkWarehouseId} onChange={(e) => setBulkWarehouseId(e.target.value)} placeholder="UUID của kho hàng" />
            </div>
            <div className="space-y-2">
              <Label>Danh sách serial / IMEI</Label>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`SN-001\nSN-002,IMEI-002\nSN-003,IMEI-003`}
                className="min-h-[200px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {bulkText ? `${bulkText.split("\n").filter((l) => l.trim()).length} dòng` : "Chưa có dữ liệu"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Huỷ</Button>
            <Button onClick={handleBulkCreate}>
              <Upload className="mr-2 h-4 w-4" /> Nhập {bulkText ? bulkText.split("\n").filter((l) => l.trim()).length : 0} serial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

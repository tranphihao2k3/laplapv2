"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { 
  Search, Plus, Tag, Gift, Percent, Truck, Calendar, 
  Clock, AlertCircle, CheckCircle2, XCircle, Edit, Trash2,
  Copy, ToggleLeft, ToggleRight, Info
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useCrudBulkDelete, useCrudList, useCrudCreate, useCrudUpdate, useCrudDelete } from "@/lib/api/admin-crud";
import { BulkActionsToolbar, useBulkSelection } from "@/components/admin/bulk-actions";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { formatCurrency } from "@/lib/utils";
import type { Voucher, VoucherType } from "@/types/voucher";
import { getVoucherStatus, formatVoucherValue } from "@/types/voucher";

type VoucherFormData = {
  code: string;
  name: string;
  description: string;
  type: VoucherType;
  value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  quantity_total: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  applicable_products: string[] | null;
  applicable_categories: string[] | null;
  user_usage_limit: number;
};

const INIT_FORM: VoucherFormData = {
  code: "",
  name: "",
  description: "",
  type: "percent",
  value: 10,
  min_order_amount: 0,
  max_discount_amount: null,
  quantity_total: null,
  start_date: new Date().toISOString().slice(0, 16),
  end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  is_active: true,
  applicable_products: null,
  applicable_categories: null,
  user_usage_limit: 1,
};

function VoucherTypeIcon({ type }: { type: VoucherType }) {
  switch (type) {
    case "percent":
      return <Percent className="h-4 w-4" />;
    case "fixed_amount":
      return <Gift className="h-4 w-4" />;
    case "free_shipping":
      return <Truck className="h-4 w-4" />;
  }
}

function VoucherStatusBadge({ voucher }: { voucher: Voucher }) {
  const status = getVoucherStatus(voucher);
  const now = new Date();
  const startDate = new Date(voucher.start_date);
  const endDate = new Date(voucher.end_date);
  
  if (status === "inactive") {
    return (
      <Badge variant="secondary" className="gap-1">
        <XCircle className="h-3 w-3" />
        Bị vô hiệu
      </Badge>
    );
  }
  
  if (now < startDate) {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
        <Clock className="h-3 w-3" />
        Chưa bắt đầu
      </Badge>
    );
  }
  
  if (status === "expired" || now > endDate) {
    return (
      <Badge variant="secondary" className="gap-1">
        <XCircle className="h-3 w-3" />
        Hết hạn
      </Badge>
    );
  }
  
  if (status === "depleted") {
    return (
      <Badge variant="secondary" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Hết lượt
      </Badge>
    );
  }
  
  return (
    <Badge variant="default" className="gap-1 bg-green-500">
      <CheckCircle2 className="h-3 w-3" />
      Đang hoạt động
    </Badge>
  );
}

export default function VouchersAdminPage() {
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [form, setForm] = useState<VoucherFormData>(INIT_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const q = useCrudList<Voucher>("vouchers", { search, page: 1, pageSize: 100 });
  
  const filtered = useMemo(() => {
    let items = q.data?.items ?? [];
    
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((v) =>
        v.code.toLowerCase().includes(s) ||
        v.name.toLowerCase().includes(s) ||
        v.description?.toLowerCase().includes(s)
      );
    }
    
    if (typeFilter !== "all") {
      items = items.filter((v) => v.type === typeFilter);
    }
    
    if (statusFilter !== "all") {
      items = items.filter((v) => {
        const status = getVoucherStatus(v);
        return status === statusFilter;
      });
    }
    
    return items;
  }, [q.data, search, typeFilter, statusFilter]);

  const createMutation = useCrudCreate<Voucher, VoucherFormData>("vouchers");
  const updateMutation = useCrudUpdate<Voucher, Partial<VoucherFormData>>("vouchers");
  const deleteMutation = useCrudDelete("vouchers");
  const bulkDeleteMutation = useCrudBulkDelete("vouchers");
  const selection = useBulkSelection();

  const pageIds = useMemo(() => filtered.map((v) => v.id), [filtered]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.isSelected(id));
  const someOnPageSelected = pageIds.some((id) => selection.isSelected(id));

  function resetForm() {
    setForm(INIT_FORM);
    setEditingVoucher(null);
  }

  function openEdit(voucher: Voucher) {
    setEditingVoucher(voucher);
    setForm({
      code: voucher.code,
      name: voucher.name,
      description: voucher.description ?? "",
      type: voucher.type,
      value: voucher.value,
      min_order_amount: voucher.min_order_amount,
      max_discount_amount: voucher.max_discount_amount,
      quantity_total: voucher.quantity_total,
      start_date: voucher.start_date.slice(0, 16),
      end_date: voucher.end_date.slice(0, 16),
      is_active: voucher.is_active,
      applicable_products: voucher.applicable_products,
      applicable_categories: voucher.applicable_categories,
      user_usage_limit: voucher.user_usage_limit,
    });
    setOpenForm(true);
  }

  async function handleSubmit() {
    if (!form.code.trim()) {
      toast.error("Mã voucher không được để trống");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Tên voucher không được để trống");
      return;
    }
    if (form.value <= 0) {
      toast.error("Giá trị voucher phải lớn hơn 0");
      return;
    }
    if (form.type === "percent" && form.value > 100) {
      toast.error("Phần trăm giảm không thể lớn hơn 100%");
      return;
    }
    if (new Date(form.end_date) <= new Date(form.start_date)) {
      toast.error("Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }

    try {
      const payload = {
        ...form,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
      };

      if (editingVoucher) {
        await updateMutation.mutateAsync({ id: editingVoucher.id, input: payload });
        toast.success("Đã cập nhật voucher");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã tạo voucher mới");
      }
      resetForm();
      setOpenForm(false);
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  async function handleToggleActive(voucher: Voucher) {
    try {
      await updateMutation.mutateAsync({
        id: voucher.id,
        input: { is_active: !voucher.is_active },
      });
      toast.success(voucher.is_active ? "Đã vô hiệu voucher" : "Đã kích hoạt voucher");
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  async function handleCopyCode(code: string) {
    await navigator.clipboard.writeText(code);
    toast.success(`Đã copy mã: ${code}`);
  }

  async function handleBulkDelete() {
    const ids = selection.array;
    if (ids.length === 0) return;
    try {
      const result = await bulkDeleteMutation.mutateAsync(ids);
      const deletedCount = result.deleted?.length ?? 0;
      const missingCount = result.missing?.length ?? 0;
      if (deletedCount === 0) {
        toast.error("Không xoá được bản ghi nào");
      } else if (missingCount > 0) {
        toast.warning(`Đã xoá ${deletedCount}, bỏ qua ${missingCount} không tồn tại`);
      } else {
        toast.success(`Đã xoá ${deletedCount} voucher`);
      }
      selection.clear();
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Quản lý Voucher
            </CardTitle>
            <CardDescription>
              Tạo và quản lý mã giảm giá, khuyến mãi cho đơn hàng
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã / tên voucher..."
                className="w-full sm:w-64 pl-8"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Loại voucher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="percent">Giảm %</SelectItem>
                <SelectItem value="fixed_amount">Giảm tiền</SelectItem>
                <SelectItem value="free_shipping">Miễn phí ship</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Đang hoạt động</SelectItem>
                <SelectItem value="inactive">Bị vô hiệu</SelectItem>
                <SelectItem value="expired">Hết hạn</SelectItem>
                <SelectItem value="depleted">Hết lượt</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { resetForm(); setOpenForm(true); }} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Thêm Voucher
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <BulkActionsToolbar
            count={selection.count}
            entityLabel="voucher"
            onClear={selection.clear}
            onRequestDelete={() => {
              if (window.confirm(`Xoá ${selection.count} voucher đã chọn? Hành động không thể hoàn tác.`)) {
                void handleBulkDelete();
              }
            }}
            isPending={bulkDeleteMutation.isPending}
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={() => selection.toggleAll(pageIds)}
                      aria-label="Chọn tất cả"
                      ref={(el) => {
                        if (el && "indeterminate" in el) {
                          (el as HTMLInputElement).indeterminate = !allOnPageSelected && someOnPageSelected;
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="w-[56px] text-center">STT</TableHead>
                  <TableHead>Mã</TableHead>
                  <TableHead>Thông tin</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Điều kiện</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Sử dụng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Chưa có voucher nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((voucher, idx) => {
                    const checked = selection.isSelected(voucher.id);
                    const isActive = getVoucherStatus(voucher) === "active";
                    return (
                      <TableRow key={voucher.id} data-state={checked ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => selection.toggle(voucher.id)}
                            aria-label={`Chọn voucher ${voucher.code}`}
                          />
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground text-sm">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-slate-100 px-2 py-1 font-semibold text-sm">
                              {voucher.code}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleCopyCode(voucher.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{voucher.name}</p>
                            {voucher.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {voucher.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <VoucherTypeIcon type={voucher.type} />
                            <span>{formatVoucherValue(voucher.type, voucher.value)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-xs text-muted-foreground">
                            {voucher.min_order_amount > 0 && (
                              <p>Đơn tối thiểu: {formatCurrency(voucher.min_order_amount)}</p>
                            )}
                            {voucher.max_discount_amount && (
                              <p>Giảm tối đa: {formatCurrency(voucher.max_discount_amount)}</p>
                            )}
                            {voucher.user_usage_limit > 1 && (
                              <p>Mỗi user: {voucher.user_usage_limit} lần</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-xs text-muted-foreground">
                            <p>Từ: {new Date(voucher.start_date).toLocaleDateString("vi-VN")}</p>
                            <p>Đến: {new Date(voucher.end_date).toLocaleDateString("vi-VN")}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-xs">
                            <p className={voucher.quantity_used > 0 ? "text-orange-600" : "text-muted-foreground"}>
                              Đã dùng: {voucher.quantity_used}
                            </p>
                            {voucher.quantity_total ? (
                              <p className="text-muted-foreground">
                                Tổng: {voucher.quantity_total}
                              </p>
                            ) : (
                              <p className="text-muted-foreground">Không giới hạn</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <VoucherStatusBadge voucher={voucher} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleToggleActive(voucher)}
                              title={voucher.is_active ? "Vô hiệu hóa" : "Kích hoạt"}
                            >
                              {voucher.is_active ? (
                                <ToggleRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEdit(voucher)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <ConfirmDeleteDialog
                              entity="vouchers"
                              id={voucher.id}
                              trigger={
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingVoucher ? "Chỉnh sửa Voucher" : "Thêm Voucher mới"}
            </DialogTitle>
            <DialogDescription>
              {editingVoucher
                ? `Đang chỉnh sửa voucher "${editingVoucher.code}"`
                : "Tạo mã giảm giá mới cho đơn hàng"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Code & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">
                  Mã voucher <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="VD: SUMMER2024"
                  disabled={!!editingVoucher}
                  className={editingVoucher ? "opacity-60" : ""}
                />
                {editingVoucher && (
                  <p className="text-xs text-muted-foreground">Không thể đổi mã voucher</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">
                  Tên voucher <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Khuyến mãi mùa hè"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả chi tiết về voucher (tuỳ chọn)"
                rows={2}
              />
            </div>

            {/* Type & Value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Loại voucher</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as VoucherType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        Giảm theo phần trăm (%)
                      </div>
                    </SelectItem>
                    <SelectItem value="fixed_amount">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4" />
                        Giảm số tiền cố định
                      </div>
                    </SelectItem>
                    <SelectItem value="free_shipping">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Miễn phí vận chuyển
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">
                  Giá trị {form.type === "percent" ? "(%)" : "(VND)"}
                </Label>
                <Input
                  id="value"
                  type="number"
                  min={form.type === "percent" ? 1 : 1000}
                  max={form.type === "percent" ? 100 : undefined}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                />
                {form.type === "percent" && (
                  <p className="text-xs text-muted-foreground">Tối đa 100%</p>
                )}
              </div>
            </div>

            {/* Max Discount (for percent type) */}
            {form.type === "percent" && (
              <div className="space-y-2">
                <Label htmlFor="max_discount">Giảm tối đa (VND)</Label>
                <Input
                  id="max_discount"
                  type="number"
                  min={0}
                  value={form.max_discount_amount ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      max_discount_amount: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Để trống = không giới hạn"
                />
              </div>
            )}

            {/* Min Order Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_order">Đơn hàng tối thiểu (VND)</Label>
                <Input
                  id="min_order"
                  type="number"
                  min={0}
                  value={form.min_order_amount}
                  onChange={(e) => setForm({ ...form, min_order_amount: Number(e.target.value) })}
                  placeholder="0 = không giới hạn"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user_limit">Số lần mỗi user</Label>
                <Input
                  id="user_limit"
                  type="number"
                  min={1}
                  value={form.user_usage_limit}
                  onChange={(e) => setForm({ ...form, user_usage_limit: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Tổng số lượng voucher</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={form.quantity_total ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    quantity_total: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Để trống = không giới hạn"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Ngày bắt đầu
                </Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Ngày kết thúc
                </Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: !!checked })}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Kích hoạt voucher ngay
              </Label>
            </div>

            {/* Info */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-800 space-y-1">
                  <p className="font-medium">Lưu ý:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Mã voucher phải là duy nhất</li>
                    <li>Voucher sẽ tự động hết hạn sau ngày kết thúc</li>
                    <li>Để trống số lượng = không giới hạn số lần sử dụng</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

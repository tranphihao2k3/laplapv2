"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useCrudList, useCrudCreate, useCrudUpdate, useCrudDelete } from "@/lib/api/admin-crud";
import { httpGet } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/response";
import {
  Plus,
  Search,
  Check,
  X,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCrudBulkDelete } from "@/lib/api/admin-crud";
import { BulkActionsToolbar, useBulkSelection } from "@/components/admin/bulk-actions";
import { ActiveBadge, IdCell, RowActions, RowIndexCell } from "@/components/admin/table-cells";

type Organization = { id: string; name: string; code: string | null };
type Shop = { id: string; organization_id: string | null; name: string; code: string | null };

type Warehouse = {
  id: string;
  organization_id: string | null;
  shop_id: string | null;
  name: string;
  code: string | null;
  type: "store" | "central" | "online" | "transit";
  address: string | null;
  is_active: boolean;
  manager_name: string | null;
  phone: string | null;
  created_at: string;
};

type ApiErrorShape = {
  error?: {
    message?: string;
    requestId?: string;
    fields?: Record<string, string[] | undefined>;
  };
};

const WAREHOUSE_TYPES = ["store", "central", "online", "transit"] as const;

const TYPE_BADGE: Record<string, string> = {
  store: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  central: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  online: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  transit: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const TYPE_LABEL: Record<string, string> = {
  store: "Cửa hàng",
  central: "Trung tâm",
  online: "Online",
  transit: "Trung chuyển",
};

function showApiError(payload: unknown) {
  const api = payload as ApiErrorShape;
  const msg = api?.error?.message ?? (payload instanceof Error ? payload.message : "Có lỗi xảy ra");
  const requestId = api?.error?.requestId;
  const fieldMessages = Object.values(api?.error?.fields ?? {})
    .flat()
    .filter(Boolean)
    .join(" · ");
  toast.error(fieldMessages ? `${msg}: ${fieldMessages}` : msg, {
    description: requestId ? `Mã lỗi: ${requestId}` : undefined,
  });
}

export default function WarehousesAdminPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [filterOrg, setFilterOrg] = useState("");
  const [filterShop, setFilterShop] = useState("");
  const [filterType, setFilterType] = useState("");

  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formOrgId, setFormOrgId] = useState("");
  const [formShopId, setFormShopId] = useState("");
  const [formType, setFormType] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formManagerName, setFormManagerName] = useState("");
  const [formPhone, setFormPhone] = useState("");

  const orgsQuery = useQuery({
    queryKey: ["organizations", "list"],
    queryFn: () => httpGet<Paginated<Organization>>("/v1/organizations?pageSize=100"),
  });

  const shopsQuery = useQuery({
    queryKey: ["shops", "list"],
    queryFn: () => httpGet<Paginated<Shop>>("/v1/shops?pageSize=100"),
  });

  const list = useCrudList<Warehouse>("warehouses", { search, page: 1, pageSize: 100 });
  const createMutation = useCrudCreate<Warehouse, Record<string, unknown>>("warehouses");
  const updateMutation = useCrudUpdate<Warehouse, Record<string, unknown>>("warehouses");
  const deleteMutation = useCrudDelete("warehouses");
  const bulkDeleteMutation = useCrudBulkDelete("warehouses");
  const selection = useBulkSelection();

  const organizations = orgsQuery.data?.items ?? [];
  const shops = shopsQuery.data?.items ?? [];
  const rows = list.data?.items ?? [];

  const filteredShops = useMemo(() => {
    if (!filterOrg) return shops;
    return shops.filter((s) => s.organization_id === filterOrg);
  }, [shops, filterOrg]);

  const formFilteredShops = useMemo(() => {
    if (!formOrgId) return shops;
    return shops.filter((s) => s.organization_id === formOrgId);
  }, [shops, formOrgId]);

  function resetForm() {
    setEditingId(null);
    setFormName("");
    setFormCode("");
    setFormOrgId("");
    setFormShopId("");
    setFormType("");
    setFormAddress("");
    setFormIsActive(true);
    setFormManagerName("");
    setFormPhone("");
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(row: Warehouse) {
    setEditingId(row.id);
    setFormName(row.name ?? "");
    setFormCode(row.code ?? "");
    setFormOrgId(row.organization_id ?? "");
    setFormShopId(row.shop_id ?? "");
    setFormType(row.type ?? "");
    setFormAddress(row.address ?? "");
    setFormIsActive(row.is_active ?? true);
    setFormManagerName(row.manager_name ?? "");
    setFormPhone(row.phone ?? "");
    setOpen(true);
  }

  async function onSubmit() {
    if (!formName.trim()) {
      toast.error("Nhập tên kho");
      return;
    }
    if (!formType) {
      toast.error("Chọn loại kho");
      return;
    }
    const payload: Record<string, unknown> = {
      name: formName.trim(),
      code: formCode.trim() || null,
      type: formType,
      address: formAddress.trim() || null,
      is_active: formIsActive,
      manager_name: formManagerName.trim() || null,
      phone: formPhone.trim() || null,
    };
    if (formOrgId) payload.organization_id = formOrgId;
    if (formShopId) payload.shop_id = formShopId;
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input: payload });
        toast.success("Đã cập nhật kho");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã tạo kho");
      }
      setOpen(false);
      resetForm();
    } catch (e) {
      showApiError(e);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Đã xoá kho");
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (e) {
      showApiError(e);
    }
  }

  function typeBadgeClass(type: string) {
    return TYPE_BADGE[type] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }

  const filteredRows = useMemo(() => {
    let result = rows;
    if (filterOrg) {
      result = result.filter((r) => r.organization_id === filterOrg);
    }
    if (filterShop) {
      result = result.filter((r) => r.shop_id === filterShop);
    }
    if (filterType) {
      result = result.filter((r) => r.type === filterType);
    }
    return result;
  }, [rows, filterOrg, filterShop, filterType]);

  const pageIds = useMemo(() => filteredRows.map((r) => r.id), [filteredRows]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selection.isSelected(id));
  const someOnPageSelected = pageIds.some((id: string) => selection.isSelected(id));

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
        toast.success(`Đã xoá ${deletedCount} kho`);
      }
      selection.clear();
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle>Kho hàng</CardTitle>
            <CardDescription>
              Quản lý danh sách kho của toàn bộ hệ thống
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên/mã kho..."
                className="w-full sm:w-56 pl-8"
              />
            </div>
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="mr-1 h-4 w-4" />
              Thêm kho
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">Bộ lọc:</span>
            </div>
            <Select value={filterOrg} onValueChange={(v) => { setFilterOrg(v); setFilterShop(""); }}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Tất cả tổ chức" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tất cả tổ chức</SelectItem>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name ?? o.id}
                    {o.code ? <span className="ml-1 text-xs text-muted-foreground">({o.code})</span> : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterShop} onValueChange={setFilterShop}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Tất cả cửa hàng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tất cả cửa hàng</SelectItem>
                {filteredShops.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name ?? s.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Tất cả loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tất cả loại</SelectItem>
                {WAREHOUSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 pb-0">
            <BulkActionsToolbar
              count={selection.count}
              entityLabel="kho"
              onClear={selection.clear}
              onRequestDelete={() => {
                if (window.confirm(`Xoá ${selection.count} kho đã chọn? Hành động không thể hoàn tác.`)) {
                  void handleBulkDelete();
                }
              }}
              isPending={bulkDeleteMutation.isPending}
            />
          </div>
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
                <TableHead>Tên kho</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Cửa hàng</TableHead>
                <TableHead>Địa chỉ</TableHead>
                <TableHead>Kích hoạt</TableHead>
                <TableHead>Quản lý</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    {search ? "Không tìm thấy kho nào" : "Chưa có kho nào"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row, idx) => {
                  const shop = shops.find((s) => s.id === row.shop_id);
                  const checked = selection.isSelected(row.id);
                  return (
                    <TableRow key={row.id} data-state={checked ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => selection.toggle(row.id)}
                          aria-label={`Chọn ${row.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <RowIndexCell index={idx + 1} />
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell><code className="text-xs">{row.code ?? "—"}</code></TableCell>
                      <TableCell>
                        <Badge className={typeBadgeClass(row.type)} variant="outline">
                          {TYPE_LABEL[row.type] ?? row.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {shop?.name ?? row.shop_id ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate" title={row.address ?? ""}>
                        {row.address ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ActiveBadge value={row.is_active} trueLabel="Hoạt động" falseLabel="Ngừng" />
                      </TableCell>
                      <TableCell>{row.manager_name ?? "—"}</TableCell>
                      <TableCell>{row.phone ?? "—"}</TableCell>
                      <TableCell>
                        <IdCell id={row.id} />
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          onEdit={() => openEdit(row)}
                          onDelete={() => { setDeleteTarget(row); setDeleteOpen(true); }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm(); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Cập nhật kho" : "Thêm kho mới"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Chỉnh sửa thông tin kho" : "Nhập thông tin để tạo kho mới trong hệ thống"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>
                Tên kho <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="VD: Kho trung tâm Hà Nội"
              />
            </div>

            <div className="space-y-2">
              <Label>Mã kho</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="VD: WH-HN-01"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Loại kho <span className="text-destructive">*</span>
              </Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại kho" />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tổ chức</Label>
              <Select
                value={formOrgId}
                onValueChange={(v) => { setFormOrgId(v === "__none__" ? "" : v); setFormShopId(""); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={orgsQuery.isLoading ? "Đang tải..." : "Chọn tổ chức"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Không chọn —</SelectItem>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name ?? o.id}
                      {o.code ? <span className="ml-1 text-xs text-muted-foreground">({o.code})</span> : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cửa hàng</Label>
              <Select
                value={formShopId}
                onValueChange={(v) => setFormShopId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={shopsQuery.isLoading ? "Đang tải..." : "Chọn cửa hàng"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Không chọn —</SelectItem>
                  {formFilteredShops.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name ?? s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Địa chỉ</Label>
              <Textarea
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="VD: 123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tên quản lý</Label>
              <Input
                value={formManagerName}
                onChange={(e) => setFormManagerName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
              />
            </div>

            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="VD: 0987654321"
              />
            </div>

            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                id="is-active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
              <Label htmlFor="is-active">Kích hoạt</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={onSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "Lưu thay đổi" : "Tạo kho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xoá</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xoá kho <strong>{deleteTarget?.name}</strong>?
              Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Đang xoá..." : "Xác nhận xoá"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

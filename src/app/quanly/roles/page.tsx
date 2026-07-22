"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  useCrudCreate,
  useCrudDelete,
  useCrudList,
  useCrudUpdate,
} from "@/lib/api/admin-crud";
import { ROLE_PRESETS } from "@/lib/rbac-presets";

type Role = {
  id?: string;
  name?: string;
  code?: string;
  organization_id?: string | null;
};

type Organization = {
  id: string;
  name?: string;
  code?: string | null;
};

const CUSTOM_CODE_SENTINEL = "__custom__";

type ApiErrorShape = {
  error?: {
    message?: string;
    requestId?: string;
    fields?: Record<string, string[] | undefined>;
  };
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

export default function RolesAdminPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [codeSelect, setCodeSelect] = useState<string>("");
  const [customCode, setCustomCode] = useState("");
  const [organizationId, setOrganizationId] = useState<string>("");

  const list = useCrudList<Role>("roles", { search, page: 1, pageSize: 50 });
  const orgsList = useCrudList<Organization>("organizations", { page: 1, pageSize: 200 });
  const createMutation = useCrudCreate<Role, Record<string, unknown>>("roles");
  const updateMutation = useCrudUpdate<Role, Record<string, unknown>>("roles");
  const deleteMutation = useCrudDelete("roles");

  const rows = list.data?.items ?? [];
  const organizations = orgsList.data?.items ?? [];

  function resetForm() {
    setEditingId(null);
    setName("");
    setCodeSelect("");
    setCustomCode("");
    setOrganizationId("");
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(row: Role) {
    setEditingId(String(row.id ?? ""));
    setName(String(row.name ?? ""));
    const presetMatch = ROLE_PRESETS.find((p) => p.code === row.code);
    if (presetMatch) {
      setCodeSelect(presetMatch.code);
      setCustomCode("");
    } else {
      setCodeSelect(CUSTOM_CODE_SENTINEL);
      setCustomCode(String(row.code ?? ""));
    }
    setOrganizationId(String(row.organization_id ?? ""));
    setOpen(true);
  }

  function onPresetChange(value: string) {
    setCodeSelect(value);
    if (value !== CUSTOM_CODE_SENTINEL) {
      const preset = ROLE_PRESETS.find((p) => p.code === value);
      if (preset && !name.trim()) {
        setName(preset.name);
      }
    }
  }

  async function onSubmit() {
    const resolvedCode = codeSelect === CUSTOM_CODE_SENTINEL ? customCode.trim() : codeSelect;
    if (!name.trim()) {
      toast.error("Nhập tên vai trò");
      return;
    }
    if (!resolvedCode) {
      toast.error("Chọn hoặc nhập mã vai trò");
      return;
    }
    const payload: Record<string, unknown> = {
      name: name.trim(),
      code: resolvedCode,
    };
    if (organizationId) {
      payload.organization_id = organizationId;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input: payload });
        toast.success("Đã cập nhật vai trò");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã tạo vai trò");
      }
      setOpen(false);
      resetForm();
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col items-stretch gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Vai trò</CardTitle>
            <CardDescription>
              Nhóm quyền cho từng loại nhân sự (Admin, Staff, Kế toán...). Chọn nhanh từ danh sách preset hoặc tự định nghĩa mã riêng.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên/mã..."
              className="w-full sm:w-56"
            />
            <Button className="w-full sm:w-auto" onClick={openCreate}>Thêm vai trò</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên vai trò</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead>Tổ chức</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {list.isLoading ? "Đang tải..." : "Chưa có vai trò nào"}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const org = organizations.find((o) => o.id === row.organization_id);
                  return (
                    <TableRow key={String(row.id)}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell><code className="text-xs">{row.code}</code></TableCell>
                      <TableCell>{org?.name ?? (row.organization_id ? row.organization_id : "—")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                            Sửa
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              try {
                                await deleteMutation.mutateAsync(String(row.id));
                                toast.success("Đã xoá vai trò");
                              } catch (e) {
                                showApiError(e);
                              }
                            }}
                          >
                            Xoá
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

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm(); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Cập nhật vai trò" : "Tạo vai trò"}</DialogTitle>
            <DialogDescription>
              Vai trò gom nhiều quyền lại để gán cho nhân viên. Sau khi tạo xong, vào trang “Phân quyền” để gán các quyền cụ thể.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Mã vai trò</Label>
              <Select value={codeSelect} onValueChange={onPresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn từ danh sách preset..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_PRESETS.map((preset) => (
                    <SelectItem key={preset.code} value={preset.code}>
                      <span className="font-medium">{preset.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({preset.code})</span>
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_CODE_SENTINEL}>Tự nhập mã khác...</SelectItem>
                </SelectContent>
              </Select>
              {codeSelect === CUSTOM_CODE_SENTINEL ? (
                <Input
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="Ví dụ: staff_returns"
                />
              ) : null}
              <p className="text-xs text-muted-foreground">
                Mã là định danh duy nhất (snake_case). Code sẽ kiểm tra quyền hạn theo mã này.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Tên hiển thị</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Nhân viên bán hàng"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Tổ chức</Label>
              <Select
                value={organizationId || undefined}
                onValueChange={(v) => setOrganizationId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={orgsList.isLoading ? "Đang tải tổ chức..." : "Chọn tổ chức (bỏ qua nếu không dùng đa tổ chức)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Không gắn tổ chức —</SelectItem>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name ?? o.id}
                      {o.code ? <span className="ml-2 text-xs text-muted-foreground">({o.code})</span> : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {organizations.length === 0 && !orgsList.isLoading ? (
                <p className="text-xs text-muted-foreground">
                  Chưa có tổ chức nào. Tạo trước ở mục “Tổ chức” nếu cần đa tổ chức.
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={onSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "Lưu thay đổi" : "Tạo vai trò"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCrudCreate, useCrudList, useCrudUpdate } from "@/lib/api/admin-crud";
import { PERMISSION_PRESETS } from "@/lib/rbac-presets";

type Role = { id: string; name: string; code?: string | null };
type Permission = { id: string; code: string; description?: string | null };
type RolePermission = { role_id: string; permission_id: string };
type ShopStaff = { id: string; user_id: string | null; role_id: string | null; shop_id: string | null; is_active: boolean | null };
type UserProfile = { id: string; full_name: string | null; phone: string | null };
type Shop = { id: string; name: string };

export default function PermissionsAdminPage() {
  const [search, setSearch] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedStaffRoleId, setSelectedStaffRoleId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");

  const rolesQuery = useCrudList<Role>("roles", { page: 1, pageSize: 200 });
  const permissionsQuery = useCrudList<Permission>("permissions", { search, page: 1, pageSize: 500 });
  const rolePermissionsQuery = useCrudList<RolePermission>("role-permissions", { page: 1, pageSize: 500 });
  const shopStaffQuery = useCrudList<ShopStaff>("shop-staff", { page: 1, pageSize: 500 });
  const usersQuery = useCrudList<UserProfile>("user-profiles", { page: 1, pageSize: 500 });
  const shopsQuery = useCrudList<Shop>("shops", { page: 1, pageSize: 200 });

  const createShopStaff = useCrudCreate<ShopStaff, { user_id: string; shop_id: string; role_id: string; is_active: boolean }>("shop-staff");
  const updateShopStaff = useCrudUpdate<ShopStaff, { role_id: string; is_active: boolean }>("shop-staff");

  const roles = rolesQuery.data?.items ?? [];
  const permissions = permissionsQuery.data?.items ?? [];
  const rolePermissions = rolePermissionsQuery.data?.items ?? [];
  const users = usersQuery.data?.items ?? [];
  const shops = shopsQuery.data?.items ?? [];
  const staffRows = shopStaffQuery.data?.items ?? [];

  const rolePermissionMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of rolePermissions) {
      if (!map.has(row.role_id)) map.set(row.role_id, []);
      map.get(row.role_id)?.push(row.permission_id);
    }
    return map;
  }, [rolePermissions]);

  const presetByCode = useMemo(() => {
    const map = new Map<string, { group: string; apiEnforced?: boolean }>();
    for (const p of PERMISSION_PRESETS) map.set(p.code, { group: p.group, apiEnforced: p.apiEnforced });
    return map;
  }, []);

  const GROUP_ORDER = [
    "API yêu cầu",
    "Sản phẩm",
    "Kho",
    "Bán hàng",
    "Đối tác",
    "Sau bán hàng",
    "Nhân sự & phân quyền",
    "Tổ chức",
    "Hệ thống",
    "Khác",
  ];

  function deriveGroup(code: string) {
    const preset = presetByCode.get(code);
    if (preset) return preset.group;
    const prefix = code.split(".")[0];
    if (!prefix) return "Khác";
    return `Khác (${prefix})`;
  }

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const p of permissions) {
      const g = deriveGroup(p.code);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(p);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a[0]);
      const bi = GROUP_ORDER.indexOf(b[0]);
      const ax = ai < 0 ? GROUP_ORDER.length : ai;
      const bx = bi < 0 ? GROUP_ORDER.length : bi;
      if (ax !== bx) return ax - bx;
      return a[0].localeCompare(b[0]);
    });
  }, [permissions, presetByCode]);

  function toggleGroupAll(groupItems: Permission[], next: boolean) {
    const ids = groupItems.map((p) => p.id);
    setSelectedPermissionIds((prev) => {
      const set = new Set(prev);
      if (next) ids.forEach((id) => set.add(id));
      else ids.forEach((id) => set.delete(id));
      return Array.from(set);
    });
  }

  function toggleAll(next: boolean) {
    setSelectedPermissionIds(next ? permissions.map((p) => p.id) : []);
  }

  const selectedRolePermissionIds = selectedRoleId ? rolePermissionMap.get(selectedRoleId) ?? [] : [];

  const selectedStaff = staffRows.find((s) => s.id === selectedStaffId);

  const loadRolePermissions = () => {
    if (!selectedRoleId) return;
    setSelectedPermissionIds(selectedRolePermissionIds);
  };

  const saveRolePermissions = async () => {
    if (!selectedRoleId) {
      toast.error("Chọn role trước");
      return;
    }
    if (selectedPermissionIds.length === 0) {
      toast.error("Chọn ít nhất 1 quyền");
      return;
    }
    try {
      const res = await fetch("/api/v1/role-permissions/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: selectedRoleId, permission_ids: selectedPermissionIds }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || !payload.ok) throw new Error(payload.error?.message ?? "Lưu phân quyền thất bại");
      toast.success("Đã lưu phân quyền role");
      rolePermissionsQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu phân quyền thất bại");
    }
  };

  const createStaffAssignment = async () => {
    if (!selectedUserId || !selectedShopId || !selectedStaffRoleId) {
      toast.error("Chọn user, shop và role");
      return;
    }
    try {
      await createShopStaff.mutateAsync({
        user_id: selectedUserId,
        shop_id: selectedShopId,
        role_id: selectedStaffRoleId,
        is_active: true,
      });
      toast.success("Đã gán role cho account");
      shopStaffQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gán role thất bại");
    }
  };

  const updateStaffAssignment = async () => {
    if (!selectedStaffId || !selectedStaffRoleId) {
      toast.error("Chọn dòng staff và role mới");
      return;
    }
    try {
      await updateShopStaff.mutateAsync({ id: selectedStaffId, input: { role_id: selectedStaffRoleId, is_active: true } });
      toast.success("Đã cập nhật role account");
      shopStaffQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cập nhật role thất bại");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Phân quyền hệ thống</CardTitle>
          <CardDescription>
            Quy trình chuẩn: (1) Chọn role và Nạp quyền hiện tại → (2) Tick quyền cần cấp rồi Lưu phân quyền → (3) Sang tab Account ↔ Role để gán role cho nhân viên theo shop. Danh mục quyền được khoá cứng trong code (rbac-presets.ts), muốn thêm quyền mới hãy chạy scripts/seed-rbac.mjs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="role-permissions" className="space-y-4">
            <TabsList>
              <TabsTrigger value="role-permissions">Role ↔ Quyền</TabsTrigger>
              <TabsTrigger value="account-role">Account ↔ Role</TabsTrigger>
            </TabsList>

            <TabsContent value="role-permissions" className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="space-y-2 w-full sm:min-w-64 sm:w-auto">
                    <Label>Chọn role</Label>
                    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                      <SelectTrigger><SelectValue placeholder="Chọn role..." /></SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={loadRolePermissions}>Nạp quyền hiện tại</Button>
                  <Button className="w-full sm:w-auto" onClick={saveRolePermissions}>Lưu phân quyền</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Nạp quyền hiện tại: lấy quyền đang có của role. Lưu phân quyền: ghi danh sách quyền đã tick vào role.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tìm quyền</Label>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="products.create, orders.cancel..." />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-b pb-2">
                <span className="text-xs text-muted-foreground">
                  Tìm theo mã quyền (vd: orders.create). Đã chọn {selectedPermissionIds.length}/{permissions.length}.
                </span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleAll(true)} disabled={permissions.length === 0}>
                    Chọn tất cả
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleAll(false)} disabled={selectedPermissionIds.length === 0}>
                    Bỏ chọn tất cả
                  </Button>
                </div>
              </div>

              {permissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Không tìm thấy quyền nào. Thử xóa từ khóa, hoặc chạy scripts/seed-rbac.mjs để nạp danh mục quyền.
                </p>
              ) : (
                <div className="space-y-4">
                  {groupedPermissions.map(([groupName, items]) => {
                    const groupIds = items.map((p) => p.id);
                    const allSelected = groupIds.every((id) => selectedPermissionIds.includes(id));
                    const someSelected = groupIds.some((id) => selectedPermissionIds.includes(id));
                    const isApiGroup = groupName === "API yêu cầu";
                    return (
                      <div key={groupName} className="space-y-2 rounded-md border p-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            onCheckedChange={(v) => toggleGroupAll(items, Boolean(v))}
                          />
                          <h4 className={`text-sm font-semibold ${isApiGroup ? "text-destructive" : ""}`}>
                            {groupName}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            ({items.filter((p) => selectedPermissionIds.includes(p.id)).length}/{items.length})
                          </span>
                          {isApiGroup ? (
                            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                              API thực sự chặn
                            </span>
                          ) : null}
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {items.map((p) => {
                            const checked = selectedPermissionIds.includes(p.id);
                            const enforced = presetByCode.get(p.code)?.apiEnforced;
                            return (
                              <label key={p.id} className="flex items-start gap-2 rounded border p-2">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(next) => {
                                    setSelectedPermissionIds((prev) => {
                                      if (next) return [...prev, p.id];
                                      return prev.filter((id) => id !== p.id);
                                    });
                                  }}
                                />
                                <span className="text-sm">
                                  <strong className={enforced ? "text-destructive" : ""}>{p.code}</strong>
                                  {p.description ? (
                                    <span className="block text-muted-foreground">{p.description}</span>
                                  ) : null}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="account-role" className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger><SelectValue placeholder="Chọn user" /></SelectTrigger>
                    <SelectContent>
                      {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Shop</Label>
                  <Select value={selectedShopId} onValueChange={setSelectedShopId}>
                    <SelectTrigger><SelectValue placeholder="Chọn shop" /></SelectTrigger>
                    <SelectContent>
                      {shops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={selectedStaffRoleId} onValueChange={setSelectedStaffRoleId}>
                    <SelectTrigger><SelectValue placeholder="Chọn role" /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={createStaffAssignment}>Gán role</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Staff assignment hiện có</Label>
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger><SelectValue placeholder="Chọn dòng assignment để sửa role" /></SelectTrigger>
                  <SelectContent>
                    {staffRows.map((s) => {
                      const user = users.find((u) => u.id === s.user_id);
                      const role = roles.find((r) => r.id === s.role_id);
                      const shop = shops.find((sp) => sp.id === s.shop_id);
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {(user?.full_name ?? s.user_id ?? "N/A")} • {(shop?.name ?? s.shop_id ?? "N/A")} • {(role?.name ?? "Chưa có role")}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedStaff ? (
                  <p className="text-sm text-muted-foreground">
                    Đang chọn: {selectedStaff.user_id} / {selectedStaff.shop_id} / role={selectedStaff.role_id ?? "null"}
                  </p>
                ) : null}
                <Button variant="outline" onClick={updateStaffAssignment}>Cập nhật role cho assignment đã chọn</Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

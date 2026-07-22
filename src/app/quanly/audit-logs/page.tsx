"use client";

import { useMemo, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCrudList } from "@/lib/api/admin-crud";
import {
  Search,
  Eye,
  Monitor,
  User as UserIcon,
  Package,
  ShoppingCart,
  Truck,
  Wrench,
  Users,
  ShieldCheck,
  Settings,
  FileText,
} from "lucide-react";

type AuditLog = {
  id: number;
  organization_id: string | null;
  user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action: string | null;
  before_data: unknown | null;
  after_data: unknown | null;
  ip_address: string | null;
  created_at: string | null;
};

type UserProfile = { id: string; full_name: string | null };

const ACTION_STYLES: Record<string, { label: string; cls: string }> = {
  create: { label: "Tạo", cls: "bg-green-100 text-green-700" },
  update: { label: "Sửa", cls: "bg-blue-100 text-blue-700" },
  delete: { label: "Xoá", cls: "bg-red-100 text-red-700" },
  action: { label: "Hành động", cls: "bg-purple-100 text-purple-700" },
};

const ENTITY_LABELS: Record<string, string> = {
  organizations: "Tổ chức",
  shops: "Cửa hàng",
  warehouses: "Kho",
  user_profiles: "Người dùng",
  roles: "Vai trò",
  permissions: "Quyền",
  role_permissions: "Phân quyền",
  shop_staff: "Nhân sự",
  brands: "Thương hiệu",
  categories: "Danh mục",
  spec_templates: "Thông số",
  products: "Sản phẩm",
  product_variants: "Biến thể",
  product_gifts: "Quà tặng",
  stock_levels: "Tồn kho",
  inventory_transactions: "Giao dịch kho",
  serial_numbers: "Serial",
  purchase_orders: "Phiếu nhập",
  purchase_order_items: "Dòng nhập",
  suppliers: "NCC",
  orders: "Đơn hàng",
  order_items: "Dòng đơn",
  payments: "Thanh toán",
  pos_sessions: "POS",
  customers: "Khách hàng",
  loyalty_transactions: "Điểm thưởng",
  return_orders: "Trả hàng",
  return_order_items: "Dòng trả",
  order_status_logs: "Trạng thái",
  repair_tickets: "Sửa chữa",
  trade_in_requests: "Thu cũ",
  warranties: "Bảo hành",
  settings: "Cài đặt",
  audit_logs: "Audit log",
};

function entityIcon(type: string | null) {
  const icons: Record<string, typeof Package> = {
    organizations: ShieldCheck,
    shops: ShieldCheck,
    warehouses: Package,
    products: Package,
    product_variants: Package,
    orders: ShoppingCart,
    purchase_orders: Truck,
    customers: Users,
    user_profiles: Users,
    roles: ShieldCheck,
    permissions: ShieldCheck,
    repair_tickets: Wrench,
    trade_in_requests: Wrench,
    settings: Settings,
    audit_logs: FileText,
  };
  const Icon = icons[type ?? ""] ?? FileText;
  return <Icon className="h-4 w-4 text-muted-foreground" />;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return d;
  }
}

function JsonViewer({ data, label }: { data: unknown; label: string }) {
  const [open, setOpen] = useState(false);
  const preview =
    data == null
      ? "—"
      : JSON.stringify(data).length > 80
        ? JSON.stringify(data).slice(0, 80) + "..."
        : JSON.stringify(data);

  return (
    <>
      <button
        type="button"
        className="text-xs text-left text-muted-foreground hover:text-foreground truncate max-w-[180px] inline-block"
        onClick={() => setOpen(true)}
        title="Xem chi tiết"
      >
        {preview}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted p-4 rounded-md overflow-auto whitespace-pre-wrap break-all font-mono">
            {JSON.stringify(data, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}

const ENTITY_TYPES = Object.keys(ENTITY_LABELS).sort();
const ACTIONS = ["create", "update", "delete", "action"];

export default function AuditLogsAdminPage() {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const q = useCrudList<AuditLog>("audit-logs", { search, page: 1, pageSize: 200 });
  const usersQ = useCrudList<UserProfile>("user-profiles", { page: 1, pageSize: 200 });

  const userMap = useMemo(() => {
    const m = new Map<string, UserProfile>();
    (usersQ.data?.items ?? []).forEach((u) => m.set(u.id, u));
    return m;
  }, [usersQ.data]);

  const filtered = useMemo(() => {
    const items = q.data?.items ?? [];
    return items.filter((r) => {
      if (entityFilter !== "all" && r.entity_type !== entityFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      return true;
    });
  }, [q.data, entityFilter, actionFilter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Nhật ký hệ thống</CardTitle>
            <CardDescription>Theo dõi mọi thao tác thay đổi dữ liệu</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm entity_id..."
                className="w-full sm:w-48 pl-8"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Bảng" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả bảng</SelectItem>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{ENTITY_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Hành động" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_STYLES[a]?.label ?? a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Bảng</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Trước</TableHead>
                <TableHead>Sau</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Không có dữ liệu</TableCell></TableRow>
              ) : (
                filtered.map((r) => {
                  const actionStyle = ACTION_STYLES[r.action ?? ""] ?? { label: r.action ?? "—", cls: "bg-muted" };
                  const user = r.user_id ? userMap.get(r.user_id) : null;
                  return (
                    <TableRow key={r.id} className="group">
                      <TableCell className="text-xs text-muted-foreground font-mono">{r.id}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          {entityIcon(r.entity_type)}
                          {ENTITY_LABELS[r.entity_type ?? ""] ?? r.entity_type ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${actionStyle.cls}`}>
                          {actionStyle.label}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate" title={r.entity_id ?? ""}>
                        {r.entity_id ? r.entity_id.slice(0, 8) + "..." : "—"}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {user?.full_name ?? (r.user_id ? r.user_id.slice(0, 8) + "..." : "—")}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.ip_address ? (
                          <span className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            {r.ip_address}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <JsonViewer data={r.before_data} label="Dữ liệu trước khi thay đổi" />
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <JsonViewer data={r.after_data} label="Dữ liệu sau khi thay đổi" />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setDetailLog(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detailLog} onOpenChange={(o) => { if (!o) setDetailLog(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Audit #{detailLog?.id} — {ENTITY_LABELS[detailLog?.entity_type ?? ""] ?? detailLog?.entity_type} / {ACTION_STYLES[detailLog?.action ?? ""]?.label ?? detailLog?.action}
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Bảng</Label>
                  <p>{ENTITY_LABELS[detailLog.entity_type ?? ""] ?? detailLog.entity_type ?? "—"} ({detailLog.entity_type})</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entity ID</Label>
                  <p className="font-mono text-xs">{detailLog.entity_id ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Người thực hiện</Label>
                  <p>{userMap.get(detailLog.user_id ?? "")?.full_name ?? detailLog.user_id ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">IP</Label>
                  <p>{detailLog.ip_address ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Thời gian</Label>
                  <p>{fmtDate(detailLog.created_at)}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Dữ liệu trước</Label>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto whitespace-pre-wrap break-all font-mono mt-1 max-h-48">
                  {detailLog.before_data != null ? JSON.stringify(detailLog.before_data, null, 2) : "null"}
                </pre>
              </div>
              <div>
                <Label className="text-muted-foreground">Dữ liệu sau</Label>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto whitespace-pre-wrap break-all font-mono mt-1 max-h-48">
                  {detailLog.after_data != null ? JSON.stringify(detailLog.after_data, null, 2) : "null"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

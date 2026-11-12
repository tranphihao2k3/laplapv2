"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useCrudBulkDelete, useCrudDelete, useCrudList } from "@/lib/api/admin-crud";
import { httpGet } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/response";
import { BulkActionsToolbar, useBulkSelection } from "@/components/admin/bulk-actions";
import {
  Wrench,
  ShoppingBag,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  Trash2,
  CopyMinus,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileWarning,
  Filter,
} from "lucide-react";
import { QuickWarrantyDialog } from "./_components/quick-warranty-dialog";
import { parseNoteBody } from "@/lib/warranties/quick-warranty";

type WarrantyRow = {
  id: string;
  serial_number_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  repair_ticket_id: string | null;
  warranty_type: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  note: string | null;
  device_name: string | null;
  customer: { id: string; full_name: string | null; phone: string | null } | null;
  order: {
    id: string;
    order_number: string | null;
    created_at: string | null;
    total_amount: number | null;
    order_items: Array<{
      id: string;
      quantity: number | null;
      unit_price: number | null;
      product_variant: {
        id: string;
        sku: string | null;
        name: string | null;
        product: { id: string; name: string | null } | null;
      } | null;
    }> | null;
  } | null;
  serial: {
    id: string;
    serial: string | null;
    imei: string | null;
    product_variant: {
      id: string;
      sku: string | null;
      name: string | null;
      specs: Record<string, unknown> | null;
      attributes: Record<string, unknown> | null;
      product: { id: string; name: string | null } | null;
    } | null;
  } | null;
};

const WARRANTY_TYPE_META: Record<
  string,
  { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }
> = {
  sold: { label: "Bán máy", cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300", icon: ShoppingBag },
  repair: { label: "Sửa chữa", cls: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300", icon: Wrench },
  extension: { label: "Gia hạn", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300", icon: PlusCircle },
};

function WarrantyTypeBadge({ type }: { type: string | null }) {
  const key = type ?? "sold";
  const meta = WARRANTY_TYPE_META[key] ?? WARRANTY_TYPE_META.sold;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function diffMonths(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  const dayAdj = e.getDate() >= s.getDate() ? 0 : -1;
  return months + dayAdj;
}

function daysLeft(end: string | null) {
  if (!end) return null;
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - today.getTime()) / 86400000);
}

function statusBadge(status: string | null, leftDays: number | null) {
  if (status === "voided") return <Badge variant="destructive">Đã huỷ</Badge>;
  if (status === "claimed") return <Badge className="bg-blue-600 hover:bg-blue-600">Đã yêu cầu</Badge>;
  if (status === "expired" || (leftDays !== null && leftDays < 0))
    return <Badge variant="secondary">Hết hạn</Badge>;
  if (leftDays !== null && leftDays <= 30)
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Sắp hết hạn</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600">Còn hiệu lực</Badge>;
}

function warrantyDupKey(w: WarrantyRow): string {
  const type = w.warranty_type ?? "sold";
  const start = w.start_date ?? "";
  const end = w.end_date ?? "";
  if (w.serial_number_id) return `sn:${w.serial_number_id}|${type}|${start}|${end}`;
  const who = w.customer?.phone ?? w.customer_id ?? "guest";
  const device = (w.device_name ?? w.note ?? "").trim().toLowerCase();
  return `dev:${who}|${device}|${type}|${start}|${end}`;
}

function findDuplicateWarrantyIds(rows: WarrantyRow[]): string[] {
  const groups = new Map<string, WarrantyRow[]>();
  for (const w of rows) {
    if (w.status === "voided") continue;
    const key = warrantyDupKey(w);
    const list = groups.get(key) ?? [];
    list.push(w);
    groups.set(key, list);
  }
  const toDelete: string[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const ranked = [...list].sort((a, b) => {
      const score = (w: WarrantyRow) =>
        (w.order_id ? 4 : 0) + (w.repair_ticket_id ? 2 : 0) + (w.serial_number_id ? 1 : 0);
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return a.id < b.id ? -1 : 1;
    });
    for (const extra of ranked.slice(1)) toDelete.push(extra.id);
  }
  return toDelete;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "ok" | "warn" | "bad" | "info";
}) {
  const tones: Record<string, string> = {
    default: "border-border bg-card",
    ok: "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900",
    warn: "border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900",
    bad: "border-rose-200 bg-rose-50/60 dark:bg-rose-950/20 dark:border-rose-900",
    info: "border-sky-200 bg-sky-50/60 dark:bg-sky-950/20 dark:border-sky-900",
  };
  const iconTones: Record<string, string> = {
    default: "text-muted-foreground",
    ok: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-rose-600",
    info: "text-sky-600",
  };
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs sm:text-sm text-muted-foreground truncate">{label}</p>
        <Icon className={`h-4 w-4 shrink-0 ${iconTones[tone]}`} />
      </div>
      <p className="mt-1 text-xl sm:text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function WarrantiesAdminPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [warrantyType, setWarrantyType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [quickOpen, setQuickOpen] = useState(false);
  const [scanningDupes, setScanningDupes] = useState(false);

  const list = useCrudList<WarrantyRow>("warranties", {
    search,
    page,
    pageSize: 20,
    ...(status !== "all" || warrantyType !== "all"
      ? ({
          filters: {
            ...(status !== "all" ? { status } : {}),
            ...(warrantyType !== "all" ? { warranty_type: warrantyType } : {}),
          },
        } as never)
      : {}),
  });

  // Global stats (counts)
  const totalQ = useCrudList<WarrantyRow>("warranties", { page: 1, pageSize: 1 });
  const activeQ = useCrudList<WarrantyRow>("warranties", { page: 1, pageSize: 1, filters: { status: "active" } as never });
  const expiredQ = useCrudList<WarrantyRow>("warranties", { page: 1, pageSize: 1, filters: { status: "expired" } as never });
  const claimedQ = useCrudList<WarrantyRow>("warranties", { page: 1, pageSize: 1, filters: { status: "claimed" } as never });
  const voidedQ = useCrudList<WarrantyRow>("warranties", { page: 1, pageSize: 1, filters: { status: "voided" } as never });
  const soldQ = useCrudList<WarrantyRow>("warranties", { page: 1, pageSize: 1, filters: { warranty_type: "sold" } as never });
  const repairQ = useCrudList<WarrantyRow>("warranties", { page: 1, pageSize: 1, filters: { warranty_type: "repair" } as never });
  // Sample active to estimate expiring soon
  const activeSampleQ = useCrudList<WarrantyRow>("warranties", {
    page: 1,
    pageSize: 100,
    filters: { status: "active" } as never,
  });

  const bulkDeleteMutation = useCrudBulkDelete("warranties");
  const deleteMutation = useCrudDelete("warranties");
  const selection = useBulkSelection();

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = list.data?.totalPages ?? 1;

  const pageIds = useMemo(() => items.map((w) => w.id), [items]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selection.isSelected(id));
  const someOnPageSelected = pageIds.some((id) => selection.isSelected(id));

  const expiringSoonCount = useMemo(() => {
    const rows = activeSampleQ.data?.items ?? [];
    let c = 0;
    for (const w of rows) {
      const left = daysLeft(w.end_date);
      if (left !== null && left >= 0 && left <= 30) c += 1;
    }
    return c;
  }, [activeSampleQ.data]);
  const expiringSoonIsEstimate = (activeQ.data?.total ?? 0) > (activeSampleQ.data?.items?.length ?? 0);

  async function handleBulkDelete() {
    const ids = selection.array;
    if (ids.length === 0) return;
    try {
      const result = await bulkDeleteMutation.mutateAsync(ids);
      const deletedCount = result.deleted?.length ?? 0;
      const missingCount = result.missing?.length ?? 0;
      if (deletedCount === 0) toast.error("Không xoá được bản ghi nào");
      else if (missingCount > 0) toast.warning(`Đã xoá ${deletedCount}, bỏ qua ${missingCount} không tồn tại`);
      else toast.success(`Đã xoá ${deletedCount} bảo hành`);
      selection.clear();
      void Promise.all([list.refetch(), totalQ.refetch(), activeQ.refetch(), expiredQ.refetch(), claimedQ.refetch(), voidedQ.refetch(), soldQ.refetch(), repairQ.refetch(), activeSampleQ.refetch()]);
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } };
      toast.error(err?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  async function handleDeleteOne(w: WarrantyRow) {
    const label =
      w.device_name ?? w.serial?.product_variant?.product?.name ?? w.customer?.full_name ?? w.id.slice(0, 8);
    if (!confirm(`Xoá bảo hành "${label}"?`)) return;
    try {
      await deleteMutation.mutateAsync(w.id);
      toast.success("Đã xoá bảo hành");
      selection.clear();
      void Promise.all([list.refetch(), totalQ.refetch(), activeQ.refetch(), expiredQ.refetch(), claimedQ.refetch(), voidedQ.refetch(), activeSampleQ.refetch()]);
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } };
      toast.error(err?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  async function handleSelectDuplicates() {
    setScanningDupes(true);
    try {
      const params: Record<string, unknown> = { page: 1, pageSize: 100 };
      if (status !== "all") params.status = status;
      if (warrantyType !== "all") params.warranty_type = warrantyType;
      if (search.trim()) params.search = search.trim();
      const page1 = await httpGet<Paginated<WarrantyRow>>("/v1/warranties", params);
      let all = page1.items ?? [];
      if ((page1.totalPages ?? 1) > 1) {
        const page2 = await httpGet<Paginated<WarrantyRow>>("/v1/warranties", { ...params, page: 2 });
        all = all.concat(page2.items ?? []);
      }
      const dupIds = findDuplicateWarrantyIds(all);
      if (dupIds.length === 0) {
        toast.message("Không thấy bảo hành trùng trong ~200 bản gần nhất");
        selection.clear();
        return;
      }
      selection.setMany(dupIds);
      toast.success(`Đã chọn ${dupIds.length} bản trùng (giữ 1 bản/nhóm). Bấm Xoá để dọn.`);
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } };
      toast.error(err?.error?.message ?? "Không quét được bản trùng");
    } finally {
      setScanningDupes(false);
    }
  }

  function refetchAll() {
    void Promise.all([list.refetch(), totalQ.refetch(), activeQ.refetch(), expiredQ.refetch(), claimedQ.refetch(), voidedQ.refetch(), soldQ.refetch(), repairQ.refetch(), activeSampleQ.refetch()]);
  }

  const activeFilters = (status !== "all" ? 1 : 0) + (warrantyType !== "all" ? 1 : 0) + (search.trim() ? 1 : 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Bảo hành</h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi, lọc và xử lý bảo hành nhanh trên mọi thiết bị.
          </p>
        </div>
        <div className="flex flex-col xs:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => void handleSelectDuplicates()} disabled={scanningDupes} className="w-full sm:w-auto">
            <CopyMinus className="mr-2 h-4 w-4" />
            {scanningDupes ? "Đang quét…" : "Chọn bản trùng"}
          </Button>
          <Button type="button" onClick={() => setQuickOpen(true)} className="w-full sm:w-auto">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Tạo nhanh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Tổng bảo hành" value={totalQ.data?.total ?? "—"} icon={ShieldCheck} />
        <StatCard label="Còn hiệu lực" value={activeQ.data?.total ?? "—"} icon={CheckCircle2} tone="ok" />
        <StatCard
          label={`Sắp hết hạn${expiringSoonIsEstimate ? " (ước tính)" : ""}`}
          value={activeSampleQ.isLoading ? "…" : expiringSoonCount}
          icon={AlertTriangle}
          tone="warn"
        />
        <StatCard label="Hết hạn" value={expiredQ.data?.total ?? "—"} icon={Clock} tone="bad" />
        <StatCard label="Đã yêu cầu" value={claimedQ.data?.total ?? "—"} icon={FileWarning} tone="info" />
        <StatCard label="BH bán máy" value={soldQ.data?.total ?? "—"} icon={ShoppingBag} />
        <StatCard label="BH sửa chữa" value={repairQ.data?.total ?? "—"} icon={Wrench} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              Danh sách
              <Badge variant="secondary" className="font-normal">
                {total} kết quả
              </Badge>
            </CardTitle>
            {activeFilters > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setWarrantyType("all");
                  setPage(1);
                }}
                className="w-full lg:w-auto"
              >
                <XCircle className="mr-1.5 h-4 w-4" /> Xoá {activeFilters} bộ lọc
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm SP, serial, khách, số HĐ…"
                className="pl-9"
              />
            </div>
            <Select value={warrantyType} onValueChange={(v) => { setWarrantyType(v); setPage(1); }}>
              <SelectTrigger className="w-full lg:w-[170px]">
                <SelectValue placeholder="Loại BH" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="sold">BH bán máy</SelectItem>
                <SelectItem value="repair">BH sửa chữa</SelectItem>
                <SelectItem value="extension">Gia hạn</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="active">Còn hiệu lực</SelectItem>
                <SelectItem value="expired">Hết hạn</SelectItem>
                <SelectItem value="claimed">Đã yêu cầu BH</SelectItem>
                <SelectItem value="voided">Đã huỷ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <BulkActionsToolbar
            count={selection.count}
            entityLabel="bảo hành"
            onClear={selection.clear}
            onRequestDelete={() => {
              if (window.confirm(`Xoá ${selection.count} bảo hành đã chọn? Hành động không thể hoàn tác.`)) {
                void handleBulkDelete();
              }
            }}
            isPending={bulkDeleteMutation.isPending}
          />

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {list.isLoading ? (
              <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Đang tải…</div>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Không có bảo hành phù hợp
              </div>
            ) : (
              items.map((w) => {
                const months = diffMonths(w.start_date, w.end_date);
                const left = daysLeft(w.end_date);
                const pv = w.serial?.product_variant ?? null;
                const primary = w.order?.order_items?.[0]?.product_variant ?? null;
                const productName =
                  pv?.product?.name ?? pv?.name ?? primary?.product?.name ?? primary?.name ?? w.device_name ?? "(Không xác định)";
                const sku = pv?.sku ?? primary?.sku ?? null;
                const serialCode = w.serial?.serial ?? w.serial?.imei ?? null;
                const checked = selection.isSelected(w.id);
                return (
                  <div key={w.id} className={`rounded-xl border p-3 ${checked ? "ring-2 ring-primary/40 bg-muted/30" : "bg-card"}`}>
                    <div className="flex items-start gap-2">
                      <Checkbox checked={checked} onCheckedChange={() => selection.toggle(w.id)} aria-label={`Chọn ${productName}`} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <WarrantyTypeBadge type={w.warranty_type} />
                          {statusBadge(w.status, left)}
                        </div>
                        <p className="mt-1 font-medium leading-snug break-words">{productName}</p>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          {sku ? <span>SKU: {sku}</span> : null}
                          {serialCode ? <span className="font-mono">SN: {serialCode}</span> : null}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <div><span className="text-muted-foreground">Khách:</span> {w.customer?.full_name ?? "Khách lẻ"}</div>
                          <div><span className="text-muted-foreground">SĐT:</span> {w.customer?.phone ?? "—"}</div>
                          <div><span className="text-muted-foreground">Bắt đầu:</span> {fmtDate(w.start_date)}</div>
                          <div><span className="text-muted-foreground">Hết hạn:</span> {fmtDate(w.end_date)}</div>
                          <div><span className="text-muted-foreground">Thời hạn:</span> {months !== null ? `${months} tháng` : "—"}</div>
                          <div>
                            <span className="text-muted-foreground">Còn lại:</span>{" "}
                            {left === null ? "—" : left < 0 ? `Hết ${Math.abs(left)} ngày` : <span className={left <= 30 ? "text-amber-600 font-medium" : ""}>{left} ngày</span>}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {w.warranty_type === "repair" && w.repair_ticket_id ? (
                            <Link href="/quanly/repair-tickets" className="inline-flex items-center gap-1 text-violet-600">
                              <Wrench className="h-3 w-3" /> Phiếu sửa <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : w.order ? (
                            <Link href={`/quanly/orders/${w.order.id}`} className="inline-flex items-center gap-1 text-sky-600">
                              <ShoppingBag className="h-3 w-3" /> HĐ #{w.order.order_number ?? w.order.id.slice(0, 6)} <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Không có nguồn</span>
                          )}
                        </div>
                        {w.note ? (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2" title={w.note}>
                            {parseNoteBody(w.note) ?? w.note}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => void handleDeleteOne(w)}
                        disabled={deleteMutation.isPending}
                        aria-label="Xoá"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
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
                  <TableHead>Loại</TableHead>
                  <TableHead>Sản phẩm / thiết bị</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Nguồn</TableHead>
                  <TableHead>Bắt đầu</TableHead>
                  <TableHead>Hết hạn</TableHead>
                  <TableHead className="text-right">Thời hạn</TableHead>
                  <TableHead className="text-right">Còn lại</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right w-[56px]">Xoá</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">Đang tải…</TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">Không có bảo hành phù hợp</TableCell>
                  </TableRow>
                ) : (
                  items.map((w) => {
                    const months = diffMonths(w.start_date, w.end_date);
                    const left = daysLeft(w.end_date);
                    const pv = w.serial?.product_variant ?? null;
                    const primary = w.order?.order_items?.[0]?.product_variant ?? null;
                    const productName =
                      pv?.product?.name ?? pv?.name ?? primary?.product?.name ?? primary?.name ?? w.device_name ?? "(Không xác định)";
                    const sku = pv?.sku ?? primary?.sku ?? null;
                    const extraCount = Math.max(0, (w.order?.order_items?.length ?? 0) - 1);
                    const serialCode = w.serial?.serial ?? w.serial?.imei ?? null;
                    const checked = selection.isSelected(w.id);
                    return (
                      <TableRow key={w.id} data-state={checked ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox checked={checked} onCheckedChange={() => selection.toggle(w.id)} aria-label={`Chọn ${productName}`} />
                        </TableCell>
                        <TableCell><WarrantyTypeBadge type={w.warranty_type} /></TableCell>
                        <TableCell className="max-w-[280px]">
                          <div className="font-medium truncate" title={productName}>{productName}</div>
                          <div className="text-xs text-muted-foreground space-x-2">
                            {sku ? <span>SKU: {sku}</span> : null}
                            {serialCode ? <span className="font-mono">SN: {serialCode}</span> : null}
                            {extraCount > 0 ? <span>+{extraCount} SP</span> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="truncate max-w-[160px]">{w.customer?.full_name ?? "Khách lẻ"}</div>
                          {w.customer?.phone ? <div className="text-xs text-muted-foreground">{w.customer.phone}</div> : null}
                        </TableCell>
                        <TableCell>
                          {w.warranty_type === "repair" && w.repair_ticket_id ? (
                            <Link href="/quanly/repair-tickets" className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                              <Wrench className="h-3 w-3" /> Phiếu sửa <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : w.order ? (
                            <Link href={`/quanly/orders/${w.order.id}`} className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline">
                              <ShoppingBag className="h-3 w-3" /> #{w.order.order_number ?? w.order.id.slice(0, 6)} <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {w.note ? (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[180px]" title={w.note}>
                              {parseNoteBody(w.note) ?? w.note}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(w.start_date)}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(w.end_date)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{months !== null ? `${months} tháng` : "—"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {left === null ? "—" : left < 0 ? (
                            <span className="text-muted-foreground">Hết {Math.abs(left)}d</span>
                          ) : (
                            <span className={left <= 30 ? "text-amber-600 font-medium" : ""}>{left} ngày</span>
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(w.status, left)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => void handleDeleteOne(w)}
                            disabled={deleteMutation.isPending}
                            aria-label="Xoá bảo hành"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
              <div>Trang {page} / {totalPages} · {total} kết quả</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex-1 sm:flex-none">
                  Trước
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="flex-1 sm:flex-none">
                  Sau
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <QuickWarrantyDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onCreated={() => {
          if (page !== 1) setPage(1);
          refetchAll();
        }}
      />
    </div>
  );
}

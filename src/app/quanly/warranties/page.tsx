"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Wrench, ShoppingBag, PlusCircle, ExternalLink } from "lucide-react";

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

const WARRANTY_TYPE_META: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  sold: { label: "Bán máy", cls: "bg-sky-100 text-sky-700 border-sky-200", icon: ShoppingBag },
  repair: { label: "Sửa chữa", cls: "bg-violet-100 text-violet-700 border-violet-200", icon: Wrench },
  extension: { label: "Gia hạn", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: PlusCircle },
};

function WarrantyTypeBadge({ type }: { type: string | null }) {
  const key = type ?? "sold";
  const meta = WARRANTY_TYPE_META[key] ?? WARRANTY_TYPE_META.sold;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${meta.cls}`}>
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
  const months =
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  // bù phần ngày
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
  const ms = e.getTime() - today.getTime();
  return Math.round(ms / 86400000);
}

function statusBadge(status: string | null, leftDays: number | null) {
  if (status === "voided")
    return <Badge variant="destructive">Đã huỷ</Badge>;
  if (status === "claimed")
    return <Badge className="bg-blue-600 hover:bg-blue-600">Đã yêu cầu BH</Badge>;
  if (status === "expired" || (leftDays !== null && leftDays < 0))
    return <Badge variant="secondary">Hết hạn</Badge>;
  if (leftDays !== null && leftDays <= 30)
    return <Badge className="bg-amber-500 hover:bg-amber-500">Sắp hết hạn</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600">Còn hiệu lực</Badge>;
}

function fmtCurrency(v: number | null) {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("vi-VN") + " ₫";
}

export default function WarrantiesAdminPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [warrantyType, setWarrantyType] = useState<string>("all");
  const [page, setPage] = useState(1);

  const list = useCrudList<WarrantyRow>("warranties", {
    search,
    page,
    pageSize: 20,
    ...(status !== "all" ? ({ filters: { status } } as never) : {}),
    ...(warrantyType !== "all" ? ({ filters: { warranty_type: warrantyType } } as never) : {}),
  });

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = list.data?.totalPages ?? 1;

  const stats = useMemo(() => {
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let repairCount = 0;
    let soldCount = 0;
    for (const w of items) {
      const left = daysLeft(w.end_date);
      if (w.status === "voided") continue;
      if (w.status === "expired" || (left !== null && left < 0)) expired += 1;
      else if (left !== null && left <= 30) expiringSoon += 1;
      else active += 1;
      if (w.warranty_type === "repair") repairCount += 1;
      else if (w.warranty_type === "sold") soldCount += 1;
    }
    return { active, expiringSoon, expired, repairCount, soldCount };
  }, [items]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Bảo hành</CardTitle>
            <CardDescription>
              Tổng: <strong>{total}</strong> bảo hành ·{" "}
              <span className="text-sky-600">{stats.soldCount} BH bán máy</span> ·{" "}
              <span className="text-violet-600">{stats.repairCount} BH sửa chữa</span> ·{" "}
              <span className="text-emerald-600">{stats.active} còn hiệu lực</span> ·{" "}
              <span className="text-amber-600">{stats.expiringSoon} sắp hết hạn</span> ·{" "}
              <span className="text-muted-foreground">{stats.expired} hết hạn</span>
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo SP / serial / khách / số HĐ..."
              className="w-full sm:w-72"
            />
            <Select
              value={warrantyType}
              onValueChange={(v) => {
                setWarrantyType(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Loại BH" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="sold">BH bán máy</SelectItem>
                <SelectItem value="repair">BH sửa chữa</SelectItem>
                <SelectItem value="extension">Gia hạn</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-44">
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loại</TableHead>
                <TableHead>Sản phẩm / thiết bị</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Nguồn</TableHead>
                <TableHead>Ngày bắt đầu</TableHead>
                <TableHead>Ngày hết</TableHead>
                <TableHead className="text-right">Thời hạn</TableHead>
                <TableHead className="text-right">Còn lại</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Không có bảo hành nào
                  </TableCell>
                </TableRow>
              ) : (
                items.map((w) => {
                  const months = diffMonths(w.start_date, w.end_date);
                  const left = daysLeft(w.end_date);
                  const pv = w.serial?.product_variant ?? null;
                  const orderItems = w.order?.order_items ?? [];
                  const primary = orderItems[0]?.product_variant ?? null;
                  const productName =
                    pv?.product?.name ??
                    pv?.name ??
                    primary?.product?.name ??
                    primary?.name ??
                    "(Không xác định)";
                  const sku = pv?.sku ?? primary?.sku ?? null;
                  const extraCount = Math.max(0, orderItems.length - 1);
                  return (
                    <TableRow key={w.id}>
                      <TableCell>
                        <WarrantyTypeBadge type={w.warranty_type} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{productName}</div>
                        <div className="text-xs text-muted-foreground space-x-2">
                          {sku ? <span>SKU: {sku}</span> : null}
                          {extraCount > 0 ? (
                            <span>+ {extraCount} SP khác trong HĐ</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {w.customer ? (
                          <>
                            <div>{w.customer.full_name ?? "(Khách lẻ)"}</div>
                            {w.customer.phone ? (
                              <div className="text-xs text-muted-foreground">
                                {w.customer.phone}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Khách lẻ</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {w.warranty_type === "repair" && w.repair_ticket_id ? (
                          <Link
                            href={`/quanly/repair-tickets`}
                            className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                            title="Mở phiếu sửa chữa"
                          >
                            <Wrench className="h-3 w-3" /> Phiếu sửa <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : w.order ? (
                          <Link
                            href={`/quanly/orders/${w.order.id}`}
                            className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline"
                          >
                            <ShoppingBag className="h-3 w-3" /> HĐ #{w.order.order_number ?? w.order.id.slice(0, 6)} <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {w.note ? (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1" title={w.note}>
                            {w.note}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{fmtDate(w.start_date)}</TableCell>
                      <TableCell>{fmtDate(w.end_date)}</TableCell>
                      <TableCell className="text-right">
                        {months !== null ? `${months} tháng` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {left === null ? (
                          "—"
                        ) : left < 0 ? (
                          <span className="text-muted-foreground">
                            Đã hết {Math.abs(left)} ngày
                          </span>
                        ) : (
                          <span
                            className={
                              left <= 30 ? "text-amber-600 font-medium" : ""
                            }
                          >
                            {left} ngày
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(w.status, left)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <div>
                Trang {page} / {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded border px-3 py-1 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Trước
                </button>
                <button
                  className="rounded border px-3 py-1 disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Sau
                </button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpGet, httpPost } from "@/lib/api/http";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useCrudBulkDelete, useCrudList, useCrudCreate, useCrudUpdate, useCrudDelete } from "@/lib/api/admin-crud";
import { BulkActionsToolbar, useBulkSelection } from "@/components/admin/bulk-actions";
import { createClient } from "@/lib/supabase/client";
import {
  Search, Plus, Edit, Trash2, Wrench, Camera, X, ImageIcon,
  Printer, ShieldCheck, CheckCircle2, Circle, Clock, Truck, Package, XCircle,
  AlertTriangle, Eye, MessageCircle, Phone,
} from "lucide-react";
import { zaloLink, telLink } from "@/lib/contact";
import {
  RepairIntakeReceipt,
  RepairReceiptStyles,
  type IntakeReceiptData,
} from "@/components/admin/repair-tickets/repair-intake-receipt";
import { RepairTicketDetailDialog } from "@/components/admin/repair-tickets/repair-ticket-detail";

type RepairTicket = {
  id: string;
  ticket_code: string | null;
  shop_id: string | null;
  customer_id: string | null;
  device_name: string | null;
  serial_number: string | null;
  issue_description: string | null;
  condition_description: string | null;
  images: string[] | null;
  status: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  assigned_to: string | null;
  repair_solution: string | null;
  warranty_months: number | null;
  completed_at: string | null;
  delivered_at: string | null;
  created_at: string | null;
};

type Shop = { id: string; name: string; code: string | null };
type Customer = { id: string; full_name: string | null; phone: string | null };

/**
 * Timeline các trạng thái theo thứ tự.
 * - received → diagnosing → quoted → approved → repairing → done → delivered
 * - cancelled là trạng thái đầu cuối (bất kỳ lúc nào)
 */
const STATUS_ORDER: Record<string, { label: string; cls: string; step: number }> = {
  received: { label: "Đã nhận", cls: "bg-blue-100 text-blue-700", step: 1 },
  diagnosing: { label: "Đang chẩn đoán", cls: "bg-indigo-100 text-indigo-700", step: 2 },
  quoted: { label: "Đã báo giá", cls: "bg-amber-100 text-amber-700", step: 3 },
  approved: { label: "KH đồng ý", cls: "bg-emerald-100 text-emerald-700", step: 4 },
  repairing: { label: "Đang sửa", cls: "bg-violet-100 text-violet-700", step: 5 },
  done: { label: "Đã sửa xong", cls: "bg-teal-100 text-teal-700", step: 6 },
  delivered: { label: "Đã trả máy", cls: "bg-green-100 text-green-700", step: 7 },
  cancelled: { label: "Đã huỷ", cls: "bg-red-100 text-red-700", step: 0 },
};

const STATUS_OPTIONS = Object.entries(STATUS_ORDER)
  .filter(([v]) => v !== "cancelled")
  .map(([value, s]) => ({ value, label: s.label }));

const TIMELINE_STEPS = [
  { key: "received", label: "Tiếp nhận", icon: Package },
  { key: "diagnosing", label: "Chẩn đoán", icon: Search },
  { key: "quoted", label: "Báo giá", icon: Clock },
  { key: "approved", label: "KH đồng ý", icon: CheckCircle2 },
  { key: "repairing", label: "Đang sửa", icon: Wrench },
  { key: "done", label: "Sửa xong", icon: CheckCircle2 },
  { key: "delivered", label: "Đã trả", icon: Truck },
] as const;

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("vi-VN"); } catch { return d; }
}
function groupDigits(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "";
  return new Intl.NumberFormat("vi-VN").format(v);
}
function parseMoney(s: string): number | null {
  const digits = s.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

export default function RepairTicketsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<RepairTicket | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ status: "received" });
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick customer creation
  const [quickCustomer, setQuickCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");

  // Hoàn tất sửa chữa
  const [completeOpen, setCompleteOpen] = useState<RepairTicket | null>(null);
  const [completeSolution, setCompleteSolution] = useState("");
  const [completeWarrantyMonths, setCompleteWarrantyMonths] = useState<number>(3);
  // Xem chi tiết phiếu (kèm thông tin BH)
  const [detailTicket, setDetailTicket] = useState<RepairTicket | null>(null);

  // In phiếu
  const [printTicket, setPrintTicket] = useState<IntakeReceiptData | null>(null);

  const q = useCrudList<RepairTicket>("repair-tickets", { search, page: 1, pageSize: 100 });
  const shopsQ = useCrudList<Shop>("shops", { page: 1, pageSize: 100 });
  const customersQ = useCrudList<Customer>("customers", { page: 1, pageSize: 500 });
  const shopMap = useMemo(() => new Map((shopsQ.data?.items ?? []).map((s) => [s.id, s])), [shopsQ.data]);
  const customerMap = useMemo(() => new Map((customersQ.data?.items ?? []).map((c) => [c.id, c])), [customersQ.data]);

  const items = useMemo(() => {
    const all = q.data?.items ?? [];
    return statusFilter === "all" ? all : all.filter((t) => t.status === statusFilter);
  }, [q.data, statusFilter]);

  const createMutation = useCrudCreate("repair-tickets");
  const updateMutation = useCrudUpdate("repair-tickets");
  const deleteMutation = useCrudDelete("repair-tickets");
  const bulkDeleteMutation = useCrudBulkDelete("repair-tickets");
  const selection = useBulkSelection();

  const pageIds = useMemo(() => items.map((t) => t.id), [items]);
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
        toast.success(`Đã xoá ${deletedCount} phiếu sửa`);
      }
      selection.clear();
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }
  const createCustomer = useCrudCreate("customers");
  const qc = useQueryClient();

  const checkoutMutation = useMutation({
    mutationFn: (ticketId: string) => httpPost(`/v1/repair-tickets/${ticketId}/checkout`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crud", "repair-tickets"] });
      toast.success("Đã tạo phiếu thu tiền");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (input: { id: string; repair_solution?: string; warranty_months: number }) =>
      httpPost(`/v1/repair-tickets/${input.id}/complete`, {
        repair_solution: input.repair_solution || undefined,
        warranty_months: input.warranty_months,
      }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin-crud", "repair-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-crud", "warranties"] });
      setCompleteOpen(null);
      setCompleteSolution("");
      setCompleteWarrantyMonths(3);
      if (data?.warranty) {
        toast.success(`Đã hoàn tất. Tự động tạo bảo hành ${data.warranty.warranty_type} đến ${fmtDateTime(data.warranty.end_date)}.`);
      } else {
        toast.success("Đã hoàn tất sửa chữa. Phiếu không cấp bảo hành.");
      }
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    },
  });

  function resetForm() {
    setForm({ status: "received" });
    setEditing(null);
    setImages([]);
    setQuickCustomer(false);
    setNewCustName("");
    setNewCustPhone("");
  }

  function openEdit(t: RepairTicket) {
    setEditing(t);
    setForm({
      shop_id: t.shop_id, customer_id: t.customer_id, device_name: t.device_name,
      serial_number: t.serial_number, issue_description: t.issue_description,
      condition_description: t.condition_description, status: t.status ?? "received",
      estimated_cost: t.estimated_cost, actual_cost: t.actual_cost, assigned_to: t.assigned_to,
      images: t.images,
    });
    setImages([]);
    setQuickCustomer(false);
    setOpenNew(true);
  }

  function openPrint(t: RepairTicket) {
    const c = t.customer_id ? customerMap.get(t.customer_id) : null;
    const shop = t.shop_id ? shopMap.get(t.shop_id) : null;
    setPrintTicket({
      ticketCode: t.ticket_code ?? t.id.slice(0, 8).toUpperCase(),
      createdAt: t.created_at,
      statusLabel: STATUS_ORDER[t.status ?? ""]?.label ?? t.status ?? "—",
      deviceName: t.device_name ?? "—",
      serialNumber: t.serial_number,
      issueDescription: t.issue_description,
      conditionDescription: t.condition_description,
      estimatedCost: t.estimated_cost,
      customerName: c?.full_name ?? null,
      customerPhone: c?.phone ?? null,
      shopName: shop?.name ?? null,
      shopAddress: shop?.code ?? null, // hiện chưa có cột address trong Shop, để mở rộng sau
      shopPhone: null,
      shopEmail: null,
      shopWebsite: null,
      warrantyMonths: t.warranty_months,
      images: t.images,
      pickupDeadlineDays: 30,
    });
  }

  async function uploadImages(): Promise<string[]> {
    if (images.length === 0) return form.images ?? [];
    const supabase = createClient();
    const urls: string[] = [...(form.images ?? [])];

    for (const item of images) {
      const fileExt = item.file.name.split(".").pop();
      const fileName = `repairs/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, item.file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw new Error(`Lỗi tải ảnh: ${error.message}`);
      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  async function handleSubmit() {
    if (!form.device_name || !form.issue_description) {
      toast.error("Vui lòng điền tên thiết bị và mô tả lỗi");
      return;
    }
    try {
      let customerId = form.customer_id;

      // Quick create customer if needed
      if (quickCustomer && (newCustName || newCustPhone)) {
        const newCust = await createCustomer.mutateAsync({
          full_name: newCustName || null,
          phone: newCustPhone || null,
        } as any);
        customerId = (newCust as any).id;
      }

      setUploading(true);
      const imageUrls = await uploadImages();
      setUploading(false);

      const body: Record<string, any> = {};
      Object.entries({ ...form, customer_id: customerId, images: imageUrls }).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) body[k] = v;
      });

      let saved: RepairTicket | null = null;
      if (editing) {
        saved = (await updateMutation.mutateAsync({ id: editing.id, input: body as any })) as RepairTicket;
        toast.success("Đã cập nhật phiếu sửa chữa");
      } else {
        saved = (await createMutation.mutateAsync(body as any)) as RepairTicket;
        toast.success(`Đã tiếp nhận máy sửa. Mã phiếu: ${(saved as any)?.ticket_code ?? "—"}`);
        // Tự động mở hộp thoại in phiếu cho khách
        if (saved) {
          openPrint(saved);
        }
      }
      resetForm();
      setOpenNew(false);
    } catch (e: any) {
      toast.error(e?.error?.message ?? e?.message ?? "Có lỗi xảy ra");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(t: RepairTicket) {
    if (!confirm(`Xoá phiếu sửa "${t.device_name}"?`)) return;
    try { await deleteMutation.mutateAsync(t.id); toast.success("Đã xoá"); }
    catch (e: any) { toast.error(e?.error?.message ?? "Có lỗi xảy ra"); }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const preview = URL.createObjectURL(file);
      setImages((prev) => [...prev, { file, preview }]);
    }
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function removeExistingImage(url: string) {
    setForm((p: any) => ({
      ...p,
      images: (p.images ?? []).filter((u: string) => u !== url),
    }));
  }

  const existingImages: string[] = form.images ?? [];
  const allPreviewImages = [...existingImages, ...images.map((i) => i.preview)];

  return (
    <div className="space-y-4">
      <RepairReceiptStyles />
      <RepairIntakeReceipt data={printTicket} variant="hidden" />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Phiếu sửa chữa</CardTitle>
            <CardDescription>
              Tiếp nhận → chẩn đoán → báo giá → sửa chữa → hoàn tất (tự tạo bảo hành) → trả máy
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mã / thiết bị / serial..." className="w-full sm:w-56 pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { resetForm(); setOpenNew(true); }} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Tiếp nhận
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <BulkActionsToolbar
            count={selection.count}
            entityLabel="phiếu sửa"
            onClear={selection.clear}
            onRequestDelete={() => {
              if (window.confirm(`Xoá ${selection.count} phiếu sửa đã chọn? Hành động không thể hoàn tác.`)) {
                void handleBulkDelete();
              }
            }}
            isPending={bulkDeleteMutation.isPending}
          />
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
                <TableHead>Mã phiếu</TableHead>
                <TableHead>Thiết bị</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead className="text-right">CP dự kiến</TableHead>
                <TableHead className="text-right">CP thực tế</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Chưa có phiếu sửa chữa</TableCell></TableRow>
              ) : (
                items.map((t) => {
                  const st = STATUS_ORDER[t.status ?? ""] ?? { label: t.status ?? "-", cls: "bg-muted", step: 0 };
                  const c = t.customer_id ? customerMap.get(t.customer_id) : null;
                  const checked = selection.isSelected(t.id);
                  return (
                    <TableRow key={t.id} data-state={checked ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => selection.toggle(t.id)}
                          aria-label={`Chọn phiếu ${t.device_name ?? t.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <code className="text-[11px] font-mono text-muted-foreground">{t.ticket_code ?? "—"}</code>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {t.images && t.images.length > 0 && <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          {t.device_name ?? "—"}
                        </div>
                        {t.warranty_months ? (
                          <div className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                            <ShieldCheck className="h-3 w-3" /> BH {t.warranty_months} tháng
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.serial_number ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {c?.full_name ?? "—"}
                        {c?.phone ? <div className="text-muted-foreground">{c.phone}</div> : null}
                      </TableCell>
                      <TableCell className="text-right">{fmtCurrency(t.estimated_cost)}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(t.actual_cost)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(t.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {/* Liên hệ nhanh: chỉ hiện khi có SĐT — dùng để báo giá / xin ý kiến KH */}
                          {(() => {
                            const phone = c?.phone ?? null;
                            const zalo = zaloLink(phone);
                            const tel = telLink(phone);
                            if (!zalo && !tel) return null;
                            return (
                              <>
                                {zalo && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 border-sky-200 bg-sky-50 hover:bg-sky-100"
                                    onClick={() => window.open(zalo, "_blank", "noopener,noreferrer")}
                                    title={`Chat Zalo với ${c?.full_name ?? phone}`}
                                  >
                                    <MessageCircle className="h-3.5 w-3.5 text-sky-600" />
                                  </Button>
                                )}
                                {tel && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                                    asChild
                                  >
                                    <a
                                      href={tel}
                                      title={`Gọi ${c?.full_name ?? phone}`}
                                      className="flex items-center justify-center"
                                    >
                                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                                    </a>
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                          {t.status === "done" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => checkoutMutation.mutate(t.id)}
                              disabled={checkoutMutation.isPending}
                            >
                              Tính tiền
                            </Button>
                          )}
                          {t.status !== "done" && t.status !== "delivered" && t.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCompleteOpen(t);
                                setCompleteSolution(t.repair_solution ?? "");
                                setCompleteWarrantyMonths(t.warranty_months ?? 3);
                              }}
                              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Hoàn tất
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setDetailTicket(t)} title="Xem chi tiết & bảo hành">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openPrint(t)} title="In phiếu biên nhận">
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(t)}>
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

      {/* === INTAKE DIALOG === */}
      <Dialog open={openNew} onOpenChange={(o) => { if (!o) { resetForm(); } setOpenNew(o); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa phiếu sửa chữa" : "Tiếp nhận máy sửa chữa"}</DialogTitle>
            <DialogDescription>
              Nhập thông tin thiết bị, tình trạng và ảnh chụp. Hệ thống sẽ tự sinh mã phiếu (VD: SC-2026-000123) và mở hộp thoại in biên nhận cho khách.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Tên thiết bị *</Label>
              <Input value={form.device_name ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, device_name: e.target.value }))} placeholder="VD: iPhone 14 Pro Max" />
            </div>
            <div className="space-y-2">
              <Label>Cửa hàng</Label>
              <Select value={form.shop_id ?? ""} onValueChange={(v) => setForm((p: any) => ({ ...p, shop_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn cửa hàng" /></SelectTrigger>
                <SelectContent>
                  {(shopsQ.data?.items ?? []).length === 0 ? (
                    <SelectItem value="__loading" disabled>Đang tải...</SelectItem>
                  ) : (
                    (shopsQ.data?.items ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Khách hàng</Label>
              {!quickCustomer ? (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select value={form.customer_id ?? ""} onValueChange={(v) => setForm((p: any) => ({ ...p, customer_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Chọn KH" /></SelectTrigger>
                      <SelectContent>
                        {(customersQ.data?.items ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.full_name ?? c.id.slice(0, 8)}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setQuickCustomer(true)} title="Thêm khách mới">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Khách hàng mới</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setQuickCustomer(false)}>
                      <X className="h-3 w-3 mr-1" /> Chọn KH có sẵn
                    </Button>
                  </div>
                  <Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Họ tên khách" />
                  <Input value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="Số điện thoại" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Serial / IMEI</Label>
              <Input value={form.serial_number ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, serial_number: e.target.value }))} placeholder="Serial hoặc IMEI" />
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={form.status ?? "received"} onValueChange={(v) => setForm((p: any) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Mô tả lỗi *</Label>
              <Textarea value={form.issue_description ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, issue_description: e.target.value }))} placeholder="Mô tả chi tiết lỗi khách báo..." rows={3} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Tình trạng máy khi nhận</Label>
              <Textarea value={form.condition_description ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, condition_description: e.target.value }))} placeholder="Mô tả hiện trạng máy khi nhận (trầy, móp, màn...)" rows={2} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Ảnh chụp máy</Label>
              <div className="flex flex-wrap gap-3">
                {allPreviewImages.map((url, i) => (
                  <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-lg border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => {
                        if (i < existingImages.length) removeExistingImage(url);
                        else removeImage(i - existingImages.length);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-6 w-6" />
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <Label>Chi phí dự kiến</Label>
              <div className="relative">
                <Input
                  inputMode="numeric"
                  className="pr-10 text-right"
                  value={groupDigits(form.estimated_cost)}
                  onChange={(e) => setForm((p: any) => ({ ...p, estimated_cost: parseMoney(e.target.value) }))}
                  placeholder="0"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">đ</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Chi phí thực tế</Label>
              <div className="relative">
                <Input
                  inputMode="numeric"
                  className="pr-10 text-right"
                  value={groupDigits(form.actual_cost)}
                  onChange={(e) => setForm((p: any) => ({ ...p, actual_cost: parseMoney(e.target.value) }))}
                  placeholder="0"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">đ</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { resetForm(); setOpenNew(false); }}>Huỷ</Button>
            <Button disabled={!form.device_name || !form.issue_description || uploading || createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
              {uploading ? "Đang tải ảnh..." : editing ? "Cập nhật" : "Tiếp nhận & in phiếu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === HOÀN TẤT SỬA CHỮA === */}
      <Dialog open={!!completeOpen} onOpenChange={(o) => !o && setCompleteOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Hoàn tất sửa chữa
            </DialogTitle>
            <DialogDescription>
              Mã phiếu: <strong>{completeOpen?.ticket_code}</strong> — {completeOpen?.device_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Cách xử lý / linh kiện thay thế</Label>
              <Textarea
                value={completeSolution}
                onChange={(e) => setCompleteSolution(e.target.value)}
                placeholder="VD: Thay màn hình iPhone 14 Pro Max, ép kính..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Cấp bảo hành sau sửa
              </Label>
              <Select
                value={String(completeWarrantyMonths)}
                onValueChange={(v) => setCompleteWarrantyMonths(Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Không cấp bảo hành</SelectItem>
                  <SelectItem value="1">1 tháng</SelectItem>
                  <SelectItem value="3">3 tháng</SelectItem>
                  <SelectItem value="6">6 tháng</SelectItem>
                  <SelectItem value="12">12 tháng</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {completeWarrantyMonths > 0
                  ? `Sau khi lưu, hệ thống sẽ tự động tạo 1 bảo hành "${completeWarrantyMonths} tháng" gắn với phiếu này, hiển thị trong mục Bảo hành > Bảo hành sửa chữa.`
                  : "Phiếu này sẽ không có bảo hành. Khách chỉ nhận máy."}
              </p>
              {completeWarrantyMonths === 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <div className="font-medium">Chưa cấp bảo hành</div>
                    <div className="text-amber-800/90">
                      Khách sẽ không có căn cứ bảo hành sau sửa. Bạn có chắc muốn tiếp tục?
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(null)}>Huỷ</Button>
            <Button
              onClick={() => {
                if (!completeOpen) return;
                if (completeWarrantyMonths === 0) {
                  const ok = window.confirm(
                    "Xác nhận KHÔNG cấp bảo hành cho phiếu này?\n\nPhiếu sẽ được hoàn tất nhưng khách không có bảo hành sau sửa.",
                  );
                  if (!ok) return;
                }
                completeMutation.mutate({
                  id: completeOpen.id,
                  repair_solution: completeSolution,
                  warranty_months: completeWarrantyMonths,
                });
              }}
              disabled={completeMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {completeMutation.isPending ? "Đang lưu..." : "Xác nhận hoàn tất"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === XEM CHI TIẾT PHIẾU (kèm thông tin bảo hành) === */}
      <RepairTicketDetailDialog
        open={!!detailTicket}
        onOpenChange={(o) => !o && setDetailTicket(null)}
        ticket={detailTicket}
        customerName={
          detailTicket?.customer_id
            ? customerMap.get(detailTicket.customer_id)?.full_name ?? null
            : null
        }
        customerPhone={
          detailTicket?.customer_id
            ? customerMap.get(detailTicket.customer_id)?.phone ?? null
            : null
        }
        onPrint={() => {
          if (detailTicket) {
            setDetailTicket(null);
            openPrint(detailTicket);
          }
        }}
      />
    </div>
  );
}

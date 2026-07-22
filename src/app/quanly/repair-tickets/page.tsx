"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpPost } from "@/lib/api/http";
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
import { Textarea } from "@/components/ui/textarea";
import { useCrudList, useCrudCreate, useCrudUpdate, useCrudDelete } from "@/lib/api/admin-crud";
import { createClient } from "@/lib/supabase/client";
import { Search, Plus, Edit, Trash2, Wrench, Camera, X, ImageIcon } from "lucide-react";

type RepairTicket = {
  id: string;
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
  created_at: string | null;
};

type Shop = { id: string; name: string; code: string | null };
type Customer = { id: string; full_name: string | null; phone: string | null };

const STATUS_ORDER: Record<string, { label: string; cls: string }> = {
  received: { label: "Đã nhận", cls: "bg-blue-100 text-blue-700" },
  diagnosing: { label: "Đang chẩn đoán", cls: "bg-indigo-100 text-indigo-700" },
  quoted: { label: "Đã báo giá", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "KH đồng ý", cls: "bg-emerald-100 text-emerald-700" },
  repairing: { label: "Đang sửa", cls: "bg-violet-100 text-violet-700" },
  done: { label: "Đã sửa xong", cls: "bg-teal-100 text-teal-700" },
  delivered: { label: "Đã trả máy", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Đã huỷ", cls: "bg-red-100 text-red-700" },
};

const STATUS_OPTIONS = Object.entries(STATUS_ORDER).map(([value, s]) => ({ value, label: s.label }));

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("vi-VN"); } catch { return d; }
}
// Hiển thị số tiền có dấu phân cách hàng nghìn khi nhập (VD 3000000 → "3.000.000").
function groupDigits(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "";
  return new Intl.NumberFormat("vi-VN").format(v);
}
// Lấy số nguyên từ chuỗi người dùng gõ (bỏ mọi ký tự không phải số).
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

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: body as any });
        toast.success("Đã cập nhật phiếu sửa chữa");
      } else {
        await createMutation.mutateAsync(body as any);
        toast.success("Đã tạo phiếu sửa chữa");
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
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Phiếu sửa chữa</CardTitle>
            <CardDescription>Tiếp nhận, chẩn đoán, sửa chữa và trả máy</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm thiết bị / serial..." className="w-full sm:w-56 pl-8" />
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thiết bị</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Cửa hàng</TableHead>
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
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Chưa có phiếu sửa chữa</TableCell></TableRow>
              ) : (
                items.map((t) => {
                  const st = STATUS_ORDER[t.status ?? ""] ?? { label: t.status ?? "-", cls: "bg-muted" };
                  const c = t.customer_id ? customerMap.get(t.customer_id) : null;
                  const shop = t.shop_id ? shopMap.get(t.shop_id) : null;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {t.images && t.images.length > 0 && <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          {t.device_name ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.serial_number ?? "—"}</TableCell>
                      <TableCell className="text-xs">{shop?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{c?.full_name ?? "—"}{c?.phone ? ` (${c.phone})` : ""}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(t.estimated_cost)}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(t.actual_cost)}</TableCell>
                      <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(t.created_at)}</TableCell>
<TableCell className="text-right">
                         <div className="flex justify-end gap-2">
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
                           <Button size="sm" variant="outline" onClick={() => openEdit(t)}><Edit className="h-4 w-4" /></Button>
                           <Button size="sm" variant="destructive" onClick={() => handleDelete(t)}><Trash2 className="h-4 w-4" /></Button>
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

      <Dialog open={openNew} onOpenChange={(o) => { if (!o) { resetForm(); } setOpenNew(o); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa phiếu sửa chữa" : "Tiếp nhận máy sửa chữa"}</DialogTitle>
            <DialogDescription>Nhập thông tin thiết bị, tình trạng và ảnh chụp máy.</DialogDescription>
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

            {/* Image upload */}
            <div className="space-y-2 sm:col-span-2">
              <Label>Ảnh chụp máy</Label>
              <div className="flex flex-wrap gap-3">
                {allPreviewImages.map((url, i) => (
                  <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-lg border bg-muted">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setOpenNew(false); }}>Huỷ</Button>
            <Button disabled={!form.device_name || !form.issue_description || uploading || createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
              {uploading ? "Đang tải ảnh..." : editing ? "Cập nhật" : "Tiếp nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

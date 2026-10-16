"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, ShieldX, ShieldAlert, Calendar, User, Wrench, Receipt, FileText, Camera, ImageIcon, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { httpPatch } from "@/lib/api/http";
import { toast } from "sonner";

type RepairTicketLite = {
  id: string;
  ticket_code: string | null;
  device_name: string | null;
  serial_number: string | null;
  issue_description: string | null;
  condition_description: string | null;
  repair_solution: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  status: string | null;
  customer_id: string | null;
  warranty_months: number | null;
  completed_at: string | null;
  delivered_at: string | null;
  created_at: string | null;
  images: string[] | null;
};

type WarrantyRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  note: string | null;
  warranty_type: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: RepairTicketLite | null;
  customerName: string | null;
  customerPhone: string | null;
  onPrint?: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  received: "Tiếp nhận",
  repairing: "Đang sửa",
  done: "Đã sửa xong",
  delivered: "Đã trả máy",
  cancelled: "Đã hủy",
};

function fmtCurrency(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("vi-VN").format(v) + " ₫";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d;
  }
}

function fmtDateTime(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d;
  }
}

export function RepairTicketDetailDialog({ open, onOpenChange, ticket, customerName, customerPhone, onPrint }: Props) {
  const [warranty, setWarranty] = useState<WarrantyRow | null>(null);
  const [loading, setLoading] = useState(false);

  // === Local state cho upload ảnh bổ sung ===
  // Tách riêng 2 ref: 1 cho camera (capture=environment), 1 cho thư viện.
  const fileCameraRef = useRef<HTMLInputElement>(null);
  const fileGalleryRef = useRef<HTMLInputElement>(null);
  const [newImages, setNewImages] = useState<{ file: File; preview: string }[]>([]);
  const [removedExisting, setRemovedExisting] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [captureMode, setCaptureMode] = useState<"gallery" | "camera">("gallery");
  const qc = useQueryClient();

  const updateImagesMutation = useMutation({
    mutationFn: async (input: { id: string; finalImages: string[] }) =>
      httpPatch(`/v1/repair-tickets/${input.id}`, { images: input.finalImages }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-crud", "repair-tickets"] });
    },
  });

  useEffect(() => {
    if (!open || !ticket) {
      setWarranty(null);
      return;
    }
    const supabase = createClient();
    setLoading(true);
    supabase
      .from("warranties")
      .select("id, start_date, end_date, status, note, warranty_type")
      .eq("repair_ticket_id", ticket.id)
      .eq("warranty_type", "repair")
      .maybeSingle()
      .then(({ data }) => {
        setWarranty((data as WarrantyRow | null) ?? null);
        setLoading(false);
      });
  }, [open, ticket]);

  // Khi ticket đổi hoặc dialog đóng → reset state upload.
  useEffect(() => {
    if (!open) {
      newImages.forEach((i) => URL.revokeObjectURL(i.preview));
      setNewImages([]);
      setRemovedExisting([]);
      setCaptureMode("gallery");
    }
  }, [open, ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const preview = URL.createObjectURL(file);
      setNewImages((prev) => [...prev, { file, preview }]);
    }
    e.target.value = "";
    if (captureMode === "camera") {
      setTimeout(() => fileCameraRef.current?.click(), 250);
    }
  }

  function removeNewImage(index: number) {
    setNewImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function toggleRemoveExisting(url: string) {
    setRemovedExisting((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  }

  async function uploadNewImages(): Promise<string[]> {
    if (newImages.length === 0) return [];
    const supabase = createClient();
    const urls: string[] = [];
    for (const item of newImages) {
      const fileExt = item.file.name.split(".").pop() ?? "jpg";
      const fileName = `repairs/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(fileName, item.file, { cacheControl: "3600", upsert: false });
      if (error) throw new Error(`Lỗi tải ảnh: ${error.message}`);
      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  async function saveImages() {
    if (!ticket) return;
    if (newImages.length === 0 && removedExisting.length === 0) {
      toast.info("Không có thay đổi để lưu");
      return;
    }
    setUploadingImages(true);
    try {
      const uploadedUrls = await uploadNewImages();
      const keptExisting = (ticket.images ?? []).filter((u) => !removedExisting.includes(u));
      const finalImages = [...keptExisting, ...uploadedUrls];
      await updateImagesMutation.mutateAsync({ id: ticket.id, finalImages });
      // Reset local state
      newImages.forEach((i) => URL.revokeObjectURL(i.preview));
      setNewImages([]);
      setRemovedExisting([]);
      toast.success(
        newImages.length > 0
          ? `Đã thêm ${uploadedUrls.length} ảnh`
          : `Đã xoá ${removedExisting.length} ảnh`
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Có lỗi xảy ra");
    } finally {
      setUploadingImages(false);
    }
  }

  if (!ticket) return null;

  // Trạng thái BH suy ra:
  //   1. Có warranty record → dùng trực tiếp
  //   2. Không có record nhưng ticket.warranty_months > 0 → "Đã đăng ký, chờ thanh toán"
  //   3. Còn lại → chưa cấp
  const months = ticket.warranty_months ?? 0;
  const now = new Date();
  let warrantyBlock: { kind: "active" | "expired" | "registered" | "none"; title: string; sub: string; endDate: string | null };

  if (warranty) {
    const end = new Date(warranty.end_date);
    const expired = end < now || warranty.status !== "active";
    warrantyBlock = {
      kind: expired ? "expired" : "active",
      title: expired ? "Bảo hành đã hết hạn" : "Bảo hành đang hiệu lực",
      sub: expired
        ? `Hết hạn ${fmtDate(warranty.end_date)}`
        : `Còn ${Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000))} ngày (đến ${fmtDate(warranty.end_date)})`,
      endDate: warranty.end_date,
    };
  } else if (months > 0) {
    warrantyBlock = {
      kind: "registered",
      title: `Đã đăng ký BH ${months} tháng`,
      sub: "Sẽ tự tạo bản ghi khi thanh toán tại POS",
      endDate: null,
    };
  } else {
    warrantyBlock = {
      kind: "none",
      title: "Chưa cấp bảo hành",
      sub: "Phiếu này không có bảo hành sau sửa",
      endDate: null,
    };
  }

  const blockStyles: Record<typeof warrantyBlock.kind, { box: string; icon: React.ReactNode }> = {
    active: {
      box: "border-emerald-300 bg-emerald-50 text-emerald-900",
      icon: <ShieldCheck className="h-5 w-5 text-emerald-700" />,
    },
    expired: {
      box: "border-zinc-300 bg-zinc-50 text-zinc-700",
      icon: <ShieldX className="h-5 w-5 text-zinc-500" />,
    },
    registered: {
      box: "border-blue-300 bg-blue-50 text-blue-900",
      icon: <ShieldAlert className="h-5 w-5 text-blue-700" />,
    },
    none: {
      box: "border-amber-300 bg-amber-50 text-amber-900",
      icon: <ShieldAlert className="h-5 w-5 text-amber-600" />,
    },
  };
  const style = blockStyles[warrantyBlock.kind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Phiếu sửa {ticket.ticket_code ?? ticket.id.slice(0, 8).toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            Trạng thái: <strong>{STATUS_LABEL[ticket.status ?? ""] ?? ticket.status ?? "—"}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* === BẢO HÀNH — nổi bật === */}
          <div className={`flex items-start gap-3 rounded-md border p-3 ${style.box}`}>
            {style.icon}
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{warrantyBlock.title}</div>
              <div className="text-xs opacity-90 mt-0.5">{warrantyBlock.sub}</div>
              {warranty?.start_date && (
                <div className="text-[11px] opacity-75 mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Từ {fmtDate(warranty.start_date)}
                </div>
              )}
              {warranty?.note && (
                <div className="text-[11px] opacity-75 mt-1 italic">"{warranty.note}"</div>
              )}
              {loading && <div className="text-[11px] opacity-60 mt-1">Đang tải...</div>}
            </div>
          </div>

          {/* === KHÁCH HÀNG === */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Khách hàng
            </h3>
            <div className="rounded border bg-muted/30 p-2.5 text-sm space-y-0.5">
              <div><span className="text-muted-foreground">Họ tên:</span> <strong>{customerName ?? "—"}</strong></div>
              <div><span className="text-muted-foreground">SĐT:</span> {customerPhone ?? "—"}</div>
            </div>
          </section>

          {/* === THIẾT BỊ === */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> Thiết bị
            </h3>
            <div className="rounded border bg-muted/30 p-2.5 text-sm space-y-0.5">
              <div><span className="text-muted-foreground">Tên TB:</span> <strong>{ticket.device_name ?? "—"}</strong></div>
              <div><span className="text-muted-foreground">Serial:</span> <span className="font-mono text-xs">{ticket.serial_number ?? "—"}</span></div>
            </div>
          </section>

          {/* === MÔ TẢ === */}
          {ticket.issue_description && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Mô tả lỗi</h3>
              <p className="text-sm whitespace-pre-wrap">{ticket.issue_description}</p>
            </section>
          )}
          {ticket.condition_description && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Hiện trạng tiếp nhận</h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{ticket.condition_description}</p>
            </section>
          )}
          {ticket.repair_solution && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cách xử lý</h3>
              <p className="text-sm whitespace-pre-wrap">{ticket.repair_solution}</p>
            </section>
          )}

          {/* === HÌNH ẢNH === */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Hình ảnh
                <span className="text-[10px] font-normal text-muted-foreground/70">
                  ({[...(ticket.images ?? []).filter((u) => !removedExisting.includes(u)), ...newImages].length})
                </span>
              </span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {/* Ảnh đã có (chưa bị đánh dấu xoá) */}
              {(ticket.images ?? [])
                .filter((u) => !removedExisting.includes(u))
                .map((url) => (
                  <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-md border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => toggleRemoveExisting(url)}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      title="Đánh dấu xoá"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] font-medium text-white">CŨ</div>
                  </div>
                ))}
              {/* Ảnh mới (preview) */}
              {newImages.map((img, i) => (
                <div key={img.preview} className="group relative h-20 w-20 overflow-hidden rounded-md border border-emerald-300 bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeNewImage(i)}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                    title="Bỏ ảnh này"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-0.5 left-0.5 rounded bg-emerald-600 px-1 text-[9px] font-medium text-white">MỚI</div>
                </div>
              ))}
              {/* 2 nút upload: camera + thư viện */}
              <button
                type="button"
                className="flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                onClick={() => {
                  setCaptureMode("camera");
                  fileCameraRef.current?.click();
                }}
                title="Mở camera chụp nhiều ảnh liên tục"
              >
                <Camera className="h-5 w-5" />
                <span className="text-[9px] font-medium">Chụp</span>
              </button>
              <button
                type="button"
                className="flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                onClick={() => {
                  setCaptureMode("gallery");
                  fileGalleryRef.current?.click();
                }}
                title="Chọn ảnh từ thư viện"
              >
                <ImageIcon className="h-5 w-5" />
                <span className="text-[9px] font-medium">Thư viện</span>
              </button>
            </div>
            {(newImages.length > 0 || removedExisting.length > 0) && (
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    newImages.forEach((i) => URL.revokeObjectURL(i.preview));
                    setNewImages([]);
                    setRemovedExisting([]);
                  }}
                  disabled={uploadingImages}
                >
                  Huỷ thay đổi
                </Button>
                <Button
                  size="sm"
                  onClick={saveImages}
                  disabled={uploadingImages || updateImagesMutation.isPending}
                >
                  {uploadingImages || updateImagesMutation.isPending
                    ? "Đang lưu..."
                    : newImages.length > 0
                    ? `Lưu ${newImages.length} ảnh mới`
                    : `Xoá ${removedExisting.length} ảnh`}
                </Button>
                {removedExisting.length > 0 && (
                  <span className="text-[11px] text-amber-700">
                    ({removedExisting.length} ảnh sẽ bị xoá sau khi lưu)
                  </span>
                )}
              </div>
            )}
            {/* Hidden inputs */}
            <input
              ref={fileCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />
            <input
              ref={fileGalleryRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
          </section>

          {/* === CHI PHÍ + THỜI GIAN === */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Chi phí &amp; thời gian
            </h3>
            <div className="rounded border bg-muted/30 p-2.5 text-sm space-y-0.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chi phí dự kiến</span>
                <span>{fmtCurrency(ticket.estimated_cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chi phí thực tế</span>
                <strong>{fmtCurrency(ticket.actual_cost)}</strong>
              </div>
              <div className="border-t pt-1 mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Tiếp nhận: {fmtDateTime(ticket.created_at)}</span>
              </div>
              {ticket.completed_at && (
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Sửa xong: {fmtDateTime(ticket.completed_at)}</span>
                </div>
              )}
              {ticket.delivered_at && (
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Trả máy: {fmtDateTime(ticket.delivered_at)}</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2">
          {onPrint && (
            <Button variant="outline" size="sm" onClick={onPrint}>
              In phiếu A5
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} size="sm">Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

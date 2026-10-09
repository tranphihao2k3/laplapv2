"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX, ShieldAlert, Calendar, User, Wrench, Receipt, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

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

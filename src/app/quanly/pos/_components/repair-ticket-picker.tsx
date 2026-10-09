"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Wrench,
  Loader2,
  User,
  Phone,
  Hash,
  ClipboardList,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCrudList } from "@/lib/api/admin-crud";
import { cn } from "@/lib/utils";
import { formatVND } from "./types";

export type RepairTicket = {
  id: string;
  ticket_code?: string | null;
  device_name: string | null;
  serial_number: string | null;
  /** Mô tả lỗi khách báo khi tiếp nhận. */
  issue_description: string | null;
  /** Phương án xử lý / nội dung sửa (do kỹ thuật viên ghi). */
  repair_solution: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  status: string | null;
  customer_id: string | null;
  customer_name?: string | null;
  // ===== Joins thêm từ API (xem repairTicketsService.list custom) =====
  customer_full_name?: string | null;
  customer_phone?: string | null;
  /** Ngày kết thúc bảo hành sửa chữa (yyyy-mm-dd) hoặc null nếu chưa có. */
  warranty_end_date?: string | null;
  warranty_start_date?: string | null;
  warranty_status?: string | null;
  /** Số tháng BH đã set trên phiếu (mặc định null/0 nếu chưa tick). */
  warranty_months?: number | null;
  /** Thời điểm hoàn tất sửa (ISO). Null nếu phiếu chưa "done". */
  completed_at?: string | null;
};

/**
 * Status mà admin có thể "tính tiền luôn" tại POS (chưa trả máy + chưa huỷ).
 * Bao gồm toàn bộ phiếu từ lúc "tiếp nhận" (received) → chẩn đoán → báo giá → duyệt
 * → đang sửa → sửa xong. Chọn xong bấm Thanh toán sẽ tự động chuyển sang "done" (nếu chưa)
 * rồi checkout ngay trong 1 bước.
 *
 * Lưu ý: KHÔNG lấy "delivered" (đã trả) + "cancelled" (đã huỷ).
 */
const ALLOWED_STATUSES = [
  "received",
  "diagnosing",
  "quoted",
  "approved",
  "repairing",
  "done",
] as const;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  received: { label: "Tiếp nhận", cls: "bg-blue-100 text-blue-700" },
  diagnosing: { label: "Đang chẩn đoán", cls: "bg-indigo-100 text-indigo-700" },
  quoted: { label: "Đã báo giá", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "KH duyệt", cls: "bg-emerald-100 text-emerald-700" },
  repairing: { label: "Đang sửa", cls: "bg-violet-100 text-violet-700" },
  done: { label: "Sửa xong", cls: "bg-teal-100 text-teal-700" },
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Phân loại hạn bảo hành để hiển thị icon + màu phù hợp.
 *   - null:    chưa có BH (icon: ShieldCheck xám, text "BH theo phiếu")
 *   - expired: đã hết hạn        (icon: ShieldX đỏ,    text "BH hết hạn …")
 *   - expiring: còn ≤ 14 ngày     (icon: ShieldAlert vàng, text "Còn N ngày")
 *   - active:  còn > 14 ngày       (icon: ShieldCheck xanh, text "BH đến …")
 */
function warrantyState(end: string | null | undefined) {
  if (!end) return { kind: "none" as const, label: "BH theo phiếu" };
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return { kind: "none" as const, label: "BH theo phiếu" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((endDate.getTime() - today.getTime()) / MS_PER_DAY);
  if (days < 0) {
    return { kind: "expired" as const, label: `BH hết hạn ${-days} ngày` };
  }
  if (days <= 14) {
    return { kind: "expiring" as const, label: `Còn ${days} ngày BH` };
  }
  return { kind: "active" as const, label: `BH đến ${endDate.toLocaleDateString("vi-VN")}` };
}

const WARRANTY_STATE_STYLE: Record<
  "none" | "active" | "expiring" | "expired",
  { cls: string; Icon: typeof ShieldCheck }
> = {
  none: { cls: "text-slate-500", Icon: ShieldCheck },
  active: { cls: "text-emerald-600", Icon: ShieldCheck },
  expiring: { cls: "text-amber-600", Icon: ShieldAlert },
  expired: { cls: "text-rose-600", Icon: ShieldX },
};

type RepairTicketPickerProps = {
  onPick: (ticket: RepairTicket) => void;
};

export function RepairTicketPicker({ onPick }: RepairTicketPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Lấy TẤT CẢ ticket, lọc client-side. Service đã join customers + warranties.
  // pageSize lớn để bao trùm các phiếu đang mở trong ngày.
  const ticketsQuery = useCrudList<RepairTicket>("repair-tickets", {
    page: 1,
    pageSize: 200,
  });

  const tickets = useMemo(() => {
    const allowed = new Set<string>(ALLOWED_STATUSES);
    const all = ticketsQuery.data?.items ?? [];
    const s = search.toLowerCase().trim();
    return all
      .filter((t) => t.status && allowed.has(t.status))
      .filter((t) => {
        if (!s) return true;
        return (
          (t.device_name?.toLowerCase().includes(s) ?? false) ||
          (t.serial_number?.toLowerCase().includes(s) ?? false) ||
          (t.ticket_code?.toLowerCase().includes(s) ?? false) ||
          (t.customer_full_name?.toLowerCase().includes(s) ?? false) ||
          (t.customer_phone?.toLowerCase().includes(s) ?? false) ||
          (t.issue_description?.toLowerCase().includes(s) ?? false) ||
          (t.repair_solution?.toLowerCase().includes(s) ?? false)
        );
      })
      // Ưu tiên "done" trước, sau đó theo thời gian tạo mới nhất.
      .sort((a, b) => {
        const ad = a.status === "done" ? 0 : 1;
        const bd = b.status === "done" ? 0 : 1;
        if (ad !== bd) return ad - bd;
        const at = a.id ?? "";
        const bt = b.id ?? "";
        return bt.localeCompare(at);
      });
  }, [ticketsQuery.data, search]);

  const handleSelect = (ticket: RepairTicket) => {
    onPick(ticket);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Wrench className="h-4 w-4" /> Sửa chữa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chọn phiếu sửa chữa để tính tiền</DialogTitle>
          <DialogDescription>
            Hiển thị cả máy <b>đã nhận</b>, <b>đang sửa</b> và <b>đã sửa xong</b>. Bấm Thanh toán sẽ
            tự động chuyển phiếu sang &ldquo;Đã sửa xong&rdquo; (nếu chưa) và lên hóa đơn trong một bước.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm tên khách / SĐT / thiết bị / serial / mã phiếu / lỗi..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
            {ticketsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải danh sách phiếu...
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                {search
                  ? "Không tìm thấy phiếu phù hợp"
                  : "Chưa có phiếu sửa đang mở (tiếp nhận / đang sửa / đã sửa xong)"}
              </p>
            ) : (
              tickets.map((t) => {
                const badge = STATUS_BADGE[t.status ?? ""] ?? {
                  label: t.status ?? "—",
                  cls: "bg-gray-100 text-gray-600",
                };
                const needsComplete = t.status !== "done";
                const warranty = warrantyState(t.warranty_end_date);
                const wStyle = WARRANTY_STATE_STYLE[warranty.kind];
                const WIcon = wStyle.Icon;
                const customerName = t.customer_full_name || t.customer_name || "Khách lẻ";
                const solution = t.repair_solution?.trim() || null;
                const issue = t.issue_description?.trim() || null;
                return (
                  <div
                    key={t.id}
                    className="rounded-lg border bg-card p-3 cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50"
                    onClick={() => handleSelect(t)}
                  >
                    {/* Hàng 1: Tên thiết bị + mã phiếu + badge trạng thái */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="font-semibold truncate">
                            {t.device_name || "Máy sửa"}
                          </span>
                          {t.ticket_code && (
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                              #{t.ticket_code}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          badge.cls,
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Hàng 2: Khách hàng */}
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground min-w-0">
                      <span className="flex items-center gap-1 min-w-0">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate font-medium text-foreground/80">
                          {customerName}
                        </span>
                      </span>
                      {t.customer_phone && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Phone className="h-3 w-3" />
                          {t.customer_phone}
                        </span>
                      )}
                    </div>

                    {/* Hàng 3: Mô tả lỗi khách báo */}
                    {issue && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-xs">
                        <ClipboardList className="h-3 w-3 mt-0.5 shrink-0 text-rose-500" />
                        <span className="line-clamp-2 text-muted-foreground">
                          <span className="font-medium text-foreground/70">Lỗi:</span> {issue}
                        </span>
                      </div>
                    )}

                    {/* Hàng 4: Phương án sửa (nếu có) */}
                    {solution && (
                      <div className="mt-1 flex items-start gap-1.5 text-xs">
                        <Wrench className="h-3 w-3 mt-0.5 shrink-0 text-violet-500" />
                        <span className="line-clamp-2 text-muted-foreground">
                          <span className="font-medium text-foreground/70">Sửa:</span> {solution}
                        </span>
                      </div>
                    )}

                    {/* Hàng 5: SN + BH + tiền */}
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 min-w-0 text-muted-foreground">
                        {t.serial_number && (
                          <span className="flex items-center gap-1 min-w-0">
                            <Hash className="h-3 w-3 shrink-0" />
                            <span className="truncate font-mono">{t.serial_number}</span>
                          </span>
                        )}
                        <span
                          className={cn(
                            "flex items-center gap-1 shrink-0 font-medium",
                            wStyle.cls,
                          )}
                          title={
                            t.warranty_end_date
                              ? `Hạn bảo hành: ${new Date(t.warranty_end_date).toLocaleDateString("vi-VN")}`
                              : "Bảo hành theo phiếu (chưa phát sinh record)"
                          }
                        >
                          <WIcon className="h-3 w-3" />
                          {warranty.label}
                        </span>
                      </div>
                      <span className="font-semibold text-foreground shrink-0">
                        {formatVND(t.actual_cost || t.estimated_cost || 0)}
                      </span>
                    </div>

                    {needsComplete && (
                      <div className="mt-1.5 text-[10px] italic text-muted-foreground">
                        Sẽ tự chuyển sang &ldquo;Đã sửa xong&rdquo; khi thanh toán
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

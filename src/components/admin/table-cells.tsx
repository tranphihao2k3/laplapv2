"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Số thứ tự tự động đếm trong trang (1-based). */
export function RowIndexCell({ index }: { index: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[1.75rem] text-xs font-mono text-muted-foreground tabular-nums">
      {index}
    </span>
  );
}

/**
 * Ô hiển thị mã ngắn (8 ký tự đầu của UUID) cho dễ nhìn,
 * click để copy full UUID. Dùng cho cột "Mã".
 */
export function IdCell({ id, prefix = "" }: { id: string; prefix?: string }) {
  const [copied, setCopied] = useState(false);
  const short = id?.slice(0, 8) ?? "—";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success("Đã copy mã");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Không copy được");
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            className="group inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {prefix && <span className="text-foreground/60">{prefix}</span>}
            <span>{short}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click để copy full ID</p>
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5 break-all">{id}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Badge trạng thái chung: active/inactive, hiển thị chấm tròn xanh/xám. */
export function ActiveBadge({
  value,
  trueLabel = "Hoạt động",
  falseLabel = "Tạm ẩn",
}: {
  value: boolean | null | undefined;
  trueLabel?: string;
  falseLabel?: string;
}) {
  const isActive = value !== false;
  if (isActive) {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 gap-1 font-semibold"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
        {trueLabel}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 gap-1 font-semibold"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
      {falseLabel}
    </Badge>
  );
}

/**
 * Format ngày kiểu Việt Nam gọn: dd/MM/yyyy, hoặc "HH:mm dd/MM" nếu showTime.
 */
export function DateCell({
  value,
  showTime = false,
}: {
  value: string | number | Date | null | undefined;
  showTime?: boolean;
}) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const d = new Date(value);
  if (isNaN(d.getTime())) return <span className="text-muted-foreground">—</span>;
  const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return (
    <span className="text-xs tabular-nums whitespace-nowrap">
      {showTime ? `${time} ${date}` : date}
    </span>
  );
}

/** Format tiền VND gọn — dùng cho cột "Giá", "Giá trị". */
export function MoneyCell({ value }: { value: number | string | null | undefined }) {
  const n = Number(value ?? 0);
  if (!n) return <span className="text-muted-foreground">—</span>;
  return <span className="font-semibold tabular-nums">{n.toLocaleString("vi-VN")}₫</span>;
}

/** Số nguyên tabular-nums, fallback "—" */
export function NumberCell({ value }: { value: number | string | null | undefined }) {
  const n = Number(value ?? 0);
  return <span className="tabular-nums">{n.toLocaleString("vi-VN")}</span>;
}

/** Cell thao tác gọn (Sửa/Xoá icon button) — dùng chung cho các bảng admin */
export function RowActions({
  onEdit,
  onDelete,
  editLabel = "Sửa",
  deleteLabel = "Xoá",
  isDeleting = false,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  isDeleting?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex justify-end gap-1">
        {onEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={onEdit} aria-label={editLabel}>
                <PencilIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{editLabel}</TooltipContent>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="destructive"
                className="h-7 w-7"
                onClick={onDelete}
                disabled={isDeleting}
                aria-label={deleteLabel}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{deleteLabel}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

/** Wrapper căn giữa cho cột checkbox 40px */
export function CheckboxCell({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center">{children}</div>;
}
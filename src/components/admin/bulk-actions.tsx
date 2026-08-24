"use client";

import { useMemo, useState, useCallback } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Hook quản lý trạng thái chọn nhiều row trong table.
 *
 * Dùng:
 *   const selection = useBulkSelection();
 *   selection.isSelected(row.id)
 *   selection.toggle(row.id)
 *   selection.toggleAll(currentPageIds)
 *   <BulkActionsToolbar ... />
 */
export function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const count = selectedIds.size;
  const array = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return { selectedIds, count, array, isSelected, toggle, toggleAll, clear };
}

// ============================================================
// BulkActionsToolbar: hiển thị thanh floating bar khi có chọn ≥1
// ============================================================

type BulkActionsToolbarProps = {
  count: number;
  entityLabel: string; // VD: "sản phẩm", "đơn hàng"
  onClear: () => void;
  /** Optional: render thêm action tuỳ ý bên trái nút Xoá */
  extraActions?: React.ReactNode;
  /** Khi user xác nhận xoá — caller tự đóng confirm + chạy mutation với ids đang chọn. */
  onRequestDelete: () => void;
  /** Khi true, không cho bấm nút Xoá (vd: đang pending). */
  isPending?: boolean;
};

export function BulkActionsToolbar({
  count,
  entityLabel,
  onClear,
  extraActions,
  onRequestDelete,
  isPending,
}: BulkActionsToolbarProps) {
  if (count === 0) return null;

  return (
    <div className="sticky top-0 z-30 -mx-3 mb-3 flex items-center justify-between gap-2 rounded-lg border bg-background/95 px-3 py-2 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-4 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground tabular-nums">
          {count}
        </span>
        <span className="truncate">
          đã chọn <span className="font-medium">{entityLabel}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {extraActions}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 gap-1.5"
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Bỏ chọn</span>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onRequestDelete}
          className="h-8 gap-1.5"
          disabled={isPending}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Xoá ({count})</span>
          <span className="sm:hidden">Xoá</span>
        </Button>
      </div>
    </div>
  );
}

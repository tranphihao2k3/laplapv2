"use client";

/**
 * Panel phải (sticky) của trang PC Builder.
 *
 * - Hiện tất cả slot đã chọn (ảnh, tên, qty, giá, tổng từng slot).
 * - Cho phép xoá linh kiện khỏi slot, thay đổi số lượng (1–n).
 * - Tổng tiền ở chân.
 * - Empty state khi chưa có gì.
 *
 * Component này KHÔNG bao gồm các nút Lưu/Chia sẻ — đó là của `save-share-bar.tsx`.
 */

import { useMemo } from "react";
import Image from "next/image";
import {
  Minus,
  Plus,
  Trash2,
  PackageOpen,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn, formatCurrency } from "@/lib/utils";
import {
  SLOT_LABEL,
  SLOT_ORDER,
  type BuildItem,
  type BuildState,
  type SlotKey,
} from "@/lib/pc-builder/types";
import { calculateTotal, countItems } from "@/lib/pc-builder/storage";
import { CompatibilityBanner } from "./compatibility-banner";
import type { CompatibilityIssue } from "@/lib/pc-builder/types";

type Props = {
  build: BuildState;
  issues: CompatibilityIssue[];
  onAddSlot: (slot: SlotKey) => void;
  onRemoveItem: (slot: SlotKey, productId: string) => void;
  onUpdateQty: (slot: SlotKey, productId: string, qty: number) => void;
};

function SlotGroup({
  slot,
  items,
  onAdd,
  onRemove,
  onUpdateQty,
}: {
  slot: SlotKey;
  items: BuildItem[];
  onAdd: () => void;
  onRemove: (productId: string) => void;
  onUpdateQty: (productId: string, qty: number) => void;
}) {
  const total = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {SLOT_LABEL[slot]}
          </p>
          <p className="text-[11px] text-slate-500">
            {items.length > 0
              ? `${items.length} món · ${formatCurrency(total)}`
              : "Chưa chọn"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="h-8 rounded-lg text-xs"
        >
          {items.length > 0 ? "Thay" : "Chọn"}
        </Button>
      </header>
      {items.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex items-start gap-3 px-3 py-2.5"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                {item.thumbnail ? (
                  <Image
                    src={item.thumbnail}
                    alt={item.name}
                    fill
                    sizes="48px"
                    className="object-contain p-1"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] font-semibold text-slate-300">
                    Lap
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] font-medium text-slate-800">
                  {item.name}
                </p>
                {item.brand ? (
                  <p className="text-[11px] text-slate-500">{item.brand}</p>
                ) : null}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateQty(item.productId, Math.max(1, item.qty - 1))
                      }
                      aria-label="Giảm số lượng"
                      className="flex h-6 w-6 items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      disabled={item.qty <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-semibold tabular-nums text-slate-700">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.productId, item.qty + 1)}
                      aria-label="Tăng số lượng"
                      className="flex h-6 w-6 items-center justify-center text-slate-500 hover:bg-slate-50"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-xs font-bold text-slate-900">
                    {formatCurrency(item.unitPrice * item.qty)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.productId)}
                aria-label={`Xoá ${item.name}`}
                className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-b-xl px-3 py-3 text-xs text-slate-400",
            "hover:bg-slate-50 hover:text-primary",
          )}
        >
          <Plus className="h-3.5 w-3.5" /> Chọn {SLOT_LABEL[slot].toLowerCase()}
        </button>
      )}
    </section>
  );
}

export function BuildSummary({
  build,
  issues,
  onAddSlot,
  onRemoveItem,
  onUpdateQty,
}: Props) {
  const total = useMemo(() => calculateTotal(build), [build]);
  const itemCount = useMemo(() => countItems(build), [build]);

  const filledSlots = SLOT_ORDER.filter(
    (s) => (build[s]?.length ?? 0) > 0,
  );

  return (
    <div className="space-y-3">
      {/* Banner tương thích */}
      <CompatibilityBanner issues={issues} />

      {/* Tổng tiền card */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-white p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              Tổng tiền
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(total)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {itemCount > 0
                ? `${itemCount} linh kiện · ${filledSlots.length} loại`
                : "Chưa có linh kiện nào"}
            </p>
          </div>
          <ShoppingBag className="h-8 w-8 text-primary/30" />
        </div>
      </div>

      {/* Danh sách slot */}
      {filledSlots.length > 0 ? (
        <div className="space-y-2.5">
          {filledSlots.map((slot) => (
            <SlotGroup
              key={slot}
              slot={slot}
              items={build[slot] ?? []}
              onAdd={() => onAddSlot(slot)}
              onRemove={(pid) => onRemoveItem(slot, pid)}
              onUpdateQty={(pid, qty) => onUpdateQty(slot, pid, qty)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-12 text-center">
          <PackageOpen className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">
            Bắt đầu dựng cấu hình của bạn
          </p>
          <p className="max-w-xs text-[11px] text-slate-500">
            Chọn linh kiện từ thanh bên trái hoặc chọn 1 cấu hình mẫu để bắt đầu nhanh.
          </p>
        </div>
      )}

      {filledSlots.length > 0 ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Tạm tính ({itemCount} món)</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(total)}
            </span>
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Phí lắp đặt (dự kiến)</span>
            <span>Tính khi đặt hàng</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

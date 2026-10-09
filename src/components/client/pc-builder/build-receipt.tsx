"use client";

/**
 * Layout dùng cho cả in và chia sẻ. Hiển thị:
 *  - Logo + tiêu đề "Phiếu cấu hình PC"
 *  - Thông tin build (tên, ngày, share link nếu có)
 *  - Bảng 2 cột: linh kiện | số lượng | đơn giá | thành tiền
 *  - Tổng cộng
 *  - Ghi chú (nếu có)
 *
 * CSS @media print sẽ lo ẩn các nút; class `print:hidden` trên wrapper ngoài
 * (panel actions, sidebar, header) sẽ lo phần UI không cần thiết khi in.
 * Component render cả trên màn hình lẫn khi in để xem trước phiếu + chụp PDF.
 */

import Image from "next/image";
import { format } from "date-fns";
import { Cpu } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import {
  SLOT_LABEL,
  SLOT_ORDER,
  type BuildItem,
  type BuildState,
  type SlotKey,
} from "@/lib/pc-builder/types";
import { calculateTotal, countItems } from "@/lib/pc-builder/storage";

type Props = {
  build: BuildState;
  /** Tên cấu hình hiển thị (mặc định "Phiếu cấu hình PC"). */
  title?: string;
  /** Ghi chú in trên phiếu. */
  note?: string | null;
  /** Link chia sẻ (in trên phiếu để khách có thể mở lại). */
  shareUrl?: string | null;
};

function Row({
  item,
  index,
}: {
  item: BuildItem;
  index: number;
}) {
  return (
    <tr className="border-b border-slate-200 print:border-slate-300">
      <td className="py-1.5 pr-2 align-top text-[11px] tabular-nums text-slate-500 print:text-[10px]">
        {index + 1}
      </td>
      <td className="py-1.5 pr-2 align-top">
        <p className="text-xs font-medium text-slate-800 print:text-[11px]">
          {item.name}
        </p>
        <p className="text-[10px] text-slate-500">
          {item.brand ? `${item.brand} · ` : ""}
          SKU {item.productId.slice(0, 8)}
        </p>
      </td>
      <td className="py-1.5 pr-2 text-center align-top text-xs tabular-nums text-slate-700 print:text-[11px]">
        ×{item.qty}
      </td>
      <td className="py-1.5 pr-2 text-right align-top text-xs tabular-nums text-slate-700 print:text-[11px]">
        {formatCurrency(item.unitPrice)}
      </td>
      <td className="py-1.5 text-right align-top text-xs font-semibold tabular-nums text-slate-900 print:text-[11px]">
        {formatCurrency(item.unitPrice * item.qty)}
      </td>
    </tr>
  );
}

function buildFlatRows(build: BuildState): Array<{ slot: SlotKey; item: BuildItem }> {
  const rows: Array<{ slot: SlotKey; item: BuildItem }> = [];
  for (const slot of SLOT_ORDER) {
    const items = build[slot] ?? [];
    for (const item of items) {
      rows.push({ slot, item });
    }
  }
  return rows;
}

export function BuildReceipt({ build, title, note, shareUrl }: Props) {
  const rows = buildFlatRows(build);
  const total = calculateTotal(build);
  const itemCount = countItems(build);
  const date = format(new Date(), "dd/MM/yyyy HH:mm");

  return (
    <div
      id="pc-builder-receipt"
      className="block print:break-inside-avoid"
    >
      <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-sm print:max-w-full print:rounded-none print:border-0 print:shadow-none">
        {/* Header */}
        <header className="mb-4 flex items-start justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <p className="text-base font-bold">LapLap Cần Thơ</p>
              <p className="text-[11px] text-slate-500">lap-lap.com.vn</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Phiếu cấu hình PC
            </p>
            <p className="text-[11px] text-slate-500">{date}</p>
          </div>
        </header>

        <h1 className="mb-3 text-lg font-bold tracking-tight">
          {title ?? "Phiếu cấu hình PC"}
        </h1>

        {/* Empty state */}
        {rows.length === 0 ? (
          <p className="my-6 text-center text-xs text-slate-500">
            Chưa có linh kiện nào trong cấu hình.
          </p>
        ) : (
          <>
            {/* Bảng linh kiện */}
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-1.5 pr-2 text-left font-semibold">#</th>
                  <th className="py-1.5 pr-2 text-left font-semibold">
                    Linh kiện
                  </th>
                  <th className="py-1.5 pr-2 text-center font-semibold">SL</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">
                    Đơn giá
                  </th>
                  <th className="py-1.5 text-right font-semibold">
                    Thành tiền
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ slot, item }, idx) => (
                  <Row key={`${slot}-${item.productId}`} item={item} index={idx} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3 text-right text-xs font-semibold">
                    Tổng ({itemCount} món)
                  </td>
                  <td className="pt-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(total)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Ghi chú */}
            {note ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Ghi chú
                </p>
                <p className="mt-0.5 whitespace-pre-line text-xs text-slate-700">
                  {note}
                </p>
              </div>
            ) : null}

            {/* Chia sẻ */}
            {shareUrl ? (
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Link chia sẻ
                </p>
                <p className="mt-0.5 break-all text-[11px] font-mono text-slate-700">
                  {shareUrl}
                </p>
              </div>
            ) : null}
          </>
        )}

        <Separator className="my-4" />
        <p className="text-center text-[10px] text-slate-400">
          Phiếu được tạo bởi công cụ Xây dựng cấu hình PC của LapLap.
        </p>
      </div>
    </div>
  );
}

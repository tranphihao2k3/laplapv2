"use client";

/**
 * Phiếu cấu hình PC (in / PDF) — chế độ tham khảo, không in giá.
 */

import { format } from "date-fns";
import { Cpu } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  SLOT_LABEL,
  SLOT_ORDER,
  type BuildItem,
  type BuildState,
  type SlotKey,
} from "@/lib/pc-builder/types";
import { countItems } from "@/lib/pc-builder/storage";

type Props = {
  build: BuildState;
  title?: string;
  note?: string | null;
  shareUrl?: string | null;
};

function Row({ item, index, slot }: { item: BuildItem; index: number; slot: SlotKey }) {
  return (
    <tr className="border-b border-slate-200 print:border-slate-300">
      <td className="py-1.5 pr-2 align-top text-[11px] tabular-nums text-slate-500 print:text-[10px]">
        {index + 1}
      </td>
      <td className="py-1.5 pr-2 align-top text-[10px] text-slate-500 print:text-[10px]">
        {SLOT_LABEL[slot]}
      </td>
      <td className="py-1.5 pr-2 align-top">
        <p className="text-xs font-medium text-slate-800 print:text-[11px]">
          {item.name}
        </p>
        <p className="text-[10px] text-slate-500">
          {item.brand ? `${item.brand}` : ""}
        </p>
      </td>
      <td className="py-1.5 text-center align-top text-xs tabular-nums text-slate-700 print:text-[11px]">
        ×{item.qty}
      </td>
    </tr>
  );
}

function buildFlatRows(build: BuildState): Array<{ slot: SlotKey; item: BuildItem }> {
  const rows: Array<{ slot: SlotKey; item: BuildItem }> = [];
  for (const slot of SLOT_ORDER) {
    for (const item of build[slot] ?? []) {
      rows.push({ slot, item });
    }
  }
  return rows;
}

export function BuildReceipt({ build, title, note, shareUrl }: Props) {
  const rows = buildFlatRows(build);
  const itemCount = countItems(build);
  const date = format(new Date(), "dd/MM/yyyy HH:mm");

  return (
    <div id="pc-builder-receipt" className="block print:break-inside-avoid">
      <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-sm print:max-w-full print:rounded-none print:border-0 print:shadow-none">
        <header className="mb-4 flex items-start justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <p className="text-base font-bold">Laptop Thành Võ Cần Thơ</p>
              <p className="text-[11px] text-slate-500">Cấu hình tham khảo</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Phiếu cấu hình PC
            </p>
            <p className="text-[11px] text-slate-500">{date}</p>
          </div>
        </header>

        <h1 className="mb-1 text-lg font-bold tracking-tight">
          {title ?? "Phiếu cấu hình PC"}
        </h1>
        <p className="mb-3 text-[11px] text-amber-700">
          Chỉ tham khảo — giá lắp ráp do shop báo khi nhận cấu hình.
        </p>

        {rows.length === 0 ? (
          <p className="my-6 text-center text-xs text-slate-500">
            Chưa có linh kiện nào trong cấu hình.
          </p>
        ) : (
          <>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-1.5 pr-2 text-left font-semibold">#</th>
                  <th className="py-1.5 pr-2 text-left font-semibold">Loại</th>
                  <th className="py-1.5 pr-2 text-left font-semibold">Linh kiện</th>
                  <th className="py-1.5 text-center font-semibold">SL</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ slot, item }, idx) => (
                  <Row
                    key={`${slot}-${item.productId}`}
                    item={item}
                    index={idx}
                    slot={slot}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3 text-right text-xs font-semibold text-slate-700">
                    Tổng {itemCount} linh kiện (không kèm giá)
                  </td>
                </tr>
              </tfoot>
            </table>

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

            {shareUrl ? (
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Link chia sẻ
                </p>
                <p className="mt-0.5 break-all font-mono text-[11px] text-slate-700">
                  {shareUrl}
                </p>
              </div>
            ) : null}
          </>
        )}

        <Separator className="my-4" />
        <p className="text-center text-[10px] text-slate-400">
          Gửi phiếu này cho shop để nhận báo giá lắp ráp thực tế.
        </p>
      </div>
    </div>
  );
}

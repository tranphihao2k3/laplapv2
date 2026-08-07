"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { extraRowLabel } from "@/lib/compare/ranking";
import { METRIC_BY_ID } from "@/lib/compare/spec-registry";
import type { CompareResult, Row } from "@/lib/compare/types";
import { specIcon } from "@/components/client/compare/spec-icons";
import { DiffNote, RankBadge, RankBar } from "./rank-badge";

type Props = {
  result: CompareResult;
  /** Ẩn các hàng mà mọi máy đều giống nhau. */
  onlyDiff: boolean;
  onRemove: (id: string) => void;
};

/** Hàng có ít nhất 1 máy có dữ liệu — hàng trống hoàn toàn thì ẩn luôn. */
function hasAnyData(row: Row): boolean {
  return row.cells.some((c) => c.raw != null || c.value != null);
}

/** Mọi máy hiển thị giống hệt nhau → không phải "khác biệt". */
function isIdentical(row: Row): boolean {
  const first = row.cells[0]?.display ?? "";
  return row.cells.every((c) => c.display === first);
}

export function CompareTable({ result, onlyDiff, onRemove }: Props) {
  const { products } = result;

  const visibleRows = (rows: Row[]) =>
    rows.filter((r) => hasAnyData(r) && (!onlyDiff || !isIdentical(r)));

  const groups = result.groups
    .map((g) => ({ ...g, rows: visibleRows(g.rows) }))
    .filter((g) => g.rows.length > 0);
  const extras = visibleRows(result.extraRows);

  return (
    /*
      Scroll ngang trên mobile: 4 cột + cột nhãn không vừa màn 360px.
      border-separate (không phải border-collapse) vì collapse phá vỡ
      position:sticky của cột nhãn trên một số trình duyệt.
    */
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 top-0 z-20 w-[168px] min-w-[168px] border-b border-r border-slate-200 bg-slate-50 p-3 text-left align-bottom"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Thông số
              </span>
            </th>
            {products.map((p) => (
              <th
                key={p.id}
                scope="col"
                className="min-w-[170px] border-b border-slate-200 bg-white p-3 text-left align-top font-normal"
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    aria-label={`Bỏ ${p.name} khỏi bảng so sánh`}
                    className="absolute -right-1 -top-1 rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>

                  <Link href={`/products/${p.slug}`} className="group block">
                    <div className="relative mx-auto mb-2 h-20 w-full">
                      {p.image ? (
                        <Image
                          src={p.image}
                          alt={p.name}
                          fill
                          sizes="170px"
                          className="object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-200">
                          LapLap
                        </div>
                      )}
                    </div>
                    <p className="line-clamp-2 pr-4 text-[12px] font-medium leading-snug text-slate-800 group-hover:text-primary">
                      {p.name}
                    </p>
                  </Link>

                  <p className="mt-1 text-[13px] font-semibold text-slate-900">
                    {p.price > 0 ? formatCurrency(p.price) : "Liên hệ"}
                  </p>
                  {!p.inStock && (
                    <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      Hết hàng
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {groups.map((g) => (
            <GroupRows key={g.group} group={g.group} rows={g.rows} colCount={products.length} />
          ))}
          {extras.length > 0 && (
            <GroupRows
              group="Thông số khác"
              rows={extras}
              colCount={products.length}
              labelOf={(id) => extraRowLabel(id)}
            />
          )}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  group,
  rows,
  colCount,
  labelOf,
}: {
  group: string;
  rows: Row[];
  colCount: number;
  labelOf?: (metricId: string) => string;
}) {
  return (
    <>
      <tr>
        <th
          scope="colgroup"
          colSpan={colCount + 1}
          className="sticky left-0 z-10 border-b border-t border-slate-200 bg-slate-50/80 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
        >
          {group}
        </th>
      </tr>
      {rows.map((row, idx) => {
        const metric = METRIC_BY_ID.get(row.metricId);
        const Icon = specIcon(metric?.iconName);
        const label = labelOf ? labelOf(row.metricId) : metric?.label ?? row.metricId;
        const zebra = idx % 2 === 1;

        return (
          <tr key={row.metricId}>
            <th
              scope="row"
              className={cn(
                "sticky left-0 z-10 border-b border-r border-slate-200 p-3 text-left align-top",
                zebra ? "bg-slate-50/60" : "bg-white",
              )}
            >
              <span className="flex items-start gap-2 text-[12px] font-medium text-slate-600">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0">{label}</span>
              </span>
            </th>

            {row.cells.map((cell) => {
              const isBest = row.ranked && !row.allEqual && cell.rank === 1;
              return (
                <td
                  key={cell.productId}
                  className={cn(
                    "border-b border-slate-200 p-3 align-top",
                    zebra ? "bg-slate-50/40" : "bg-white",
                    isBest && "bg-amber-50/50",
                  )}
                >
                  <div className="space-y-1.5">
                    <p
                      className={cn(
                        "break-words text-[12px] leading-snug",
                        cell.display === "—"
                          ? "text-slate-300"
                          : isBest
                            ? "font-semibold text-slate-900"
                            : "text-slate-700",
                      )}
                      title={cell.raw ?? undefined}
                    >
                      {cell.display}
                    </p>

                    {row.ranked && cell.rank != null && (
                      <>
                        <RankBar cell={cell} />
                        <div className="flex flex-wrap items-center gap-1">
                          <RankBadge rank={cell.rank} allEqual={row.allEqual} />
                        </div>
                        <DiffNote cell={cell} allEqual={row.allEqual} />
                      </>
                    )}
                  </div>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

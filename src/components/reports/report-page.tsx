"use client";

import { ReactNode } from "react";
import { ExportButton } from "./export-button";
import { ReportFilterBar, type FilterField } from "./report-filter-bar";
import { ReportKpiRow, type KpiItem } from "./report-kpi-row";
import { ReportTable, type ReportTableConfig } from "./report-table";

type Props<T> = {
  title: string;
  description?: string;
  exportEndpoint: string;
  /** Field filter + value hiện tại + callback onChange */
  filterFields: FilterField[];
  filterValues: Record<string, string | number>;
  onFilterChange: (next: Record<string, string | number>) => void;
  /** Khi click Reset, set filter về đây (vd last 30 days). */
  filterResetValues?: Record<string, string | number>;
  /** Render thêm custom filter (vd ShopSelect) */
  filterExtra?: ReactNode;
  /** Tên file xuất Excel (fallback nếu server không set) */
  exportFilename: string;
  /** KPI cards */
  summary: KpiItem[];
  /** Charts — ReactNode (thường là 2-3 chart cards) */
  charts?: ReactNode;
  /** Bảng dữ liệu */
  table: ReportTableConfig<T>;
  /** Loading state */
  loading?: boolean;
};

export function ReportPage<T>({
  title,
  description,
  exportEndpoint,
  filterFields,
  filterValues,
  onFilterChange,
  filterResetValues,
  filterExtra,
  exportFilename,
  summary,
  charts,
  table,
  loading = false,
}: Props<T>) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && (
            <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
          )}
        </div>
        <ExportButton
          endpoint={exportEndpoint}
          params={filterValues}
          filename={exportFilename}
        />
      </div>

      {/* Filter bar */}
      <div className="rounded-lg border bg-card p-3 sm:p-4">
        <ReportFilterBar
          fields={filterFields}
          values={filterValues}
          onChange={onFilterChange}
          extra={filterExtra}
          resetValues={filterResetValues}
        />
      </div>

      {/* KPI row */}
      <ReportKpiRow items={summary} />

      {/* Charts */}
      {charts && <div className="grid gap-4 lg:grid-cols-2">{charts}</div>}

      {/* Table */}
      <ReportTable<T> {...table} loading={loading} />
    </div>
  );
}

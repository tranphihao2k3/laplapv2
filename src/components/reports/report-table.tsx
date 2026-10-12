"use client";

import { ReactNode, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Loader2 } from "lucide-react";

export type ReportTableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
  className?: string;
  render?: (row: T) => ReactNode;
};

export type ReportTableConfig<T> = {
  columns: ReportTableColumn<T>[];
  rows: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  loading?: boolean;
  emptyMessage?: string;
  searchable?: boolean;
  rowKey?: (row: T, idx: number) => string;
};

export function ReportTable<T>({
  columns,
  rows,
  total,
  page = 1,
  pageSize = 20,
  loading = false,
  emptyMessage = "Không có dữ liệu trong khoảng đã chọn",
  searchable = true,
  rowKey,
}: ReportTableConfig<T>) {
  const [search, setSearch] = useState("");
  const [internalPage, setInternalPage] = useState(page);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase().trim();
    return rows.filter((row) => {
      const obj = row as Record<string, unknown>;
      return columns.some((c) => {
        const v = obj[c.key];
        if (v == null) return false;
        return String(v).toLowerCase().includes(q);
      });
    });
  }, [rows, search, columns]);

  const totalRows = total ?? filtered.length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(internalPage, 1), totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  return (
    <Card>
      <CardContent className="p-0">
        {searchable && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setInternalPage(1);
                }}
                placeholder="Tìm trong bảng..."
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {filtered.length === rows.length
                ? `${rows.length.toLocaleString("vi-VN")} dòng`
                : `${filtered.length.toLocaleString("vi-VN")} / ${rows.length.toLocaleString("vi-VN")}`}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={c.className}
                    style={{
                      width: c.width,
                      textAlign: c.align ?? "left",
                    }}
                  >
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải dữ liệu...
                    </div>
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((row, i) => (
                  <TableRow
                    key={rowKey ? rowKey(row, i) : `${(row as Record<string, unknown>).id ?? i}`}
                  >
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={c.className}
                        style={{ textAlign: c.align ?? "left" }}
                      >
                        {c.render ? c.render(row) : (row as Record<string, unknown>)[c.key] as ReactNode}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filtered.length > pageSize && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t text-xs">
            <span className="text-muted-foreground tabular-nums">
              Trang <strong>{safePage}</strong>/<strong>{totalPages}</strong> · {filtered.length.toLocaleString("vi-VN")} dòng
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                disabled={safePage <= 1}
                onClick={() => setInternalPage(1)}
                aria-label="Trang đầu"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                disabled={safePage <= 1}
                onClick={() => setInternalPage((p) => Math.max(1, p - 1))}
                aria-label="Trang trước"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                disabled={safePage >= totalPages}
                onClick={() => setInternalPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Trang sau"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                disabled={safePage >= totalPages}
                onClick={() => setInternalPage(totalPages)}
                aria-label="Trang cuối"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

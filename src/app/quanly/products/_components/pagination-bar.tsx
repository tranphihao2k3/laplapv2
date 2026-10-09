"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  isFetching: boolean;
  onChange: (page: number) => void;
};

/**
 * Tính dãy trang cần hiển thị, rút gọn khi nhiều trang:
 *   [1] 2 3 … 20
 *   1 [2] 3 4 5 6 7 … 20
 *   1 2 3 … 18 19 [20]
 *   1 … 14 15 16 … 20
 * Khi tổng ≤ 7 trang → hiện tất cả.
 */
function buildPageWindow(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "…"> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) out.push("…");
  for (let i = left; i <= right; i++) out.push(i);
  if (right < total - 1) out.push("…");
  out.push(total);
  return out;
}

export function PaginationBar({ page, totalPages, total, pageSize, isFetching, onChange }: Props) {
  const [draft, setDraft] = useState<string>("");
  const window = useMemo(() => buildPageWindow(page, totalPages), [page, totalPages]);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function goToDraft() {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
      onChange(n);
      setDraft("");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {isFetching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        )}
        <span>
          Hiển thị <span className="font-semibold tabular-nums text-foreground">{start.toLocaleString("vi-VN")}</span>–
          <span className="font-semibold tabular-nums text-foreground">{end.toLocaleString("vi-VN")}</span> /{" "}
          <span className="font-semibold tabular-nums text-foreground">{total.toLocaleString("vi-VN")}</span> sản phẩm
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          disabled={page <= 1 || isFetching}
          onClick={() => onChange(1)}
          aria-label="Trang đầu"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 px-2"
          disabled={page <= 1 || isFetching}
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Trước</span>
        </Button>

        <div className="flex items-center gap-0.5">
          {window.map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                size="sm"
                variant={p === page ? "default" : "ghost"}
                className={cn(
                  "h-8 min-w-8 px-2 text-xs tabular-nums",
                  p === page && "shadow-sm",
                )}
                onClick={() => onChange(p)}
                disabled={isFetching}
              >
                {p}
              </Button>
            ),
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 px-2"
          disabled={page >= totalPages || isFetching}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
        >
          <span className="hidden sm:inline">Sau</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          disabled={page >= totalPages || isFetching}
          onClick={() => onChange(totalPages)}
          aria-label="Trang cuối"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>

        <div className="ml-1 hidden items-center gap-1.5 border-l pl-2 sm:flex">
          <span className="text-xs text-muted-foreground">Đến</span>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") goToDraft();
            }}
            className="h-8 w-14 px-2 text-center text-xs tabular-nums"
            placeholder={String(page)}
            inputMode="numeric"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={goToDraft}
            disabled={!draft}
          >
            Go
          </Button>
        </div>
      </div>
    </div>
  );
}

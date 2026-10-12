"use client";

/**
 * TopRankingsTable — shared rankings table used by:
 * - /test-laptop (landing, condensed: top 10 + "Xem tất cả" link)
 * - /test-laptop/ranking (full page: up to 50 + filter/sort/refresh)
 *
 * Props:
 *   - limit:        how many rows to fetch (default 10)
 *   - showFullControls: show filter input + sort dropdown + refresh button
 *                      (default false — landing only needs the table + link)
 *   - highlightId:  highlight the row matching this laptop_id (yellow ring)
 *                  — passed from URL ?highlight=<id> on landing page
 *
 * The row UI (medals, rank badge, hover state) is the same in both modes.
 */

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type RankingRow = {
  rank: number;
  laptop_id: string;
  device_name: string;
  cpu_name: string;
  cpu_cores: number;
  ram_gb: number;
  ram_type: string;
  gpu_name: string;
  gpu_vram_gb: number;
  gpu_score: number;
  gpu_rank: string;
  benchmark_tool: string | null;
  test_width: number | null;
  test_height: number | null;
  test_preset: string | null;
  test_duration_seconds: number | null;
  test_date: string | null;
};

type SortBy = "gpu_score" | "ram_gb" | "cpu_name";

const SORT_LABELS: Record<SortBy, string> = {
  gpu_score: "Điểm GPU",
  ram_gb: "Dung lượng RAM",
  cpu_name: "Tên CPU",
};

const RANK_TIERS = [
  { label: "Excellent", min: 8000, color: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  { label: "Good", min: 6000, color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  { label: "Fair", min: 4000, color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  { label: "Poor", min: 0, color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
];

function RankBadge({ rank }: { rank: string }) {
  const tier = RANK_TIERS.find((t) => t.label === rank) ?? RANK_TIERS[3];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        tier.color,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tier.dot)} />
      {rank}
    </span>
  );
}

function formatTest(row: RankingRow) {
  const resolution =
    row.test_width && row.test_height ? `${row.test_width}x${row.test_height}` : null;
  const duration = row.test_duration_seconds ? `${row.test_duration_seconds}s` : null;
  return [row.benchmark_tool || "FurMark", resolution || row.test_preset, duration]
    .filter(Boolean)
    .join(" • ");
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function TopRankingsTable({
  limit = 10,
  showFullControls = false,
  highlightId,
}: {
  limit?: number;
  showFullControls?: boolean;
  highlightId?: string | null;
}) {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("gpu_score");
  const [gpuFilter, setGpuFilter] = useState("");
  const [cpuFilter, setCpuFilter] = useState("");
  const [ramFilter, setRamFilter] = useState("");
  const [appliedGpuFilter, setAppliedGpuFilter] = useState("");
  const [appliedCpuFilter, setAppliedCpuFilter] = useState("");
  const [appliedRamFilter, setAppliedRamFilter] = useState("");

  // Debounce filter inputs (400ms) để tránh gọi API mỗi keystroke
  useEffect(() => {
    const t = setTimeout(() => setAppliedGpuFilter(gpuFilter.trim()), 400);
    return () => clearTimeout(t);
  }, [gpuFilter]);
  useEffect(() => {
    const t = setTimeout(() => setAppliedCpuFilter(cpuFilter.trim()), 400);
    return () => clearTimeout(t);
  }, [cpuFilter]);
  useEffect(() => {
    const t = setTimeout(() => setAppliedRamFilter(ramFilter.trim()), 400);
    return () => clearTimeout(t);
  }, [ramFilter]);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sort_by: sortBy, limit: String(limit) });
      if (appliedGpuFilter) params.set("gpu", appliedGpuFilter);
      if (appliedCpuFilter) params.set("cpu", appliedCpuFilter);
      if (appliedRamFilter) params.set("ram", appliedRamFilter);
      const res = await fetch(`/api/v1/laptops/ranking?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Không tải được bảng xếp hạng");
      setRows(json.data?.data || []);
      setTotal(json.data?.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đã xảy ra lỗi");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [sortBy, appliedGpuFilter, appliedCpuFilter, appliedRamFilter, limit]);

  useEffect(() => {
    void fetchRankings();
  }, [fetchRankings]);

  return (
    <div>
      {showFullControls && (
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Lọc theo tên GPU (vd: RTX 3050)..."
              value={gpuFilter}
              onChange={(e) => setGpuFilter(e.target.value)}
              className="sm:max-w-[200px]"
            />
            <Input
              placeholder="Lọc theo tên CPU (vd: Core i5)..."
              value={cpuFilter}
              onChange={(e) => setCpuFilter(e.target.value)}
              className="sm:max-w-[200px]"
            />
            <Input
              type="number"
              min={1}
              max={256}
              placeholder="RAM (GB)"
              value={ramFilter}
              onChange={(e) => setRamFilter(e.target.value)}
              className="sm:max-w-[120px]"
            />
            <button
              type="button"
              onClick={fetchRankings}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground"
              aria-label="Tải lại"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">Sắp xếp:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortBy[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(appliedGpuFilter || appliedCpuFilter || appliedRamFilter) && (
              <button
                type="button"
                onClick={() => {
                  setGpuFilter("");
                  setCpuFilter("");
                  setRamFilter("");
                }}
                className="text-xs text-violet-700 hover:text-violet-900 hover:underline"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Lỗi:</strong> {error}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50">
                <TableHead className="w-14 text-center">#</TableHead>
                <TableHead>Thiết bị</TableHead>
                <TableHead>GPU</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>RAM</TableHead>
                <TableHead>Bài test</TableHead>
                <TableHead className="text-right">Điểm GPU</TableHead>
                <TableHead className="text-center">Xếp loại</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                    <Trophy className="mx-auto mb-2 h-8 w-8 opacity-20" />
                    Chưa có dữ liệu benchmark nào.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const isHighlighted =
                    !!highlightId && row.laptop_id === highlightId;
                  return (
                    <TableRow
                      key={row.laptop_id}
                      className={cn(
                        row.rank <= 3 && "bg-amber-50/40",
                        isHighlighted &&
                          "ring-2 ring-amber-400 ring-inset bg-amber-50/60",
                      )}
                    >
                      <TableCell className="text-center font-semibold">
                        {row.rank <= 3 ? (
                          <span className="text-base">{MEDALS[row.rank - 1]}</span>
                        ) : (
                          <span className="text-zinc-500">{row.rank}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-zinc-900">
                        {row.device_name}
                      </TableCell>
                      <TableCell>
                        {row.gpu_name}
                        {row.gpu_vram_gb > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {row.gpu_vram_gb}GB
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.cpu_name}
                        {row.cpu_cores > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {row.cpu_cores} nhân
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.ram_gb > 0
                          ? `${row.ram_gb}GB${row.ram_type ? " " + row.ram_type : ""}`
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTest(row) || "FurMark"}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-zinc-900">
                        {row.gpu_score.toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-center">
                        <RankBadge rank={row.gpu_rank} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Hiển thị {rows.length} / {total} laptop</span>
          {!showFullControls && total > rows.length && (
            <Link
              href="/test-laptop/ranking"
              className="font-medium text-violet-700 hover:text-violet-900 hover:underline"
            >
              Xem tất cả →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

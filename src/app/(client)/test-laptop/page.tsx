"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Trophy, Zap, TrendingUp, Award } from "lucide-react";
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
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tier.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
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

export default function RankingTabPage() {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("gpu_score");
  const [gpuFilter, setGpuFilter] = useState("");
  const [appliedGpuFilter, setAppliedGpuFilter] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setAppliedGpuFilter(gpuFilter.trim()), 400);
    return () => clearTimeout(t);
  }, [gpuFilter]);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sort_by: sortBy, limit: "50" });
      if (appliedGpuFilter) params.set("gpu", appliedGpuFilter);
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
  }, [sortBy, appliedGpuFilter]);

  useEffect(() => {
    void fetchRankings();
  }, [fetchRankings]);

  // Top 1 stats
  const top1 = rows[0];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* Title */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
          <h2 className="text-lg font-bold text-zinc-900 sm:text-xl">Bảng xếp hạng GPU Benchmark</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          So sánh điểm benchmark GPU (FurMark) giữa các laptop đã test qua phần mềm Scanner.
        </p>
      </div>

      {/* Rank tier legend */}
      <div className="mb-5 flex flex-wrap gap-2">
        {RANK_TIERS.map((tier) => (
          <span
            key={tier.label}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${tier.color}`}
          >
            <span className={`h-2 w-2 rounded-full ${tier.dot}`} />
            {tier.label}
            <span className="opacity-60">
              {tier.label === "Excellent" ? "≥8000" :
               tier.label === "Good" ? "6000–7999" :
               tier.label === "Fair" ? "4000–5999" : "<4000"}
            </span>
          </span>
        ))}
      </div>

      {/* Stats bar */}
      {!loading && rows.length > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <Award className="h-4 w-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Top GPU</p>
              <p className="text-sm font-semibold text-zinc-900 truncate">{top1?.gpu_name ?? "—"}</p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <Zap className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Điểm cao nhất</p>
              <p className="text-sm font-semibold text-zinc-900">
                {top1?.gpu_score.toLocaleString("vi-VN") ?? "—"}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Tổng laptop</p>
              <p className="text-sm font-semibold text-zinc-900">{total}</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Lọc theo tên GPU (vd: RTX 3050)..."
          value={gpuFilter}
          onChange={(e) => setGpuFilter(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-muted-foreground">Sắp xếp:</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortBy[]).map((key) => (
                <SelectItem key={key} value={key}>{SORT_LABELS[key]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={fetchRankings}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground"
            aria-label="Tải lại"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
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
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
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
                rows.map((row) => (
                  <TableRow
                    key={row.laptop_id}
                    className={row.rank <= 3 ? "bg-amber-50/40" : undefined}
                  >
                    <TableCell className="text-center font-semibold">
                      {row.rank <= 3 ? (
                        <span className="text-base">{MEDALS[row.rank - 1]}</span>
                      ) : (
                        <span className="text-zinc-500">{row.rank}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-zinc-900">{row.device_name}</TableCell>
                    <TableCell>
                      {row.gpu_name}
                      {row.gpu_vram_gb > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">{row.gpu_vram_gb}GB</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.cpu_name}
                      {row.cpu_cores > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">{row.cpu_cores} nhân</span>
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <p className="mt-2 text-right text-xs text-muted-foreground">
          Hiển thị {rows.length} / {total} laptop
        </p>
      )}
    </div>
  );
}

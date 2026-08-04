"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, ShieldCheck, ShieldAlert, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToolInfo = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  sizeBytes: number;
  sizeLabel: string;
  sha256: string;
  exec: string;
  extract: boolean;
  launchArgs: string[];
  requiresAdmin: boolean;
  version: string | null;
  vendor: string | null;
  verifyMode: "verified" | "required" | "skip";
  launchEndpoint: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  diagnostic: "Chẩn đoán",
  stress: "Stress test",
  benchmark: "Benchmark",
  utility: "Tiện ích",
};

export default function ToolsPage() {
  const [tools, setTools] = useState<ToolInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/tools");
        const json = await res.json();
        const list = json?.data ?? json;
        if (!cancelled && Array.isArray(list)) setTools(list);
      } catch (e) {
        console.error("Failed to load tools", e);
        toast.error("Không tải được danh sách công cụ.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownload = async (tool: ToolInfo) => {
    if (downloading.has(tool.id)) return;
    setDownloading((prev) => new Set(prev).add(tool.id));
    try {
      // Mo URL download trong tab moi (browser se auto download).
      const url = `/api/v1/tools/download?toolId=${encodeURIComponent(tool.id)}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tool.id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Đã gửi yêu cầu tải ${tool.name}`, { duration: 3000 });
    } catch (e) {
      toast.error(`Lỗi: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setTimeout(() => {
        setDownloading((prev) => {
          const next = new Set(prev);
          next.delete(tool.id);
          return next;
        });
      }, 1500);
    }
  };

  // Group by category
  const grouped = (tools ?? []).reduce((acc, t) => {
    const cat = t.category || "utility";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {} as Record<string, ToolInfo[]>);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Hero header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block h-1 w-6 rounded-full bg-zinc-900" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
              Công cụ kiểm tra · server-hosted
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Tải công cụ kiểm tra
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Bộ phần mềm kiểm tra laptop phổ biến, lưu trữ trên R2 của LapLap.
            Sau khi quét xong, bạn có thể mở tool tự động từ trang kết quả scan.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div className="text-xs leading-tight">
            <p className="font-semibold text-emerald-700">Lưu trữ trên R2</p>
            <p className="text-emerald-600/80">SHA256 verified</p>
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && tools && tools.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <Wrench className="mx-auto mb-4 h-12 w-12 text-zinc-300" />
          <p className="text-sm text-zinc-500">
            Chưa có công cụ nào. Admin có thể thêm qua{" "}
            <a href="/quanly/tools" className="text-zinc-900 underline">
              /quanly/tools
            </a>
            .
          </p>
        </div>
      )}

      {/* Grouped list */}
      <div className="space-y-10">
        {Object.entries(grouped).map(([cat, items]) => (
          <section key={cat}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-bold tracking-tight text-zinc-900">
                {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                {items.length}
              </span>
              <span className="ml-auto hidden h-px flex-1 bg-zinc-100 sm:block" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((tool) => {
                const isDownloading = downloading.has(tool.id);
                return (
                  <div
                    key={tool.id}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md"
                  >
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-zinc-900 transition-transform duration-300 group-hover:scale-x-100" />

                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-2xl transition-transform group-hover:scale-110">
                        {tool.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-zinc-900">
                          {tool.name}
                        </h3>
                        <p className="text-xs text-zinc-500">
                          {tool.sizeLabel}
                          {tool.version && ` · v${tool.version}`}
                          {tool.vendor && ` · ${tool.vendor}`}
                        </p>
                      </div>
                      {tool.verifyMode === "verified" && (
                        <Badge
                          variant="outline"
                          className="border-green-300 px-1.5 py-0 text-[10px] text-green-700"
                        >
                          <ShieldCheck className="mr-0.5 h-3 w-3" />
                          Verified
                        </Badge>
                      )}
                      {tool.verifyMode === "required" && (
                        <Badge
                          variant="outline"
                          className="border-amber-300 px-1.5 py-0 text-[10px] text-amber-700"
                        >
                          <ShieldAlert className="mr-0.5 h-3 w-3" />
                          Unverified
                        </Badge>
                      )}
                    </div>

                    <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-zinc-500">
                      {tool.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                      <Button
                        size="sm"
                        onClick={() => handleDownload(tool)}
                        disabled={isDownloading}
                        className="flex-1"
                      >
                        {isDownloading ? (
                          <>
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Đang tải...
                          </>
                        ) : (
                          <>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Tải {tool.sizeLabel}
                          </>
                        )}
                      </Button>
                      <a
                        href={`/test-laptop/system-scan?tool=${tool.id}`}
                        className="text-xs text-zinc-400 hover:text-zinc-700"
                        title="Quét máy trước rồi mở"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Note */}
      <div className="mt-10 flex items-start gap-3 rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <Wrench className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">Cách dùng tối ưu</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            Để tự động mở tool sau khi scan xong, chạy <strong>quét máy</strong> trên trang
            System Scan. Sau khi có kết quả, tool sẽ hiện trong panel "Công cụ kiểm tra thêm";
            nhấn 1 nút là scanner PS1 tự tải R2, extract và chạy.
          </p>
        </div>
      </div>
    </div>
  );
}

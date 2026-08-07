"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import type { CompareItem } from "@/stores/compare-store";

type SearchResult = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  price: number;
};

/** Ô trống "+ Thêm máy" — mở dialog tìm kiếm sản phẩm. */
export function ComparePicker({
  selectedIds,
  onPick,
  className,
}: {
  selectedIds: string[];
  onPick: (item: CompareItem) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  // Chờ người dùng ngừng gõ 300ms mới gọi API.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ["compare-picker", debounced],
    queryFn: async (): Promise<SearchResult[]> => {
      const params = new URLSearchParams({ limit: "12" });
      if (debounced) params.set("q", debounced);
      const res = await fetch(`/api/public/products?${params}`);
      if (!res.ok) throw new Error("Không tải được danh sách sản phẩm");
      const json = (await res.json()) as { items: SearchResult[] };
      return json.items ?? [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const items = (data ?? []).filter((p) => !selectedIds.includes(p.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-xl",
            "border-2 border-dashed border-slate-200 text-slate-400 transition-colors",
            "hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
            className,
          )}
        >
          <Plus className="h-6 w-6" />
          <span className="text-xs font-medium">Thêm máy</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Chọn máy để so sánh</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Tìm theo tên máy..."
            className="pl-9"
          />
        </div>

        <div className="max-h-[340px] space-y-1 overflow-y-auto">
          {isFetching && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải...
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {debounced ? "Không tìm thấy máy phù hợp." : "Chưa có sản phẩm nào."}
            </p>
          ) : (
            items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPick({
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    image: p.image ?? null,
                    price: p.price,
                  });
                  setOpen(false);
                  setTerm("");
                }}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-50"
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded bg-slate-50">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      sizes="44px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] font-semibold text-slate-300">
                      LapLap
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">{p.name}</p>
                  <p className="text-[12px] text-slate-500">
                    {p.price > 0 ? formatCurrency(p.price) : "Liên hệ"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

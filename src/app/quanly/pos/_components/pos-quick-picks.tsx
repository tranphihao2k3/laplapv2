"use client";

import Image from "next/image";
import { Loader2, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";
import { cn } from "@/lib/utils";
import { formatVND } from "./types";
import type { PosSearchGroup, PosSearchHit } from "./product-search";

type Props = {
  shopId: string;
  onPick: (hit: PosSearchHit) => void;
  /** Số SP gợi ý (mặc định 16). */
  limit?: number;
};

/**
 * Dải SP mới nhất trên POS desktop — cuộn ngang, không chiếm chỗ giỏ hàng.
 * Click card → thêm biến thể còn hàng / rẻ nhất vào hoá đơn.
 */
export function PosQuickPicks({ shopId, onPick, limit = 16 }: Props) {
  const q = useQuery({
    queryKey: ["pos-quick-picks", shopId, limit],
    enabled: !!shopId,
    queryFn: () =>
      httpGet<{ groups?: PosSearchGroup[]; items?: PosSearchHit[] }>(
        "/v1/pos/search",
        { shop_id: shopId || undefined, limit },
      ),
    staleTime: 60 * 1000,
  });

  const groups = q.data?.groups ?? [];

  if (!shopId) return null;

  return (
    <div className="hidden min-w-0 rounded-xl border bg-card shadow-sm lg:block">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Sản phẩm mới nhất
          <span className="font-normal">· bấm để thêm nhanh</span>
        </div>
        {q.isFetching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      <div className="flex gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:thin]">
        {q.isLoading && groups.length === 0 ? (
          <p className="py-4 text-xs text-muted-foreground">Đang tải…</p>
        ) : groups.length === 0 ? (
          <p className="py-4 text-xs text-muted-foreground">
            Chưa có sản phẩm active.
          </p>
        ) : (
          groups.map((g) => {
            const withStock = g.variants.filter((v) => v.stock > 0);
            const hit = (withStock.length ? withStock : g.variants)[0];
            if (!hit) return null;
            const out = g.total_stock <= 0;
            return (
              <button
                key={g.product_id ?? hit.variant_id}
                type="button"
                disabled={out}
                onClick={() => onPick(hit)}
                title={g.product_name ?? hit.display_name}
                className={cn(
                  "flex w-[132px] shrink-0 flex-col overflow-hidden rounded-lg border bg-background text-left transition-colors",
                  out
                    ? "cursor-not-allowed opacity-50"
                    : "hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <div className="relative aspect-[4/3] w-full bg-muted/40">
                  {g.thumbnail_url ? (
                    <Image
                      src={g.thumbnail_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="132px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                      No img
                    </div>
                  )}
                  {g.variant_count > 1 ? (
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[9px] text-white">
                      {g.variant_count} bản
                    </span>
                  ) : null}
                </div>
                <div className="space-y-0.5 p-1.5">
                  <p className="line-clamp-2 text-[11px] font-medium leading-tight">
                    {g.product_name ?? hit.display_name}
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-primary">
                    {formatVND(
                      g.min_price > 0 && g.max_price > g.min_price
                        ? g.min_price
                        : hit.selling_price,
                    )}
                    {g.max_price > g.min_price && g.min_price > 0 ? "+" : ""}
                  </p>
                  <p
                    className={cn(
                      "text-[10px]",
                      out ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {out ? "Hết hàng" : `Tồn ${g.total_stock}`}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * Trang view công khai của 1 cấu hình qua share_slug.
 *
 * - Nếu build.is_public = false → hiển thị "Không tìm thấy cấu hình".
 * - Render build-summary (readonly) + build-receipt (in được).
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  Loader2,
  PackageX,
  Printer,
  Share2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { fetchBuildByShareSlug, loadBuildAsState } from "@/lib/pc-builder/api";
import { calculateTotal, countItems } from "@/lib/pc-builder/storage";
import { checkCompatibility } from "@/lib/pc-builder/compatibility";
import { CompatibilityBanner } from "@/components/client/pc-builder/compatibility-banner";
import { BuildReceipt } from "@/components/client/pc-builder/build-receipt";
import {
  SLOT_LABEL,
  SLOT_ORDER,
  type BuildItem,
  type BuildState,
  type CompatibilityIssue,
  type SlotKey,
} from "@/lib/pc-builder/types";

type Props = {
  params: Promise<{ slug: string }>;
};

export default function PublicBuildPage({ params }: Props) {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((p) => {
      if (!cancelled) setSlug(p.slug);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pc-builder", "public", slug],
    queryFn: async () => {
      if (!slug) return null;
      const saved = await fetchBuildByShareSlug(slug);
      if (!saved) return null;
      const loaded = await loadBuildAsState(saved);
      return {
        name: loaded.name,
        note: loaded.note,
        state: loaded.state,
        updatedAt: saved.build.updated_at,
      };
    },
    enabled: !!slug,
    staleTime: 60_000,
  });

  if (isLoading || !slug) {
    return (
      <div className="container py-16 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải cấu hình...
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container py-16">
        <Card className="mx-auto max-w-md border-slate-200 bg-white">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <PackageX className="h-12 w-12 text-slate-300" />
            <h1 className="text-lg font-bold text-slate-900">
              Không tìm thấy cấu hình
            </h1>
            <p className="max-w-sm text-sm text-slate-500">
              Link chia sẻ có thể đã hết hạn hoặc chủ sở hữu đã tắt chia sẻ công khai.
            </p>
            <Button asChild className="mt-2 rounded-lg">
              <Link href="/pc-builder">
                <Wrench className="h-4 w-4" />
                Tự dựng cấu hình
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const state = data.state;
  const total = calculateTotal(state);
  const itemCount = countItems(state);
  const issues: CompatibilityIssue[] = checkCompatibility(state, {});
  const dateLabel = data.updatedAt
    ? format(new Date(data.updatedAt), "dd/MM/yyyy HH:mm")
    : "";

  const shareUrl =
    typeof window !== "undefined" ? window.location.href : null;

  const handleShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Đã copy link chia sẻ");
    } catch {
      toast.info("Link chia sẻ", { description: shareUrl });
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="container py-6 lg:py-8">
      <div
        data-pc-builder-no-print
        className="mb-6 flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 rounded-lg"
          >
            <Link href="/pc-builder">
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </Link>
          </Button>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              Chia sẻ công khai
            </Badge>
            {dateLabel ? (
              <span className="text-[11px] text-slate-500">
                Cập nhật: {dateLabel}
              </span>
            ) : null}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {data.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
            Sao chép link
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            In
          </Button>
          <Button asChild size="sm" className="rounded-lg">
            <Link href="/pc-builder">
              <Bookmark className="h-4 w-4" />
              Lưu bản của tôi
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div
            data-pc-builder-no-print
            className="mb-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <CompatibilityBanner issues={issues} />
          </div>

          {itemCount === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-12 text-center">
              <p className="text-sm text-slate-500">
                Cấu hình này chưa có linh kiện nào.
              </p>
            </div>
          ) : (
            <div
              data-pc-builder-no-print
              className="space-y-2.5"
            >
              {SLOT_ORDER.filter((s) => (state[s]?.length ?? 0) > 0).map(
                (slot) => (
                  <PublicSlotBlock
                    key={slot}
                    slot={slot}
                    items={state[slot] ?? []}
                  />
                ),
              )}
            </div>
          )}

          {data.note ? (
            <div
              data-pc-builder-no-print
              className="mt-4 rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Ghi chú
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {data.note}
              </p>
            </div>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div
            data-pc-builder-no-print
            className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-white p-4"
          >
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              Tổng tiền
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(total)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {itemCount} linh kiện
            </p>
            <Separator className="my-3" />
            <Button asChild className="w-full rounded-lg">
              <Link href="/pc-builder">
                <Wrench className="h-4 w-4" />
                Dựng cấu hình tương tự
              </Link>
            </Button>
          </div>
        </aside>
      </div>

      <BuildReceipt build={state} title={data.name} note={data.note} shareUrl={shareUrl} />
    </div>
  );
}

function PublicSlotBlock({
  slot,
  items,
}: {
  slot: SlotKey;
  items: BuildItem[];
}) {
  const total = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <p className="text-sm font-semibold text-slate-800">
          {SLOT_LABEL[slot]}
        </p>
        <span className="text-[11px] text-slate-500">
          {items.length} món · {formatCurrency(total)}
        </span>
      </header>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li
            key={item.productId}
            className="flex items-center justify-between gap-2 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium text-slate-800">
                {item.name}
              </p>
              {item.brand ? (
                <p className="text-[11px] text-slate-500">{item.brand}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-slate-900">
                {formatCurrency(item.unitPrice * item.qty)}
              </p>
              {item.qty > 1 ? (
                <p className="text-[10px] text-slate-500">
                  ×{item.qty} · {formatCurrency(item.unitPrice)}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

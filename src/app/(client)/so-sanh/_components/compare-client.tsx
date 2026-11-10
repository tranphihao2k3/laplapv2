"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { GitCompareArrows, PackageX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MAX_COMPARE } from "@/lib/compare/fetch-products";
import type { ProductForCompare } from "@/lib/compare/types";
import { useCompareStore } from "@/stores/compare-store";
import { CompareTable } from "./compare-table";
import { ComparePicker } from "./compare-picker";

export function CompareClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setItems = useCompareStore((s) => s.setItems);

  const idsParam = searchParams.get("ids") ?? "";
  const ids = useMemo(
    () => idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_COMPARE),
    [idsParam],
  );

  const [onlyDiff, setOnlyDiff] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["compare", ids],
    queryFn: async (): Promise<ProductForCompare[]> => {
      const res = await fetch(`/api/public/products/compare?ids=${ids.join(",")}`);
      if (!res.ok) throw new Error("Không tải được dữ liệu so sánh");
      const json = (await res.json()) as { items: ProductForCompare[] };
      return json.items ?? [];
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  });

  const products = useMemo(() => data ?? [], [data]);

  const syncedRef = useRef("");
  useEffect(() => {
    if (isLoading || products.length === 0) return;
    const key = products.map((p) => p.id).join(",");
    if (syncedRef.current === key) return;
    syncedRef.current = key;
    setItems(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        image: p.image,
        price: p.price,
      })),
    );
  }, [products, isLoading, setItems]);

  const pushIds = useCallback(
    (next: string[]) => {
      router.replace(next.length > 0 ? `/so-sanh?ids=${next.join(",")}` : "/so-sanh", {
        scroll: false,
      });
    },
    [router],
  );

  const handleRemove = useCallback(
    (id: string) => {
      const next = ids.filter((x) => x !== id);
      useCompareStore.getState().remove(id);
      syncedRef.current = next.join(",");
      pushIds(next);
    },
    [ids, pushIds],
  );

  const handleClear = useCallback(() => {
    useCompareStore.getState().clear();
    syncedRef.current = "";
    pushIds([]);
  }, [pushIds]);

  if (ids.length === 0) {
    return <EmptyState />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[460px] w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 text-center">
        <PackageX className="h-10 w-10 text-slate-400" />
        <p className="text-sm text-slate-600">Không tải được dữ liệu so sánh.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Thử lại
        </Button>
      </div>
    );
  }

  if (products.length === 0) {
    return <EmptyState note="Sản phẩm trong đường dẫn không còn tồn tại hoặc đã ngừng bán." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">
            Đang so sánh <span className="font-semibold">{products.length}</span> sản phẩm
          </p>
          <p className="text-xs text-slate-500">
            {products.length < MAX_COMPARE
              ? `Có thể thêm tối đa ${MAX_COMPARE - products.length} sản phẩm nữa.`
              : `Đã đạt tối đa ${MAX_COMPARE} sản phẩm.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {products.length >= 2 && (
            <div className="flex items-center gap-2">
              <Switch id="only-diff" checked={onlyDiff} onCheckedChange={setOnlyDiff} />
              <Label htmlFor="only-diff" className="cursor-pointer text-xs text-slate-600">
                Chỉ hiện thông số khác nhau
              </Label>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-slate-500">
            <Trash2 className="mr-1.5 h-4 w-4" />
            Xoá hết
          </Button>
        </div>
      </div>

      {products.length < 2 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-base font-semibold text-slate-900">{products[0].name}</p>
            <p className="mt-1 text-sm text-slate-500">
              Chọn thêm ít nhất 1 sản phẩm nữa để bắt đầu so sánh.
            </p>
          </div>
          <ComparePicker
            selectedIds={ids}
            onPick={(item) => {
              const next = [...ids, item.id];
              syncedRef.current = next.join(",");
              pushIds(next);
            }}
          />
        </div>
      ) : (
        <>
          <CompareTable products={products} onlyDiff={onlyDiff} onRemove={handleRemove} />

          {products.length < MAX_COMPARE && (
            <div className="max-w-sm">
              <ComparePicker
                selectedIds={ids}
                onPick={(item) => {
                  const next = [...ids, item.id];
                  syncedRef.current = next.join(",");
                  pushIds(next);
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ note }: { note?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center sm:py-20">
      <GitCompareArrows className="h-10 w-10 text-slate-300" />
      <p className="text-base font-medium text-slate-800">Chưa có sản phẩm để so sánh</p>
      <p className="max-w-md px-4 text-sm text-slate-500">
        {note ?? `Chọn sản phẩm bằng nút "So sánh" trên danh sách hoặc trang sản phẩm (tối đa ${MAX_COMPARE} sản phẩm).`}
      </p>
      <Button asChild className="mt-1">
        <Link href="/products">Xem sản phẩm</Link>
      </Button>
    </div>
  );
}

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
import { buildCompareResult } from "@/lib/compare/ranking";
import type { ProductForCompare } from "@/lib/compare/types";
import { useCompareStore } from "@/stores/compare-store";
import { CompareTable } from "./compare-table";
import { ComparePicker } from "./compare-picker";

export function CompareClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setItems = useCompareStore((s) => s.setItems);

  /**
   * URL là NGUỒN SỰ THẬT của trang này (để share link được).
   * Store chỉ đồng bộ 1 chiều store→URL khi user thêm/bớt, và URL→store đúng
   * MỘT LẦN lúc mount. Không làm 2 chiều liên tục vì sẽ tạo vòng lặp vô hạn.
   */
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

  // Đồng bộ store theo dữ liệu đã tải: id rác trong URL tự động biến mất khỏi
  // thanh nổi. Chỉ chạy khi danh sách thật sự đổi để không set liên tục.
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

  const result = useMemo(
    () => (products.length >= 2 ? buildCompareResult(products, null) : null),
    [products],
  );

  // --- Các trạng thái rỗng ---
  if (ids.length === 0) {
    return <EmptyState />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[420px] w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
        <PackageX className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Đã xảy ra lỗi khi tải dữ liệu so sánh.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Thử lại
        </Button>
      </div>
    );
  }

  if (products.length === 0) {
    return <EmptyState note="Các sản phẩm trong đường dẫn không còn tồn tại hoặc đã ngừng bán." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">
            Đang so sánh <span className="font-semibold text-slate-900">{products.length}</span> máy
          </p>
          {products.length < MAX_COMPARE && (
            <span className="text-xs text-slate-400">
              (thêm được {MAX_COMPARE - products.length} máy nữa)
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {result && (
            <div className="flex items-center gap-2">
              <Switch id="only-diff" checked={onlyDiff} onCheckedChange={setOnlyDiff} />
              <Label htmlFor="only-diff" className="cursor-pointer text-xs text-slate-600">
                Chỉ hiện khác biệt
              </Label>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-slate-500">
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Xoá hết
          </Button>
        </div>
      </div>

      {products.length < 2 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-800">{products[0].name}</p>
            <p className="mt-1 text-xs text-slate-500">
              Cần ít nhất 2 máy mới so sánh được. Chọn thêm một máy nữa.
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
          {result && <CompareTable result={result} onlyDiff={onlyDiff} onRemove={handleRemove} />}

          {products.length < MAX_COMPARE && (
            <div className="max-w-[220px]">
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
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-20 text-center">
      <GitCompareArrows className="h-10 w-10 text-slate-300" />
      <p className="font-medium text-slate-700">Chưa chọn máy nào để so sánh</p>
      <p className="max-w-sm text-sm text-slate-500">
        {note ?? `Vào trang sản phẩm và bấm nút "So sánh" trên máy bạn quan tâm (tối đa ${MAX_COMPARE} máy).`}
      </p>
      <Button asChild className="mt-1">
        <Link href="/products">Xem danh sách sản phẩm</Link>
      </Button>
    </div>
  );
}

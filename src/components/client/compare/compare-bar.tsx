"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, GitCompareArrows, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { MAX_COMPARE } from "@/lib/compare/fetch-products";
import { useCompareStore } from "@/stores/compare-store";
import { useCompareHydrated } from "./use-compare-hydrated";

/**
 * Thanh nổi cố định đáy màn hình, hiện khi đã chọn >= 1 máy để so sánh.
 *
 * Đặt ở layout client nên xuất hiện trên mọi trang public. Tự ẩn ở /so-sanh
 * (trang đó đã có UI quản lý danh sách riêng, hiện thêm thanh này là dư).
 */
export function CompareBar() {
  const hydrated = useCompareHydrated();
  const items = useCompareStore((s) => s.items);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);
  const pathname = usePathname();

  // Chờ đọc localStorage xong mới render (chống hydration mismatch).
  if (!hydrated) return null;
  if (items.length === 0) return null;
  if (pathname === "/so-sanh") return null;

  const href = `/so-sanh?ids=${items.map((i) => i.id).join(",")}`;
  const emptySlots = Math.max(0, MAX_COMPARE - items.length);

  return (
    <>
      {/*
        Spacer: đẩy nội dung trang lên để thanh nổi không che footer.
        Chiều cao phải khớp với thanh bên dưới.
      */}
      <div aria-hidden className="h-[104px] sm:h-[92px]" />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.25)] backdrop-blur">
        <div className="container flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
          {/* Nhãn + danh sách máy đã chọn */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="hidden shrink-0 items-center gap-2 text-sm font-medium text-slate-700 sm:flex">
              <GitCompareArrows className="h-4 w-4 text-primary" />
              <span>
                So sánh{" "}
                <span className="text-slate-400">
                  ({items.length}/{MAX_COMPARE})
                </span>
              </span>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group/chip relative flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 py-1.5 pl-1.5 pr-7"
                  title={item.name}
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-white">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="36px"
                        className="object-contain p-0.5"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[9px] font-semibold text-slate-300">
                        LapLap
                      </div>
                    )}
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <p className="max-w-[140px] truncate text-[11px] font-medium leading-tight text-slate-700">
                      {item.name}
                    </p>
                    <p className="text-[10px] leading-tight text-slate-500">
                      {item.price > 0 ? formatCurrency(item.price) : "Liên hệ"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label={`Bỏ ${item.name} khỏi danh sách so sánh`}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Ô trống nhắc còn chỗ để thêm máy */}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <Link
                  key={`slot-${i}`}
                  href="/products"
                  title="Chọn thêm máy để so sánh"
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                    "border border-dashed border-slate-300 text-slate-300 transition-colors",
                    "hover:border-primary/40 hover:text-primary",
                  )}
                >
                  <Plus className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>

          {/* Hành động */}
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              className="text-slate-500 hover:text-slate-900"
            >
              Xoá hết
            </Button>
            {/* Cần ít nhất 2 máy mới so sánh được → khi chỉ có 1 thì nhắc, không cho bấm. */}
            {items.length < 2 ? (
              <Button size="sm" disabled>
                Chọn thêm 1 máy
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href={href}>
                  So sánh ({items.length})
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

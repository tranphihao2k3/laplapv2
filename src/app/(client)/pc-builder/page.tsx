"use client";

/**
 * Trang PC Builder chính.
 *
 * Layout 2 cột (md+):
 *  - Trái: CategoryRail (1/5) — chọn slot.
 *  - Phải: BuildSummary (4/5) + SaveShareBar + SampleBuilds + BuildReceipt.
 *
 * State:
 *  - BuildState lưu localStorage (loadGuestBuild / saveGuestBuild).
 *  - Mỗi lần thay đổi → saveGuestBuild.
 *  - CompatibilityIssue tính lại qua useMemo mỗi khi build/specs đổi.
 *  - Specs cache trong 1 Map (key = productId) sau khi fetch từ picker.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Wrench,
  ArrowRight,
  Bookmark,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryRail } from "@/components/client/pc-builder/category-rail";
import { ComponentPicker } from "@/components/client/pc-builder/component-picker";
import { BuildSummary } from "@/components/client/pc-builder/build-summary";
import { SaveShareBar } from "@/components/client/pc-builder/save-share-bar";
import { BuildReceipt } from "@/components/client/pc-builder/build-receipt";
import { GuestMigratePrompt } from "@/components/client/pc-builder/guest-migrate-prompt";
import {
  loadGuestBuild,
  saveGuestBuild,
} from "@/lib/pc-builder/storage";
import { checkCompatibility } from "@/lib/pc-builder/compatibility";
import { fetchComponents } from "@/lib/pc-builder/api";
import {
  SAMPLE_BUILDS,
  type SampleBuild,
} from "@/lib/pc-builder/seed";
import type {
  BuildItem,
  BuildState,
  ComponentSpecSummary,
  SlotKey,
} from "@/lib/pc-builder/types";

export default function PcBuilderPage() {
  const router = useRouter();
  const [build, setBuild] = useState<BuildState>({});
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [specs, setSpecs] = useState<Record<string, ComponentSpecSummary>>({});
  const [buildId, setBuildId] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate build từ localStorage (chỉ chạy trên client).
  useEffect(() => {
    const loaded = loadGuestBuild();
    setBuild(loaded);
    setHydrated(true);
  }, []);

  // Mỗi khi build đổi → lưu localStorage (chỉ khi đã hydrate).
  useEffect(() => {
    if (!hydrated) return;
    saveGuestBuild(build);
  }, [build, hydrated]);

  // Tính issue tương thích.
  const issues = useMemo(
    () => checkCompatibility(build, specs),
    [build, specs],
  );

  /** Mở picker cho slot, đồng thời load specs cho mọi linh kiện hiện có trong build. */
  const openSlot = useCallback(async (slot: SlotKey) => {
    setActiveSlot(slot);
    setPickerOpen(true);
    // Lazy-load specs cho slot này để check tương thích ngay khi user chọn xong.
    try {
      const items = await fetchComponents(slot);
      setSpecs((prev) => {
        const next = { ...prev };
        for (const it of items) {
          next[it.product.id] = it.spec;
        }
        return next;
      });
    } catch {
      /* ignore — vẫn mở picker */
    }
  }, []);

  /** Thêm 1 item vào slot (thay thế nếu slot đó đã có cùng category). */
  const handleSelectItem = useCallback(
    (item: BuildItem) => {
      setBuild((prev) => {
        const slot = item.categorySlug;
        const existing = prev[slot] ?? [];
        // Với slot chỉ nên có 1 linh kiện duy nhất (cpu, mainboard, gpu, case, psu, cooler, monitor):
        // thay thế hoàn toàn. Với các slot cho phép nhiều (ram, ssd, hdd, keyboard, mouse, headset):
        // thêm vào nếu chưa có.
        const singleSlots: SlotKey[] = [
          "cpu",
          "mainboard",
          "gpu",
          "case",
          "psu",
          "cooler",
          "monitor",
        ];
        const next: BuildState = { ...prev };
        if (singleSlots.includes(slot)) {
          next[slot] = [item];
        } else {
          const withoutSame = existing.filter(
            (it) => it.productId !== item.productId,
          );
          next[slot] = [...withoutSame, item];
        }
        return next;
      });
      // Lưu spec của item vừa chọn vào cache.
      // (Picker đã fetch spec cho slot; ta chỉ cần lấy spec mới nhất.)
      fetchComponents(item.categorySlug)
        .then((items) => {
          const found = items.find((x) => x.product.id === item.productId);
          if (found) {
            setSpecs((prev) => ({ ...prev, [item.productId]: found.spec }));
          }
        })
        .catch(() => {
          /* ignore */
        });
    },
    [],
  );

  const handleRemoveItem = useCallback(
    (slot: SlotKey, productId: string) => {
      setBuild((prev) => {
        const existing = prev[slot] ?? [];
        const filtered = existing.filter((it) => it.productId !== productId);
        const next: BuildState = { ...prev };
        if (filtered.length === 0) {
          delete next[slot];
        } else {
          next[slot] = filtered;
        }
        return next;
      });
    },
    [],
  );

  const handleUpdateQty = useCallback(
    (slot: SlotKey, productId: string, qty: number) => {
      setBuild((prev) => {
        const existing = prev[slot] ?? [];
        const next: BuildState = { ...prev };
        next[slot] = existing.map((it) =>
          it.productId === productId ? { ...it, qty: Math.max(1, qty) } : it,
        );
        return next;
      });
    },
    [],
  );

  const handleClearAll = () => {
    if (!window.confirm("Xoá toàn bộ linh kiện trong cấu hình?")) return;
    setBuild({});
    setBuildId(null);
    setShareSlug(null);
  };

  const handleApplySample = (sample: SampleBuild) => {
    // Mở picker cho slot đầu tiên của sample. User tự chọn sản phẩm thật.
    // Ở đây ta chỉ "khởi tạo slot active" và focus vào slot đầu — không gán item giả.
    if (sample.slots.length === 0) return;
    const first = sample.slots[0];
    openSlot(first.slot);
  };

  const currentPickerItems: BuildItem[] = useMemo(() => {
    if (!activeSlot) return [];
    return build[activeSlot] ?? [];
  }, [activeSlot, build]);

  const shareUrl =
    typeof window !== "undefined" && shareSlug
      ? `${window.location.origin}/pc-builder/${shareSlug}`
      : null;

  return (
    <div className="container py-6 lg:py-8">
      {/* Hero header */}
      <div
        data-pc-builder-no-print
        className="mb-6 flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Wrench className="h-3 w-3" />
            PC Builder
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Xây dựng cấu hình PC của bạn
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Chọn từng linh kiện theo nhu cầu — hệ thống tự kiểm tra tương thích
            socket, RAM, nguồn… và báo giá tức thì.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push("/pc-builder/saved")}
            className="rounded-lg"
          >
            <Bookmark className="h-4 w-4" />
            Cấu hình đã lưu
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={Object.keys(build).length === 0}
            className="rounded-lg"
          >
            <Trash2 className="h-4 w-4" />
            Xoá hết
          </Button>
        </div>
      </div>

      {/* Sample builds (chỉ hiện khi build rỗng) */}
      {Object.keys(build).length === 0 ? (
        <section
          data-pc-builder-no-print
          className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SAMPLE_BUILDS.map((sample) => (
            <Card
              key={sample.id}
              className={cn(
                "group cursor-pointer border-slate-200 bg-white transition-all",
                "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
              )}
              onClick={() => handleApplySample(sample)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Mẫu gợi ý
                  </span>
                </div>
                <CardTitle className="text-base">{sample.name}</CardTitle>
                <CardDescription className="text-xs">
                  {sample.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-slate-500">
                  Khoảng giá dự kiến:{" "}
                  <span className="font-semibold text-slate-700">
                    {sample.estimatedBudget.toLocaleString("vi-VN")} đ
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {sample.slots.length} linh kiện
                </p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:underline">
                  Bắt đầu từ mẫu này
                  <ArrowRight className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {/* Main 2-column */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div data-pc-builder-no-print className="lg:col-span-1">
          <CategoryRail
            build={build}
            issues={issues}
            activeSlot={activeSlot}
            onSelect={openSlot}
          />
        </div>

        <div className="space-y-4 lg:col-span-4">
          <div data-pc-builder-no-print>
            <BuildSummary
              build={build}
              issues={issues}
              onAddSlot={openSlot}
              onRemoveItem={handleRemoveItem}
              onUpdateQty={handleUpdateQty}
            />
          </div>
          <div data-pc-builder-no-print>
            <SaveShareBar
              build={build}
              buildId={buildId}
              shareSlug={shareSlug}
              onBuildSaved={(info) => {
                setBuildId(info.id);
                setShareSlug(info.share_slug);
              }}
            />
          </div>
        </div>
      </div>

      {/* Picker */}
      <ComponentPicker
        open={pickerOpen}
        onOpenChange={(o) => {
          setPickerOpen(o);
          if (!o) setActiveSlot(null);
        }}
        slot={activeSlot}
        currentItems={currentPickerItems}
        onSelect={handleSelectItem}
      />

      {/* Receipt chỉ hiện khi in */}
      <BuildReceipt
        build={build}
        title="Phiếu cấu hình PC"
        shareUrl={shareUrl}
      />

      {/* Dialog hỏi user sau khi login */}
      <GuestMigratePrompt />
    </div>
  );
}

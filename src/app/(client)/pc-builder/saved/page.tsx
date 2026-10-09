"use client";

/**
 * Trang list các cấu hình đã lưu của user.
 *
 * - Nếu chưa login → "Đăng nhập để lưu cấu hình".
 * - Nếu login → gọi `fetchUserBuilds()`, list card có tên + ngày + tổng + nút "Mở" / "Xoá".
 * - Nút "Mở" → load build về state rồi điều hướng sang `/pc-builder?load=<id>`.
 * - Nút "Xoá" → confirm + `deleteBuild(id)`.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bookmark,
  LogIn,
  PackageOpen,
  Trash2,
  Loader2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import {
  fetchUserBuilds,
  loadBuildAsState,
  deleteBuild,
  ensureShareSlug,
} from "@/lib/pc-builder/api";
import {
  clearGuestBuild,
  saveGuestBuild,
} from "@/lib/pc-builder/storage";
import type { SavedBuild } from "@/lib/pc-builder/types";

export default function SavedBuildsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useUser();

  const {
    data: builds = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<SavedBuild[]>({
    queryKey: ["pc-builder", "user-builds", user?.id ?? null],
    queryFn: fetchUserBuilds,
    enabled: !!user,
  });

  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Clear opening state nếu user vừa đăng nhập → trang vẫn ổn định.
  useEffect(() => {
    setOpeningId(null);
  }, [user?.id]);

  const handleOpen = async (b: SavedBuild) => {
    try {
      setOpeningId(b.build.id);
      const { state } = await loadBuildAsState(b);
      // Load state vào localStorage rồi navigate sang builder.
      saveGuestBuild(state);
      router.push("/pc-builder");
    } catch {
      toast.error("Không mở được cấu hình");
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (b: SavedBuild) => {
    if (!window.confirm(`Xoá "${b.build.name}"? Hành động này không thể hoàn tác.`)) {
      return;
    }
    try {
      setDeletingId(b.build.id);
      const ok = await deleteBuild(b.build.id);
      if (ok) {
        toast.success("Đã xoá cấu hình");
        await queryClient.invalidateQueries({
          queryKey: ["pc-builder", "user-builds"],
        });
      } else {
        toast.error("Không xoá được cấu hình");
      }
    } catch {
      toast.error("Có lỗi khi xoá");
    } finally {
      setDeletingId(null);
    }
  };

  const handleNewBuild = () => {
    clearGuestBuild();
    router.push("/pc-builder");
  };

  const handleShare = async (b: SavedBuild) => {
    try {
      const slug = await ensureShareSlug(b.build.id);
      if (!slug) {
        toast.error("Không tạo được link chia sẻ");
        return;
      }
      const url = `${window.location.origin}/pc-builder/${slug}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Đã copy link chia sẻ");
      } catch {
        toast.info("Link chia sẻ", { description: url });
      }
    } catch {
      toast.error("Không tạo được link chia sẻ");
    }
  };

  // ─── Render branches ────────────────────────────────────────────
  if (userLoading) {
    return (
      <div className="container py-10">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <LogIn className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Đăng nhập để lưu cấu hình
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Tài khoản giúp bạn đồng bộ cấu hình giữa các thiết bị, chia sẻ dễ dàng
            và nhận thông báo khi có thay đổi giá linh kiện.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button asChild className="rounded-lg">
              <Link href="/login?redirect=/pc-builder/saved">
                Đăng nhập
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-lg">
              <Link href="/signup?redirect=/pc-builder/saved">Đăng ký</Link>
            </Button>
          </div>
          <div className="mt-6">
            <Button asChild variant="ghost" className="rounded-lg">
              <Link href="/pc-builder">
                <Wrench className="h-4 w-4" />
                Tạo cấu hình mới (không cần đăng nhập)
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Bookmark className="h-3 w-3" />
            Cấu hình đã lưu
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Cấu hình PC của bạn
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Mở lại, chỉnh sửa hoặc chia sẻ các cấu hình đã lưu.
          </p>
        </div>
        <Button onClick={handleNewBuild} className="rounded-lg">
          <Wrench className="h-4 w-4" />
          Tạo cấu hình mới
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          <p>Không tải được danh sách cấu hình.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 rounded-lg"
            onClick={() => refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : builds.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-16 text-center">
          <PackageOpen className="h-12 w-12 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">
            Bạn chưa lưu cấu hình nào
          </p>
          <p className="max-w-xs text-xs text-slate-500">
            Vào trang Xây dựng cấu hình PC để tạo và lưu cấu hình đầu tiên.
          </p>
          <Button asChild className="mt-3 rounded-lg">
            <Link href="/pc-builder">
              <Wrench className="h-4 w-4" />
              Bắt đầu dựng cấu hình
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {builds.map((b) => {
            const dateLabel = b.build.updated_at
              ? format(new Date(b.build.updated_at), "dd/MM/yyyy HH:mm")
              : "—";
            const itemCount = b.items.reduce((s, it) => s + it.qty, 0);
            const total = b.build.total_price ?? 0;
            const isOpening = openingId === b.build.id;
            const isDeleting = deletingId === b.build.id;
            return (
              <Card
                key={b.build.id}
                className="group border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1 text-base">
                      {b.build.name}
                    </CardTitle>
                    {b.build.is_public && b.build.share_slug ? (
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px] font-medium"
                      >
                        Public
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Cập nhật: {dateLabel}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold tracking-tight text-slate-900">
                    {formatCurrency(total)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {itemCount} linh kiện
                  </p>
                  <div className="mt-3 flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1 rounded-lg"
                      onClick={() => handleOpen(b)}
                      disabled={isOpening || isDeleting}
                    >
                      {isOpening ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                      Mở
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => handleShare(b)}
                      disabled={isDeleting}
                      title="Copy link chia sẻ"
                    >
                      Chia sẻ
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => handleDelete(b)}
                      disabled={isDeleting}
                      title="Xoá"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

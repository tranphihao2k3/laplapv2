"use client";

/**
 * Thanh action phía dưới build-summary: Lưu / Chia sẻ / In / Xuất PDF.
 *
 * - Nếu chưa login → mở dialog yêu cầu đăng nhập hoặc lưu guest.
 * - Nếu đã login → gọi createBuild / updateBuild.
 * - Chia sẻ: copy link `${origin}/pc-builder/${share_slug}` vào clipboard.
 * - In: window.print().
 * - Xuất PDF: dùng html2canvas + jsPDF chụp element #pc-builder-receipt rồi tải file.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Share2,
  Printer,
  FileDown,
  LogIn,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createBuild, ensureShareSlug } from "@/lib/pc-builder/api";
import {
  calculateTotal,
  loadGuestBuild,
  saveGuestBuild,
} from "@/lib/pc-builder/storage";
import { exportElementToPdf } from "@/lib/pc-builder/pdf";
import { useUser } from "@/hooks/use-user";
import type { BuildState } from "@/lib/pc-builder/types";

type Props = {
  build: BuildState;
  /** ID của build hiện tại nếu đã save (để update thay vì insert). */
  buildId: string | null;
  shareSlug: string | null;
  onBuildSaved: (info: { id: string; share_slug: string | null }) => void;
};

export function SaveShareBar({
  build,
  buildId,
  shareSlug,
  onBuildSaved,
}: Props) {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useUser();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const hasItems = Object.values(build).some(
    (arr) => Array.isArray(arr) && arr.length > 0,
  );

  const buildShareUrl = (slug: string | null) => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    return slug ? `${origin}/pc-builder/${slug}` : `${origin}/pc-builder`;
  };

  const handleSave = async () => {
    if (!hasItems) {
      toast.warning("Chưa có linh kiện nào để lưu");
      return;
    }
    if (userLoading) return;
    if (!user) {
      // Lưu guest vào localStorage trước → mở dialog yêu cầu đăng nhập.
      saveGuestBuild(build);
      setAuthDialogOpen(true);
      return;
    }
    try {
      setSaving(true);
      const result = await createBuild(build, {
        userId: user.id,
        name: "Cấu hình của tôi",
      });
      if (!result) {
        toast.error("Không lưu được cấu hình", {
          description: "Vui lòng thử lại sau.",
        });
        return;
      }
      onBuildSaved({ id: result.id, share_slug: result.share_slug });
      toast.success("Đã lưu cấu hình", {
        description: "Bạn có thể mở lại từ mục 'Cấu hình đã lưu'.",
        action: {
          label: "Xem",
          onClick: () => router.push("/pc-builder/saved"),
        },
      });
    } catch (err) {
      toast.error("Lỗi khi lưu cấu hình", {
        description: err instanceof Error ? err.message : "Vui lòng thử lại.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    let slug = shareSlug;
    if (!slug && hasItems) {
      try {
        setSharing(true);
        // Nếu đã có buildId → ensureShareSlug trên id đó.
        // Nếu chưa có buildId → tạo guest build trước rồi share.
        if (buildId) {
          slug = await ensureShareSlug(buildId);
        } else {
          const result = await createBuild(build, {
            userId: user?.id ?? null,
            name: "Cấu hình chia sẻ",
          });
          if (result) {
            slug = result.share_slug;
            onBuildSaved({ id: result.id, share_slug: result.share_slug });
          }
        }
      } catch {
        /* swallow */
      } finally {
        setSharing(false);
      }
    }

    const url = buildShareUrl(slug);
    if (!slug) {
      toast.warning("Cần chọn ít nhất 1 linh kiện để chia sẻ");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Đã copy link chia sẻ", { description: url });
    } catch {
      toast.info("Link chia sẻ", {
        description: url,
        action: {
          label: "Mở",
          onClick: () => window.open(url, "_blank", "noopener"),
        },
      });
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  const handleExportPdf = async () => {
    const el = document.getElementById("pc-builder-receipt");
    if (!el) {
      toast.error("Không tìm thấy phiếu để xuất PDF");
      return;
    }
    try {
      setExportingPdf(true);
      const safeName = "phieu-cau-hinh-pc";
      await exportElementToPdf(el, { filename: safeName });
      toast.success("Đã tải file PDF");
    } catch (err) {
      toast.error("Xuất PDF thất bại", {
        description: err instanceof Error ? err.message : "Vui lòng thử lại.",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 print:hidden">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || userLoading || !hasItems}
          size="sm"
          className="rounded-lg"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : user ? (
            <Save className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Lưu
        </Button>
        <Button
          type="button"
          onClick={handleShare}
          disabled={sharing || !hasItems}
          variant="secondary"
          size="sm"
          className="rounded-lg"
        >
          {sharing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          Chia sẻ
        </Button>
        <Button
          type="button"
          onClick={handlePrint}
          disabled={!hasItems}
          variant="outline"
          size="sm"
          className="rounded-lg"
        >
          <Printer className="h-4 w-4" />
          In
        </Button>
        <Button
          type="button"
          onClick={handleExportPdf}
          disabled={exportingPdf || !hasItems}
          variant="outline"
          size="sm"
          className="rounded-lg"
        >
          {exportingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          Xuất PDF
        </Button>
      </div>

      {/* Dialog yêu cầu đăng nhập khi lưu guest */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-primary" />
              Đăng nhập để lưu cấu hình
            </DialogTitle>
            <DialogDescription>
              Bạn đang có cấu hình dở dang ({calculateTotal(loadGuestBuild()).toLocaleString("vi-VN")} đ).
              Đăng nhập để lưu vào tài khoản và đồng bộ giữa các thiết bị. Nếu chưa có
              tài khoản, bạn có thể đăng ký miễn phí.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAuthDialogOpen(false)}
              className="rounded-lg"
            >
              Để sau
            </Button>
            <Button asChild className="rounded-lg">
              <Link href="/login?redirect=/pc-builder">Đăng nhập</Link>
            </Button>
            <Button asChild variant="secondary" className="rounded-lg">
              <Link href="/signup?redirect=/pc-builder">Đăng ký</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

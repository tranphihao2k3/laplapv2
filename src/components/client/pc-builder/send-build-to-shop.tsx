"use client";

/**
 * CTA gửi cấu hình cho shop: copy text / mở Zalo / chụp màn hình (PDF/print).
 * PC Builder chạy chế độ tham khảo — không hiện giá.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Copy,
  Loader2,
  MessageCircle,
  Printer,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoreSettings } from "@/components/client/layout/use-store-settings";
import { formatBuildText } from "@/lib/pc-builder/format-build-text";
import { exportElementToPdf } from "@/lib/pc-builder/pdf";
import { countItems } from "@/lib/pc-builder/storage";
import type { BuildState } from "@/lib/pc-builder/types";

type Props = {
  build: BuildState;
};

function resolveZaloUrl(settings: ReturnType<typeof useStoreSettings>["settings"]): string | null {
  const social = settings?.social_links?.zalo?.trim();
  if (social) return social;
  const channel = settings?.contact_channels?.find((c) => c.type === "zalo");
  if (channel?.link) return channel.link;
  if (channel?.value) {
    const digits = channel.value.replace(/\D/g, "");
    if (digits) return `https://zalo.me/${digits}`;
  }
  const phone = (settings?.hotline || settings?.phone || "").replace(/\D/g, "");
  if (phone) return `https://zalo.me/${phone}`;
  return null;
}

export function SendBuildToShop({ build }: Props) {
  const { settings } = useStoreSettings({ fetchOnMount: true });
  const [copying, setCopying] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const itemCount = useMemo(() => countItems(build), [build]);
  const text = useMemo(
    () => formatBuildText(build, { shopName: settings?.name }),
    [build, settings?.name],
  );
  const zaloUrl = resolveZaloUrl(settings);

  if (itemCount === 0) return null;

  const handleCopy = async () => {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(text);
      toast.success("Đã copy cấu hình — dán vào Zalo gửi shop");
    } catch {
      toast.error("Trình duyệt không cho copy — hãy dùng Chụp PDF");
    } finally {
      setCopying(false);
    }
  };

  const handleZalo = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Đã copy cấu hình. Đang mở Zalo…");
    } catch {
      /* vẫn mở Zalo */
    }
    if (zaloUrl) {
      window.open(zaloUrl, "_blank", "noopener,noreferrer");
    } else {
      toast.message("Chưa cấu hình link Zalo — dán cấu hình đã copy vào chat shop");
    }
  };

  const handleCapture = async () => {
    const el = document.getElementById("pc-builder-receipt");
    if (!el) {
      toast.error("Không tìm thấy phiếu cấu hình");
      return;
    }
    try {
      setCapturing(true);
      await exportElementToPdf(el, { filename: `cau-hinh-pc-${Date.now()}` });
      toast.success("Đã tải ảnh/PDF cấu hình — gửi file cho shop");
    } catch {
      toast.error("Không chụp được — thử In / Lưu PDF");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-white to-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            <Send className="h-3.5 w-3.5" />
            Gửi shop
          </div>
          <p className="text-sm font-semibold text-slate-900">
            Chỉ tham khảo — báo giá khi gửi cấu hình
          </p>
          <p className="mt-0.5 max-w-xl text-[12px] text-slate-500">
            Linh kiện lấy từ kho shop. Chụp / copy danh sách rồi gửi Zalo để
            nhận báo giá lắp ráp thực tế.
          </p>
        </div>
        <p className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
          {itemCount} linh kiện
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
          onClick={handleZalo}
        >
          <MessageCircle className="h-4 w-4" />
          Gửi Zalo shop
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-lg"
          disabled={copying}
          onClick={handleCopy}
        >
          {copying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          Copy cấu hình
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-lg"
          disabled={capturing}
          onClick={handleCapture}
        >
          {capturing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Chụp PDF
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-lg"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          In
        </Button>
      </div>
    </div>
  );
}

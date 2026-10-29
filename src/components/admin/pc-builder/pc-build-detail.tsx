"use client";

/**
 * Chi tiết 1 PC Build cho admin.
 *
 * Hiển thị:
 * - Thông tin build: tên, ngày tạo, người tạo, note
 * - Bảng linh kiện trong build: thumbnail, tên, danh mục, số lượng, đơn giá, thành tiền
 * - Tổng cộng
 * - Nút: "In phiếu cấu hình" (window.print), "Xuất PDF" (cũng window.print — user
 *   chọn Save as PDF trong dialog của trình duyệt). Tạm thời không cần lib PDF.
 * - Component BuildReceipt: layout A4 (logo thương hiệu, tiêu đề, bảng, tổng, footer)
 * - Nút "Xoá build" → confirm dialog
 *
 * CSS in ấn: globals.css có rule `[data-pc-builder-no-print]` bị display:none khi
 * @media print. Sidebar/Header/nút bấm đã wrap trong attribute đó.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Printer, FileDown, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { exportElementToPdf } from "@/lib/pc-builder/pdf";
import { useStoreSettings } from "@/components/client/layout/use-store-settings";
import {
  computeTotal,
  formatDateTime,
  formatVnd,
  type PcBuildItemRow,
  type PcBuildRow,
} from "./helpers";

type ProductLite = {
  id: string;
  name: string;
  slug: string | null;
  thumbnail_url: string | null;
};

type CategoryLite = { id: string; name: string; slug: string };

type ItemView = PcBuildItemRow & {
  product: ProductLite | null;
  category: CategoryLite | null;
};

type InitialPayload = {
  build: PcBuildRow;
  items: ItemView[];
  user: { id: string; full_name: string | null } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  cpu: "CPU",
  mainboard: "Bo mạch chủ",
  ram: "RAM",
  gpu: "VGA / GPU",
  ssd: "SSD",
  hdd: "HDD",
  psu: "Nguồn",
  case: "Vỏ case",
  cooler: "Tản nhiệt",
  monitor: "Màn hình",
  keyboard: "Bàn phím",
  mouse: "Chuột",
  headset: "Tai nghe",
};

function categoryLabel(slug: string | null): string {
  if (!slug) return "—";
  return CATEGORY_LABELS[slug] ?? slug;
}

export function PcBuildDetail({ initialBuild }: { initialBuild: InitialPayload }) {
  const router = useRouter();
  const [deletingOpen, setDeletingOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const { build, items, user } = initialBuild;

  // Lấy thông tin cửa hàng để render phiếu in (thay vì hardcode tên brand).
  // Không fetch on mount vì trang này chỉ cần data khi in.
  const { settings: storeSettings } = useStoreSettings({ fetchOnMount: false });
  const brandName = storeSettings?.name?.trim() || "Website";
  const storePhone = storeSettings?.hotline?.trim() || storeSettings?.phone?.trim() || "";
  const storeAddress = storeSettings?.address?.trim() || "";
  const storeEmail = storeSettings?.email?.trim() || "";

  // Tổng tiền: ưu tiên build.total_price, fallback tính lại từ items (đề phòng lệch).
  const itemsTotal = useMemo(() => computeTotal(items), [items]);
  const total = build.total_price ?? itemsTotal;

  function handlePrint() {
    if (typeof window !== "undefined") window.print();
  }

  async function handleExportPdf() {
    const el = document.getElementById("pc-builder-receipt");
    if (!el) {
      toast.error("Không tìm thấy phiếu để xuất PDF");
      return;
    }
    try {
      setExportingPdf(true);
      const slug = build.share_slug ?? build.id.slice(0, 8);
      await exportElementToPdf(el, { filename: `phieu-cau-hinh-${slug}` });
      toast.success("Đã tải file PDF");
    } catch (err) {
      toast.error("Xuất PDF thất bại", {
        description: err instanceof Error ? err.message : "Vui lòng thử lại.",
      });
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    // Items bị xoá cascade theo FK on delete cascade → chỉ cần xoá build
    const { error } = await supabase.from("pc_builds").delete().eq("id", build.id);
    setDeleting(false);
    if (error) {
      toast.error(`Xoá thất bại: ${error.message}`);
      return;
    }
    toast.success("Đã xoá cấu hình");
    setDeletingOpen(false);
    router.push("/quanly/pc-builds");
  }

  const userLabel = !build.user_id
    ? "Khách (lưu local)"
    : user?.full_name ?? "(đã xoá tài khoản)";

  return (
    <div className="space-y-4">
      {/* Thanh thao tác — sẽ bị ẩn khi in */}
      <div
        data-pc-builder-no-print
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <Button variant="ghost" size="sm" className="self-start" onClick={() => router.push("/quanly/pc-builds")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại danh sách
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> In phiếu cấu hình
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf}>
            {exportingPdf ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-1" />
            )}
            Xuất PDF
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeletingOpen(true)}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Xoá build
          </Button>
        </div>
      </div>

      {/* Phiếu in — phần này luôn hiển thị (kể cả khi in) */}
      <BuildReceipt
        build={build}
        items={items}
        userLabel={userLabel}
        total={total}
        brandName={brandName}
        storePhone={storePhone}
        storeAddress={storeAddress}
        storeEmail={storeEmail}
      />

      <AlertDialog open={deletingOpen} onOpenChange={(o) => !o && setDeletingOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá cấu hình này?</AlertDialogTitle>
            <AlertDialogDescription>
              Cấu hình <strong>&quot;{build.name || "(chưa đặt tên)"}&quot;</strong> sẽ bị xoá cùng
              toàn bộ linh kiện trong build. Hành động không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Đang xoá..." : "Xoá"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* =====================================================================
   BuildReceipt — layout phiếu cấu hình, in được A4
   ===================================================================== */

function BuildReceipt({
  build,
  items,
  userLabel,
  total,
  brandName,
  storePhone,
  storeAddress,
  storeEmail,
}: {
  build: PcBuildRow;
  items: ItemView[];
  userLabel: string;
  total: number;
  brandName: string;
  storePhone: string;
  storeAddress: string;
  storeEmail: string;
}) {
  return (
    <Card id="pc-builder-receipt" className="border shadow-sm print:shadow-none print:border-black">
      <CardHeader data-pc-builder-no-print className="border-b">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg sm:text-xl">{build.name || "(chưa đặt tên)"}</CardTitle>
            <CardDescription>
              Cấu hình PC · Tạo lúc {formatDateTime(build.created_at)}
              {build.is_public ? " · Đang công khai" : " · Riêng tư"}
            </CardDescription>
          </div>
          <div className="text-xs text-muted-foreground text-right space-y-1">
            <div className="flex items-center justify-end gap-1">
              <User className="h-3 w-3" /> {userLabel}
            </div>
            {build.share_slug && (
              <div className="font-mono">share: {build.share_slug}</div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 print:pt-0">
        {/* Header in — chỉ hiện khi in */}
        <div className="hidden print:block mb-4">
          <div className="flex items-center justify-between border-b border-black/40 pb-3">
            <div className="flex items-center gap-3">
              {/* Logo thương hiệu — dùng text vì không có file logo bundled sẵn */}
              <div className="flex h-12 w-12 items-center justify-center rounded bg-black text-white font-bold text-xl">
                L
              </div>
              <div>
                <div className="text-xl font-bold">{brandName}</div>
                <div className="text-xs text-gray-600">Cửa hàng Laptop &amp; Linh kiện PC</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold uppercase tracking-wide">Phiếu cấu hình PC</div>
              <div className="text-xs text-gray-600">
                Mã: <span className="font-mono">{build.share_slug ?? build.id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mt-3">
            <div>
              <div className="text-gray-600">Khách hàng:</div>
              <div className="font-semibold">{userLabel}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-600">Ngày tạo:</div>
              <div className="font-semibold">{formatDateTime(build.created_at)}</div>
            </div>
          </div>
        </div>

        <Table className="print:text-black">
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 print:hidden">Ảnh</TableHead>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Tên linh kiện</TableHead>
              <TableHead>Danh mục</TableHead>
              <TableHead className="text-center w-16">SL</TableHead>
              <TableHead className="text-right">Đơn giá</TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Build chưa có linh kiện nào.
                </TableCell>
              </TableRow>
            ) : (
              items.map((it, idx) => (
                <TableRow key={it.id}>
                  <TableCell className="print:hidden">
                    {it.product?.thumbnail_url ? (
                      <Image
                        src={it.product.thumbnail_url}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded object-cover border"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center text-[9px] text-muted-foreground">
                        Ảnh
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    {it.product ? (
                      <Link
                        href={`/quanly/products?search=${encodeURIComponent(it.product.name)}`}
                        className="font-medium text-sm hover:underline text-primary"
                      >
                        {it.product.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-sm">(đã xoá sản phẩm)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {categoryLabel(it.category_slug)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {it.qty ?? 0}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatVnd(it.unit_price)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatVnd((it.qty ?? 0) * (it.unit_price ?? 0))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {build.note && (
          <div className="mt-4 rounded-md border bg-muted/30 p-3 print:bg-transparent print:border-black">
            <div className="text-xs text-muted-foreground mb-1 print:text-gray-600">Ghi chú của khách</div>
            <div className="text-sm whitespace-pre-line">{build.note}</div>
          </div>
        )}

        {/* Tổng cộng */}
        <div className="mt-4 flex justify-end">
          <div className="w-full sm:w-72 space-y-1 rounded-md border bg-muted/40 p-3 print:bg-transparent print:border-black">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground print:text-gray-600">Số linh kiện</span>
              <span className="tabular-nums">{items.length}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t print:border-black">
              <span>Tổng cộng</span>
              <span className="tabular-nums text-primary print:text-black">
                {formatVnd(total)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer in */}
        <div className="hidden print:block mt-6 pt-3 border-t border-black/40 text-xs text-gray-600">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="font-semibold mb-1">{brandName}</div>
              {storePhone && <div>Hotline: {storePhone}</div>}
              {storeAddress && <div>Địa chỉ: {storeAddress}</div>}
              {storeEmail && <div>Website: {storeEmail}</div>}
            </div>
            <div className="text-right">
              <div className="italic mb-6">Cảm ơn quý khách!</div>
              <div>Ngày in: {formatDateTime(new Date().toISOString())}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
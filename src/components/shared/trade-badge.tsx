/**
 * TradeBadge — Logo "Đã thông báo Bộ Công Thương".
 *
 * Theo Nghị định 52/2013/NĐ-CP (sửa đổi bởi 85/2021/NĐ-CP), Điều 53 khoản 1:
 *   Website TMĐT bán hàng có chức năng đặt hàng trực tuyến BẮT BUỘC gắn logo
 *   "Đã thông báo/đăng ký với Bộ Công Thương" trỏ về trang tra cứu trên
 *   online.gov.vn.
 *
 * Logo chính thức do Cục Thương mại điện tử & Kinh tế số cấp — vì đây là
 * placeholder, ta dựng badge SVG inline với phong cách tương đương, link tới
 * URL đã cấu hình (settings.legal.bo_cong_thuong_url). Khi nhận logo thật,
 * thay nội dung SVG và giữ nguyên khung.
 */
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getLegalInfo } from "@/lib/shop-info";

interface Props {
  className?: string;
}

export async function TradeBadge({ className }: Props) {
  const legal = await getLegalInfo();
  const url = legal.bo_cong_thuong_url || "https://online.gov.vn";

  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Đã thông báo/đăng ký với Bộ Công Thương"
      aria-label="Đã thông báo/đăng ký với Bộ Công Thương"
      className={`inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60 ${className ?? ""}`}
    >
      <ShieldCheck className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Đã thông báo
        </span>
        <span className="font-bold">Bộ Công Thương</span>
        <span className="text-[10px] text-amber-800/80 dark:text-amber-300/80">
          online.gov.vn/vn
        </span>
      </span>
    </Link>
  );
}
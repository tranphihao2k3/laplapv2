"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Variant = "stock" | "transfer";

const TYPE_BADGE_CLASS: Record<string, string> = {
  in: "bg-emerald-100 text-emerald-700 border-emerald-200",
  out: "bg-rose-100 text-rose-700 border-rose-200",
  transfer: "bg-sky-100 text-sky-700 border-sky-200",
  sale: "bg-violet-100 text-violet-700 border-violet-200",
  adjustment: "bg-amber-100 text-amber-700 border-amber-200",
};

const TYPE_LABEL: Record<string, string> = {
  in: "Nhập",
  out: "Xuất",
  transfer: "Chuyển",
  sale: "Bán",
  adjustment: "Điều chỉnh",
};

/**
 * Icon "?" inline, dùng cho các thuật ngữ khó. Wrap cả icon và tooltip vào
 * TooltipProvider để tránh phải bọc từng nhóm một.
 */
export function HelpTip({
  content,
  className,
  side = "top",
}: {
  content: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Giải thích"
            className={cn(
              "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-left leading-relaxed">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function InventoryHelpSection({ variant }: { variant: Variant }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-dashed bg-muted/30">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Hướng dẫn sử dụng</CardTitle>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen((v) => !v)}
          className="h-7 px-2"
          aria-expanded={open}
        >
          {open ? (
            <>
              <ChevronUp className="mr-1 h-3.5 w-3.5" /> Thu gọn
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-3.5 w-3.5" /> Mở rộng
            </>
          )}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 border-t p-4 text-sm">
          {variant === "stock" ? <StockHelpBody /> : <TransferHelpBody />}
          <Separator />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Đóng
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function StockHelpBody() {
  return (
    <div className="space-y-4">
      <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Tồn khả dụng (available_qty)</span>:
          là số lượng có thể bán hiện tại = nhập kho − xuất kho − đã bán. Cập nhật tự
          động khi có đơn POS/online, khi nhập hàng (<code>in</code>), xuất hàng (
          <code>out</code>), chuyển kho hoặc điều chỉnh thủ công.
        </li>
        <li>
          <span className="font-medium text-foreground">Các loại kho</span>:{" "}
          <em>Kho cửa hàng</em> (type <code>store</code>) phục vụ bán trực tiếp tại
          shop. <em>Kho tổng</em> (type khác) chứa hàng nhập từ nhà cung cấp, sau đó
          chuyển về kho cửa hàng.
        </li>
        <li>
          <span className="font-medium text-foreground">Cột "Đang giữ"</span>{" "}
          (reserved): những sản phẩm đã có đơn nhưng chưa xuất kho. Hiện schema gộp
          vào <code>available_qty</code> (chưa tách cột riêng).
        </li>
        <li>
          <span className="font-medium text-foreground">Khi nào tồn = 0</span>: sản
          phẩm hết hàng ở kho đó. POS sẽ cảnh báo nếu bán vượt tồn.
        </li>
      </ul>

      <div>
        <p className="mb-2 font-medium text-foreground">Các loại giao dịch kho</p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted text-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Mã</th>
                <th className="px-3 py-2 text-left font-semibold">Ý nghĩa</th>
                <th className="px-3 py-2 text-left font-semibold">Cách phát sinh</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  code: "in",
                  meaning: "Nhập kho từ NCC",
                  source: "Phiếu mua hàng (PO) → received",
                },
                {
                  code: "out",
                  meaning: "Xuất kho",
                  source: "Phiếu xuất nội bộ / bán trực tiếp ở kho không qua POS",
                },
                {
                  code: "transfer",
                  meaning: "Chuyển kho",
                  source: 'Trang "Chuyển kho"',
                },
                {
                  code: "sale",
                  meaning: "Bán hàng (POS/online)",
                  source: "Trang POS / Checkout",
                },
                {
                  code: "adjustment",
                  meaning: "Điều chỉnh thủ công",
                  source: 'Trang "Tồn kho" → sửa available_qty',
                },
              ].map((row) => (
                <tr key={row.code} className="border-t">
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn("font-mono", TYPE_BADGE_CLASS[row.code])}
                    >
                      {row.code}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {TYPE_LABEL[row.code]} — {row.meaning}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TransferHelpBody() {
  return (
    <div className="space-y-4 text-muted-foreground">
      <div>
        <p className="font-medium text-foreground">Luồng chuyển kho</p>
        <p className="mt-1">
          Kho nguồn (<code>from</code>) → Kho đích (<code>to</code>). Có thể chuyển
          trong cùng shop hoặc khác shop tuỳ chọn.
        </p>
      </div>

      <div>
        <p className="font-medium text-foreground">Các bước thực hiện</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>Chọn <strong>Kho nguồn</strong> và <strong>Kho đích</strong> (bắt buộc khác nhau).</li>
          <li>Thêm sản phẩm + số lượng cần chuyển.</li>
          <li>Bấm <strong>Xác nhận chuyển kho</strong>.</li>
        </ol>
      </div>

      <div>
        <p className="font-medium text-foreground">Điều kiện xảy ra</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Tồn kho <strong>nguồn giảm</strong> ngay, tồn kho <strong>đích tăng</strong> ngay.
          </li>
          <li>
            Phát sinh <strong>2 dòng</strong> trong bảng{" "}
            <code>inventory_transactions</code>: 1 dòng <code>out</code> từ kho nguồn
            và 1 dòng <code>in</code> vào kho đích.
          </li>
          <li>Lịch sử chuyển hiển thị bên dưới để tra cứu.</li>
        </ul>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
        <p className="font-medium">Lưu ý về serial number</p>
        <p className="mt-1">
          Nếu sản phẩm có serial (laptop/serial), hệ thống sẽ tự chọn serial từ kho
          nguồn. Tuyệt đối không chuyển những serial đã bán — hệ thống sẽ chặn.
        </p>
      </div>
    </div>
  );
}

export default InventoryHelpSection;

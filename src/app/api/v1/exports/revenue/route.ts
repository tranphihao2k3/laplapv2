/**
 * Excel export cho báo cáo doanh thu.
 * GET /api/v1/exports/revenue?from=...&to=...&shop_id=...&channel=...
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { excelResponse, buildWorkbook, type ExcelColumn } from "@/lib/excel/server";
import { parseFilters, fetchAll, type ReportFilters } from "@/lib/reports/query";

type OrderRow = {
  id: string;
  order_number: string;
  status: string | null;
  payment_status: string | null;
  channel: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  created_at: string | null;
  shop_id: string | null;
  customer_id: string | null;
};

const COLUMNS: ExcelColumn<{
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  shop_name: string;
  shop_code: string;
  channel: string;
  payment_status: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
}>[] = [
  { header: "Mã đơn", key: "order_number", width: 18 },
  { header: "Ngày tạo", key: "created_at", width: 18, format: "datetime" },
  { header: "Khách hàng", key: "customer_name", width: 24 },
  { header: "SĐT", key: "customer_phone", width: 14 },
  { header: "Cửa hàng", key: "shop_name", width: 20 },
  { header: "Mã CH", key: "shop_code", width: 10 },
  { header: "Kênh", key: "channel", width: 12 },
  { header: "PTTT", key: "payment_status", width: 14 },
  { header: "Trạng thái", key: "status", width: 14 },
  { header: "Tạm tính", key: "subtotal", width: 16, format: "money" },
  { header: "Giảm giá", key: "discount_amount", width: 14, format: "money" },
  { header: "Tổng cộng", key: "total_amount", width: 16, format: "money" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao",
  fulfilled: "Đã giao",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "Chưa thanh toán",
  partial: "Một phần",
  paid: "Đã thanh toán",
  refunded: "Đã hoàn tiền",
};

const CHANNEL_LABEL: Record<string, string> = {
  pos: "POS",
  online: "Online",
  phone: "Điện thoại",
  in_store: "Tại quầy",
};

export async function GET(req: NextRequest) {
  await requireUser();
  const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
  const supabase = await createClient();

  const orders = await fetchAll<OrderRow>(
    "orders",
    "id, order_number, status, payment_status, channel, subtotal, discount_amount, total_amount, created_at, shop_id, customer_id",
    filters,
    { hardLimit: 50_000 },
  );

  const customerIds = Array.from(new Set(orders.map((o) => o.customer_id).filter((x): x is string => !!x)));
  const shopIds = Array.from(new Set(orders.map((o) => o.shop_id).filter((x): x is string => !!x)));
  const [customersRes, shopsRes] = await Promise.all([
    customerIds.length > 0
      ? supabase.from("customers").select("id, full_name, phone").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; phone: string | null }[] }),
    shopIds.length > 0
      ? supabase.from("shops").select("id, name, code").in("id", shopIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; code: string | null }[] }),
  ]);
  const customerMap = new Map(((customersRes.data ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map((c) => [c.id, c]));
  const shopMap = new Map(((shopsRes.data ?? []) as { id: string; name: string | null; code: string | null }[]).map((s) => [s.id, s]));

  const detailRows = orders.map((o) => {
    const c = o.customer_id ? customerMap.get(o.customer_id) : null;
    const s = o.shop_id ? shopMap.get(o.shop_id) : null;
    return {
      order_number: o.order_number,
      created_at: o.created_at ?? "",
      customer_name: c?.full_name ?? "",
      customer_phone: c?.phone ?? "",
      shop_name: s?.name ?? "",
      shop_code: s?.code ?? "",
      channel: CHANNEL_LABEL[o.channel ?? ""] ?? o.channel ?? "",
      payment_status: PAYMENT_LABEL[o.payment_status ?? ""] ?? o.payment_status ?? "",
      status: STATUS_LABEL[o.status ?? ""] ?? o.status ?? "",
      subtotal: Number(o.subtotal ?? 0),
      discount_amount: Number(o.discount_amount ?? 0),
      total_amount: Number(o.total_amount ?? 0),
    };
  });

  // Summary
  const completed = detailRows.filter((r) => r.status === "Hoàn tất" || r.status === "Đã giao");
  const cancelled = detailRows.filter((r) => r.status === "Đã huỷ");
  const totalRevenue = completed.reduce((s, r) => s + r.total_amount, 0);
  const totalDiscount = detailRows.reduce((s, r) => s + r.discount_amount, 0);

  const buf = await buildWorkbook({
    fileName: "bao-cao-doanh-thu",
    summarySheet: {
      title: "Tổng quan",
      rows: [
        ["Tổng đơn hàng", detailRows.length],
        ["Đơn hoàn tất", completed.length],
        ["Đơn huỷ", cancelled.length],
        ["Tỉ lệ hoàn tất (%)", detailRows.length > 0 ? (completed.length / detailRows.length) * 100 : 0],
        ["Tổng doanh thu (VNĐ)", totalRevenue],
        ["Tổng giảm giá (VNĐ)", totalDiscount],
        ["AOV — Giá trị đơn TB (VNĐ)", completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0],
      ],
    },
    detailSheet: {
      title: "Chi tiết đơn hàng",
      columns: COLUMNS,
      rows: detailRows,
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  return excelResponse(buf, `bao-cao-doanh-thu-${today}.xlsx`);
}

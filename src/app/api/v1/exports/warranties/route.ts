/**
 * Excel export cho báo cáo bảo hành.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { excelResponse, buildWorkbook, type ExcelColumn } from "@/lib/excel/server";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type Warranty = {
  id: string; serial_number_id: string | null; customer_id: string | null;
  warranty_type: string | null; start_date: string | null; end_date: string | null;
  status: string | null;
};

const COLUMNS: ExcelColumn<{
  warranty_code: string; warranty_type: string; customer_name: string; customer_phone: string;
  product_name: string; sku: string; serial_number: string;
  purchase_date: string; expiry_date: string; days_remaining: number;
  status: string; repair_count: number;
}>[] = [
  { header: "Mã BH", key: "warranty_code", width: 14 },
  { header: "Loại", key: "warranty_type", width: 12 },
  { header: "Khách hàng", key: "customer_name", width: 24 },
  { header: "SĐT", key: "customer_phone", width: 14 },
  { header: "Sản phẩm", key: "product_name", width: 30 },
  { header: "SKU", key: "sku", width: 14 },
  { header: "Serial", key: "serial_number", width: 18 },
  { header: "Ngày mua", key: "purchase_date", width: 14, format: "date" },
  { header: "Hết hạn", key: "expiry_date", width: 14, format: "date" },
  { header: "Còn (ngày)", key: "days_remaining", width: 12, format: "number" },
  { header: "Trạng thái", key: "status", width: 14 },
  { header: "Số lần sửa", key: "repair_count", width: 12, format: "number" },
];

export async function GET(req: NextRequest) {
  await requireUser();
  const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("warranties")
    .select("id, serial_number_id, customer_id, warranty_type, start_date, end_date, status")
    .limit(50_000);
  if (filters.from) q = q.gte("start_date", filters.from);
  if (filters.to) q = q.lte("start_date", filters.to);
  if (filters.status) q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw error;
  const warranties = (data ?? []) as Warranty[];

  const customerIds = Array.from(new Set(warranties.map((w) => w.customer_id).filter((x): x is string => !!x)));
  const serialIds = Array.from(new Set(warranties.map((w) => w.serial_number_id).filter((x): x is string => !!x)));
  const [customersRes, serialsRes, repairsRes] = await Promise.all([
    customerIds.length > 0 ? supabase.from("customers").select("id, full_name, phone").in("id", customerIds) : Promise.resolve({ data: [] }),
    serialIds.length > 0
      ? supabase.from("serial_numbers").select("id, serial, imei, product_variant:product_variants!inner(sku, name, product:products!inner(name))").in("id", serialIds)
      : Promise.resolve({ data: [] }),
    serialIds.length > 0 ? supabase.from("repair_tickets").select("serial_number_id").in("serial_number_id", serialIds) : Promise.resolve({ data: [] }),
  ]);
  const customerMap = new Map(((customersRes.data ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map((c) => [c.id, c]));
  type Serial = { id: string; serial: string | null; imei: string | null; product_variant: { sku: string | null; name: string | null; product: { name: string | null } } };
  const serialMap = new Map(((serialsRes.data ?? []) as unknown as Serial[]).map((s) => [s.id, s]));
  const repairCount = new Map<string, number>();
  for (const r of (repairsRes.data ?? []) as Array<{ serial_number_id: string | null }>) {
    if (!r.serial_number_id) continue;
    repairCount.set(r.serial_number_id, (repairCount.get(r.serial_number_id) ?? 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const detailRows = warranties.map((w) => {
    const c = w.customer_id ? customerMap.get(w.customer_id) : null;
    const s = w.serial_number_id ? serialMap.get(w.serial_number_id) : null;
    const daysRemaining = w.end_date ? Math.round((new Date(w.end_date).getTime() - today.getTime()) / 86400000) : 0;
    return {
      warranty_code: w.id.slice(0, 8).toUpperCase(),
      warranty_type: w.warranty_type ?? "—",
      customer_name: c?.full_name ?? "Khách lẻ",
      customer_phone: c?.phone ?? "",
      product_name: s?.product_variant?.product?.name ?? "—",
      sku: s?.product_variant?.sku ?? "—",
      serial_number: s?.serial ?? s?.imei ?? "—",
      purchase_date: w.start_date ?? "",
      expiry_date: w.end_date ?? "",
      days_remaining: daysRemaining,
      status: w.status === "voided" ? "Đã hủy" : daysRemaining < 0 ? "Hết hạn" : daysRemaining <= 30 ? "Sắp hết hạn" : "Còn hiệu lực",
      repair_count: w.serial_number_id ? (repairCount.get(w.serial_number_id) ?? 0) : 0,
    };
  });

  const buf = await buildWorkbook({
    fileName: "bao-cao-bao-hanh",
    summarySheet: {
      title: "Tổng quan",
      rows: [
        ["Tổng bảo hành", detailRows.length],
        ["Còn hiệu lực", detailRows.filter((r) => r.status === "Còn hiệu lực").length],
        ["Sắp hết hạn (≤30 ngày)", detailRows.filter((r) => r.status === "Sắp hết hạn").length],
        ["Hết hạn", detailRows.filter((r) => r.status === "Hết hạn").length],
        ["Đã hủy", detailRows.filter((r) => r.status === "Đã hủy").length],
      ],
    },
    detailSheet: { title: "Chi tiết bảo hành", columns: COLUMNS, rows: detailRows },
  });
  const todayStr = new Date().toISOString().slice(0, 10);
  return excelResponse(buf, `bao-cao-bao-hanh-${todayStr}.xlsx`);
}

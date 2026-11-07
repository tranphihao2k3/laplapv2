/**
 * POST /v1/warranties/quick — Tạo nhanh bảo hành cho máy KHÔNG có trong catalog.
 *
 * Vấn đề giải quyết: admin có danh sách máy đã bán (và đã sửa chữa) nhưng máy đó
 * không có `product_variants` row trên web → không tạo được bảo hành qua luồng
 * bán hàng thông thường. Schema DB cho phép làm việc này vì:
 *   - `serial_numbers.product_variant_id` NULLABLE
 *   - `warranties.customer_id / serial_number_id / order_id / repair_ticket_id` NULLABLE
 *
 * Luồng xử lý 1 bản ghi:
 *   1. Tìm hoặc tạo khách hàng theo SĐT (không có SĐT → khách lẻ, customer_id = null).
 *   2. Tìm `serial_numbers` theo serial/IMEI → tái sử dụng nếu đã có (tránh trùng).
 *      Không có thì tạo mới với `product_variant_id` = null (hoặc id được chọn).
 *   3. Tạo `warranties` row trỏ tới serial + khách (+ phiếu sửa chữa nếu có).
 *
 * Endpoint nhận được CẢ 2 dạng:
 *   - 1 object: `{ warranty_type, customer, device, start_date, ... }`
 *   - 1 array : `[{ ... }, { ... }]` → trả về kết quả từng dòng (để import 1 list).
 *     Lỗi của 1 dòng KHÔNG làm hỏng cả batch (validate + insert từng dòng riêng).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requirePermission } from "@/lib/api/guard";
import { ok, handleError, Errors } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { uuid, isoDate } from "@/lib/validators/common";
import {
  addMonthsIso,
  buildDeviceNote,
  calcLoyaltyPoints,
  normalizePhone,
} from "@/lib/warranties/quick-warranty";

/** 1 dòng trong body (dùng cho cả single & bulk). */
const quickWarrantyItemSchema = z.object({
  warranty_type: z.enum(["sold", "repair", "extension"]).default("sold"),
  customer: z
    .object({
      full_name: z.string().max(200).nullish(),
      phone: z.string().max(30).nullish(),
    })
    .nullish(),
  device: z.object({
    /** Tên máy tự do — BẮT BUỘC vì máy có thể không có trong catalog. */
    name: z.string().min(1, "Thiết bị: cần nhập tên máy").max(200),
    serial: z.string().max(120).nullish(),
    imei: z.string().max(120).nullish(),
    /** Tuỳ chọn: liên kết tới product variant có sẵn. null = máy ngoài catalog. */
    product_variant_id: uuid.nullish(),
  }),
  start_date: isoDate,
  /** Số tháng bảo hành — dùng để tính end_date khi không chỉ định end_date. */
  warranty_months: z.number().int().min(0).max(120).nullish(),
  /** Ghi đè end_date (nếu admin muốn đặt hạn thủ công). */
  end_date: isoDate.nullish(),
  status: z.enum(["active", "expired", "voided", "claimed"]).default("active"),
  note: z.string().max(2000).nullish(),
  /** Tuỳ chọn: gắn vào 1 phiếu sửa chữa có sẵn (chỉ dùng cho warranty_type = repair). */
  repair_ticket_id: uuid.nullish(),
  /**
   * Giá bán / phí (VNĐ). Nếu > 0 → tạo đơn hoàn tất + thanh toán + tích điểm
   * (giống bán hàng nhanh, không trừ kho vì máy ngoài catalog).
   */
  sale_amount: z.number().nonnegative().nullish(),
  payment_method: z
    .enum(["cash", "card", "transfer", "ewallet", "cod", "credit"])
    .default("cash")
    .optional(),
});

type QuickItem = z.infer<typeof quickWarrantyItemSchema>;

type CreateResult = {
  ok: boolean;
  warranty_id?: string;
  serial_number_id?: string;
  customer_id?: string | null;
  order_id?: string | null;
  order_number?: string | null;
  loyalty_points?: number;
  error?: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type SB = any;

/**
 * Tìm khách hàng theo SĐT (đã chuẩn hoá) → không có thì tạo mới.
 * Dùng `organization_id` để tách khách của cửa hàng này với khách cửa hàng khác.
 */
async function findOrCreateCustomer(
  supabase: SB,
  orgId: string,
  phone: string | null,
  fullName: string | null,
): Promise<string | null> {
  if (!phone) return null;

  const { data: existing, error: findErr } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", phone)
    .eq("organization_id", orgId)
    .limit(1);
  if (findErr) throw findErr;
  if (existing && existing.length > 0) return existing[0].id as string;

  // Khách cũ tạo trước khi tách tổ chức có thể có organization_id = null
  // → tìm thêm theo SĐT mà không lọc tổ chức để không tạo trùng.
  const { data: legacy, error: legacyErr } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", phone)
    .is("organization_id", null)
    .limit(1);
  if (legacyErr) throw legacyErr;
  if (legacy && legacy.length > 0) return legacy[0].id as string;

  const { data: created, error: createErr } = await supabase
    .from("customers")
    .insert({
      organization_id: orgId,
      phone,
      full_name: fullName?.trim() || null,
      tier: "bronze",
    })
    .select("id")
    .single();
  if (createErr) throw createErr;
  return created.id as string;
}

/**
 * Tìm serial_numbers theo serial/imei → tái sử dụng nếu đã có (KHÔNG tạo trùng).
 * Nếu chưa có thì tạo mới với product_variant_id = null (máy ngoài catalog).
 *
 * Lưu ý: dùng 2 query `.eq()` riêng thay vì `.or("serial.eq.X,imei.eq.Y")` vì
 * dấu `|`/`,`/`(` trong serial dán tay sẽ làm hỏng cú pháp filter của PostgREST.
 */
async function findOrCreateSerial(
  supabase: SB,
  item: QuickItem,
  startDate: string,
): Promise<string> {
  const serial = item.device.serial?.trim() || null;
  const imei = item.device.imei?.trim() || null;

  // Trạng thái serial: máy đã bán (bán máy / gia hạn) hoặc đang sửa (sửa chữa).
  // `sold_at` chỉ set cho máy đã bán.
  const isSold = item.warranty_type !== "repair";

  if (serial) {
    const { data, error } = await supabase
      .from("serial_numbers")
      .select("id, status")
      .eq("serial", serial)
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      await syncSerialStatus(supabase, data[0].id, data[0].status, isSold, startDate);
      return data[0].id as string;
    }
  }

  if (imei) {
    const { data, error } = await supabase
      .from("serial_numbers")
      .select("id, status")
      .eq("imei", imei)
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      await syncSerialStatus(supabase, data[0].id, data[0].status, isSold, startDate);
      return data[0].id as string;
    }
  }

  const row = {
    product_variant_id: item.device.product_variant_id ?? null,
    serial,
    imei,
    status: isSold ? "sold" : "in_repair",
    sold_at: isSold ? startDate : null,
    imported_at: new Date().toISOString(),
  };

  const { data: created, error: createErr } = await supabase
    .from("serial_numbers")
    .insert(row)
    .select("id")
    .single();
  if (createErr) throw createErr;
  return created.id as string;
}

/**
 * Khi tái sử dụng 1 serial có sẵn và tạo bảo hành loại "bán máy" → đánh dấu máy
 * đã bán (nếu trạng thái cũ chưa phải máy đã bán / bị hỏng / đã trả lại).
 * Trạng thái "returned"/"damaged" giữ nguyên vì đó là thông tin vật lý.
 */
async function syncSerialStatus(
  supabase: SB,
  serialId: string,
  currentStatus: string | null,
  isSold: boolean,
  startDate: string,
): Promise<void> {
  if (!isSold) return;
  if (currentStatus === "sold" || currentStatus === "returned" || currentStatus === "damaged") {
    return;
  }
  const { error } = await supabase
    .from("serial_numbers")
    .update({ status: "sold", sold_at: startDate })
    .eq("id", serialId);
  // Lỗi ở bước đồng bộ trạng thái KHÔNG được làm hỏng việc tạo bảo hành.
  if (error) {
    console.warn("[warranties/quick] không đồng bộ được trạng thái serial:", error);
  }
}

/**
 * Tạo đơn hoàn tất + thanh toán + tích điểm khi admin nhập giá ở BH nhanh.
 * Không trừ kho (máy ngoài catalog / đã bán tay). Channel:
 *   repair → "repair" · sold/extension → "pos"
 */
async function createQuickSaleOrder(
  supabase: SB,
  args: {
    orgId: string;
    shopId: string | null;
    userId: string;
    customerId: string | null;
    item: QuickItem;
    amount: number;
    serialNumberId: string;
  },
): Promise<{ orderId: string; orderNumber: string; loyaltyPoints: number }> {
  const { orgId, shopId, userId, customerId, item, amount, serialNumberId } = args;
  const channel = item.warranty_type === "repair" ? "repair" : "pos";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const orderNumber = `LPL-QW-${stamp}-${String(Date.now()).slice(-6)}`;
  const label =
    item.warranty_type === "repair"
      ? `Phí sửa chữa - ${item.device.name}`
      : item.warranty_type === "extension"
        ? `Gia hạn BH - ${item.device.name}`
        : item.device.name;

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      organization_id: orgId,
      shop_id: shopId,
      customer_id: customerId,
      order_number: orderNumber,
      channel,
      status: "completed",
      payment_status: "paid",
      fulfillment_status: "delivered",
      subtotal: amount,
      discount_amount: 0,
      total_amount: amount,
      note: `Bảo hành nhanh · ${label}`,
      created_by: userId,
      created_at: `${item.start_date}T12:00:00.000Z`,
    })
    .select("id, order_number")
    .single();
  if (orderErr) throw orderErr;

  const { error: itemErr } = await supabase.from("order_items").insert({
    order_id: order.id,
    product_variant_id: item.device.product_variant_id ?? null,
    quantity: 1,
    unit_price: amount,
    total_price: amount,
    product_snapshot: {
      name: label,
      kind: "quick_warranty_sale",
      device_name: item.device.name,
      serial_number_id: serialNumberId,
      serial: item.device.serial ?? null,
      imei: item.device.imei ?? null,
      warranty_type: item.warranty_type,
    },
  });
  if (itemErr) throw itemErr;

  const { error: payErr } = await supabase.from("payments").insert({
    order_id: order.id,
    method: item.payment_method ?? "cash",
    amount,
    status: "paid",
    paid_at: `${item.start_date}T12:00:00.000Z`,
  });
  if (payErr) throw payErr;

  let loyaltyPoints = 0;
  if (customerId) {
    loyaltyPoints = calcLoyaltyPoints(amount);
    if (loyaltyPoints > 0) {
      const { error: txErr } = await supabase.from("loyalty_transactions").insert({
        customer_id: customerId,
        order_id: order.id,
        points: loyaltyPoints,
        type: "earn",
      });
      if (txErr) throw txErr;

      const { data: cust, error: custErr } = await supabase
        .from("customers")
        .select("loyalty_points")
        .eq("id", customerId)
        .maybeSingle();
      if (custErr) throw custErr;
      const nextPoints = Number(cust?.loyalty_points ?? 0) + loyaltyPoints;
      const { error: updErr } = await supabase
        .from("customers")
        .update({ loyalty_points: nextPoints })
        .eq("id", customerId);
      if (updErr) throw updErr;
    }
  }

  return {
    orderId: order.id as string,
    orderNumber: order.order_number as string,
    loyaltyPoints,
  };
}

/** Tạo 1 bảo hành (và các bản ghi liên quan). Trả về id các row đã tạo. */
async function createOne(
  supabase: SB,
  orgId: string,
  userId: string,
  shopId: string | null,
  item: QuickItem,
): Promise<CreateResult> {
  const phone = normalizePhone(item.customer?.phone);
  const customerId = await findOrCreateCustomer(
    supabase,
    orgId,
    phone,
    item.customer?.full_name ?? null,
  );

  // Validate phiếu sửa chữa nếu được truyền vào (để admin không tạo BH treo).
  if (item.repair_ticket_id) {
    const { data: ticket, error: ticketErr } = await supabase
      .from("repair_tickets")
      .select("id")
      .eq("id", item.repair_ticket_id)
      .maybeSingle();
    if (ticketErr) throw ticketErr;
    if (!ticket) return { ok: false, error: "Phiếu sửa chữa không tồn tại" };
  }

  const serialNumberId = await findOrCreateSerial(supabase, item, item.start_date);

  // Tên máy (không có trong catalog) được lưu trong `note` theo quy ước
  // "Thiết bị: <tên>" — xem src/lib/warranties/quick-warranty.ts.
  const note = buildDeviceNote(item.device.name, item.note);

  const endDate =
    item.end_date ??
    (item.warranty_months && item.warranty_months > 0
      ? addMonthsIso(item.start_date, item.warranty_months)
      : null);

  const saleAmount =
    item.sale_amount != null && item.sale_amount > 0 ? item.sale_amount : 0;

  let orderId: string | null = null;
  let orderNumber: string | null = null;
  let loyaltyPoints = 0;

  if (saleAmount > 0) {
    const sale = await createQuickSaleOrder(supabase, {
      orgId,
      shopId,
      userId,
      customerId,
      item,
      amount: saleAmount,
      serialNumberId,
    });
    orderId = sale.orderId;
    orderNumber = sale.orderNumber;
    loyaltyPoints = sale.loyaltyPoints;
  }

  const { data: warranty, error: wErr } = await supabase
    .from("warranties")
    .insert({
      customer_id: customerId,
      serial_number_id: serialNumberId,
      repair_ticket_id:
        item.warranty_type === "repair" ? (item.repair_ticket_id ?? null) : null,
      order_id: orderId,
      warranty_type: item.warranty_type,
      start_date: item.start_date,
      end_date: endDate,
      status: item.status,
      note,
    })
    .select("id")
    .single();
  if (wErr) throw wErr;

  return {
    ok: true,
    warranty_id: warranty.id as string,
    serial_number_id: serialNumberId,
    customer_id: customerId,
    order_id: orderId,
    order_number: orderNumber,
    loyalty_points: loyaltyPoints,
  };
}

/** Gom message lỗi của zod thành chuỗi ngắn cho UI hiển thị theo từng dòng. */
function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".") || "dữ liệu"}: ${i.message}`)
    .join(" · ");
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser();
    // requirePermission trả về luôn orgId (qua requireOrg bên trong).
    const { orgId } = await requirePermission("warranties.create");
    const supabase = await createClient();

    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const shopId = (shop?.id as string | undefined) ?? null;

    const raw = await req.json();
    // Bulk: mỗi dòng validate RIÊNG → 1 dòng sai không làm hỏng cả batch.
    const isBulk = Array.isArray(raw);
    const rawItems: unknown[] = isBulk ? raw : [raw];
    if (rawItems.length === 0) {
      return handleError(Errors.badRequest("Danh sách bảo hành rỗng"));
    }
    if (rawItems.length > 500) {
      return handleError(Errors.badRequest("Tối đa 500 bản ghi mỗi lần"));
    }

    const results: CreateResult[] = [];
    for (const rawItem of rawItems) {
      const parsed = quickWarrantyItemSchema.safeParse(rawItem);
      if (!parsed.success) {
        results.push({ ok: false, error: formatZodError(parsed.error) });
        continue;
      }
      try {
        results.push(await createOne(supabase, orgId, user.id, shopId, parsed.data));
      } catch (e) {
        // Một dòng lỗi KHÔNG được làm hỏng cả batch → ghi lại lỗi dòng đó.
        const message = e instanceof Error ? e.message : "Lỗi không xác định";
        results.push({ ok: false, error: message });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "warranties",
      entityId: "",
      action: "create",
      afterData: { mode: isBulk ? "bulk" : "single", succeeded, failed },
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    const payload = {
      mode: isBulk ? ("bulk" as const) : ("single" as const),
      succeeded,
      failed,
      results,
    };
    // Trả 201 khi tạo được ít nhất 1 bản ghi; nếu hỏng hết thì 422 để UI báo lỗi.
    return ok(payload, { status: succeeded > 0 ? 201 : 422 });
  } catch (e) {
    return handleError(e);
  }
}

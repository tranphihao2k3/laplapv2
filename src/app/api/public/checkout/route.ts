import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

const BodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(20),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  address: z.string().trim().min(5).max(500),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  paymentMethod: z.enum(["cod", "bank_transfer"]).default("cod"),
  items: z.array(ItemSchema).min(1).max(50),
  voucherCode: z.string().trim().max(50).optional().or(z.literal("")),
});

function genOrderNumber() {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WEB${y}${m}${day}-${rand}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

type VoucherRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  quantity_total: number | null;
  quantity_used: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  applicable_products: string[] | null;
  applicable_categories: string[] | null;
  user_usage_limit: number | null;
};

type StockRow = {
  warehouse_id: string;
  product_variant_id: string;
  available_qty: number | null;
};

function fail(code: string, message: string, status = 400) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  const code = error?.code ?? "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation .* does not exist/i.test(error?.message ?? "")
  );
}

type VoucherResult =
  | { ok: true; voucher: VoucherRow; discount: number }
  | { ok: false; message: string };

/** Validate + tính giảm giá voucher ở server (không tin giá trị client gửi lên). */
async function resolveVoucher(
  admin: Admin,
  opts: {
    code: string;
    subtotal: number;
    productIds: string[];
    categoryIds: string[];
    authUserId: string | null;
    userIdentifier: string;
  },
): Promise<VoucherResult> {
  const raw = opts.code.trim();
  let voucher: VoucherRow | null = null;
  let lookupError: { code?: string; message?: string } | null = null;

  for (const candidate of [...new Set([raw, raw.toUpperCase(), raw.toLowerCase()])]) {
    const res = await admin
      .from("vouchers")
      .select(
        "id, code, name, type, value, min_order_amount, max_discount_amount, quantity_total, quantity_used, start_date, end_date, is_active, applicable_products, applicable_categories, user_usage_limit",
      )
      .eq("code", candidate)
      .maybeSingle();
    if (res.error) {
      lookupError = res.error;
      break;
    }
    if (res.data) {
      voucher = res.data as VoucherRow;
      break;
    }
  }

  if (lookupError) {
    if (isMissingTable(lookupError)) {
      return { ok: false, message: "Mã giảm giá hiện không khả dụng." };
    }
    throw lookupError;
  }
  if (!voucher) return { ok: false, message: "Mã voucher không tồn tại." };
  if (!voucher.is_active) return { ok: false, message: "Mã voucher đã bị vô hiệu hóa." };

  const now = Date.now();
  if (now < new Date(voucher.start_date).getTime()) {
    return { ok: false, message: "Voucher chưa bắt đầu." };
  }
  if (now > new Date(voucher.end_date).getTime()) {
    return { ok: false, message: "Voucher đã hết hạn." };
  }
  if (
    voucher.quantity_total !== null &&
    Number(voucher.quantity_used ?? 0) >= Number(voucher.quantity_total)
  ) {
    return { ok: false, message: "Voucher đã hết lượt sử dụng." };
  }

  const usageLimit = Number(voucher.user_usage_limit ?? 1);
  if (usageLimit > 0) {
    let usageQuery = admin
      .from("voucher_usages")
      .select("id", { count: "exact", head: true })
      .eq("voucher_id", voucher.id);
    usageQuery = opts.authUserId
      ? usageQuery.eq("user_id", opts.authUserId)
      : usageQuery.eq("user_identifier", opts.userIdentifier);
    const { count, error: uErr } = await usageQuery;
    if (uErr) {
      if (!isMissingTable(uErr)) throw uErr;
    } else if ((count ?? 0) >= usageLimit) {
      return { ok: false, message: "Bạn đã sử dụng voucher này rồi." };
    }
  }

  const minOrder = Number(voucher.min_order_amount ?? 0);
  if (opts.subtotal < minOrder) {
    return {
      ok: false,
      message: `Đơn hàng tối thiểu ${minOrder.toLocaleString("vi-VN")}đ để dùng voucher này.`,
    };
  }

  const applicableProducts = voucher.applicable_products ?? [];
  if (applicableProducts.length > 0) {
    const matched = opts.productIds.some((id) => applicableProducts.includes(id));
    if (!matched) {
      return { ok: false, message: "Giỏ hàng không có sản phẩm nào áp dụng voucher này." };
    }
  }

  const applicableCategories = voucher.applicable_categories ?? [];
  if (applicableCategories.length > 0) {
    const matched = opts.categoryIds.some((id) => applicableCategories.includes(id));
    if (!matched) {
      return { ok: false, message: "Giỏ hàng không có sản phẩm thuộc danh mục áp dụng voucher này." };
    }
  }

  let discount = 0;
  if (voucher.type === "percent") {
    discount = Math.round((opts.subtotal * Number(voucher.value)) / 100);
    if (voucher.max_discount_amount !== null) {
      discount = Math.min(discount, Number(voucher.max_discount_amount));
    }
  } else if (voucher.type === "fixed_amount") {
    discount = Math.min(Number(voucher.value), opts.subtotal);
  }
  discount = Math.max(0, Math.min(discount, opts.subtotal));

  return { ok: true, voucher, discount };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: { code: "INVALID_BODY", message: "Thông tin đặt hàng không hợp lệ." } },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const email = body.email || null;
    const note = body.note || null;
    const voucherCode = body.voucherCode || null;

    const admin = createAdminClient() as Admin;

    const { data: shop } = await admin
      .from("shops")
      .select("id, organization_id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!shop?.id) {
      return Response.json(
        { ok: false, error: { code: "NO_SHOP", message: "Cửa hàng chưa sẵn sàng nhận đơn. Vui lòng thử lại sau." } },
        { status: 503 },
      );
    }

    let authUserId: string | null = null;
    let customerId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      authUserId = user?.id ?? null;
      if (authUserId) {
        const { data: cust } = await admin
          .from("customers")
          .select("id")
          .eq("auth_user_id", authUserId)
          .is("deleted_at", null)
          .maybeSingle();
        customerId = cust?.id ?? null;
      }
    } catch {
      // guest checkout allowed
    }

    if (!customerId && body.phone) {
      const { data: byPhone } = await admin
        .from("customers")
        .select("id")
        .eq("phone", body.phone)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (byPhone?.id) customerId = byPhone.id;
    }
    if (!customerId && email) {
      const { data: byEmail } = await admin
        .from("customers")
        .select("id")
        .ilike("email", email)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (byEmail?.id) customerId = byEmail.id;
    }
    if (!customerId) {
      const { data: createdCust } = await admin
        .from("customers")
        .insert({
          full_name: body.fullName,
          phone: body.phone,
          email,
          organization_id: shop.organization_id ?? null,
        })
        .select("id")
        .single();
      customerId = createdCust?.id ?? null;
    }

    // Gộp các dòng trùng variant để kiểm tra tồn kho chính xác.
    const qtyByVariant = new Map<string, number>();
    for (const item of body.items) {
      const next = (qtyByVariant.get(item.variantId) ?? 0) + item.quantity;
      if (next > 99) {
        return fail("INVALID_ITEM", "Số lượng mỗi sản phẩm tối đa là 99.");
      }
      qtyByVariant.set(item.variantId, next);
    }
    const variantIds = [...qtyByVariant.keys()];

    const { data: variants, error: vErr } = await admin
      .from("product_variants")
      .select(
        "id, product_id, name, sku, selling_price, is_active, product:products(id,name,slug,thumbnail_url,status,category_id)",
      )
      .in("id", variantIds);
    if (vErr) throw vErr;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vMap = new Map<string, any>((variants ?? []).map((v: any) => [v.id, v]));

    const orderItems: Array<{
      product_variant_id: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      product_snapshot: Record<string, unknown>;
    }> = [];
    const categoryIds = new Set<string>();

    for (const [variantId, quantity] of qtyByVariant) {
      const v = vMap.get(variantId);
      if (!v || v.is_active === false) {
        return Response.json(
          { ok: false, error: { code: "INVALID_ITEM", message: "Một số sản phẩm không còn khả dụng. Vui lòng kiểm tra lại giỏ hàng." } },
          { status: 400 },
        );
      }
      const product = v.product;
      if (!product || product.status !== "active") {
        return Response.json(
          { ok: false, error: { code: "INVALID_ITEM", message: `Sản phẩm "${product?.name ?? v.sku}" hiện không khả dụng.` } },
          { status: 400 },
        );
      }
      if (product.category_id) categoryIds.add(product.category_id);
      const unit = Number(v.selling_price ?? 0);
      if (!(unit > 0)) {
        return Response.json(
          { ok: false, error: { code: "NO_PRICE", message: `Sản phẩm "${product.name}" chưa có giá bán. Vui lòng liên hệ cửa hàng.` } },
          { status: 400 },
        );
      }
      const total = unit * quantity;
      orderItems.push({
        product_variant_id: v.id,
        quantity,
        unit_price: unit,
        total_price: total,
        product_snapshot: {
          name: product.name,
          slug: product.slug,
          thumbnail_url: product.thumbnail_url,
          variant_name: v.name ?? null,
          sku: v.sku ?? null,
        },
      });
    }

    const subtotal = orderItems.reduce((s, i) => s + i.total_price, 0);

    // Voucher: validate + tính giảm giá ở server.
    let appliedVoucher: VoucherRow | null = null;
    let discountAmount = 0;
    if (voucherCode) {
      const productIds = [
        ...new Set(
          orderItems
            .map((i) => vMap.get(i.product_variant_id)?.product_id as string | undefined)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const result = await resolveVoucher(admin, {
        code: voucherCode,
        subtotal,
        productIds,
        categoryIds: [...categoryIds],
        authUserId,
        userIdentifier: body.phone,
      });
      if (!result.ok) return fail("INVALID_VOUCHER", result.message);
      appliedVoucher = result.voucher;
      discountAmount = result.discount;
    }

    // Tồn kho: chỉ chặn khi variant có dòng stock_levels (được quản lý tồn).
    const { data: warehouses } = await admin
      .from("warehouses")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    const warehouseIds: string[] = (warehouses ?? []).map((w: { id: string }) => w.id);

    let stockRows: StockRow[] = [];
    if (warehouseIds.length > 0) {
      const { data, error: stErr } = await admin
        .from("stock_levels")
        .select("warehouse_id, product_variant_id, available_qty")
        .in("product_variant_id", variantIds)
        .in("warehouse_id", warehouseIds);
      if (stErr) throw stErr;
      stockRows = (data ?? []) as StockRow[];
    }

    const stockByVariant = new Map<string, StockRow[]>();
    for (const row of stockRows) {
      const list = stockByVariant.get(row.product_variant_id) ?? [];
      list.push(row);
      stockByVariant.set(row.product_variant_id, list);
    }
    for (const list of stockByVariant.values()) {
      list.sort((a, b) => {
        if (a.warehouse_id === warehouseIds[0]) return -1;
        if (b.warehouse_id === warehouseIds[0]) return 1;
        return 0;
      });
    }

    for (const item of orderItems) {
      const rows = stockByVariant.get(item.product_variant_id);
      if (!rows || rows.length === 0) continue; // không quản lý tồn
      const available = rows.reduce((s, r) => s + Number(r.available_qty ?? 0), 0);
      if (available < item.quantity) {
        const name = (vMap.get(item.product_variant_id)?.product?.name as string) ?? "Sản phẩm";
        return fail(
          "OUT_OF_STOCK",
          available > 0
            ? `"${name}" chỉ còn ${available} sản phẩm. Vui lòng giảm số lượng.`
            : `"${name}" đã hết hàng.`,
        );
      }
    }

    const freeShipping = appliedVoucher?.type === "free_shipping";
    const totalAmount = Math.max(0, subtotal - discountAmount);
    const orderNumber = genOrderNumber();

    const shippingNote = [
      `Họ tên: ${body.fullName}`,
      `SĐT: ${body.phone}`,
      email ? `Email: ${email}` : null,
      `Địa chỉ: ${body.address}`,
      `Thanh toán: ${body.paymentMethod === "bank_transfer" ? "Chuyển khoản" : "COD"}`,
      appliedVoucher
        ? `Voucher: ${appliedVoucher.code}${discountAmount > 0 ? ` (-${discountAmount.toLocaleString("vi-VN")}đ)` : ""}${freeShipping ? " · Miễn phí vận chuyển" : ""}`
        : voucherCode
          ? `Mã voucher (không áp dụng được): ${voucherCode}`
          : null,
      note ? `Ghi chú: ${note}` : null,
    ].filter(Boolean).join("\n");

    const orderPayload: Record<string, unknown> = {
      order_number: orderNumber,
      shop_id: shop.id,
      customer_id: customerId,
      channel: "online",
      status: "pending",
      payment_status: "unpaid",
      fulfillment_status: "unfulfilled",
      subtotal,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      note: shippingNote,
      organization_id: shop.organization_id ?? null,
    };
    // Chỉ ghi cột voucher khi thật sự có voucher → không vỡ DB chưa migrate.
    if (appliedVoucher) {
      orderPayload.voucher_id = appliedVoucher.id;
      orderPayload.voucher_discount = discountAmount;
    }

    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert(orderPayload)
      .select("id, order_number, status, payment_status, total_amount, subtotal, discount_amount, created_at")
      .single();
    if (oErr) throw oErr;

    const deductions: Array<{ warehouseId: string; variantId: string; quantity: number }> = [];
    let usageRecorded = false;

    async function rollback() {
      try {
        for (const d of deductions) {
          const { data: cur } = await admin
            .from("stock_levels")
            .select("available_qty")
            .eq("warehouse_id", d.warehouseId)
            .eq("product_variant_id", d.variantId)
            .maybeSingle();
          const restored = Number(cur?.available_qty ?? 0) + d.quantity;
          await admin
            .from("stock_levels")
            .update({ available_qty: restored })
            .eq("warehouse_id", d.warehouseId)
            .eq("product_variant_id", d.variantId);
        }
        await admin
          .from("inventory_transactions")
          .delete()
          .eq("reference_type", "order")
          .eq("reference_id", order.id);
        if (usageRecorded && appliedVoucher) {
          await admin.from("voucher_usages").delete().eq("order_id", order.id);
          const { data: vcur } = await admin
            .from("vouchers")
            .select("quantity_used")
            .eq("id", appliedVoucher.id)
            .maybeSingle();
          const used = Math.max(0, Number(vcur?.quantity_used ?? 1) - 1);
          await admin.from("vouchers").update({ quantity_used: used }).eq("id", appliedVoucher.id);
        }
        await admin.from("payments").delete().eq("order_id", order.id);
        await admin.from("order_items").delete().eq("order_id", order.id);
        await admin.from("orders").delete().eq("id", order.id);
      } catch {
        // rollback best-effort
      }
    }

    try {
      const itemsPayload = orderItems.map((it) => ({ ...it, order_id: order.id }));
      const { error: iErr } = await admin.from("order_items").insert(itemsPayload);
      if (iErr) throw iErr;

      // Thanh toán ghi nhận best-effort: đơn hàng vẫn hợp lệ nếu bảng payments lỗi.
      await admin.from("payments").insert({
        order_id: order.id,
        method: body.paymentMethod === "bank_transfer" ? "transfer" : "cod",
        amount: totalAmount,
        status: "unpaid",
      });

      if (appliedVoucher) {
        const { error: uErr } = await admin.from("voucher_usages").insert({
          voucher_id: appliedVoucher.id,
          user_id: authUserId,
          user_identifier: body.phone,
          order_id: order.id,
          discount_amount: discountAmount,
        });
        if (uErr) throw uErr;
        usageRecorded = true;

        if (customerId) {
          await admin
            .from("voucher_claims")
            .update({ used_at: new Date().toISOString(), order_id: order.id })
            .eq("customer_id", customerId)
            .eq("voucher_id", appliedVoucher.id)
            .is("used_at", null);
        }
      }

      // Trừ tồn kho theo từng kho (kho chính trước), chống race bằng điều kiện available_qty.
      for (const item of orderItems) {
        const rows = stockByVariant.get(item.product_variant_id);
        if (!rows || rows.length === 0) continue;
        let remaining = item.quantity;
        for (const row of rows) {
          if (remaining <= 0) break;
          const have = Number(row.available_qty ?? 0);
          if (have <= 0) continue;
          const take = Math.min(have, remaining);
          const next = have - take;

          const { data: updated, error: updErr } = await admin
            .from("stock_levels")
            .update({ available_qty: next })
            .eq("warehouse_id", row.warehouse_id)
            .eq("product_variant_id", item.product_variant_id)
            .eq("available_qty", have)
            .select("warehouse_id");
          if (updErr) throw updErr;
          if (!updated || updated.length === 0) {
            throw new Error("Tồn kho vừa thay đổi, vui lòng thử lại.");
          }
          deductions.push({
            warehouseId: row.warehouse_id,
            variantId: item.product_variant_id,
            quantity: take,
          });

          const name = (vMap.get(item.product_variant_id)?.product?.name as string) ?? "Sản phẩm";
          await admin.from("inventory_transactions").insert({
            organization_id: shop.organization_id ?? null,
            warehouse_id: row.warehouse_id,
            product_variant_id: item.product_variant_id,
            type: "sale",
            quantity: -take,
            unit_cost: 0,
            reference_type: "order",
            reference_id: order.id,
            note: `Đơn online ${order.order_number} · ${name}`,
            created_by: null,
          });
          remaining -= take;
        }
        if (remaining > 0) {
          const name = (vMap.get(item.product_variant_id)?.product?.name as string) ?? "Sản phẩm";
          throw new Error(`"${name}" không đủ tồn kho.`);
        }
      }
    } catch (e) {
      await rollback();
      throw e;
    }

    return Response.json(
      {
        ok: true,
        data: {
          order,
          voucher: appliedVoucher
            ? {
                code: appliedVoucher.code,
                name: appliedVoucher.name,
                discount_amount: discountAmount,
                free_shipping: freeShipping,
              }
            : null,
        },
      },
      { status: 201 },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Không thể tạo đơn hàng.";
    return Response.json(
      { ok: false, error: { code: "CHECKOUT_FAILED", message } },
      { status: 500 },
    );
  }
}

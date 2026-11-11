import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

    const admin = createAdminClient() as any;

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

    const variantIds = body.items.map((i) => i.variantId);
    const { data: variants, error: vErr } = await admin
      .from("product_variants")
      .select("id, product_id, name, sku, selling_price, is_active, product:products(id,name,slug,thumbnail_url,status)")
      .in("id", variantIds);
    if (vErr) throw vErr;
    const vMap = new Map<string, any>((variants ?? []).map((v: any) => [v.id, v]));

    const orderItems: Array<{
      product_variant_id: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      product_snapshot: any;
    }> = [];

    for (const item of body.items) {
      const v = vMap.get(item.variantId);
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
      const unit = Number(v.selling_price ?? 0);
      if (!(unit > 0)) {
        return Response.json(
          { ok: false, error: { code: "NO_PRICE", message: `Sản phẩm "${product.name}" chưa có giá bán. Vui lòng liên hệ cửa hàng.` } },
          { status: 400 },
        );
      }
      const total = unit * item.quantity;
      orderItems.push({
        product_variant_id: v.id,
        quantity: item.quantity,
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
    const discountAmount = 0;
    const totalAmount = Math.max(0, subtotal - discountAmount);
    const orderNumber = genOrderNumber();

    const shippingNote = [
      `Họ tên: ${body.fullName}`,
      `SĐT: ${body.phone}`,
      email ? `Email: ${email}` : null,
      `Địa chỉ: ${body.address}`,
      `Thanh toán: ${body.paymentMethod === "bank_transfer" ? "Chuyển khoản" : "COD"}`,
      voucherCode ? `Mã voucher (khách nhập): ${voucherCode}` : null,
      note ? `Ghi chú: ${note}` : null,
    ].filter(Boolean).join("\n");

    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
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
      })
      .select("id, order_number, status, payment_status, total_amount, subtotal, discount_amount, created_at")
      .single();
    if (oErr) throw oErr;

    const itemsPayload = orderItems.map((it) => ({ ...it, order_id: order.id }));
    const { error: iErr } = await admin.from("order_items").insert(itemsPayload);
    if (iErr) {
      await admin.from("orders").delete().eq("id", order.id);
      throw iErr;
    }

    try {
      await admin.from("payments").insert({
        order_id: order.id,
        method: body.paymentMethod === "bank_transfer" ? "transfer" : "cod",
        amount: totalAmount,
        status: "unpaid",
      });
    } catch {
      // non-fatal
    }

    return Response.json({ ok: true, data: { order } }, { status: 201 });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: { code: "CHECKOUT_FAILED", message: e?.message || "Không thể tạo đơn hàng." } },
      { status: 500 },
    );
  }
}

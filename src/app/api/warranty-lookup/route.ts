import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Vui lòng nhập số serial/IMEI hoặc số điện thoại" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const isPhone = /^[0-9]{9,11}$/.test(query);

  let warranties: any[] = [];
  let customerInfo: { full_name: string | null; phone: string | null } | null = null;

  if (isPhone) {
    const { data: customers, error: customerErr } = await supabase
      .from("customers")
      .select("id, full_name, phone")
      .eq("phone", query);

    if (customerErr || !customers || customers.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy khách hàng với số điện thoại này" },
        { status: 404 }
      );
    }

    customerInfo = { full_name: customers[0].full_name, phone: customers[0].phone };
    const customerIds = customers.map(c => c.id);

    const { data, error } = await supabase
      .from("warranties")
      .select(`
        id, start_date, end_date, status,
        order:orders(id, order_number, created_at),
        serial:serial_numbers(id, serial, imei)
      `)
      .in("customer_id", customerIds)
      .order("start_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Lỗi truy vấn: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy bảo hành nào cho số điện thoại này" },
        { status: 404 }
      );
    }

    warranties = data;
  } else {
    const { data: serials, error: serialErr } = await supabase
      .from("serial_numbers")
      .select("id, serial, imei")
      .or(`serial.eq.${query},imei.eq.${query}`);

    if (serialErr || !serials || serials.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy số serial/IMEI này trong hệ thống" },
        { status: 404 }
      );
    }

    const serialIds = serials.map(s => s.id);

    const { data, error } = await supabase
      .from("warranties")
      .select(`
        id, start_date, end_date, status,
        customer:customers(id, full_name, phone),
        order:orders(id, order_number, created_at),
        serial:serial_numbers(id, serial, imei)
      `)
      .in("serial_number_id", serialIds)
      .order("start_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Lỗi truy vấn: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy bảo hành nào cho serial/IMEI này" },
        { status: 404 }
      );
    }

    warranties = data;
    const firstCustomer = Array.isArray(data[0].customer)
      ? data[0].customer[0]
      : data[0].customer;
    customerInfo = firstCustomer
      ? { full_name: firstCustomer.full_name, phone: firstCustomer.phone }
      : null;
  }

  // Batch lấy product info cho tất cả warranties
  const orderIds = warranties.filter(w => w.order?.id).map(w => w.order.id);
  const serialIds = warranties.filter(w => w.serial?.id).map(w => w.serial.id);

  const orderItemMap = new Map<string, { product_name: string; product_sku: string | null }>();
  const serialProductMap = new Map<string, { product_name: string; product_sku: string | null }>();

  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select(`
        order_id,
        product_variant:product_variants(id, sku, name,
          product:products(id, name)
        )
      `)
      .in("order_id", orderIds);

    if (items) {
      for (const item of items) {
        if (!orderItemMap.has(item.order_id)) {
          const pv = item.product_variant as any;
          if (pv) {
            orderItemMap.set(item.order_id, {
              product_name: pv.product?.name ?? pv.name ?? "Sản phẩm không xác định",
              product_sku: pv.sku ?? null,
            });
          }
        }
      }
    }
  }

  if (serialIds.length > 0) {
    const { data: serials } = await supabase
      .from("serial_numbers")
      .select(`
        id,
        product_variant:product_variants(id, sku, name,
          product:products(id, name)
        )
      `)
      .in("id", serialIds);

    if (serials) {
      for (const s of serials) {
        const pv = s.product_variant as any;
        if (pv) {
          serialProductMap.set(s.id, {
            product_name: pv.product?.name ?? pv.name ?? "Sản phẩm không xác định",
            product_sku: pv.sku ?? null,
          });
        }
      }
    }
  }

  const result = warranties.map(w => {
    const productInfo = w.serial?.id
      ? serialProductMap.get(w.serial.id)
      : w.order?.id
        ? orderItemMap.get(w.order.id)
        : null;

    const pn = productInfo?.product_name ?? "Sản phẩm không xác định";
    const sku = productInfo?.product_sku ?? null;

    const startDate = new Date(w.start_date);
    const endDate = new Date(w.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const daysLeft = Math.round((endDate.getTime() - today.getTime()) / 86400000);
    const warrantyMonths =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()) +
      (endDate.getDate() >= startDate.getDate() ? 0 : -1);

    return {
      id: w.id,
      product_name: pn,
      product_sku: sku,
      serial_number: w.serial?.serial ?? w.serial?.imei ?? null,
      order_number: w.order?.order_number ?? null,
      purchase_date: w.order?.created_at ?? w.start_date,
      warranty_start: w.start_date,
      warranty_end: w.end_date,
      warranty_months: warrantyMonths,
      status: w.status,
      days_left: daysLeft,
    };
  });

  return NextResponse.json({
    customer: customerInfo,
    warranties: result,
    total: result.length,
  });
}

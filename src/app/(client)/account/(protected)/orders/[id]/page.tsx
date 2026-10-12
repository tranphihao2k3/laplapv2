import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireCustomer, isStaffUser } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";
import { OrderDetailView, type RepairInfo } from "./_sections/order-detail-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const me = await requireCustomer();
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data } = await db
    .from("orders")
    .select("order_number")
    .eq("id", id)
    .eq("customer_id", me.customerId ?? "")
    .maybeSingle();

  return {
    title: data ? `Đơn #${data.order_number}` : "Đơn hàng",
  };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireCustomer();

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [orderRes, itemsRes, paymentsRes, logsRes, returnsRes, ticketRes] =
    await Promise.all([
      db
        .from("orders")
        .select(
          "id, order_number, status, payment_status, fulfillment_status, channel, subtotal, discount_amount, total_amount, note, created_at, customer_id, shop_id, shop:shops(id, name, phone, address)",
        )
        .eq("id", id)
        .maybeSingle(),
      db
        .from("order_items")
        .select(
          "id, product_variant_id, quantity, unit_price, total_price, product_snapshot, product_variant:product_variants(id, sku, name, product:products(id, name, slug, thumbnail_url))",
        )
        .eq("order_id", id),
      db
        .from("payments")
        .select("id, amount, method, status, paid_at, note")
        .eq("order_id", id)
        .order("paid_at", { ascending: false }),
      db
        .from("order_status_logs")
        .select("id, status, note, created_at, actor")
        .eq("order_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("return_orders")
        .select("id, status, reason, created_at, refund_amount")
        .eq("order_id", id)
        .order("created_at", { ascending: false }),
      // For repair orders, fetch the linked repair_ticket for full device info.
      // Falls back to `null` if no ticket is linked (e.g. product order or pre-migration data).
      db
        .from("repair_tickets")
        .select(
          "id, device_name, device_brand, device_model, device_serial, device_condition, issue_description, accessories, technician_name, estimated_completion",
        )
        .eq("order_id", id)
        .maybeSingle(),
    ]);

  if (!orderRes.data) {
    console.error(
      "[order detail 404] order not found: " +
        JSON.stringify(
          {
            orderId: id,
            orderResError: orderRes.error?.message ?? null,
          },
          null,
          2,
        ),
    );
    notFound();
  }

  // Access control:
  //  - Owner: customer_id === me.customerId
  //  - Staff bypass: admin/internal staff can view any order (handle repair/POS orders)
  //  - Email match was the previous fallback, but orders.customer_snapshot column
  //    does not exist in the schema, so we drop that path entirely.
  const staffBypass = isStaffUser(me.email);
  const isOwner = orderRes.data.customer_id === me.customerId;

  if (!isOwner && !staffBypass) {
    console.error(
      "[order detail 404] " +
        JSON.stringify(
          {
            orderId: id,
            orderNumber: orderRes.data.order_number,
            orderCustomerId: orderRes.data.customer_id,
            meCustomerId: me.customerId,
            meAuthId: me.id,
            meEmail: me.email,
            staffBypass,
            orderResError: orderRes.error?.message ?? null,
          },
          null,
          2,
        ),
    );
    notFound();
  }

  // Build repair info from the joined repair_ticket (preferred) or from
  // the product_snapshot of the first repair-fee item.
  let repair: RepairInfo | null = null;
  const ticket = ticketRes.data;
  if (ticket) {
    repair = {
      device_name: ticket.device_name ?? null,
      device_brand: ticket.device_brand ?? null,
      device_model: ticket.device_model ?? null,
      device_serial: ticket.device_serial ?? null,
      device_condition: ticket.device_condition ?? null,
      issue_description: ticket.issue_description ?? null,
      accessories: ticket.accessories ?? null,
      technician_name: ticket.technician_name ?? null,
      estimated_completion: ticket.estimated_completion ?? null,
    };
  } else {
    // Fallback: read device info from product_snapshot of a "repair_fee" item.
    const repairItem = (itemsRes.data ?? []).find(
      (it: { product_snapshot?: { kind?: string } | null }) =>
        it.product_snapshot &&
        typeof it.product_snapshot === "object" &&
        (it.product_snapshot as { kind?: string }).kind === "repair_fee",
    );
    if (repairItem) {
      const snap = repairItem.product_snapshot as {
        device_name?: string | null;
        serial_number?: string | null;
      };
      repair = {
        device_name: snap.device_name ?? null,
        device_brand: null,
        device_model: null,
        device_serial: snap.serial_number ?? null,
        device_condition: null,
        issue_description: null,
        accessories: null,
        technician_name: null,
        estimated_completion: null,
      };
    }
  }

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
        <Link href="/account/orders">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Quay lại danh sách đơn
        </Link>
      </Button>
      <OrderDetailView
        order={orderRes.data}
        items={itemsRes.data ?? []}
        payments={paymentsRes.data ?? []}
        statusLogs={logsRes.data ?? []}
        returns={returnsRes.data ?? []}
        repair={repair}
      />
    </div>
  );
}

/**
 * Repair checkout — tính tiền phí sửa chữa, tạo hóa đơn RIÊNG cho phí sửa.
 *
 * Phí sửa KHÔNG phải sản phẩm tồn kho nên không đi qua RPC `checkout_order`
 * (vốn check stock + cần product_variant_id thật). Thay vào đó tạo thủ công:
 *   order (channel=repair) → order_item (product_variant_id NULL) → payment
 * rồi chuyển ticket sang `delivered`. Dùng chung cho cả nút trong trang
 * repair-tickets lẫn màn POS.
 */
import type { RepairCheckoutInput } from "@/lib/validators/sales";
import type { DB } from "@/lib/api/guard";

type CheckoutArgs = RepairCheckoutInput & {
  ticketId: string;
  userId: string;
  orgId: string;
};

export const repairCheckoutService = {
  async checkout(db: DB, { ticketId, payment, actual_cost, note, userId, orgId }: CheckoutArgs) {
    const { data: ticket, error: ticketErr } = await db
      .from("repair_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketErr) throw ticketErr;
    if (!ticket) {
      throw Object.assign(new Error("Phiếu sửa không tồn tại"), { status: 404 });
    }
    if (ticket.status !== "done") {
      throw Object.assign(
        new Error("Chỉ tính tiền cho phiếu đã sửa xong (Đã sửa xong)"),
        { status: 409 },
      );
    }

    // Ưu tiên phí sửa được chỉnh trực tiếp ở POS, nếu không dùng chi phí đã lưu trên phiếu.
    const amount =
      actual_cost != null && actual_cost > 0
        ? actual_cost
        : ticket.actual_cost ?? ticket.estimated_cost ?? 0;
    if (!amount || amount <= 0) {
      throw Object.assign(
        new Error("Phiếu chưa có chi phí sửa (chi phí thực tế / dự kiến)"),
        { status: 400 },
      );
    }

    const { data: order, error: orderErr } = await db
      .from("orders")
      .insert({
        organization_id: orgId,
        shop_id: ticket.shop_id,
        customer_id: ticket.customer_id,
        order_number: `LPL-REPAIR-${Date.now()}`,
        channel: "repair",
        status: "completed",
        payment_status: "paid",
        fulfillment_status: "delivered",
        subtotal: amount,
        discount_amount: 0,
        total_amount: amount,
        note: note ?? `Thanh toán sửa chữa: ${ticket.device_name ?? ""}`.trim(),
        created_by: userId,
      })
      .select("id, order_number")
      .single();

    if (orderErr) throw orderErr;

    const { error: itemErr } = await db.from("order_items").insert({
      order_id: order.id,
      product_variant_id: null,
      quantity: 1,
      unit_price: amount,
      total_price: amount,
      product_snapshot: {
        kind: "repair_fee",
        repair_ticket_id: ticket.id,
        device_name: ticket.device_name,
        serial_number: ticket.serial_number,
      },
    });
    if (itemErr) throw itemErr;

    // Nút trong trang repair có thể không truyền payment.amount → mặc định = phí sửa.
    const paidAmount = payment.amount > 0 ? payment.amount : amount;
    const { error: payErr } = await db.from("payments").insert({
      order_id: order.id,
      method: payment.method,
      amount: paidAmount,
      status: "paid",
      transaction_code: payment.transaction_code ?? null,
      paid_at: new Date().toISOString(),
    });
    if (payErr) throw payErr;

    // Ghi lại phí sửa thực tế đã chốt (đồng bộ với hoá đơn) + chuyển trạng thái.
    const { error: updErr } = await db
      .from("repair_tickets")
      .update({ status: "delivered", actual_cost: amount })
      .eq("id", ticketId);
    if (updErr) throw updErr;

    return { order_id: order.id, order_number: order.order_number };
  },
};

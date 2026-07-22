/**
 * Checkout + cancel order — wrap RPC `checkout_order` / `cancel_order` (xem migrations/002_rpc.sql).
 * Đặt logic ở Postgres function để đảm bảo atomicity (trừ stock, ghi inventory_tx, payment, loyalty trong 1 tx).
 */
import type { CheckoutInput } from "@/lib/validators/sales";
import type { DB } from "@/lib/api/guard";

export const checkoutService = {
  async checkout(db: DB, input: CheckoutInput) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc("checkout_order", {
      payload: input,
    });
    if (error) throw error;
    return data;
  },

  async cancel(db: DB, orderId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc("cancel_order", { p_order_id: orderId });
    if (error) throw error;
    return data;
  },
};

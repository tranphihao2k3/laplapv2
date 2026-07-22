/**
 * Return orders — wrap RPC create_return_order / approve_return_order.
 * Logic ở Postgres để đảm bảo atomicity (insert return + items + cộng stock + ghi inventory_tx trong 1 tx).
 */
import type { DB } from "@/lib/api/guard";
import type { ReturnOrderCreateInput } from "@/lib/validators/sales";

export const returnsService = {
  async create(db: DB, input: ReturnOrderCreateInput) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc("create_return_order", {
      payload: input,
    });
    if (error) throw error;
    return data;
  },

  async approve(db: DB, returnId: string, warehouseId?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc("approve_return_order", {
      p_return_id: returnId,
      p_warehouse_id: warehouseId ?? null,
    });
    if (error) throw error;
    return data;
  },
};

/**
 * Đổi trạng thái đơn hàng thủ công (có ghi note vào status_logs).
 * Wrap RPC change_order_status.
 */
export const orderStatusService = {
  async change(
    db: DB,
    orderId: string,
    input: {
      to_status?: string;
      to_payment_status?: string;
      to_fulfillment_status?: string;
      note?: string;
    },
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any).rpc("change_order_status", {
      p_order_id: orderId,
      p_to_status: input.to_status ?? null,
      p_to_payment_status: input.to_payment_status ?? null,
      p_to_fulfillment_status: input.to_fulfillment_status ?? null,
      p_note: input.note ?? null,
    });
    if (error) throw error;
    return data;
  },
};

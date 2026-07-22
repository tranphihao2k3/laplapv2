/**
 * Wrap RPC inventory: receive purchase order, transfer between warehouses.
 */
import type { Json } from "@/types/database";
import type { DB } from "@/lib/api/guard";

export const inventoryActionsService = {
  async receivePurchaseOrder(
    db: DB,
    poId: string,
    serials?: Array<{ product_variant_id: string; serial?: string | null; imei?: string | null }>,
  ) {
    const { data, error } = await db.rpc("receive_purchase_order", {
      p_po_id: poId,
      p_serials: (serials ?? null) as unknown as Json,
    });
    if (error) throw error;
    return data;
  },

  async transfer(
    db: DB,
    payload: {
      from_warehouse: string;
      to_warehouse: string;
      items: Array<{ product_variant_id: string; quantity: number }>;
      note?: string | null;
    },
  ) {
    const { data, error } = await db.rpc("transfer_inventory", {
      p_from_warehouse: payload.from_warehouse,
      p_to_warehouse: payload.to_warehouse,
      p_items: payload.items as unknown as Json,
      p_note: payload.note ?? null,
    });
    if (error) throw error;
    return data;
  },
};

/**
 * POS session open/close. Open viết JS (insert pos_sessions), Close gọi RPC để tính expected_cash.
 */
import { Errors } from "@/lib/api/response";
import type { DB } from "@/lib/api/guard";

export const posSessionActionsService = {
  async open(db: DB, userId: string, payload: { shop_id: string; opening_cash: number }) {
    // Chặn nếu user còn session đang mở ở shop này
    const { data: opening } = await db
      .from("pos_sessions")
      .select("id")
      .eq("opened_by", userId)
      .eq("shop_id", payload.shop_id)
      .is("closed_at", null)
      .maybeSingle();
    if (opening) throw Errors.conflict("Bạn đang có ca POS chưa đóng");

    const { data, error } = await db
      .from("pos_sessions")
      .insert({
        shop_id: payload.shop_id,
        opened_by: userId,
        opened_at: new Date().toISOString(),
        opening_cash: payload.opening_cash,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async close(db: DB, sessionId: string, closingCash: number) {
    const { data, error } = await db.rpc("close_pos_session", {
      p_session_id: sessionId,
      p_closing_cash: closingCash,
    });
    if (error) throw error;
    return data;
  },
};

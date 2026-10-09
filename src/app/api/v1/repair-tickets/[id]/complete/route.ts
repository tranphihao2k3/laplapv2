/**
 * POST /api/v1/repair-tickets/[id]/complete
 *
 * Đánh dấu phiếu sửa chữa là "Đã sửa xong" (status = 'done'),
 * ghi nhận cách xử lý + thời điểm hoàn tất.
 * Nếu ticket có `warranty_months > 0`, tự động tạo 1 warranty
 *   warranty_type = 'repair' liên kết với ticket này.
 *
 * Body: { repair_solution?: string, warranty_months?: number }
 *
 * Phản hồi: { ticket, warranty? } — warranty null nếu không tạo BH.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";

const completeSchema = z.object({
  repair_solution: z.string().trim().max(2000).optional().nullable(),
  // Số tháng BH; 0 / null / undefined = không cấp BH
  warranty_months: z.number().int().min(0).max(120).optional().nullable(),
  // Cho phép override ngày bắt đầu BH (mặc định = hôm nay)
  warranty_start: z.string().datetime().optional().nullable(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("repair_tickets.update");
    const supabase = await createClient();
    const { id } = await ctx.params;

    const body = completeSchema.parse((await req.json().catch(() => ({}))) ?? {});

    // 1. Lấy ticket hiện tại
    const { data: ticket, error: tErr } = await supabase
      .from("repair_tickets")
      .select("*")
      .eq("id", id)
      .single();
    if (tErr || !ticket) {
      return new Response(
        JSON.stringify({ ok: false, error: { message: "Không tìm thấy phiếu sửa chữa" } }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (ticket.status === "delivered" || ticket.status === "cancelled") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { message: `Phiếu đang ở trạng thái '${ticket.status}', không thể hoàn tất.` },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }

    const months = body.warranty_months ?? ticket.warranty_months ?? 0;
    const nowIso = new Date().toISOString();

    // 2. Cập nhật ticket: status = done, completed_at, solution, warranty_months
    const { data: updatedTicket, error: uErr } = await supabase
      .from("repair_tickets")
      .update({
        status: "done",
        completed_at: nowIso,
        repair_solution: body.repair_solution ?? ticket.repair_solution ?? null,
        warranty_months: months > 0 ? months : null,
      })
      .eq("id", id)
      .select()
      .single();
    if (uErr) throw uErr;

    // 3. Nếu có yêu cầu cấp BH → tạo warranty mới
    let warranty: Record<string, unknown> | null = null;
    if (months > 0 && ticket.customer_id) {
      // Tránh tạo trùng: nếu đã có warranty 'repair' cho ticket này thì bỏ qua
      const { data: existing } = await supabase
        .from("warranties")
        .select("id")
        .eq("repair_ticket_id", id)
        .eq("warranty_type", "repair")
        .maybeSingle();

      if (!existing) {
        const startDate = body.warranty_start ?? nowIso;
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + months);

        const noteParts: string[] = [];
        if (body.repair_solution) noteParts.push(body.repair_solution);
        noteParts.push(`BH ${months} tháng sau sửa chữa`);

        const { data: w, error: wErr } = await supabase
          .from("warranties")
          .insert({
            customer_id: ticket.customer_id,
            shop_id: ticket.shop_id ?? null,
            repair_ticket_id: id,
            warranty_type: "repair",
            start_date: startDate,
            end_date: endDate.toISOString(),
            status: "active",
            note: noteParts.join(" · "),
          })
          .select()
          .single();
        if (wErr) throw wErr;
        warranty = w as Record<string, unknown>;
      } else {
        // Đã có → trả về để FE biết
        const { data: w } = await supabase
          .from("warranties")
          .select("*")
          .eq("id", existing.id)
          .single();
        warranty = (w as Record<string, unknown>) ?? null;
      }
    }

    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "repair_tickets",
      entityId: id,
      action: "action",
      afterData: {
        status: "done",
        completed_at: nowIso,
        warranty_months: months,
        warranty_id: warranty?.id ?? null,
      },
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    return ok({ ticket: updatedTicket, warranty });
  } catch (e) {
    return handleError(e);
  }
}

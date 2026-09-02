import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleError, Errors } from "@/lib/api/response";
import type { ActiveVoucher, ValidateVoucherResponse } from "@/types/voucher";
import { validateVoucherSchema } from "@/lib/validators/voucher";

/**
 * GET /api/public/vouchers
 * List available vouchers for current user (public, no auth required)
 * Returns active vouchers that are within validity period and have remaining quantity
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("active_vouchers")
      .select("*")
      .order("value", { ascending: false });

    if (error) throw error;

    return ok({ items: (data ?? []) as ActiveVoucher[] });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * POST /api/public/vouchers/validate
 * Validate a voucher code against an order
 * Public endpoint - no auth required, but user_id used for usage tracking
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = validateVoucherSchema.safeParse(body);

    if (!parsed.success) {
      throw Errors.badRequest(parsed.error.message);
    }

    const { code, order_amount, user_id, product_ids, category_ids } = parsed.data;
    const supabase = await createClient();

    // Call the database function to validate voucher
    const { data, error } = await supabase.rpc("validate_voucher", {
      p_code: code.toUpperCase().trim(),
      p_order_amount: order_amount,
      p_user_id: user_id ?? null,
      p_product_ids: product_ids ?? [],
      p_category_ids: category_ids ?? [],
    });

    if (error) throw error;

    // The RPC returns a table result
    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      return ok<ValidateVoucherResponse>({
        valid: false,
        voucher_id: null,
        voucher_type: null,
        voucher_name: null,
        discount_amount: null,
        error_message: "Không thể xác thực voucher",
      });
    }

    return ok<ValidateVoucherResponse>({
      valid: result.valid,
      voucher_id: result.voucher_id,
      voucher_type: result.voucher_type,
      voucher_name: result.voucher_name,
      discount_amount: result.discount_amount,
      error_message: result.error_message,
    });
  } catch (e) {
    return handleError(e);
  }
}

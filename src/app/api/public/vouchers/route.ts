import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, handleError, Errors } from "@/lib/api/response";
import type { ActiveVoucher, ValidateVoucherResponse, Voucher } from "@/types/voucher";
import { validateVoucherSchema } from "@/lib/validators/voucher";
import { calculateDiscount } from "@/types/voucher";

/**
 * GET /api/public/vouchers
 * Danh sách voucher đang hiệu lực cho client (banner + ví voucher).
 */
export async function GET() {
  try {
    const admin = createAdminClient() as any;
    const { data, error } = await admin
      .from("active_vouchers")
      .select("*")
      .order("value", { ascending: false });

    if (error) {
      // Chưa apply migration voucher → coi như chưa có ưu đãi, không làm sập web.
      if (error.code === "PGRST205" || error.code === "42P01") {
        return ok({ items: [] as ActiveVoucher[] });
      }
      throw error;
    }

    return ok({ items: (data ?? []) as ActiveVoucher[] });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * POST /api/public/vouchers
 * Validate mã voucher cho giỏ hàng. Không bắt buộc đăng nhập.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = validateVoucherSchema.safeParse(body);

    if (!parsed.success) {
      throw Errors.badRequest(parsed.error.message);
    }

    const { code, order_amount, user_id, product_ids, category_ids } = parsed.data;
    const admin = createAdminClient() as any;

    // User đang đăng nhập (nếu có) để check giới hạn lượt dùng mỗi user.
    let authUserId: string | null = user_id ?? null;
    if (!authUserId) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        authUserId = user?.id ?? null;
      } catch {
        // guest
      }
    }

    // Nếu client chỉ gửi product_ids, tự suy ra category_ids để validate
    // điều kiện applicable_categories.
    let categoryIds = category_ids ?? [];
    if (categoryIds.length === 0 && product_ids?.length) {
      const { data: products } = await admin
        .from("products")
        .select("id, category_id")
        .in("id", product_ids);
      categoryIds = Array.from(
        new Set(
          (products ?? [])
            .map((p: { category_id: string | null }) => p.category_id)
            .filter((id: string | null): id is string => !!id),
        ),
      );
    }

    const { data, error } = await admin.rpc("validate_voucher", {
      p_code: code.toUpperCase().trim(),
      p_order_amount: order_amount,
      p_user_id: authUserId,
      p_product_ids: product_ids ?? [],
      p_category_ids: categoryIds,
    });

    if (error) {
      // Function chưa tồn tại → fallback validate bằng JS (vẫn dùng bảng vouchers).
      // 42702: function cũ có OUT param trùng tên cột voucher_id (ambiguous),
      // chỉ xảy ra khi đã đăng nhập → dùng JS cho tới khi DB được cập nhật.
      if (error.code === "42883" || error.code === "PGRST202" || error.code === "42702") {
        return ok(await validateWithJs(admin, {
          code,
          orderAmount: order_amount,
          userId: authUserId,
          productIds: product_ids ?? [],
          categoryIds,
        }));
      }
      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      return ok<ValidateVoucherResponse>({
        valid: false,
        voucher_id: null,
        voucher_type: null,
        voucher_name: null,
        voucher_value: null,
        voucher_min_order_amount: null,
        voucher_max_discount_amount: null,
        discount_amount: null,
        error_message: "Không thể xác thực voucher",
      });
    }

    const voucher = result.voucher_id
      ? ((await admin
          .from("vouchers")
          .select("value, min_order_amount, max_discount_amount")
          .eq("id", result.voucher_id)
          .maybeSingle()).data as Pick<
            Voucher,
            "value" | "min_order_amount" | "max_discount_amount"
          > | null)
      : null;

    return ok<ValidateVoucherResponse>({
      valid: Boolean(result.valid),
      voucher_id: result.voucher_id ?? null,
      voucher_type: result.voucher_type ?? null,
      voucher_name: result.voucher_name ?? null,
      voucher_value: voucher ? Number(voucher.value) : null,
      voucher_min_order_amount: voucher ? Number(voucher.min_order_amount) : null,
      voucher_max_discount_amount:
        voucher?.max_discount_amount != null
          ? Number(voucher.max_discount_amount)
          : null,
      discount_amount:
        result.discount_amount != null ? Number(result.discount_amount) : null,
      error_message: result.error_message ?? null,
    });
  } catch (e) {
    return handleError(e);
  }
}

async function validateWithJs(
  admin: any,
  input: {
    code: string;
    orderAmount: number;
    userId: string | null;
    productIds: string[];
    categoryIds: string[];
  },
): Promise<ValidateVoucherResponse> {
  const invalid = (message: string): ValidateVoucherResponse => ({
    valid: false,
    voucher_id: null,
    voucher_type: null,
    voucher_name: null,
    voucher_value: null,
    voucher_min_order_amount: null,
    voucher_max_discount_amount: null,
    discount_amount: null,
    error_message: message,
  });

  const { data: voucher, error: vErr } = await admin
    .from("vouchers")
    .select("*")
    .eq("code", input.code.toUpperCase().trim())
    .eq("is_active", true)
    .maybeSingle();

  if (vErr) {
    if (vErr.code === "PGRST205" || vErr.code === "42P01") {
      return invalid("Mã giảm giá hiện không khả dụng");
    }
    throw vErr;
  }
  if (!voucher) return invalid("Mã voucher không tồn tại hoặc đã bị vô hiệu hóa");

  const now = new Date();
  if (now < new Date(voucher.start_date)) return invalid("Voucher chưa bắt đầu");
  if (now > new Date(voucher.end_date)) return invalid("Voucher đã hết hạn");
  if (
    voucher.quantity_total != null &&
    voucher.quantity_used >= voucher.quantity_total
  ) {
    return invalid("Voucher đã hết lượt sử dụng");
  }

  if (input.userId) {
    const { count } = await admin
      .from("voucher_usages")
      .select("id", { count: "exact", head: true })
      .eq("voucher_id", voucher.id)
      .eq("user_id", input.userId);
    if ((count ?? 0) >= voucher.user_usage_limit) {
      return invalid("Bạn đã sử dụng voucher này rồi");
    }
  }

  if (input.orderAmount < Number(voucher.min_order_amount)) {
    return invalid(
      `Đơn hàng tối thiểu ${new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(Number(voucher.min_order_amount))} để sử dụng voucher này`,
    );
  }

  if (
    voucher.applicable_products?.length &&
    !input.productIds.some((id) => voucher.applicable_products.includes(id))
  ) {
    return invalid("Giỏ hàng không có sản phẩm nào áp dụng voucher này");
  }

  if (
    voucher.applicable_categories?.length &&
    !input.categoryIds.some((id) => voucher.applicable_categories.includes(id))
  ) {
    return invalid("Giỏ hàng không có sản phẩm thuộc danh mục áp dụng voucher này");
  }

  return {
    valid: true,
    voucher_id: voucher.id,
    voucher_type: voucher.type,
    voucher_name: voucher.name,
    voucher_value: Number(voucher.value),
    voucher_min_order_amount: Number(voucher.min_order_amount),
    voucher_max_discount_amount:
      voucher.max_discount_amount != null
        ? Number(voucher.max_discount_amount)
        : null,
    discount_amount: calculateDiscount(voucher, input.orderAmount),
    error_message: null,
  };
}

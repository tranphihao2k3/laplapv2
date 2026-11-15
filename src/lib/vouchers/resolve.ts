/**
 * Voucher resolver dùng chung cho mọi luồng checkout (public + POS admin).
 * Validate + tính giảm giá ở server — không tin giá trị client gửi lên.
 */
import { createAdminClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VoucherAdmin = ReturnType<typeof createAdminClient> | any;

export type VoucherRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  quantity_total: number | null;
  quantity_used: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  applicable_products: string[] | null;
  applicable_categories: string[] | null;
  user_usage_limit: number | null;
};

export type VoucherResult =
  | { ok: true; voucher: VoucherRow; discount: number }
  | { ok: false; message: string };

export type ResolveVoucherOpts = {
  code: string;
  /** Giá trị đơn để so min_order + tính discount (đã trừ giảm giá tay/loyalty). */
  subtotal: number;
  productIds: string[];
  categoryIds: string[];
  authUserId: string | null;
  /**
   * Mốc tính giới hạn lượt dùng (VD: SĐT khách ở POS). Ưu tiên hơn authUserId —
   * vì máy POS dùng chung 1 tài khoản admin, giới hạn phải tính theo khách.
   * Chuẩn hoá mốc ở caller bằng @/lib/vouchers/identity.
   */
  userIdentifier: string;
};

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  const code = error?.code ?? "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation .* does not exist/i.test(error?.message ?? "")
  );
}

export async function resolveVoucher(
  admin: VoucherAdmin,
  opts: ResolveVoucherOpts,
): Promise<VoucherResult> {
  const raw = opts.code.trim();
  let voucher: VoucherRow | null = null;
  let lookupError: { code?: string; message?: string } | null = null;

  for (const candidate of [...new Set([raw, raw.toUpperCase(), raw.toLowerCase()])]) {
    const res = await admin
      .from("vouchers")
      .select(
        "id, code, name, type, value, min_order_amount, max_discount_amount, quantity_total, quantity_used, start_date, end_date, is_active, applicable_products, applicable_categories, user_usage_limit",
      )
      .eq("code", candidate)
      .maybeSingle();
    if (res.error) {
      lookupError = res.error;
      break;
    }
    if (res.data) {
      voucher = res.data as VoucherRow;
      break;
    }
  }

  if (lookupError) {
    if (isMissingTable(lookupError)) {
      return { ok: false, message: "Mã giảm giá hiện không khả dụng." };
    }
    throw lookupError;
  }
  if (!voucher) return { ok: false, message: "Mã voucher không tồn tại." };
  if (!voucher.is_active) return { ok: false, message: "Mã voucher đã bị vô hiệu hóa." };

  const now = Date.now();
  if (now < new Date(voucher.start_date).getTime()) {
    return { ok: false, message: "Voucher chưa bắt đầu." };
  }
  if (now > new Date(voucher.end_date).getTime()) {
    return { ok: false, message: "Voucher đã hết hạn." };
  }
  if (
    voucher.quantity_total !== null &&
    Number(voucher.quantity_used ?? 0) >= Number(voucher.quantity_total)
  ) {
    return { ok: false, message: "Voucher đã hết lượt sử dụng." };
  }

  const usageLimit = Number(voucher.user_usage_limit ?? 1);
  if (usageLimit > 0) {
    let usageQuery = admin
      .from("voucher_usages")
      .select("id", { count: "exact", head: true })
      .eq("voucher_id", voucher.id);
    usageQuery = opts.userIdentifier
      ? usageQuery.eq("user_identifier", opts.userIdentifier)
      : opts.authUserId
        ? usageQuery.eq("user_id", opts.authUserId)
        : usageQuery;
    const { count, error: uErr } = await usageQuery;
    if (uErr) {
      if (!isMissingTable(uErr)) throw uErr;
    } else if ((count ?? 0) >= usageLimit) {
      return { ok: false, message: "Bạn đã sử dụng voucher này rồi." };
    }
  }

  const minOrder = Number(voucher.min_order_amount ?? 0);
  if (opts.subtotal < minOrder) {
    return {
      ok: false,
      message: `Đơn hàng tối thiểu ${minOrder.toLocaleString("vi-VN")}đ để dùng voucher này.`,
    };
  }

  const applicableProducts = voucher.applicable_products ?? [];
  if (applicableProducts.length > 0) {
    const matched = opts.productIds.some((id) => applicableProducts.includes(id));
    if (!matched) {
      return { ok: false, message: "Giỏ hàng không có sản phẩm nào áp dụng voucher này." };
    }
  }

  const applicableCategories = voucher.applicable_categories ?? [];
  if (applicableCategories.length > 0) {
    const matched = opts.categoryIds.some((id) => applicableCategories.includes(id));
    if (!matched) {
      return {
        ok: false,
        message: "Giỏ hàng không có sản phẩm thuộc danh mục áp dụng voucher này.",
      };
    }
  }

  let discount = 0;
  if (voucher.type === "percent") {
    discount = Math.round((opts.subtotal * Number(voucher.value)) / 100);
    if (voucher.max_discount_amount !== null) {
      discount = Math.min(discount, Number(voucher.max_discount_amount));
    }
  } else if (voucher.type === "fixed_amount") {
    discount = Math.min(Number(voucher.value), opts.subtotal);
  }
  discount = Math.max(0, Math.min(discount, opts.subtotal));

  return { ok: true, voucher, discount };
}

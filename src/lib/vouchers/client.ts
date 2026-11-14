import type { AppliedVoucher, ValidateVoucherResponse } from "@/types/voucher";

type ValidateForCartInput = {
  code: string;
  subtotal: number;
  productIds: string[];
  categoryIds?: string[];
};

/**
 * Gọi API validate voucher và trả về object sẵn sàng lưu vào cart store.
 * API trả `{ ok, data }`; một số chỗ cũ đọc thẳng response nên luôn ra
 * `valid` undefined — helper này xử lý thống nhất cho mọi nơi.
 */
export async function validateVoucherForCart({
  code,
  subtotal,
  productIds,
  categoryIds,
}: ValidateForCartInput): Promise<AppliedVoucher> {
  const res = await fetch("/api/public/vouchers/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: code.trim(),
      order_amount: subtotal,
      product_ids: productIds,
      category_ids: categoryIds,
    }),
  });

  const json = await res.json().catch(() => null);
  const data: ValidateVoucherResponse | undefined = json?.data ?? json;

  if (!res.ok || !data?.valid) {
    throw new Error(
      data?.error_message ??
        json?.error?.message ??
        "Mã voucher không hợp lệ",
    );
  }

  if (!data.voucher_id || !data.voucher_type || !data.voucher_name) {
    throw new Error("Không đọc được thông tin voucher");
  }

  return {
    id: data.voucher_id,
    code: code.trim().toUpperCase(),
    name: data.voucher_name,
    type: data.voucher_type,
    value: data.voucher_value ?? 0,
    min_order_amount: data.voucher_min_order_amount ?? 0,
    discount_amount: data.discount_amount ?? 0,
    max_discount_amount: data.voucher_max_discount_amount ?? null,
  };
}

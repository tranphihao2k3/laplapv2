/**
 * Helpers tạo deep-link liên hệ nhanh (Zalo / Gọi điện / SMS) từ số điện thoại.
 * - SĐT Việt Nam phổ biến: "0901234567" hoặc "84901234567" hoặc "+84901234567"
 * - Chuẩn hoá về dạng chỉ chứa chữ số, độ dài 9-13
 * - Tự thêm prefix "84" nếu thiếu (Zalo bắt buộc phải có)
 */

/**
 * Trả về link Zalo hợp lệ, hoặc null nếu SĐT không thoả điều kiện.
 * Ví dụ: "0901234567" → "https://zalo.me/84901234567"
 */
export function zaloLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 13) return null;
  let normalized = digits;
  if (normalized.startsWith("0")) normalized = "84" + normalized.slice(1);
  if (!normalized.startsWith("84")) normalized = "84" + normalized;
  return `https://zalo.me/${normalized}`;
}

/**
 * Trả về link tel: cho nút gọi điện. Trả về null nếu SĐT không hợp lệ.
 * Ví dụ: "0901234567" → "tel:0901234567" (giữ nguyên SĐT gốc, không ép 84).
 */
export function telLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 13) return null;
  return `tel:${digits}`;
}

/**
 * Trả về link SMS: nếu SĐT hợp lệ. Trả về null nếu không.
 */
export function smsLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 13) return null;
  return `sms:${digits}`;
}

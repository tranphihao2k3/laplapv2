/**
 * Mốc tính giới hạn lượt dùng voucher theo KHÁCH, không theo tài khoản
 * đăng nhập — vì máy POS dùng chung 1 tài khoản admin.
 *
 * Module thuần (không import server-only) để dùng được cả client lẫn server.
 * QUAN TRỌNG: validate lúc áp mã và checkout lúc ghi nhận phải dùng
 * CÙNG hàm này, nếu không đếm lượt dùng sẽ lệch.
 */

/** Chuẩn hoá SĐT: chỉ giữ số, đủ dài mới coi là SĐT. */
export function phoneIdentity(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : "";
}

/**
 * Mốc dùng ở POS, ưu tiên: SĐT khách → khách đã chọn (cus:<id>) → khách lẻ.
 */
export function posVoucherIdentity(
  phone: string | null | undefined,
  customerId: string | null | undefined,
): string {
  const phoneId = phoneIdentity(phone);
  if (phoneId) return phoneId;
  if (customerId) return `cus:${customerId}`;
  return "pos-walkin";
}

/** Parse mốc client gửi lên API validate: SĐT → chuẩn hoá số; mốc đặc biệt (pos-walkin, cus:...) giữ nguyên. */
export function parseUserIdentifier(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  return phoneIdentity(trimmed) || trimmed;
}

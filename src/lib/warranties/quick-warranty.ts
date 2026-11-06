/**
 * Helper cho tính năng "Tạo nhanh bảo hành" (POST /v1/warranties/quick).
 *
 * Bối cảnh: admin có danh sách máy ĐÃ BÁN (và đã sửa) nhưng máy đó KHÔNG có
 * trong catalog web → không có `product_variants` row → không thể tạo bảo hành
 * theo luồng bán hàng thông thường. Schema DB cho phép:
 *   - `serial_numbers.product_variant_id` NULLABLE  → serial có thể tồn tại "trần".
 *   - `warranties.customer_id / serial_number_id / order_id / repair_ticket_id` NULLABLE
 *     → bảo hành độc lập (không cần đơn hàng).
 *
 * ── Quy ước lưu TÊN MÁY ──────────────────────────────────────────────────────
 * Bảng `warranties` KHÔNG có cột tên sản phẩm / tên thiết bị. Máy không có
 * trong catalog thì không có chỗ nào khác để lưu "Dell Inspiron 15 3511".
 * Vì vậy tên thiết bị được ghi vào cột `note` theo định dạng có tiền tố cố định:
 *
 *     note = "Thiết bị: <tên máy>"                    (không có ghi chú thêm)
 *     note = "Thiết bị: <tên máy> — <ghi chú của admin>"
 *
 * `parseDeviceName()` / `parseNoteBody()` dùng chung để đọc lại 2 phần này.
 * Cách này giữ được ghi chú tự do của admin (vẫn hiển thị nguyên vẹn ở list)
 * mà vẫn cho admin thấy đúng tên máy thay vì "(Không xác định)".
 * Ghi chú cũ (tạo từ luồng khác) không có tiền tố → `parseDeviceName()` = null
 * → hành vi cũ được giữ nguyên (backward compatible).
 */

/** Tiền tố bắt buộc của tên thiết bị trong `warranties.note`. */
export const DEVICE_NOTE_PREFIX = "Thiết bị:";

/** Dấu phân cách giữa "tên máy" và "ghi chú" trong `warranties.note`. */
export const DEVICE_NOTE_SEPARATOR = " — ";

/**
 * Ghép `note` cho bảo hành tạo nhanh.
 * @param deviceName tên máy (bắt buộc)
 * @param note ghi chú tuỳ chọn của admin
 */
export function buildDeviceNote(deviceName: string, note?: string | null): string {
  const head = `${DEVICE_NOTE_PREFIX} ${deviceName.trim()}`;
  const extra = note?.trim();
  return extra ? `${head}${DEVICE_NOTE_SEPARATOR}${extra}` : head;
}

/**
 * Lấy tên thiết bị từ `warranties.note`.
 * @returns tên máy, hoặc null nếu note không phải do luồng "tạo nhanh" ghi.
 */
export function parseDeviceName(note: string | null | undefined): string | null {
  if (!note) return null;
  if (!note.startsWith(DEVICE_NOTE_PREFIX)) return null;
  let rest = note.slice(DEVICE_NOTE_PREFIX.length).trim();
  const sep = rest.indexOf(DEVICE_NOTE_SEPARATOR);
  if (sep >= 0) rest = rest.slice(0, sep).trim();
  return rest.length > 0 ? rest : null;
}

/**
 * Lấy phần ghi chú của admin (bỏ tiền tố "Thiết bị: ...").
 * @returns ghi chú, hoặc null nếu không có.
 */
export function parseNoteBody(note: string | null | undefined): string | null {
  if (!note) return null;
  if (!note.startsWith(DEVICE_NOTE_PREFIX)) return note;
  const rest = note.slice(DEVICE_NOTE_PREFIX.length);
  const sep = rest.indexOf(DEVICE_NOTE_SEPARATOR);
  if (sep < 0) return null;
  const body = rest.slice(sep + DEVICE_NOTE_SEPARATOR.length).trim();
  return body.length > 0 ? body : null;
}

/**
 * Cộng N tháng vào ngày ISO (YYYY-MM-DD), giữ nguyên giờ 00:00 UTC.
 * Xử lý riêng trường hợp ngày không tồn tại trong tháng đích (VD: 31/01 + 1 tháng
 * → 28/02) để không trôi sang tháng kế tiếp như `Date.setMonth` mặc định.
 */
export function addMonthsIso(startIso: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startIso);
  if (!m) return startIso;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const daysInTarget = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTarget));
  return target.toISOString().slice(0, 10);
}

/** Ngày hôm nay theo định dạng YYYY-MM-DD (giờ địa phương). */
export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

/**
 * Chuẩn hoá số điện thoại VN về dạng 0XXXXXXXXX để find-or-create khách hàng
 * không bị trùng do cách gõ khác nhau (0901 234 567 / 0901234567 / +84901234567).
 * @returns số đã chuẩn hoá, hoặc null nếu không phải số ĐT VN hợp lệ.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) digits = `0${digits.slice(2)}`;
  if (digits.length === 9) digits = `0${digits}`;
  if (!/^0\d{9,10}$/.test(digits)) return null;
  return digits;
}

/** 1 dòng trong chế độ nhập nhiều dòng. */
export type QuickBulkRow = {
  /** Tên máy (bắt buộc) */
  name: string;
  serial: string | null;
  imei: string | null;
  phone: string | null;
  customerName: string | null;
  /** Số tháng bảo hành — null nghĩa là dùng mặc định của form. */
  months: number | null;
};

/**
 * Định dạng 1 dòng trong chế độ nhập nhiều dòng:
 *   `tên máy | serial | imei | số điện thoại | tên khách | số tháng`
 * Dấu `|` là dấu phân cách chính; nếu dòng KHÔNG có `|` thì fallback sang `,`
 * (tiện cho ai copy từ Google Sheets). Bỏ qua dòng rỗng và dòng bắt đầu bằng `#`.
 */
export function parseQuickBulkLine(line: string): QuickBulkRow | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const parts = trimmed.includes("|")
    ? trimmed.split("|")
    : trimmed.split(",");
  const cells = parts.map((p) => p.trim());

  const name = cells[0] ?? "";
  if (!name) return null;

  const monthsRaw = cells[5] ?? "";
  const monthsNum = /^\d+$/.test(monthsRaw) ? Number(monthsRaw) : null;

  return {
    name,
    serial: cells[1] || null,
    imei: cells[2] || null,
    phone: cells[3] || null,
    customerName: cells[4] || null,
    months: monthsNum !== null && monthsNum > 0 ? monthsNum : null,
  };
}

/** Parse cả khối text nhiều dòng → mảng row (bỏ dòng rỗng/ghi chú). */
export function parseQuickBulkText(text: string): QuickBulkRow[] {
  return text
    .split(/\r?\n/)
    .map(parseQuickBulkLine)
    .filter((r): r is QuickBulkRow => r !== null);
}

/** Mẫu định dạng để hiển thị trong UI + dùng cho file "Tải mẫu". */
export const QUICK_BULK_TEMPLATE_HEADER =
  "tên máy | serial | imei | số điện thoại | tên khách | số tháng";

export const QUICK_BULK_TEMPLATE_EXAMPLE = [
  "Dell Inspiron 15 3511 | SN-DELL-001 | 358938051234567 | 0901234567 | Nguyễn Văn A | 12",
  "Asus Vivobook 15 | SN-ASUS-002 | | 0912345678 | Trần Thị B | 6",
  "HP Pavilion 15 (sửa chữa) | | 358938051111111 | | | 3",
].join("\n");

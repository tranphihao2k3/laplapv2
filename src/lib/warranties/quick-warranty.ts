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

/**
 * Ước số tháng bảo hành từ ngày bắt đầu → ngày hết hạn (đảo của `addMonthsIso`).
 * Ưu tiên giá trị khiến `addMonthsIso(start, n) === end`; nếu không khớp (ngày
 * cụ thể giữa 2 mốc tháng) thì làm tròn tới tháng gần nhất.
 * @returns số tháng ≥ 0; 0 nếu end ≤ start hoặc ngày không hợp lệ.
 */
export function diffMonthsIso(startIso: string, endIso: string): number {
  const s = /^(\d{4})-(\d{2})-(\d{2})/.exec(startIso);
  const e = /^(\d{4})-(\d{2})-(\d{2})/.exec(endIso);
  if (!s || !e) return 0;
  if (endIso <= startIso) return 0;

  let months =
    (Number(e[1]) - Number(s[1])) * 12 + (Number(e[2]) - Number(s[2]));
  if (Number(e[3]) < Number(s[3])) months -= 1;
  months = Math.max(0, months);

  if (addMonthsIso(startIso, months) === endIso) return months;
  if (addMonthsIso(startIso, months + 1) === endIso) return months + 1;

  const endMs = Date.parse(`${endIso}T00:00:00Z`);
  const d0 = Math.abs(Date.parse(`${addMonthsIso(startIso, months)}T00:00:00Z`) - endMs);
  const d1 = Math.abs(
    Date.parse(`${addMonthsIso(startIso, months + 1)}T00:00:00Z`) - endMs,
  );
  return d1 < d0 ? months + 1 : months;
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

/** 1 dòng trong chế độ nhập nhiều dòng / dán chat Telegram. */
export type QuickBulkRow = {
  /** Tên máy (bắt buộc) */
  name: string;
  serial: string | null;
  imei: string | null;
  phone: string | null;
  customerName: string | null;
  /** Số tháng bảo hành — null nghĩa là dùng mặc định của form. */
  months: number | null;
  /** Ngày bắt đầu BH ISO — từ tin Telegram / cột 5 (VD: `6/11/2026` = ngày bán/sửa). */
  startDate: string | null;
  /** Ngày hết hạn ISO — chỉ khi admin chỉ định tường minh (hiếm). */
  endDate: string | null;
  /** Ghi chú thêm (VD: nội dung sửa / giá từ tin nhắn). */
  note: string | null;
};

const VN_PHONE_TAIL = /(\+?84|0)?(\d{9,10})\s*$/;

/** Parse `d/m/yyyy` hoặc `d-m-yyyy` → `YYYY-MM-DD`. */
export function parseVnDate(input: string): string | null {
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(input.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Lấy số tháng từ chuỗi kiểu `bh2th`, `2th`, `BH 2 tháng`. */
export function extractWarrantyMonths(text: string): number | null {
  const m =
    /\bbh\s*(\d+)\s*th(?:áng)?\b/i.exec(text) ??
    /\b(\d+)\s*th(?:áng)?\b/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}

/** Tách tên khách + SĐT ở cuối dòng (`Khánh 0777645720`). */
export function parseNamePhone(line: string): {
  customerName: string | null;
  phone: string | null;
} {
  const trimmed = line.trim();
  const m = VN_PHONE_TAIL.exec(trimmed);
  if (!m || m.index === undefined) {
    return { customerName: trimmed || null, phone: null };
  }
  const phone = normalizePhone(m[0]);
  const name = trimmed.slice(0, m.index).trim().replace(/[-–—]\s*$/, "").trim();
  return { customerName: name || null, phone };
}

/**
 * Dọn dòng mô tả máy từ Telegram (bỏ `bh2th`, giá `750k`/`1tr350k`).
 * Giữ phần tên máy + mô tả sửa.
 */
export function cleanTelegramDeviceLine(line: string): string {
  return line
    .replace(/\bbh\s*\d+\s*th(?:áng)?\b/gi, " ")
    .replace(/\b\d+\s*th(?:áng)?\b/gi, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*tr(?:iệu)?(?:\d+)?k?\b/gi, " ")
    .replace(/\b\d+[.,]?\d*\s*k\b/gi, " ")
    .replace(/\b\d{1,3}(?:[.,]\d{3})+(?:\s*đ)?\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Định dạng pipe / CSV:
 *   `tên máy | tên khách | số điện thoại | số tháng BH`
 */
export function parseQuickBulkLine(line: string): QuickBulkRow | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  // Một dòng Telegram: `An515-58 - Phước Ân 0936393449`
  if (!trimmed.includes("|") && /[-–—]/.test(trimmed) && VN_PHONE_TAIL.test(trimmed)) {
    const dash = trimmed.search(/\s[-–—]\s/);
    if (dash > 0) {
      const device = trimmed.slice(0, dash).trim();
      const rest = trimmed.slice(dash).replace(/^\s*[-–—]\s*/, "");
      const { customerName, phone } = parseNamePhone(rest);
      if (device && (phone || customerName)) {
        return {
          name: device,
          serial: null,
          imei: null,
          customerName,
          phone,
          months: null,
          startDate: null,
          endDate: null,
          note: null,
        };
      }
    }
  }

  if (!trimmed.includes("|") && !trimmed.includes(",")) return null;

  const parts = trimmed.includes("|")
    ? trimmed.split("|")
    : trimmed.split(",");
  const cells = parts.map((p) => p.trim());

  const name = cells[0] ?? "";
  if (!name) return null;

  const monthsRaw = cells[3] ?? "";
  const monthsNum = /^\d+$/.test(monthsRaw) ? Number(monthsRaw) : null;
  // Cột 5 (tuỳ chọn): ngày bắt đầu BH `d/m/yyyy` hoặc `YYYY-MM-DD`
  const startRaw = cells[4] ?? "";
  const startDate =
    parseVnDate(startRaw) ??
    (/^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : null);

  return {
    name,
    serial: null,
    imei: null,
    customerName: cells[1] || null,
    phone: cells[2] || null,
    months: monthsNum !== null && monthsNum > 0 ? monthsNum : null,
    startDate,
    endDate: null,
    note: null,
  };
}

/**
 * Parse cả khối text:
 * 1) Định dạng `|` / CSV (1 dòng = 1 máy)
 * 2) Copy từ Telegram — 1 dòng `máy - tên SĐT` hoặc block 3 dòng:
 *      6/11/2026          ← ngày bắt đầu BH (ngày bán / sửa)
 *      Thinkbook IC sạc 750k bh2th
 *      Khánh 0777645720
 */
export function parseQuickBulkText(text: string): QuickBulkRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  const rows: QuickBulkRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const dateIso = parseVnDate(lines[i]);
    // Block Telegram 3 dòng: ngày bắt đầu → mô tả máy → tên + SĐT
    if (dateIso && i + 2 < lines.length) {
      const deviceRaw = lines[i + 1];
      const customerLine = lines[i + 2];
      // Dòng kế phải giống "tên + SĐT", không phải ngày khác
      if (!parseVnDate(customerLine) && VN_PHONE_TAIL.test(customerLine)) {
        const months = extractWarrantyMonths(deviceRaw);
        const name = cleanTelegramDeviceLine(deviceRaw) || deviceRaw;
        const { customerName, phone } = parseNamePhone(customerLine);
        rows.push({
          name,
          serial: null,
          imei: null,
          customerName,
          phone,
          months,
          startDate: dateIso,
          endDate: null,
          note: deviceRaw !== name ? deviceRaw : null,
        });
        i += 3;
        continue;
      }
    }

    const pipeOrOneLiner = parseQuickBulkLine(lines[i]);
    if (pipeOrOneLiner) {
      rows.push(pipeOrOneLiner);
      i += 1;
      continue;
    }

    // Bỏ qua dòng không nhận diện (timestamp Telegram, ảnh caption rỗng…)
    i += 1;
  }

  return rows;
}

/** Mẫu định dạng để hiển thị trong UI + dùng cho file "Tải mẫu". */
export const QUICK_BULK_TEMPLATE_HEADER =
  "tên máy | tên khách | số điện thoại | số tháng BH | ngày bắt đầu";

export const QUICK_BULK_TEMPLATE_EXAMPLE = [
  "Dell Inspiron 15 3511 | Nguyễn Văn A | 0901234567 | 12 | 7/11/2026",
  "Asus Vivobook 15 | Trần Thị B | 0912345678 | 6",
  "# Hoặc dán nguyên tin Telegram (dòng 1 = ngày bắt đầu BH):",
  "An515-58 - Phước Ân 0936393449",
  "6/11/2026",
  "Thinkbook IC sạc 750k bh2th",
  "Khánh 0777645720",
].join("\n");

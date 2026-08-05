/**
 * Parse chuỗi specs (do người nhập tay / AI sinh) thành SỐ để xếp hạng.
 *
 * Reuse ramSize()/storageSize() ở src/lib/normalize-ram.ts — hai hàm đó trả
 * STRING (dùng cho bộ lọc gom nhóm), ở đây chỉ bọc thêm lớp đổi sang number.
 *
 * Nguyên tắc: KHÔNG ĐOÁN. Không parse được → trả null (hiển thị "—"), tuyệt đối
 * không mặc định 0 hay 60Hz — vì null bị loại khỏi xếp hạng, còn 0 sẽ làm máy đó
 * xếp bét oan (hoặc thắng oan ở các chỉ số "thấp hơn tốt hơn" như giá/trọng lượng).
 */

import { ramSize, storageSize } from "@/lib/normalize-ram";

/** Đọc số thập phân, chấp nhận cả dấu phẩy kiểu VN: "1,35" → 1.35 */
function num(s: string): number | null {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "16GB DDR4" → 16 | "16GB (nâng cấp tối đa 64GB)" → 16 */
export function parseRamGb(raw?: string): number | null {
  if (!raw) return null;
  const m = ramSize(raw).match(/^(\d+(?:[.,]\d+)?)GB$/i);
  return m ? num(m[1]) : null;
}

/**
 * "512GB SSD" → 512 | "1TB NVMe" → 1024.
 * Giới hạn đã biết: "512GB SSD + 1TB HDD" chỉ lấy 512 (storageSize khớp số đầu).
 */
export function parseStorageGb(raw?: string): number | null {
  if (!raw) return null;
  const m = storageSize(raw).match(/^(\d+(?:[.,]\d+)?)(TB|GB)$/i);
  if (!m) return null;
  const v = num(m[1]);
  if (v == null) return null;
  return m[2].toUpperCase() === "TB" ? v * 1024 : v;
}

/**
 * "1.35 kg" | "1,35kg" | "1350g" | "khoảng 1.4 kg" → số kg.
 * Dự phòng bậc 2: cột product_variants.weight (đáng tin hơn chuỗi tự do).
 */
export function parseWeightKg(raw?: string, variantWeight?: number | null): number | null {
  if (raw) {
    const kg = raw.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
    if (kg) return num(kg[1]);
    // Gram: 3-4 chữ số ("1350g"). Không nhận "1.35 g" vì vô nghĩa với laptop.
    const g = raw.match(/(\d{3,4})\s*g\b/i);
    if (g) {
      const v = num(g[1]);
      if (v != null) return v / 1000;
    }
    // Số trần không đơn vị, chỉ nhận trong khoảng hợp lý của laptop.
    const bare = raw.match(/^(\d(?:[.,]\d+)?)$/);
    if (bare) {
      const v = num(bare[1]);
      if (v != null && v >= 0.5 && v <= 5) return v;
    }
  }
  if (typeof variantWeight === "number" && variantWeight > 0) {
    // Cột weight không ghi rõ đơn vị: >= 100 coi là gram, còn lại là kg.
    return variantWeight >= 100 ? variantWeight / 1000 : variantWeight;
  }
  return null;
}

/**
 * "56Wh" | "3 cell 41 Wh" | "Pin 70Wh" → số Wh.
 * mAh KHÔNG quy đổi (thiếu điện áp thì quy đổi là bịa) → null.
 */
export function parseBatteryWh(raw?: string): number | null {
  if (!raw) return null;
  const wh = raw.match(/(\d+(?:[.,]\d+)?)\s*wh\b/i);
  if (wh) return num(wh[1]);
  // mWh (scanner WMI trả đơn vị này): 4-6 chữ số.
  const mwh = raw.match(/(\d{4,6})\s*mwh\b/i);
  if (mwh) {
    const v = num(mwh[1]);
    if (v != null) return v / 1000;
  }
  return null;
}

/**
 * "15.6 inch FHD 144Hz" → 144.
 * KHÔNG mặc định 60Hz khi thiếu dữ liệu — thiếu thông tin ≠ màn 60Hz.
 */
export function parseRefreshHz(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2,3})\s*hz\b/i);
  return m ? num(m[1]) : null;
}

/** '15.6"' | "15,6 inch" | "14 in" | "15.6 FHD IPS" → số inch */
export function parseScreenInch(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2}(?:[.,]\d)?)\s*(?:inch|in\b|"|”|''|′′)/i);
  if (m) return num(m[1]);
  // Số trần 10-19 ở ĐẦU chuỗi. Giới hạn 2 chữ số nguyên + \b để không nuốt "144" của "144Hz".
  const bare = raw.match(/^\s*(1[0-9](?:[.,]\d)?)\b/);
  return bare ? num(bare[1]) : null;
}

/**
 * Từ khoá độ phân giải phổ biến ở VN → tổng số pixel.
 * THỨ TỰ TRONG MẢNG = ĐỘ ƯU TIÊN: "4k" phải đứng trước "2k",
 * "fhd+" trước "fhd", "qhd" trước "hd" (nếu không "hd" sẽ khớp trước).
 */
const RES_KEYWORDS: Array<[RegExp, number]> = [
  [/\b(4k|uhd|3840\s*[x×]\s*2160)\b/i, 3840 * 2160],
  [/\b(3\.?2k|3200\s*[x×]\s*2000)\b/i, 3200 * 2000],
  [/\b(3k|2880\s*[x×]\s*1800)\b/i, 2880 * 1800],
  [/\b(2\.?8k|2880\s*[x×]\s*1620)\b/i, 2880 * 1620],
  [/\b(qhd\+|wqxga|2560\s*[x×]\s*1600)\b/i, 2560 * 1600],
  [/\b(qhd|wqhd|2k|2560\s*[x×]\s*1440)\b/i, 2560 * 1440],
  [/\b(fhd\+|wuxga|1920\s*[x×]\s*1200)\b/i, 1920 * 1200],
  [/\b(fhd|full\s*hd|1080p|1920\s*[x×]\s*1080)\b/i, 1920 * 1080],
  [/\b(hd\+|1600\s*[x×]\s*900)\b/i, 1600 * 900],
  [/\b(hd|1366\s*[x×]\s*768)\b/i, 1366 * 768],
];

/**
 * Trả TỔNG SỐ PIXEL để so sánh. "Retina" → null (không suy ra được con số cụ thể).
 * Ưu tiên số chính xác "1920x1080" trước, rồi mới tới từ khoá.
 */
export function parseResolutionPx(raw?: string): number | null {
  if (!raw) return null;
  const exact = raw.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/);
  if (exact) {
    const w = num(exact[1]);
    const h = num(exact[2]);
    if (w != null && h != null) return w * h;
  }
  for (const [re, px] of RES_KEYWORDS) {
    if (re.test(raw)) return px;
  }
  return null;
}

/**
 * Có card đồ hoạ RỜI hay không — dùng làm điều kiện cứng cho nhãn "tốt nhất cho Gaming".
 *
 * Nhận diện theo tên dòng card rời phổ biến. Loại trừ tường minh các GPU tích hợp
 * ("Iris Xe", "UHD", "Vega", "Radeon Graphics", "onboard") vì tên chúng cũng chứa
 * chữ "Radeon"/"Graphics" nên dễ bị nhận nhầm là card rời.
 *
 * Trả null khi KHÔNG có thông tin GPU (khác với false = biết chắc chỉ có GPU tích hợp).
 */
export function hasDiscreteGpu(raw?: string): boolean | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.toLowerCase();
  if (/\b(onboard|tích hợp|tich hop|integrated|không có card rời|khong co card roi)\b/.test(s)) {
    return false;
  }
  // GPU tích hợp: phải kiểm tra TRƯỚC các mẫu chung để không nhận nhầm.
  if (/\b(iris\s*xe|uhd\s*graphics|hd\s*graphics|vega\s*\d|radeon\s*graphics)\b/.test(s)) {
    return false;
  }
  // Card rời NVIDIA / AMD / Intel Arc.
  if (/\b(rtx|gtx|quadro|mx\s*\d{3}|radeon\s*rx|arc\s*a\d{3})\b/.test(s)) return true;
  // Apple M-series: GPU tích hợp nhưng đủ mạnh — không xếp vào "card rời".
  return false;
}

/** Ngược của RES_KEYWORDS: tổng pixel → nhãn "1920×1080" cho các mốc quen thuộc. */
const PX_TO_LABEL = new Map<number, string>([
  [3840 * 2160, "3840×2160 (4K)"],
  [3200 * 2000, "3200×2000 (3.2K)"],
  [2880 * 1800, "2880×1800 (3K)"],
  [2880 * 1620, "2880×1620 (2.8K)"],
  [2560 * 1600, "2560×1600 (QHD+)"],
  [2560 * 1440, "2560×1440 (QHD)"],
  [1920 * 1200, "1920×1200 (FHD+)"],
  [1920 * 1080, "1920×1080 (FHD)"],
  [1600 * 900, "1600×900 (HD+)"],
  [1366 * 768, "1366×768 (HD)"],
]);

/**
 * Format số về chuỗi hiển thị gọn theo từng metric.
 * Giá được format riêng ở tầng UI bằng formatCurrency().
 */
export function formatMetricValue(metricId: string, n: number): string {
  switch (metricId) {
    case "ram":
      return `${n} GB`;
    case "storage":
      // 1024GB → "1 TB" cho dễ đọc.
      return n >= 1024 && n % 1024 === 0 ? `${n / 1024} TB` : `${n} GB`;
    case "resolution":
      return PX_TO_LABEL.get(n) ?? `${(n / 1_000_000).toFixed(1)} MP`;
    case "screenInch":
      return `${n}"`;
    case "refreshHz":
      return `${n} Hz`;
    case "battery":
      return `${n} Wh`;
    case "weight":
      return `${n} kg`;
    case "cpu":
    case "gpu":
    case "display":
      // Điểm AI 0-100.
      return `${n}/100`;
    default:
      return String(n);
  }
}

/**
 * Registry chỉ số so sánh — NGUỒN SỰ THẬT DUY NHẤT cho bảng /so-sanh.
 *
 * Vì specs lưu ở product_variants.specs (jsonb, key tự do), tập key thực tế
 * KHÔNG nhất quán: prompt AI sinh ra "screen"/"ports", trang chi tiết lại đọc
 * "display"/"man_hinh"/"connectivity". Trường `keys` gom tất cả alias theo
 * THỨ TỰ ƯU TIÊN nên chỗ nào cũng đọc ra đúng giá trị.
 *
 * Lưu ý: iconName là STRING (không phải component) để file này không import
 * lucide-react — src/lib/compare/ phải chạy được trong API route trên Worker.
 * Map sang component ở src/components/client/compare/spec-icons.ts.
 */

import type { Direction, MetricKind } from "./types";

export type MetricGroup = "Hiệu năng" | "Hiển thị" | "Di động & Pin" | "Kết nối" | "Khác";

export type Metric = {
  /** Canonical id — key ổn định trong JSON kết quả, KHÁC với key trong specs. */
  id: string;
  label: string;
  unit?: string;
  group: MetricGroup;
  iconName: string;
  /** Alias key trong specs jsonb, theo THỨ TỰ ƯU TIÊN. Rỗng = lấy từ nguồn khác (giá). */
  keys: string[];
  kind: MetricKind;
  /** Bắt buộc khi kind !== "info". */
  direction?: Direction;
  /** Số chữ số thập phân khi so sánh & format (1.400 kg == 1.4 kg). */
  decimals?: number;
  /** Chỉ số này có tham gia tính điểm tổng không. */
  scored: boolean;
};

export const METRICS: Metric[] = [
  // ---------- Hiệu năng: 2 mục AI chấm, 2 mục CODE đo ----------
  {
    id: "cpu",
    label: "CPU",
    group: "Hiệu năng",
    iconName: "Cpu",
    keys: ["cpu"],
    kind: "ai-scored",
    direction: "higher",
    scored: true,
  },
  {
    id: "gpu",
    label: "Card đồ hoạ",
    group: "Hiệu năng",
    iconName: "CircuitBoard",
    keys: ["gpu", "vga"],
    kind: "ai-scored",
    direction: "higher",
    scored: true,
  },
  {
    id: "ram",
    label: "RAM",
    unit: "GB",
    group: "Hiệu năng",
    iconName: "MemoryStick",
    keys: ["ram"],
    kind: "measurable",
    direction: "higher",
    decimals: 0,
    scored: true,
  },
  {
    id: "storage",
    label: "Ổ cứng",
    unit: "GB",
    group: "Hiệu năng",
    iconName: "HardDrive",
    keys: ["ssd", "storage"],
    kind: "measurable",
    direction: "higher",
    decimals: 0,
    scored: true,
  },

  // ---------- Hiển thị: 1 mục AI chấm chất lượng tấm nền + 3 mục CODE đo ----------
  {
    id: "display",
    label: "Chất lượng màn hình",
    group: "Hiển thị",
    iconName: "Monitor",
    keys: ["display", "screen", "man_hinh"],
    kind: "ai-scored",
    direction: "higher",
    scored: true,
  },
  {
    id: "screenInch",
    label: "Kích thước màn",
    unit: '"',
    group: "Hiển thị",
    iconName: "Ruler",
    keys: ["display", "screen", "man_hinh"],
    kind: "measurable",
    direction: "higher",
    decimals: 1,
    // Màn to hơn không phải "tốt hơn" với mọi người (mỏng nhẹ thích màn nhỏ)
    // → xếp hạng cho biết, nhưng không tính vào điểm tổng.
    scored: false,
  },
  {
    id: "refreshHz",
    label: "Tần số quét",
    unit: "Hz",
    group: "Hiển thị",
    iconName: "Gauge",
    keys: ["display", "screen", "man_hinh", "refresh_rate", "tan_so_quet"],
    kind: "measurable",
    direction: "higher",
    decimals: 0,
    scored: true,
  },
  {
    id: "resolution",
    label: "Độ phân giải",
    group: "Hiển thị",
    iconName: "Scan",
    keys: ["display", "screen", "man_hinh", "resolution", "do_phan_giai"],
    kind: "measurable",
    direction: "higher",
    decimals: 0,
    scored: true,
  },

  // ---------- Di động & Pin ----------
  // Shop bán nhiều máy cũ nên trường battery thường ghi sức khoẻ pin
  // ("100% (93 chu kỳ sạc)") thay vì Wh → tách thành 3 chỉ số, chỉ chỉ số nào
  // parse được mới hiện.
  {
    id: "batteryHealth",
    label: "Độ chai pin",
    unit: "%",
    group: "Di động & Pin",
    iconName: "BatteryCharging",
    keys: ["battery", "pin", "battery_health", "do_chai_pin"],
    kind: "measurable",
    direction: "higher",
    decimals: 0,
    scored: true,
  },
  {
    id: "batteryCycles",
    label: "Số chu kỳ sạc",
    group: "Di động & Pin",
    iconName: "RotateCcw",
    keys: ["battery", "pin", "battery_cycles", "chu_ky_sac"],
    kind: "measurable",
    // Càng ít chu kỳ càng tốt — pin còn mới.
    direction: "lower",
    decimals: 0,
    scored: false,
  },
  {
    id: "battery",
    label: "Dung lượng pin",
    unit: "Wh",
    group: "Di động & Pin",
    iconName: "Battery",
    keys: ["battery", "pin"],
    kind: "measurable",
    direction: "higher",
    decimals: 0,
    scored: true,
  },
  {
    id: "weight",
    label: "Trọng lượng",
    unit: "kg",
    group: "Di động & Pin",
    iconName: "Weight",
    keys: ["weight", "trong_luong"],
    kind: "measurable",
    direction: "lower",
    decimals: 2,
    scored: true,
  },

  // ---------- Giá: đo được, thấp hơn tốt hơn ----------
  // KHÔNG tính vào điểm tổng (nếu tính, máy rẻ-yếu sẽ thắng oan).
  // Giá đi riêng qua chỉ số "đáng tiền" = điểm tổng / giá.
  {
    id: "price",
    label: "Giá bán",
    group: "Khác",
    iconName: "Tag",
    keys: [],
    kind: "measurable",
    direction: "lower",
    decimals: 0,
    scored: false,
  },

  // ---------- Info-only: chỉ hiện text, không xếp hạng ----------
  {
    id: "connectivity",
    label: "Cổng kết nối",
    group: "Kết nối",
    iconName: "Usb",
    keys: ["connectivity", "ports", "cong_ket_noi"],
    kind: "info",
    scored: false,
  },
  {
    id: "wireless",
    label: "Không dây",
    group: "Kết nối",
    iconName: "Wifi",
    keys: ["wireless", "khong_day"],
    kind: "info",
    scored: false,
  },
  {
    id: "keyboard",
    label: "Bàn phím",
    group: "Khác",
    iconName: "Keyboard",
    keys: ["ban_phim", "keyboard"],
    kind: "info",
    scored: false,
  },
  {
    id: "os",
    label: "Hệ điều hành",
    group: "Khác",
    iconName: "MonitorSmartphone",
    keys: ["os", "he_dieu_hanh", "operating_system"],
    kind: "info",
    scored: false,
  },
  {
    id: "warranty",
    // Cùng quy tắc ưu tiên với trang chi tiết (ProductSpecs ưu tiên "warranty").
    label: "Bảo hành",
    group: "Khác",
    iconName: "ShieldCheck",
    keys: ["warranty", "bao_hanh"],
    kind: "info",
    scored: false,
  },
];

export const GROUP_ORDER: MetricGroup[] = [
  "Hiệu năng",
  "Hiển thị",
  "Di động & Pin",
  "Kết nối",
  "Khác",
];

export const METRIC_BY_ID = new Map(METRICS.map((m) => [m.id, m]));

/** Lấy giá trị thô của một metric từ specs, theo thứ tự alias ưu tiên. */
export function rawValueOf(metric: Metric, specs: Record<string, string>): string | undefined {
  for (const k of metric.keys) {
    const v = specs[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** Mọi key đã được registry "nhận" — dùng để tìm key lạ. */
const KNOWN_KEYS = new Set(METRICS.flatMap((m) => m.keys));

/**
 * Các key trong specs KHÔNG khớp metric nào (do template shop tự thêm:
 * mainboard, psu, switch_type...) → gom thành hàng info-only động,
 * để không vứt mất dữ liệu admin đã nhập.
 */
export function unknownSpecKeys(allSpecs: Record<string, string>[]): string[] {
  const out = new Set<string>();
  for (const s of allSpecs) {
    for (const [k, v] of Object.entries(s)) {
      if (!KNOWN_KEYS.has(k) && typeof v === "string" && v.trim()) out.add(k);
    }
  }
  return [...out].sort();
}

/** Đổi key snake_case thành nhãn đọc được: "switch_type" → "Switch type". */
export function humanizeKey(key: string): string {
  const s = key.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

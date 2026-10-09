/**
 * Kiểu dữ liệu cốt lõi cho tính năng PC Builder.
 *
 * Lưu ý:
 * - `SlotKey` đại diện cho 1 vị trí linh kiện trong cấu hình PC.
 * - `BuildItem` là một dòng linh kiện đã chọn (snapshot dữ liệu từ bảng products).
 * - `BuildState` lưu trữ các slot đã điền — chỉ slot có dữ liệu mới xuất hiện trong object.
 * - `CompatibilityIssue` là phát hiện tương thích giữa các linh kiện.
 * - `ComponentSpecSummary` là subset thông số kỹ thuật đọc từ `pc_components_specs`.
 */

export type SlotKey =
  | "cpu"
  | "mainboard"
  | "ram"
  | "gpu"
  | "ssd"
  | "hdd"
  | "psu"
  | "case"
  | "cooler"
  | "monitor"
  | "keyboard"
  | "mouse"
  | "headset";

/**
 * Thứ tự hiển thị các slot trong sidebar và build summary.
 * Core trước (CPU/main/RAM/GPU/SSD/HDD/PSU/case/cooler) → ngoại vi (monitor/KB/mouse/headset).
 */
export const SLOT_ORDER: SlotKey[] = [
  "cpu",
  "mainboard",
  "ram",
  "gpu",
  "ssd",
  "hdd",
  "psu",
  "case",
  "cooler",
  "monitor",
  "keyboard",
  "mouse",
  "headset",
];

/** Nhãn tiếng Việt cho từng slot — dùng cho UI. */
export const SLOT_LABEL: Record<SlotKey, string> = {
  cpu: "CPU",
  mainboard: "Bo mạch chủ",
  ram: "RAM",
  gpu: "VGA / GPU",
  ssd: "SSD",
  hdd: "HDD",
  psu: "Nguồn",
  case: "Vỏ case",
  cooler: "Tản nhiệt",
  monitor: "Màn hình",
  keyboard: "Bàn phím",
  mouse: "Chuột",
  headset: "Tai nghe",
};

/** Một dòng linh kiện trong build (đã chọn). */
export type BuildItem = {
  productId: string;
  categorySlug: SlotKey;
  name: string;
  thumbnail: string | null;
  qty: number;
  unitPrice: number;
  brand?: string | null;
};

/**
 * State của cả build: map slot → danh sách linh kiện đã chọn.
 * Slot không có linh kiện sẽ không xuất hiện trong object (Partial).
 */
export type BuildState = Partial<Record<SlotKey, BuildItem[]>>;

/** Mức độ nghiêm trọng của 1 issue tương thích. */
export type CompatibilitySeverity = "error" | "warning" | "info";

/** Một phát hiện bất tương thích giữa các linh kiện. */
export type CompatibilityIssue = {
  severity: CompatibilitySeverity;
  /** Slot bị ảnh hưởng (chính) — dùng để focus UI. */
  slot: SlotKey;
  /** Nội dung thông báo đã Việt hoá, hiển thị trực tiếp cho user. */
  message: string;
  /** Slot thứ 2 liên quan (nếu có) — giúp build banner hiển thị đủ context. */
  relatedSlot?: SlotKey;
};

/**
 * Subset thông số kỹ thuật linh kiện, đủ dùng cho compatibility check.
 * Lấy từ `pc_components_specs` Row + `extras` (jsonb).
 */
export type ComponentSpecSummary = {
  productId: string;
  categorySlug: SlotKey;
  socket?: string | null;
  ramType?: string | null;
  formFactor?: string | null;
  tdpW?: number | null;
  lengthMm?: number | null;
  wattageW?: number | null;
  storageInterface?: string | null;
  /**
   * Các spec phụ như `supported_form_factors` (case), `supported_socket` (cooler),
   * `max_gpu_length_mm` (case), `connectors`... Cấu trúc tuỳ ý, không bắt buộc.
   */
  extras?: Record<string, unknown> | null;
};

/** Một dòng product + spec trả về từ API cho picker. */
export type ComponentWithSpec = {
  product: {
    id: string;
    name: string;
    slug: string;
    thumbnail_url: string | null;
    price: number;
    brand?: string | null;
  };
  spec: ComponentSpecSummary;
};

/** Kết quả build đầy đủ (kèm items). */
export type SavedBuild = {
  build: {
    id: string;
    user_id: string | null;
    session_id: string | null;
    name: string;
    note: string | null;
    total_price: number | null;
    share_slug: string | null;
    is_public: boolean | null;
    created_at: string | null;
    updated_at: string | null;
  };
  items: Array<{
    id: string;
    build_id: string;
    product_id: string;
    category_slug: string;
    qty: number;
    unit_price: number;
  }>;
};

/** Preset mẫu cho UI (chỉ gợi ý slot, không query DB). */
export type SampleBuildPreset = {
  id: string;
  name: string;
  description: string;
  /** Map categorySlug → tên gợi ý hiển thị cho user (không phải product thật). */
  categorySlug: string;
  productName: string;
}[];

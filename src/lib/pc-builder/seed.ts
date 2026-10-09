/**
 * Preset cấu hình mẫu cho PC Builder.
 *
 * KHÔNG hardcode tên model thật — chỉ dùng tên generic ("CPU tầm trung", "Mainboard ATX"...).
 * Khi user click "Dùng cấu hình này", UI sẽ mở picker cho từng slot để user tự chọn sản phẩm
 * từ danh sách thật trong DB.
 */

import type { SlotKey } from "./types";

export type SampleBuild = {
  id: string;
  name: string;
  description: string;
  /** Tổng tiền dự kiến (VND) — chỉ để hiển thị, không tính toán chính xác. */
  estimatedBudget: number;
  /** Mảng các slot gợi ý kèm tên hiển thị để user tự pick. */
  slots: Array<{ slot: SlotKey; productName: string }>;
};

export const SAMPLE_BUILDS: SampleBuild[] = [
  {
    id: "gaming-mid",
    name: "Gaming tầm trung 25 triệu",
    description: "Chơi game AAA ở 1080p, thiết kế đồ hoạ nhẹ.",
    estimatedBudget: 25_000_000,
    slots: [
      { slot: "cpu", productName: "CPU tầm trung (6–8 cores)" },
      { slot: "mainboard", productName: "Mainboard ATX tương thích" },
      { slot: "ram", productName: "RAM 16GB DDR4/DDR5" },
      { slot: "gpu", productName: "VGA tầm trung (RTX 4060 / RX 7600 class)" },
      { slot: "ssd", productName: "SSD NVMe 500GB–1TB" },
      { slot: "psu", productName: "Nguồn 650W 80+ Bronze" },
      { slot: "case", productName: "Case ATX mid-tower" },
      { slot: "cooler", productName: "Tản nhiệt khí tower" },
      { slot: "monitor", productName: "Màn hình 24–27 inch 144Hz" },
    ],
  },
  {
    id: "office-budget",
    name: "Văn phòng 8 triệu",
    description: "Làm việc văn phòng, lướt web, học online.",
    estimatedBudget: 8_000_000,
    slots: [
      { slot: "cpu", productName: "CPU giá rẻ (i3 / Ryzen 3 class)" },
      { slot: "mainboard", productName: "Mainboard mATX phù hợp" },
      { slot: "ram", productName: "RAM 8GB DDR4" },
      { slot: "ssd", productName: "SSD SATA 240–500GB" },
      { slot: "psu", productName: "Nguồn 400–500W" },
      { slot: "case", productName: "Case mATX nhỏ gọn" },
      { slot: "monitor", productName: "Màn hình 22–24 inch FullHD" },
      { slot: "keyboard", productName: "Bàn phím cơ cơ bản" },
      { slot: "mouse", productName: "Chuột văn phòng" },
    ],
  },
  {
    id: "design-pro",
    name: "Đồ hoạ & dựng phim 35 triệu",
    description: "Thiết kế 2D/3D, edit video 4K, render nặng.",
    estimatedBudget: 35_000_000,
    slots: [
      { slot: "cpu", productName: "CPU cao cấp (8+ cores, nhiều nhân)" },
      { slot: "mainboard", productName: "Mainboard ATX cao cấp" },
      { slot: "ram", productName: "RAM 32GB DDR5" },
      { slot: "gpu", productName: "VGA cao cấp (RTX 4070+ class)" },
      { slot: "ssd", productName: "SSD NVMe 1TB tốc độ cao" },
      { slot: "hdd", productName: "HDD 2TB lưu trữ" },
      { slot: "psu", productName: "Nguồn 750–850W 80+ Gold" },
      { slot: "case", productName: "Case ATX airflow tốt" },
      { slot: "cooler", productName: "Tản nhiệt khí cao cấp / AIO 240mm" },
      { slot: "monitor", productName: "Màn hình 27–32 inch 4K / 2K 144Hz" },
    ],
  },
];

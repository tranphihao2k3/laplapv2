/**
 * Hằng số dùng chung cho dịch vụ sửa chữa (bảng giá).
 * Dùng ở: validator (kiểm slug hợp lệ), trang admin, trang client, API public.
 */

export type RepairServicePriceType = "fixed" | "from" | "range" | "contact";

export type RepairServiceRow = {
  category: string;
  created_at: string | null;
  description: string | null;
  id: string;
  is_active: boolean;
  is_featured: boolean;
  name: string;
  organization_id: string | null;
  position: number;
  price_max: number | null;
  price_min: number | null;
  price_type: string;
  slug: string | null;
  unit: string | null;
  updated_at: string | null;
  warranty_text: string | null;
};

export type RepairServiceCategory = {
  slug: string;
  label: string;
  /** Mô tả ngắn cho SEO / phụ đề nhóm. */
  blurb: string;
  /** Tên icon lucide (map ở component). */
  icon: "Cpu" | "Wrench" | "MonitorSmartphone" | "Sparkles";
};

export const REPAIR_SERVICE_CATEGORIES: RepairServiceCategory[] = [
  {
    slug: "thay-linh-kien",
    label: "Thay thế linh kiện",
    blurb: "Pin, màn hình, bàn phím, ổ cứng, RAM, sạc chính hãng.",
    icon: "Cpu",
  },
  {
    slug: "sua-phan-cung",
    label: "Sửa phần cứng",
    blurb: "Sửa main, chip, VGA, nguồn, cổng kết nối, đóng chì.",
    icon: "Wrench",
  },
  {
    slug: "sua-phan-mem",
    label: "Sửa phần mềm",
    blurb: "Cài Win, driver, diệt virus, phục hồi dữ liệu, unlock.",
    icon: "MonitorSmartphone",
  },
  {
    slug: "ve-sinh-nang-cap",
    label: "Vệ sinh & Nâng cấp",
    blurb: "Vệ sinh, tra keo tản nhiệt, nâng cấp RAM/SSD.",
    icon: "Sparkles",
  },
];

export const REPAIR_SERVICE_CATEGORY_SLUGS = REPAIR_SERVICE_CATEGORIES.map((c) => c.slug);

export function repairCategoryLabel(slug: string): string {
  return REPAIR_SERVICE_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export const PRICE_TYPE_OPTIONS: { value: RepairServicePriceType; label: string }[] = [
  { value: "fixed", label: "Giá cố định" },
  { value: "from", label: 'Giá "Từ..."' },
  { value: "range", label: "Khoảng giá (min – max)" },
  { value: "contact", label: "Liên hệ" },
];

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ";

/** Hiển thị giá theo price_type — dùng cả admin lẫn client. */
export function formatServicePrice(
  s: Pick<RepairServiceRow, "price_type" | "price_min" | "price_max" | "unit">,
): string {
  const unit = s.unit ? ` ${s.unit}` : "";
  const priceType = s.price_type as RepairServicePriceType | string;
  switch (priceType) {
    case "contact":
      return "Liên hệ";
    case "range":
      if (s.price_min != null && s.price_max != null)
        return `${vnd(s.price_min)} – ${vnd(s.price_max)}${unit}`;
      if (s.price_min != null) return `Từ ${vnd(s.price_min)}${unit}`;
      return "Liên hệ";
    case "from":
      return s.price_min != null ? `Từ ${vnd(s.price_min)}${unit}` : "Liên hệ";
    case "fixed":
    default:
      return s.price_min != null ? `${vnd(s.price_min)}${unit}` : "Liên hệ";
  }
}

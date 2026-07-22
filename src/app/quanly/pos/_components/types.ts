export type ProductVariant = {
  id: string;
  product_id: string | null;
  sku: string | null;
  barcode: string | null;
  name: string | null;
  selling_price: number | null;
  cost_price: number | null;
  is_active: boolean | null;
};

export type Product = {
  id: string;
  name: string;
  slug: string | null;
  thumbnail_url: string | null;
  status: string | null;
  brand_id: string | null;
  category_id: string | null;
};

export type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  tier: string | null;
  loyalty_points: number | null;
};

export type Shop = {
  id: string;
  name: string;
  code: string | null;
};

export type CartLine = {
  variant_id: string;
  product_id: string | null;
  display_name: string;
  sku: string | null;
  thumbnail_url: string | null;
  list_price: number;
  unit_price: number;
  quantity: number;
  /** Tồn kho khả dụng tại cửa hàng đang chọn (tại thời điểm thêm vào giỏ). */
  stock: number;
};

export type PaymentMethod = "cash" | "card" | "transfer" | "ewallet";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Tiền mặt",
  card: "Quẹt thẻ",
  transfer: "Chuyển khoản",
  ewallet: "Ví điện tử",
};

export function formatVND(n: number): string {
  if (!Number.isFinite(n)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

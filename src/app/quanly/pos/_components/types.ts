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
  /** Ghi chú riêng cho dòng (vd: yêu cầu đặc biệt). */
  note?: string | null;
};

export type PaymentMethod = "cash" | "card" | "transfer" | "ewallet";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Tiền mặt",
  card: "Quẹt thẻ",
  transfer: "Chuyển khoản",
  ewallet: "Ví điện tử",
};

/**
 * Một phần thanh toán trong hóa đơn — dùng cho split payment.
 * Một đơn có thể trả bằng nhiều phương thức (vd: 200k tiền mặt + 1.5tr chuyển khoản).
 */
export type PaymentPart = {
  method: PaymentMethod;
  amount: number;
  transaction_code?: string | null;
};

/**
 * Đơn giữ tạm (hold bill) — lưu trong memory, không gọi API server.
 * Cho phép thu ngân tạm dừng đơn để phục vụ khách khác, sau đó quay lại.
 */
export type HeldBill = {
  id: string;
  name: string;
  createdAt: string;
  shopId: string;
  customer: Customer | null;
  lines: CartLine[];
  discount: number;
  note: string;
};

export function formatVND(n: number): string {
  if (!Number.isFinite(n)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("vi-VN").format(n);
}

/**
 * Tính tiền thối khi trả tiền mặt. Đảm bảo không âm.
 */
export function calcChange(received: number, total: number): number {
  return Math.max(0, received - total);
}

/**
 * Tính tổng tiền hàng (chưa trừ giảm giá).
 */
export function calcSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
}

/**
 * Tính tổng cộng = tạm tính - giảm giá (không âm).
 */
export function calcTotal(subtotal: number, discount: number): number {
  return Math.max(0, subtotal - discount);
}

/**
 * Tính số lượng sản phẩm trên đơn.
 */
export function calcItemCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}
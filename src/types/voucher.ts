/**
 * Voucher / Coupon System Types
 * 
 * Voucher types:
 * - percent: Giảm theo % (VD: 10% off)
 * - fixed_amount: Giảm số tiền cố định (VD: 50,000đ)
 * - free_shipping: Miễn phí vận chuyển
 */

export type VoucherType = "percent" | "fixed_amount" | "free_shipping";

export type VoucherStatus = "active" | "expired" | "depleted" | "inactive";

export interface Voucher {
  [key: string]: unknown;
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: VoucherType;
  value: number; // Phần trăm (%) hoặc số tiền cố định (VND)
  min_order_amount: number; // Đơn hàng tối thiểu (VND)
  max_discount_amount: number | null; // Giảm tối đa (cho loại percent)
  quantity_total: number | null; // Tổng số lượng voucher
  quantity_used: number; // Đã sử dụng
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  is_active: boolean;
  applicable_products: string[] | null; // Danh sách product_id được áp dụng
  applicable_categories: string[] | null; // Danh sách category_id được áp dụng
  user_usage_limit: number; // Số lần mỗi user được sử dụng
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoucherUsage {
  id: string;
  voucher_id: string;
  user_id: string | null;
  user_identifier: string | null;
  order_id: string | null;
  discount_amount: number;
  used_at: string;
}

export interface ActiveVoucher {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: VoucherType;
  value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  applicable_products: string[] | null;
  applicable_categories: string[] | null;
  user_usage_limit: number;
  quantity_total: number | null;
  quantity_used: number;
  quantity_remaining: number | null;
}

// API Request/Response types
export interface CreateVoucherInput {
  code: string;
  name: string;
  description?: string;
  type: VoucherType;
  value: number;
  min_order_amount?: number;
  max_discount_amount?: number | null;
  quantity_total?: number | null;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  applicable_products?: string[] | null;
  applicable_categories?: string[] | null;
  user_usage_limit?: number;
}

export interface UpdateVoucherInput {
  code?: string;
  name?: string;
  description?: string;
  type?: VoucherType;
  value?: number;
  min_order_amount?: number;
  max_discount_amount?: number | null;
  quantity_total?: number | null;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  applicable_products?: string[] | null;
  applicable_categories?: string[] | null;
  user_usage_limit?: number;
}

export interface ValidateVoucherInput {
  code: string;
  order_amount: number;
  user_id?: string;
  product_ids?: string[];
  category_ids?: string[];
}

export interface ValidateVoucherResponse {
  valid: boolean;
  voucher_id: string | null;
  voucher_type: VoucherType | null;
  voucher_name: string | null;
  discount_amount: number | null;
  error_message: string | null;
}

// Cart applied voucher
export interface AppliedVoucher {
  id: string;
  code: string;
  name: string;
  type: VoucherType;
  value: number;
  discount_amount: number;
  max_discount_amount: number | null;
}

// Helper functions
export function getVoucherStatus(voucher: Voucher): VoucherStatus {
  if (!voucher.is_active) return "inactive";
  if (voucher.end_date && new Date(voucher.end_date) < new Date()) return "expired";
  if (voucher.quantity_total !== null && voucher.quantity_used >= voucher.quantity_total) return "depleted";
  return "active";
}

export function formatVoucherValue(type: VoucherType, value: number): string {
  switch (type) {
    case "percent":
      return `${value}%`;
    case "fixed_amount":
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(value);
    case "free_shipping":
      return "Miễn phí vận chuyển";
    default:
      return String(value);
  }
}

export function isVoucherApplicable(
  voucher: Voucher | ActiveVoucher,
  orderAmount: number,
  productIds?: string[],
  categoryIds?: string[]
): { applicable: boolean; reason?: string } {
  const now = new Date();
  
  // Check if voucher is active
  if (!voucher.is_active) {
    return { applicable: false, reason: "Voucher đã bị vô hiệu hóa" };
  }
  
  // Check date validity
  if (voucher.start_date && new Date(voucher.start_date) > now) {
    return { applicable: false, reason: "Voucher chưa bắt đầu" };
  }
  
  if (voucher.end_date && new Date(voucher.end_date) < now) {
    return { applicable: false, reason: "Voucher đã hết hạn" };
  }
  
  // Check quantity
  if ("quantity_total" in voucher && voucher.quantity_total !== null && voucher.quantity_used >= voucher.quantity_total) {
    return { applicable: false, reason: "Voucher đã hết lượt sử dụng" };
  }
  
  // Check min order amount
  if (orderAmount < voucher.min_order_amount) {
    return { 
      applicable: false, 
      reason: `Đơn hàng tối thiểu ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(voucher.min_order_amount)}` 
    };
  }
  
  // Check product/category restrictions
  if (voucher.applicable_products && voucher.applicable_products.length > 0) {
    if (!productIds || !productIds.some(id => voucher.applicable_products!.includes(id))) {
      return { applicable: false, reason: "Voucher không áp dụng cho sản phẩm trong giỏ hàng" };
    }
  }
  
  if (voucher.applicable_categories && voucher.applicable_categories.length > 0) {
    if (!categoryIds || !categoryIds.some(id => voucher.applicable_categories!.includes(id))) {
      return { applicable: false, reason: "Voucher không áp dụng cho danh mục sản phẩm trong giỏ hàng" };
    }
  }
  
  return { applicable: true };
}

export function calculateDiscount(
  voucher: Voucher | ActiveVoucher,
  orderAmount: number
): number {
  switch (voucher.type) {
    case "percent": {
      let discount = Math.round(orderAmount * voucher.value / 100);
      if (voucher.max_discount_amount !== null) {
        discount = Math.min(discount, voucher.max_discount_amount);
      }
      return discount;
    }
    case "fixed_amount":
      return Math.min(voucher.value, orderAmount);
    case "free_shipping":
      return 0; // Free shipping handled separately
    default:
      return 0;
  }
}

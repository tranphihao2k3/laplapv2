/**
 * Footer Settings — types, defaults, and data fetching for the footer component.
 * Stores footer links, description, copyright, and payment methods in the settings table.
 *
 * Settings table structure:
 *   - group_name: "footer"
 *   - key: "footer_links" | "footer_description" | "footer_payment_methods" | "footer_copyright"
 */

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

// ====== Types ======

export type FooterLink = {
  /** Unique identifier for the link */
  id: string;
  /** URL path or full URL */
  href: string;
  /** Display label */
  label: string;
  /** Optional: opens in new tab */
  external?: boolean;
  /** Sort order */
  order: number;
};

export type FooterColumn = {
  /** Unique identifier for the column */
  id: string;
  /** Column title (e.g., "Chính sách", "Hỗ trợ") */
  title: string;
  /** Links in this column */
  links: FooterLink[];
  /** Sort order of columns */
  order: number;
};

export type FooterSettings = {
  /** Description text shown in footer brand section */
  description?: string;
  /** Custom copyright text */
  copyright?: string;
  /** Payment method badges to show */
  payment_methods?: string[];
  /** Columns with links */
  columns?: FooterColumn[];
};

// ====== Defaults ======

export const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
  description:
    "Hệ thống bán lẻ laptop chính hãng hàng đầu tại Cần Thơ. Cam kết sản phẩm chính hãng, giá tốt nhất.",
  copyright: undefined, // Uses dynamic year + store name
  payment_methods: ["Visa", "MasterCard", "COD", "MoMo", "VNPay", "Trả góp 0%"],
  columns: [
    {
      id: "about",
      title: "Về LapLap",
      order: 0,
      links: [
        { id: "about-us", href: "/about", label: "Giới thiệu", order: 0 },
        { id: "contact", href: "/contact", label: "Liên hệ", order: 1 },
        { id: "faq", href: "/cau-hoi-thuong-gap", label: "Câu hỏi thường gặp", order: 2 },
        { id: "careers", href: "/about#tuyen-dung", label: "Tuyển dụng", order: 3 },
      ],
    },
    {
      id: "policies",
      title: "Chính sách",
      order: 1,
      links: [
        { id: "warranty", href: "/chinh-sach-bao-hanh", label: "Chính sách bảo hành", order: 0 },
        { id: "returns", href: "/chinh-sach-doi-tra", label: "Chính sách đổi trả", order: 1 },
        { id: "shipping", href: "/chinh-sach-giao-hang", label: "Chính sách giao hàng", order: 2 },
        { id: "payment", href: "/chinh-sach-thanh-toan", label: "Chính sách thanh toán", order: 3 },
        { id: "privacy", href: "/chinh-sach-bao-mat", label: "Chính sách bảo mật", order: 4 },
      ],
    },
    {
      id: "legal",
      title: "Pháp lý",
      order: 2,
      links: [
        { id: "terms", href: "/dieu-khoan-su-dung", label: "Điều khoản sử dụng", order: 0 },
        { id: "complaints", href: "/chinh-sach-giai-quyet-khieu-nai", label: "Giải quyết khiếu nại", order: 1 },
      ],
    },
    {
      id: "support",
      title: "Hỗ trợ",
      order: 3,
      links: [
        { id: "how-to-buy", href: "/cau-hoi-thuong-gap", label: "Hướng dẫn mua hàng", order: 0 },
        { id: "shipping-info", href: "/chinh-sach-thanh-toan", label: "Thanh toán & vận chuyển", order: 1 },
        { id: "warranty-lookup", href: "/tra-cuu-bao-hanh", label: "Tra cứu bảo hành", order: 2 },
        { id: "repair", href: "/dich-vu-sua-chua", label: "Dịch vụ sửa chữa", order: 3 },
        { id: "support-contact", href: "/contact", label: "Liên hệ hỗ trợ", order: 4 },
      ],
    },
  ],
};

/**
 * Cached data fetching functions are in footer-settings-cached.ts
 * Import from that file in Server Components and API routes.
 */

// ====== Helpers ======

function asJson<T>(v: unknown): T | null {
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  if (typeof v === "object" && v !== null) {
    return v as T;
  }
  return null;
}

// ====== Cached Data Fetching ======

/**
 * Get footer settings using React cache (per-request).
 * Falls back to defaults if no settings exist.
 */
export const getFooterSettings = cache(async (): Promise<FooterSettings> => {
  return _getFooterSettings();
});

/**
 * Cached version using Next.js unstable_cache is in footer-settings-cached.ts
 */


async function _getFooterSettings(): Promise<FooterSettings> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .eq("group_name", "footer");

    if (error || !data) {
      return DEFAULT_FOOTER_SETTINGS;
    }

    const rows = data as Array<{ key: string | null; value: unknown }>;
    const map = new Map<string, unknown>();
    for (const r of rows) {
      if (r.key) map.set(r.key, r.value);
    }

    // Parse footer columns (stored as JSON)
    const columns = asJson<FooterColumn[]>(map.get("footer_columns")) ?? DEFAULT_FOOTER_SETTINGS.columns;

    // Sort columns and their links by order
    const sortedColumns = [...(columns ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((col) => ({
        ...col,
        links: [...col.links].sort((a, b) => a.order - b.order),
      }));

    return {
      description: (map.get("footer_description") as string) ?? DEFAULT_FOOTER_SETTINGS.description,
      copyright: (map.get("footer_copyright") as string) ?? DEFAULT_FOOTER_SETTINGS.copyright,
      payment_methods:
        asJson<string[]>(map.get("footer_payment_methods")) ?? DEFAULT_FOOTER_SETTINGS.payment_methods,
      columns: sortedColumns,
    };
  } catch {
    return DEFAULT_FOOTER_SETTINGS;
  }
}

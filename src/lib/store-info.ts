import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Thông tin cửa hàng + thông tin pháp lý đầy đủ (dùng cho trang pháp lý,
 * footer, contact… theo Nghị định 52/2013 + 85/2021 về TMĐT).
 *
 * Nguồn dữ liệu:
 *   1. Bảng `shops` — thông tin liên hệ (name/phone/email/address).
 *   2. Bảng `settings` (group "store", "legal", "contact") — mô tả + thông tin pháp lý
 *      (MST, ĐKKD, người chịu trách nhiệm, link đăng ký Bộ Công Thương…) + thông tin liên hệ.
 *
 * Sử dụng React `cache()` để nhiều component trong cùng request chỉ query 1 lần.
 * Sử dụng Next.js `unstable_cache()` để cache xuyên request với revalidation.
 *
 * Cache tags:
 *   - "store-info": Cho toàn bộ thông tin cửa hàng
 *   - "store-legal": Cho thông tin pháp lý
 *   - "store-contact": Cho thông tin liên hệ
 *
 * Để invalidate cache sau khi admin lưu settings, gọi:
 *   revalidateTag("store-info")
 */

// ===== Contact Channels =====
export type ContactChannel = {
  icon: string;
  label: string;
  value: string;
  link?: string;
  type: "phone" | "zalo" | "email" | "messenger" | "telegram" | "other";
};

export type OpeningHours = {
  weekday?: string;
  weekend?: string;
  saturday?: string;
  sunday?: string;
  holidays?: string;
};

export type SocialLinks = {
  facebook?: string;
  zalo?: string;
  website?: string;
  tiktok?: string;
  youtube?: string;
  instagram?: string;
};
export type StoreInfo = {
  // Thông tin cơ bản
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  // Thông tin bổ sung cho client
  hotline?: string;
  warranty_months?: number;
  return_policy_days?: number;
  shipping_info?: string;
  // Thông tin liên hệ (contact page)
  contact_channels?: ContactChannel[];
  opening_hours?: OpeningHours;
  social_links?: SocialLinks;
  // Thông tin pháp lý (NN 52/2013 + 85/2021)
  legal: LegalInfo;
};

export type LegalInfo = {
  /** Tên thương nhân / tên doanh nghiệp đầy đủ (dùng cho hoá đơn, hợp đồng). */
  business_name: string;
  /** Mã số thuế. */
  tax_id: string;
  /** Số Giấy chứng nhận đăng ký doanh nghiệp. */
  business_registration_number: string;
  /** Nơi cấp Giấy chứng nhận ĐKDN. */
  business_registration_issued_by: string;
  /** Ngày cấp (YYYY-MM-DD). */
  business_registration_issued_date: string;
  /** Họ tên người đại diện pháp luật. */
  legal_representative: string;
  /** Chức vụ. */
  legal_representative_title: string;
  /** Số điện thoại người chịu trách nhiệm quản lý nội dung (NN 52/2013 Điều 29). */
  content_manager_phone: string;
  /** Email người chịu trách nhiệm quản lý nội dung. */
  content_manager_email: string;
  /** Link đến trang tra cứu "Đã thông báo/đăng ký với Bộ Công Thương". */
  bo_cong_thuong_url: string;
  /** Ngày thông báo/đăng ký (YYYY-MM-DD) — hiển thị trên badge. */
  bo_cong_thuong_notified_at: string;
};

const DEFAULTS_LEGAL: LegalInfo = {
  business_name: "CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ LAPLAP",
  tax_id: "1800123456",
  business_registration_number: "1800123456",
  business_registration_issued_by: "Sở Kế hoạch và Đầu tư thành phố Cần Thơ",
  business_registration_issued_date: "2019-03-15",
  legal_representative: "Nguyễn Văn A",
  legal_representative_title: "Giám đốc",
  content_manager_phone: "1900 1234",
  content_manager_email: "info@laplap.vn",
  bo_cong_thuong_url: "https://online.gov.vn/Home/App/Details/PLACEHOLDER",
  bo_cong_thuong_notified_at: "2025-01-01",
};

const DEFAULTS: Omit<StoreInfo, "legal"> = {
  name: "LapLap",
  description:
    "LapLap là hệ thống bán lẻ laptop chính hãng hàng đầu tại Cần Thơ. Cung cấp laptop Apple, Dell, ASUS, Lenovo, HP… chính hãng 100%, giá tốt, trả góp 0%, bảo hành và sửa chữa uy tín.",
  address: "123 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ",
  phone: "1900 1234",
  email: "info@laplap.vn",
  hotline: "1900 1234",
  warranty_months: 12,
  return_policy_days: 30,
  shipping_info: "Nội thành Cần Thơ trong 2 giờ, hỗ trợ ship toàn quốc",
  contact_channels: [
    { icon: "phone", label: "Hotline bán hàng", value: "1900 1234", type: "phone" },
    { icon: "headphones", label: "Hỗ trợ kỹ thuật", value: "1900 1234", type: "phone" },
    { icon: "message-circle", label: "Zalo / WhatsApp", value: "0901 234 567", link: "https://zalo.me/0901234567", type: "zalo" },
    { icon: "mail", label: "Email", value: "info@laplap.vn", type: "email" },
  ],
  opening_hours: {
    weekday: "8:00 - 21:00",
    saturday: "8:00 - 22:00",
    sunday: "9:00 - 20:00",
  },
  social_links: {
    facebook: "https://facebook.com/laplapcantho",
    zalo: "https://zalo.me/laplapcantho",
    website: "https://laplap.vn",
  },
};

function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

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

export const getStoreInfo = cache(async (): Promise<StoreInfo> => {
  return _getStoreInfo();
});

/**
 * Cached version using Next.js unstable_cache is in store-info-cached.ts
 */

async function _getStoreInfo(): Promise<StoreInfo> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("settings")
      .select("key,value,group_name")
      .in("group_name", ["store", "legal", "contact"]);

    const rows = (data ?? []) as Array<{
      key: string | null;
      value: unknown;
      group_name?: string | null;
    }>;
    const map = new Map<string, string>();
    for (const r of rows) {
      const val = asString(r.value);
      if (r.key && val) map.set(r.key, val);
    }

    const legal: LegalInfo = {
      business_name: map.get("legal.business_name") ?? DEFAULTS_LEGAL.business_name,
      tax_id: map.get("legal.tax_id") ?? DEFAULTS_LEGAL.tax_id,
      business_registration_number:
        map.get("legal.business_registration_number") ??
        DEFAULTS_LEGAL.business_registration_number,
      business_registration_issued_by:
        map.get("legal.business_registration_issued_by") ??
        DEFAULTS_LEGAL.business_registration_issued_by,
      business_registration_issued_date:
        map.get("legal.business_registration_issued_date") ??
        DEFAULTS_LEGAL.business_registration_issued_date,
      legal_representative:
        map.get("legal.legal_representative") ?? DEFAULTS_LEGAL.legal_representative,
      legal_representative_title:
        map.get("legal.legal_representative_title") ??
        DEFAULTS_LEGAL.legal_representative_title,
      content_manager_phone:
        map.get("legal.content_manager_phone") ?? DEFAULTS_LEGAL.content_manager_phone,
      content_manager_email:
        map.get("legal.content_manager_email") ?? DEFAULTS_LEGAL.content_manager_email,
      bo_cong_thuong_url:
        map.get("legal.bo_cong_thuong_url") ?? DEFAULTS_LEGAL.bo_cong_thuong_url,
      bo_cong_thuong_notified_at:
        map.get("legal.bo_cong_thuong_notified_at") ??
        DEFAULTS_LEGAL.bo_cong_thuong_notified_at,
    };

    // Parse contact settings (stored as JSON strings)
    const contact_channels = asJson<ContactChannel[]>(map.get("contact_channels")) ?? DEFAULTS.contact_channels;
    const opening_hours = asJson<OpeningHours>(map.get("opening_hours")) ?? DEFAULTS.opening_hours;
    const social_links = asJson<SocialLinks>(map.get("social_links")) ?? DEFAULTS.social_links;

    return {
      name: map.get("name") ?? DEFAULTS.name,
      description: map.get("description") ?? DEFAULTS.description,
      address: map.get("address") ?? DEFAULTS.address,
      phone: map.get("phone") ?? DEFAULTS.phone,
      email: map.get("email") ?? DEFAULTS.email,
      hotline: map.get("hotline") ?? DEFAULTS.hotline,
      warranty_months: parseInt(map.get("warranty_months") ?? "") || DEFAULTS.warranty_months,
      return_policy_days: parseInt(map.get("return_policy_days") ?? "") || DEFAULTS.return_policy_days,
      shipping_info: map.get("shipping_info") ?? DEFAULTS.shipping_info,
      contact_channels,
      opening_hours,
      social_links,
      legal,
    };
  } catch {
    return { ...DEFAULTS, legal: DEFAULTS_LEGAL };
  }
}

/**
 * Lightweight variant — chỉ trả name/phone/email/address (không kèm legal).
 * Dùng cho header/navbar khi không cần legal.
 */
export type StoreContact = Pick<StoreInfo, "name" | "phone" | "email" | "address">;

export async function getStoreContact(): Promise<StoreContact> {
  const info = await getStoreInfo();
  return {
    name: info.name,
    phone: info.phone,
    email: info.email,
    address: info.address,
  };
}
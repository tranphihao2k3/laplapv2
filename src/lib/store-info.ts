import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Thông tin cửa hàng + thông tin pháp lý đầy đủ (dùng cho trang pháp lý,
 * footer, contact… theo Nghị định 52/2013 + 85/2021 về TMĐT).
 *
 * Nguồn dữ liệu:
 *   1. Bảng `shops` — thông tin liên hệ (name/phone/email/address).
 *   2. Bảng `settings` (group "store" và "legal") — mô tả + thông tin pháp lý
 *      (MST, ĐKKD, người chịu trách nhiệm, link đăng ký Bộ Công Thương…).
 *
 * `cache()` để nhiều component trong cùng request chỉ query 1 lần.
 */
export type StoreInfo = {
  // Thông tin cơ bản
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
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
};

function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

export const getStoreInfo = cache(async (): Promise<StoreInfo> => {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("settings")
      .select("key,value,group_name")
      .in("group_name", ["store", "legal"]);

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

    return {
      name: map.get("name") ?? DEFAULTS.name,
      description: map.get("description") ?? DEFAULTS.description,
      address: map.get("address") ?? DEFAULTS.address,
      phone: map.get("phone") ?? DEFAULTS.phone,
      email: map.get("email") ?? DEFAULTS.email,
      legal,
    };
  } catch {
    return { ...DEFAULTS, legal: DEFAULTS_LEGAL };
  }
});

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
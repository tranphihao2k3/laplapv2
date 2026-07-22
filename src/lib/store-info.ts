import { createAdminClient } from "@/lib/supabase/admin";

export type StoreInfo = {
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
};

type SettingRow = { key: string | null; value: unknown };

const DEFAULTS: StoreInfo = {
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

export async function getStoreInfo(): Promise<StoreInfo> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .eq("group_name", "store");

    const rows = (data ?? []) as SettingRow[];
    const map = new Map<string, string>();
    for (const r of rows) {
      const val = asString(r.value);
      if (r.key && val) map.set(r.key, val);
    }

    return {
      name: map.get("name") ?? DEFAULTS.name,
      description: map.get("description") ?? DEFAULTS.description,
      address: map.get("address") ?? DEFAULTS.address,
      phone: map.get("phone") ?? DEFAULTS.phone,
      email: map.get("email") ?? DEFAULTS.email,
    };
  } catch {
    return DEFAULTS;
  }
}

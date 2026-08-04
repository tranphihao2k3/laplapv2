/**
 * Template presets — TPL-001 defaults.
 *
 * Seed 3 mẫu đăng bán phổ biến cho user mới:
 *  1. "Mặc định — Laptop Cần Thơ" — phong cách chuyên laptop cũ: tiêu đề
 *     giật + dòng cấu hình (CPU/RAM/SSD/Màn/Pin/Phím) + giá + bảo hành
 *     + quà tặng + góp 0%.
 *  2. "Mặc định — Điện thoại" — cấu hình gọn (RAM/ROM/Pin/Camera/Screen)
 *     + giá + bảo hành.
 *  3. "Mặc định — Phụ kiện" — 1 dòng tên + giá + bảo hành.
 *
 * Cú pháp biến: {{product.name}}, {{variant.price}}, {{variant.specs.cpu}},
 * ... Đầy đủ trong ALLOWED_VARIABLES bên dưới.
 *
 * Biến nào user không có dữ liệu (vd GPU cho laptop văn phòng) → render
 * thành "" (unknownFallback mặc định). Vì vậy mỗi dòng specs dùng cú pháp
 * có leading icon + tên key — nếu thiếu value, dòng đó trống nhưng các
 * dòng khác vẫn hiển thị bình thường.
 *
 * Khi seed, nếu user đã tạo template trùng tên thì skip (idempotent).
 */

export type PresetKind = "laptop" | "phone" | "accessory";

export type TemplatePreset = {
  /** Tên hiển thị trong UI và lưu DB (UNIQUE). */
  name: string;
  /** Phân loại — dùng để group khi list. */
  kind: PresetKind;
  body: string;
};

/** Danh sách biến user có thể dùng trong body (cho UI hint + render doc). */
export const ALLOWED_VARIABLES: readonly string[] = [
  "product.name",
  "product.shortDescription",
  "product.slug",
  "product.updatedAt",
  "variant.sku",
  "variant.name",
  "variant.price",
  "variant.priceText",
  "variant.availableQty",
  "variant.specs.cpu",
  "variant.specs.ram",
  "variant.specs.ssd",
  "variant.specs.gpu",
  "variant.specs.screen",
  "variant.specs.battery",
  "variant.specs.keyboard",
  "variant.specs.camera",
  "variant.specs.os",
  "variant.specs.weight",
  "variant.specs.color",
  "variant.warrantyText",
  "variant.giftsText",
  "group.name",
  "group.url",
  "post.id",
  "post.scheduledAt",
];

/** Extract biến từ body để lưu vào DB (TPL-001). */
export function extractVariableList(body: string): string[] {
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m[1]) out.add(m[1]);
  }
  return [...out];
}

/** Preset 1 — Laptop Cần Thơ (mặc định). */
const LAPTOP_BODY = `🔥1 máy duy nhất cấu hình cao Chíp H nhanh mượt bản 16G Ram
💻{{product.name}}
⚡️Cpu {{variant.specs.cpu}}
⚡️Ram {{variant.specs.ram}}/ Ssd {{variant.specs.ssd}}
⚡️Màn {{variant.specs.screen}}
⚡️Pin {{variant.specs.battery}}/ Bàn phím {{variant.specs.keyboard}}
💵Chỉ {{variant.priceText}}
⏰Bảo hành tại shop {{variant.warrantyText}}
🎁{{variant.giftsText}}
🔥Góp 0% qua thẻ tín dụng và góp hồ sơ lãi suất thấp chỉ cần cccd
#Laptopcu_cantho`;

/** Preset 2 — Điện thoại. */
const PHONE_BODY = `📱{{product.name}} {{variant.name}}
⚡️Chip {{variant.specs.cpu}}
⚡️Ram {{variant.specs.ram}}/ Rom {{variant.specs.ssd}}
⚡️Màn {{variant.specs.screen}}
⚡️Pin {{variant.specs.battery}}/ Camera {{variant.specs.camera}}
⚡️Hệ điều hành {{variant.specs.os}}/ Màu {{variant.specs.color}}
💵Giá chỉ {{variant.priceText}}
⏰Bảo hành {{variant.warrantyText}}
🎁{{variant.giftsText}}
#Dienthoai_cantho`;

/** Preset 3 — Phụ kiện / sản phẩm nhỏ. */
const ACCESSORY_BODY = `🎁{{product.name}}
{{product.shortDescription}}
💵Giá chỉ {{variant.priceText}}
⏰Bảo hành {{variant.warrantyText}}
🎁{{variant.giftsText}}
#Phukien_cantho`;

/** Danh sách preset seed mặc định. Thứ tự = thứ tự hiển thị trong list. */
export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  { name: "Mặc định — Laptop Cần Thơ", kind: "laptop", body: LAPTOP_BODY },
  { name: "Mặc định — Điện thoại", kind: "phone", body: PHONE_BODY },
  { name: "Mặc định — Phụ kiện", kind: "accessory", body: ACCESSORY_BODY },
] as const;

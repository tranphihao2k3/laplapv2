/**
 * Shared constants cho template UI (TPL-001).
 *
 * Renderer dùng để hiển thị gợi ý biến + sample preview. Main dùng
 * cùng list để validate allowlist khi user nhập tay trong textarea.
 *
 * Biến nào cho phép trong body đã được engine ALLOWED_VARIABLE_PREFIXES
 * quyết định (product./variant./group./post.) — list này là subset
 * thực tế mà campaign-service build được trong context.
 */

import type { ProductVariantSummary } from "./catalog";

/** Tất cả biến user có thể chèn vào body template. */
export const TEMPLATE_VARIABLES: readonly string[] = [
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

/** Sample data cho live preview khi user edit template. */
export const SAMPLE_TEMPLATE_CONTEXT: Record<string, unknown> = {
  "product.name": "Lenovo Ideapad Slim 3i 15IAH8",
  "product.shortDescription": "Laptop văn phòng mỏng nhẹ, pin tốt",
  "product.slug": "lenovo-ideapad-slim-3i-15iah8",
  "product.updatedAt": "2026-08-01T10:00:00Z",
  "variant.sku": "LAP-IDP-15IAH8-I5-16-256",
  "variant.name": "Bản 16GB/256GB",
  "variant.price": 8500000,
  "variant.priceText": "8.500K",
  "variant.availableQty": 7,
  "variant.specs.cpu": "I5-12450H (8 nhân 12 luồng) mạnh mẽ",
  "variant.specs.ram": "16G",
  "variant.specs.ssd": "Nvme 256G",
  "variant.specs.gpu": "Intel UHD Graphics",
  "variant.specs.screen": '15.6" FHD Ips',
  "variant.specs.battery": "2-4h",
  "variant.specs.keyboard": "Full Size",
  "variant.specs.camera": "720p",
  "variant.specs.os": "Windows 11 Home",
  "variant.specs.weight": "1.6 kg",
  "variant.specs.color": "Xám",
  "variant.warrantyText": "3 tháng",
  "variant.giftsText": "Balo + túi chống sốc + chuột + lót chuột + sạc Zin",
  "group.name": "Mua bán laptop Hà Nội",
  "group.url": "https://facebook.com/groups/laptop-hn",
  "post.id": "demo-post-id",
  "post.scheduledAt": "2026-08-05T09:00:00Z",
};

/** Body mặc định khi user bấm "Tạo mẫu" lần đầu (giống preset Laptop). */
export const DEFAULT_TEMPLATE_BODY = `🔥1 máy duy nhất cấu hình cao Chíp H nhanh mượt bản 16G Ram
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

/** Extract biến `{{x.y}}` từ body (dùng cho textarea editor + save). */
export function extractTemplateVariables(body: string): string[] {
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m[1]) out.add(m[1]);
  }
  return [...out];
}

/** Re-export để renderer khỏi phải import 2 chỗ. */
export type { ProductVariantSummary };

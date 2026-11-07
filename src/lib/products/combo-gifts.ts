/**
 * Quà tặng combo chuẩn của cửa hàng — dùng chung cho UI picker + seed tồn kho.
 */
export const COMBO_GIFT_PRODUCTS = [
  { name: "Chuột", slug: "qua-tang-chuot", keywords: ["chuột", "chuot", "mouse"] },
  { name: "Lót chuột", slug: "qua-tang-lot-chuot", keywords: ["lót chuột", "lot chuot", "mousepad"] },
  { name: "Balo", slug: "qua-tang-balo", keywords: ["balo", "balô", "backpack"] },
  {
    name: "Túi chống sốc",
    slug: "qua-tang-tui-chong-soc",
    keywords: ["túi chống sốc", "tui chong soc", "sleeve", "chống sốc"],
  },
] as const;

export const DEFAULT_COMBO_GIFT_STOCK = 10_000;

export function normalizeGiftName(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function scoreGiftName(productName: string, target: string): number {
  const n = normalizeGiftName(productName);
  const k = normalizeGiftName(target);
  if (!n || !k) return 0;
  if (n === k) return 100;
  if (n.startsWith(k) || k.startsWith(n)) return 90;
  if (n.includes(k) || k.includes(n)) return 70;
  return 0;
}

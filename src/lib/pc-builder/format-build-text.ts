/**
 * Chuỗi cấu hình PC để copy / gửi Zalo — không kèm giá (chế độ tham khảo).
 */
import {
  SLOT_LABEL,
  SLOT_ORDER,
  type BuildState,
} from "./types";
import { countItems } from "./storage";

export function formatBuildText(build: BuildState, opts?: { shopName?: string }): string {
  const lines: string[] = [];
  lines.push(`Cấu hình PC tham khảo${opts?.shopName ? ` — ${opts.shopName}` : ""}`);
  lines.push(`(${countItems(build)} linh kiện)`);
  lines.push("");

  for (const slot of SLOT_ORDER) {
    const items = build[slot] ?? [];
    if (items.length === 0) continue;
    lines.push(`• ${SLOT_LABEL[slot]}:`);
    for (const it of items) {
      const brand = it.brand ? `${it.brand} · ` : "";
      const qty = it.qty > 1 ? ` ×${it.qty}` : "";
      lines.push(`  - ${brand}${it.name}${qty}`);
    }
  }

  lines.push("");
  lines.push("Chỉ tham khảo cấu hình. Em muốn build bộ này, anh/chị shop báo giá giúp ạ.");
  return lines.join("\n");
}

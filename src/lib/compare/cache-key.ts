/**
 * Cache key cho kết quả AI phân tích so sánh.
 *
 * VÌ SAO KHÔNG DÙNG updated_at: bảng product_variants (nơi lưu specs) KHÔNG có
 * cột updated_at, và products.updated_at không đổi khi admin sửa specs của
 * variant. Dùng updated_at sẽ không invalidate → khách xem phân tích cũ đã sai.
 *
 * Thay vào đó hash chính NỘI DUNG đã dùng để hỏi AI. Zero chi phí vì dữ liệu
 * đã có sẵn trong tay, và tự invalidate chính xác khi specs/giá đổi.
 */

import { METRIC_BY_ID, rawValueOf } from "./spec-registry";
import type { ProductForCompare } from "./types";

/**
 * Các thông số THỰC SỰ gửi cho AI.
 *
 * Khai báo ở đây (không import từ lib/ai) để tránh vòng import, và vì fingerprint
 * bắt buộc phải khớp đúng tập thông số này — chỉ hash phần dữ liệu có ảnh hưởng
 * tới kết quả AI, nên sửa bảo hành hay cổng kết nối không làm mất cache.
 */
export const AI_RELEVANT_METRICS = ["cpu", "gpu", "display", "ram", "storage"] as const;

/**
 * Tăng số này mỗi khi đổi prompt / thang điểm / schema
 * → invalidate toàn bộ cache cũ.
 */
export const COMPARE_PROMPT_VERSION = 1;

/**
 * Chuỗi nguồn trước khi hash (lưu vào DB để debug được).
 *
 * Sắp xếp theo id nên chọn máy theo thứ tự nào cũng ra một key.
 * Chỉ lấy các thông số THỰC SỰ gửi cho AI → sửa spec không liên quan
 * (vd. bảo hành, cổng kết nối) không làm mất cache.
 */
export function buildFingerprint(products: ProductForCompare[], model: string): string {
  const parts = [...products]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => {
      const specs = AI_RELEVANT_METRICS.map((metricId) => {
        const metric = METRIC_BY_ID.get(metricId);
        const value = metric ? rawValueOf(metric, p.specs) : undefined;
        return value ? `${metricId}=${value}` : null;
      })
        .filter(Boolean)
        .join(";");
      return `${p.id}|${p.price}|${specs}`;
    });

  return [`v${COMPARE_PROMPT_VERSION}`, model, ...parts].join("::");
}

/**
 * SHA-256 hex qua Web Crypto.
 *
 * Dùng crypto.subtle (có sẵn ở global scope trên cả Cloudflare Workers lẫn
 * Node 18+) thay vì node:crypto để không phụ thuộc nodejs_compat.
 */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

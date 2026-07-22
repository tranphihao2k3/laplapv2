/**
 * Chuẩn hoá chuỗi RAM về một định dạng thống nhất: "<dung lượng>GB <loại DDR>".
 *
 * Ví dụ đầu vào lộn xộn (AI/nhập tay) → đầu ra chuẩn:
 *   "16GB"                         → "16GB"
 *   "16 GB DDR4"                   → "16GB DDR4"
 *   "8gb ddr4"                     → "8GB DDR4"
 *   "16GB DDR5 (nâng cấp tối đa 64GB)" → "16GB DDR5"
 *   "16GB (hỗ trợ nâng cấp tối đa 32GB)" → "16GB"
 *   "RAM 8G LPDDR5"                → "8GB LPDDR5"
 *   "0.5TB"/không nhận diện        → giữ nguyên chuỗi gốc đã trim
 *
 * Dùng chung cho: bộ lọc sản phẩm (gom nhóm & khớp) và AI sinh spec (đồng bộ output).
 */
export function normalizeRam(input: unknown): string {
  if (typeof input !== "string") return "";
  const raw = input.trim();
  if (!raw) return "";

  // Tìm dung lượng: số + đơn vị GB (chấp nhận "16GB", "16 GB", "16G", "16 gb").
  const sizeMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:gb|g\b)/i);
  // Tìm loại DDR: DDR3/DDR4/DDR5, LPDDR4/LPDDR4X/LPDDR5/LPDDR5X.
  const ddrMatch = raw.match(/\b(LP)?DDR\s*([345])(X)?\b/i);

  if (!sizeMatch) {
    // Không nhận diện được dung lượng → trả chuỗi gốc (đã trim) để không mất dữ liệu.
    return raw;
  }

  const size = `${sizeMatch[1]}GB`;
  if (!ddrMatch) return size;

  const lp = ddrMatch[1] ? "LP" : "";
  const gen = ddrMatch[2];
  const x = ddrMatch[3] ? "X" : "";
  return `${size} ${lp}DDR${gen}${x}`;
}

/**
 * Chỉ lấy phần DUNG LƯỢNG của RAM, bỏ loại DDR — dùng cho BỘ LỌC để gom nhóm gọn.
 *   "16GB DDR4" → "16GB"
 *   "16GB DDR5" → "16GB"
 *   "16GB (hỗ trợ nâng cấp tối đa 64GB)" → "16GB"
 *   "8GB"       → "8GB"
 * DB và trang chi tiết vẫn giữ chuỗi đầy đủ; đây chỉ là khoá gom nhóm.
 */
export function ramSize(input: unknown): string {
  const normalized = normalizeRam(input);
  const m = normalized.match(/^(\d+(?:\.\d+)?GB)/i);
  return m ? m[1].toUpperCase() : normalized;
}

/**
 * Lấy DUNG LƯỢNG ổ cứng để gom nhóm bộ lọc, bỏ loại (SSD/NVMe/HDD).
 *   "512GB SSD"  → "512GB"
 *   "512GB NVMe" → "512GB"
 *   "1TB SSD"    → "1TB"
 *   "1 TB"       → "1TB"
 * Không nhận diện được → trả chuỗi gốc (đã trim).
 */
export function storageSize(input: unknown): string {
  if (typeof input !== "string") return "";
  const raw = input.trim();
  if (!raw) return "";
  const m = raw.match(/(\d+(?:\.\d+)?)\s*(TB|GB)/i);
  if (!m) return raw;
  return `${m[1]}${m[2].toUpperCase()}`;
}

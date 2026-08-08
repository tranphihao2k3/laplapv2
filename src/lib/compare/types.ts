/**
 * Kiểu dùng chung cho tính năng so sánh laptop (/so-sanh).
 *
 * Thư mục src/lib/compare/ là logic THUẦN (data + hàm thuần), KHÔNG import
 * React hay lucide-react — để API route chạy trên Cloudflare Worker import
 * được mà không kéo theo bundle UI.
 */

/** Hướng "tốt hơn" của một chỉ số. */
export type Direction = "higher" | "lower";

/** Kiểu so sánh của một chỉ số. */
export type MetricKind =
  /** CODE tự parse ra số từ specs → tự tính rank/%. Chính xác 100%. */
  | "measurable"
  /** AI chấm điểm 0-100 → CODE tính rank/% từ điểm đó. */
  | "ai-scored"
  /** Chỉ hiển thị text, không xếp hạng (cổng kết nối, bàn phím, bảo hành...). */
  | "info";

/** Một máy đã được chuẩn hoá để đưa vào bảng so sánh. */
export type ProductForCompare = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  /** Giá thấp nhất trong các variant active. 0 = chưa có giá → hiển thị "Liên hệ". */
  price: number;
  brandName: string | null;
  /** Slug need-tag (gaming, van-phong, do-hoa, mong-nhe). */
  tags: string[];
  /** Specs đã merge từ các variant active. */
  specs: Record<string, string>;
  /** Trọng lượng từ cột product_variants.weight — nguồn dự phòng cho specs.weight. */
  variantWeightKg: number | null;
  inStock: boolean;
};

/** Một ô trong bảng so sánh (1 máy × 1 chỉ số). */
export type Cell = {
  productId: string;
  /** Chuỗi gốc từ specs để hiển thị ("16GB DDR4"). null = không có dữ liệu. */
  raw: string | null;
  /** Số đã parse, hoặc điểm AI 0-100. null = không so sánh được. */
  value: number | null;
  /** Chuỗi đã format để hiển thị ("16 GB", "1920×1080"). */
  display: string;
  /** Competition rank 1..n (kiểu 1,1,3,4). null nếu thiếu dữ liệu. */
  rank: number | null;
  /** % kém so với máy dẫn đầu. ≤ 0 (= 0 nếu chính nó là TOP 1). */
  vsBestPct: number | null;
  /** Chỉ TOP 1: hơn máy hạng nhì bao nhiêu %. ≥ 0. */
  leadPct: number | null;
  /**
   * Số lần chênh so với TOP 1, dùng khi |vsBestPct| quá lớn.
   * "-182%" khó hiểu, "đắt gấp 2.8 lần" thì đọc là hiểu ngay.
   */
  vsBestTimes: number | null;
  /** Độ dài thanh bar, 0..100 (thuần thị giác). */
  barPct: number | null;
};

/** Một hàng trong bảng so sánh (1 chỉ số × tất cả máy). */
export type Row = {
  metricId: string;
  /** false khi < 2 máy có dữ liệu → không xếp hạng, chỉ hiện giá trị. */
  ranked: boolean;
  /** Mọi máy có dữ liệu đều bằng nhau → hiện chip "Ngang nhau" thay vì TOP 1. */
  allEqual: boolean;
  /** Có thể nhiều id nếu đồng hạng nhất. Rỗng khi allEqual. */
  bestProductIds: string[];
  cells: Cell[];
};

/** Điểm tổng của một máy theo một profile nhu cầu. */
export type OverallScore = {
  productId: string;
  /** Điểm 0-100. */
  score: number;
  rank: number;
  /** Số chỉ số thực sự có dữ liệu để tính điểm. */
  metricsUsed: number;
  /**
   * true khi điểm dựa trên quá ít chỉ số (< 4) → UI phải ghi chú "thiếu thông số".
   * Không có cờ này thì một máy chỉ có RAM + ổ cứng vẫn hiện điểm cao chót vót
   * như thể đã được đánh giá đầy đủ.
   */
  lowConfidence: boolean;
};

/** Kết quả so sánh hoàn chỉnh. */
export type CompareResult = {
  products: ProductForCompare[];
  /** Các hàng đã gom nhóm theo group của registry. */
  groups: { group: string; rows: Row[] }[];
  /** Hàng info-only sinh từ các key specs lạ không có trong registry. */
  extraRows: Row[];
  /** Điểm tổng theo profile "default". */
  overall: OverallScore[];
  /** Chỉ số đáng tiền: điểm tổng / giá (triệu đồng). null nếu chưa có giá. */
  valueScores: { productId: string; value: number | null; rank: number | null }[];
  /** Máy tốt nhất cho từng nhu cầu — CODE tính từ WEIGHT_PROFILES, không phải AI. */
  bestByNeed: { needSlug: string; needLabel: string; productId: string; score: number }[];
  /** true khi đã có điểm AI đưa vào (các hàng ai-scored mới xếp hạng được). */
  hasAiScores: boolean;
};

/** Điểm AI cho một máy — khớp với output của src/lib/ai/compare-analyzer.ts. */
export type AiMachineScores = {
  productId: string;
  cpuScore: number;
  gpuScore: number;
  displayScore: number;
};

/** Nhận xét chi tiết AI viết cho một máy. */
export type AiMachineDetail = {
  index: number;
  cpu_score: number;
  cpu_note: string;
  gpu_score: number;
  gpu_note: string;
  display_score: number;
  display_note: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
};

/**
 * Payload của POST /api/ai/compare.
 *
 * Khai báo ở đây (thay vì suy ra từ zod schema trong lib/ai) để component client
 * import được kiểu mà KHÔNG kéo gemini-client + prompt vào bundle trình duyệt.
 */
export type CompareAiPayload = {
  scores: AiMachineScores[];
  machines: AiMachineDetail[];
  verdict: string;
  needNotes: { need_slug: string; note: string }[];
};

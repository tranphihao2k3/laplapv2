// ─────────────────────────────────────────────────────────────────────────────
// Trả góp (installment financing) — kiểu dữ liệu, tính toán và cấu hình mặc định.
//
// Lưu trong bảng `settings` với key "financing.providers" (group "checkout"),
// chỉnh ở /quanly/settings và đọc qua /api/public/financing.
//
// Mô hình tính: LÃI PHẲNG (flat-rate) — cách các công ty tài chính VN
// (FE Credit, Home Credit, HD Saison…) và trả góp thẻ tín dụng thường dùng:
//   • Lãi mỗi kỳ tính trên GỐC VAY BAN ĐẦU (không giảm dần).
//   • Có thể kèm phí chuyển đổi tính 1 lần trên số tiền trả góp.
// Con số ra chỉ mang tính THAM KHẢO — số thực tế do bên tài chính quyết định.
// ─────────────────────────────────────────────────────────────────────────────

export type FinancingTerm = {
  /** Số tháng trả góp, ví dụ 6, 9, 12. */
  months: number;
  /** Lãi suất phẳng theo THÁNG tính trên gốc vay ban đầu (%). 0 = trả góp 0%. */
  monthlyRate: number;
};

export type FinancingProvider = {
  id: string;
  /** Tên bên trả góp, ví dụ "Home Credit", "Thẻ tín dụng". */
  name: string;
  /** Ghi chú ngắn hiển thị dưới tên (không bắt buộc). */
  note?: string;
  /** Trả trước tối thiểu theo % giá máy (0–100). Mặc định 0. */
  minDownPercent?: number;
  /** Phí chuyển đổi tính 1 lần trên số tiền trả góp (%). Mặc định 0. */
  conversionFeePercent?: number;
  /** Các kỳ hạn bên này hỗ trợ. */
  terms: FinancingTerm[];
};

export type FinancingSetting = {
  /** Bật/tắt hiển thị trả góp trên trang sản phẩm. */
  enabled: boolean;
  /** Chỉ hiện với sản phẩm có giá từ mức này trở lên (VND). Mặc định 3.000.000. */
  minPrice?: number;
  providers: FinancingProvider[];
};

// ── Kết quả một phương án trả góp ────────────────────────────────────────────

export type InstallmentPlan = {
  months: number;
  monthlyRate: number;
  /** Số tiền phải trả mỗi tháng (đã làm tròn). */
  monthlyPayment: number;
  /** Số tiền trả trước. */
  downPayment: number;
  /** Số tiền còn lại đem trả góp = giá - trả trước. */
  financedAmount: number;
  /** Tổng lãi trong toàn kỳ. */
  totalInterest: number;
  /** Phí chuyển đổi (nếu có). */
  conversionFee: number;
  /** Tổng phải trả = trả trước + gốc vay + lãi + phí. */
  totalPayable: number;
};

/**
 * Tính một phương án trả góp theo mô hình lãi phẳng.
 *
 * @param price       Giá sản phẩm (VND).
 * @param downPayment Số tiền trả trước (VND). Sẽ được kẹp trong [0, price].
 * @param term        Kỳ hạn (số tháng + lãi suất tháng).
 * @param conversionFeePercent Phí chuyển đổi 1 lần trên số tiền trả góp (%).
 */
export function calcInstallment(
  price: number,
  downPayment: number,
  term: FinancingTerm,
  conversionFeePercent = 0,
): InstallmentPlan {
  const safePrice = Math.max(0, price);
  const down = Math.min(Math.max(0, downPayment), safePrice);
  const financed = safePrice - down;
  const months = Math.max(1, Math.round(term.months));
  const rate = Math.max(0, term.monthlyRate) / 100;

  // Lãi phẳng: mỗi tháng lãi = gốc vay × lãi suất tháng.
  const totalInterest = financed * rate * months;
  const conversionFee = financed * (Math.max(0, conversionFeePercent) / 100);

  // Tính tổng chính xác trước rồi mới làm tròn, để "tổng phải trả" không bị
  // lệch vài đồng do nhân số tiền/tháng đã làm tròn với số kỳ.
  const totalFinanced = Math.round(financed + totalInterest + conversionFee);
  const monthlyPayment = Math.round(totalFinanced / months);

  return {
    months,
    monthlyRate: term.monthlyRate,
    monthlyPayment,
    downPayment: down,
    financedAmount: financed,
    totalInterest: Math.round(totalInterest),
    conversionFee: Math.round(conversionFee),
    totalPayable: down + totalFinanced,
  };
}

// ── Cấu hình mặc định (khi admin chưa lưu gì) ────────────────────────────────

export const DEFAULT_FINANCING: FinancingSetting = {
  enabled: true,
  minPrice: 3_000_000,
  providers: [
    {
      id: "credit-card",
      name: "Thẻ tín dụng",
      note: "Trả góp 0% qua thẻ tín dụng của các ngân hàng liên kết",
      minDownPercent: 0,
      conversionFeePercent: 0,
      terms: [
        { months: 3, monthlyRate: 0 },
        { months: 6, monthlyRate: 0 },
        { months: 12, monthlyRate: 0 },
      ],
    },
    {
      id: "home-credit",
      name: "Home Credit",
      note: "Duyệt nhanh qua CMND/CCCD, không cần thẻ tín dụng",
      minDownPercent: 10,
      conversionFeePercent: 0,
      terms: [
        { months: 6, monthlyRate: 1.5 },
        { months: 9, monthlyRate: 1.6 },
        { months: 12, monthlyRate: 1.7 },
      ],
    },
    {
      id: "fe-credit",
      name: "FE Credit",
      note: "Hỗ trợ trả góp lãi suất ưu đãi cho khách hàng mới",
      minDownPercent: 20,
      conversionFeePercent: 0,
      terms: [
        { months: 6, monthlyRate: 1.49 },
        { months: 12, monthlyRate: 1.66 },
        { months: 18, monthlyRate: 1.75 },
      ],
    },
    {
      id: "mirae-asset",
      name: "Mirae Asset",
      note: "Lãi suất ưu đãi, hỗ trợ trả góp dài hạn lên đến 24 tháng",
      minDownPercent: 15,
      conversionFeePercent: 0,
      terms: [
        { months: 6, monthlyRate: 1.39 },
        { months: 9, monthlyRate: 1.49 },
        { months: 12, monthlyRate: 1.59 },
        { months: 18, monthlyRate: 1.69 },
        { months: 24, monthlyRate: 1.79 },
      ],
    },
  ],
};

/** Chuẩn hoá dữ liệu đọc từ settings về FinancingSetting an toàn để render. */
export function normalizeFinancing(raw: unknown): FinancingSetting {
  if (!raw || typeof raw !== "object") return DEFAULT_FINANCING;
  const obj = raw as Partial<FinancingSetting>;
  if (!Array.isArray(obj.providers)) return DEFAULT_FINANCING;

  const providers: FinancingProvider[] = obj.providers
    .filter((p): p is FinancingProvider => !!p && typeof p.name === "string")
    .map((p, i) => ({
      id: p.id || `provider-${i}`,
      name: p.name,
      note: p.note,
      minDownPercent: clampPercent(p.minDownPercent),
      conversionFeePercent: clampPercent(p.conversionFeePercent),
      terms: (Array.isArray(p.terms) ? p.terms : [])
        .filter((t): t is FinancingTerm => !!t && Number.isFinite(t.months))
        .map((t) => ({
          months: Math.max(1, Math.round(t.months)),
          monthlyRate: Math.max(0, Number(t.monthlyRate) || 0),
        }))
        .sort((a, b) => a.months - b.months),
    }))
    .filter((p) => p.terms.length > 0);

  if (providers.length === 0) return DEFAULT_FINANCING;

  return {
    enabled: obj.enabled !== false,
    minPrice: Number.isFinite(obj.minPrice) ? Number(obj.minPrice) : DEFAULT_FINANCING.minPrice,
    providers,
  };
}

function clampPercent(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

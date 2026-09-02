"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Info,
  Loader2,
  PiggyBank,
  TrendingUp,
  Wallet,
  AlertCircle,
  Banknote,
  Calendar,
  Scale,
  ArrowLeft,
} from "lucide-react";
import {
  calcInstallment,
  DEFAULT_FINANCING,
  normalizeFinancing,
  type FinancingSetting,
  type FinancingProvider,
  type InstallmentPlan,
} from "@/lib/financing";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Reference Data
// ─────────────────────────────────────────────────────────────────────────────

const REFERENCE_RATE = 3;

/** Extended provider colors for visual differentiation */
const PROVIDER_COLORS: Record<string, string> = {
  "credit-card": "bg-emerald-50 border-emerald-200 text-emerald-800",
  "home-credit": "bg-blue-50 border-blue-200 text-blue-800",
  "fe-credit": "bg-purple-50 border-purple-200 text-purple-800",
  "mirae-asset": "bg-amber-50 border-amber-200 text-amber-800",
};

const PROVIDER_ACCENT: Record<string, string> = {
  "credit-card": "bg-emerald-600",
  "home-credit": "bg-blue-600",
  "fe-credit": "bg-purple-600",
  "mirae-asset": "bg-amber-600",
};

const PROVIDER_ICONS: Record<string, string> = {
  "credit-card": "💳",
  "home-credit": "🏠",
  "fe-credit": "💰",
  "mirae-asset": "🏦",
};

/** Document requirements per provider type */
const PROVIDER_DOCS: Record<string, { required: string[]; optional: string[] }> = {
  "credit-card": {
    required: ["CMND/CCCD còn hạn", "Thẻ tín dụng của ngân hàng liên kết"],
    optional: ["Sao kê lương 1 tháng gần nhất", "Hóa đơn điện/nước"],
  },
  "home-credit": {
    required: ["CMND/CCCD còn hạn", "Sổ hộ khẩu hoặc KT3"],
    optional: ["Bằng lái xe", "Hóa đơn sinh hoạt 1 tháng"],
  },
  "fe-credit": {
    required: ["CMND/CCCD còn hạn", "Giấy tờ xác minh thu nhập"],
    optional: ["Sao kê ngân hàng 3 tháng", "Hợp đồng lao động"],
  },
  "mirae-asset": {
    required: ["CMND/CCCD còn hạn", "Sổ hộ khẩu hoặc KT3"],
    optional: ["Sao kê lương 1 tháng gần nhất", "Hợp đồng lao động"],
  },
};

/** Eligibility requirements per provider type */
const PROVIDER_ELIGIBILITY: Record<string, { income: string; credit: string; age: string }> = {
  "credit-card": {
    income: "Thu nhập tối thiểu 5 triệu/tháng (tùy ngân hàng)",
    credit: "Không nợ xấu, có lịch sử tín dụng tốt",
    age: "22 - 60 tuổi",
  },
  "home-credit": {
    income: "Thu nhập từ 3 triệu/tháng trở lên",
    credit: "Không yêu cầu lịch sử tín dụng",
    age: "21 - 60 tuổi",
  },
  "fe-credit": {
    income: "Thu nhập từ 4 triệu/tháng trở lên",
    credit: "Xem xét hồ sơ tín dụng cá nhân",
    age: "20 - 60 tuổi",
  },
  "mirae-asset": {
    income: "Thu nhập từ 5 triệu/tháng trở lên",
    credit: "Xem xét hồ sơ tín dụng, hỗ trợ cả khách hàng mới",
    age: "20 - 58 tuổi",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function useFinancing() {
  return useQuery<FinancingSetting>({
    queryKey: ["public-financing"],
    queryFn: async () => {
      const res = await fetch("/api/public/financing");
      if (!res.ok) throw new Error("Không tải được cấu hình trả góp");
      return normalizeFinancing(await res.json());
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/** Calculate with 3% reference rate for comparison */
function calcWithReferenceRate(
  price: number,
  downPayment: number,
  months: number,
): { monthlyPayment: number; totalInterest: number; totalPayable: number } {
  const financed = price - downPayment;
  const totalInterest = financed * (REFERENCE_RATE / 100) * months;
  const totalFinanced = financed + totalInterest;
  const monthlyPayment = Math.round(totalFinanced / months);
  return {
    monthlyPayment,
    totalInterest: Math.round(totalInterest),
    totalPayable: downPayment + Math.round(totalFinanced),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", highlight && "text-white")}>
      <span className={cn(highlight ? "text-white/50" : "text-slate-500")}>{label}</span>
      <span className={cn(highlight ? "text-white/90" : "text-slate-900", "tabular-nums font-medium")}>
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Calculator; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-4 w-4 text-slate-600" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
    </div>
  );
}

function ComparisonCard({
  provider,
  price,
  downPayment,
  term,
  isSelected,
  onSelect,
}: {
  provider: FinancingProvider;
  price: number;
  downPayment: number;
  term: { months: number; monthlyRate: number };
  isSelected: boolean;
  onSelect: () => void;
}) {
  const plan = calcInstallment(price, downPayment, term, provider.conversionFeePercent ?? 0);
  const isZeroPercent = term.monthlyRate === 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative w-full rounded-xl border-2 p-4 text-left transition-all",
        isSelected
          ? "border-slate-900 bg-slate-900 text-white shadow-lg"
          : "border-slate-200 bg-white hover:border-slate-400 hover:shadow-md",
      )}
    >
      {isZeroPercent && (
        <span className="absolute -top-2.5 left-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
          0% LÃI
        </span>
      )}
      <div className="mt-1 flex items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold">{provider.name}</p>
          <p className={cn("mt-0.5 text-xs", isSelected ? "text-white/60" : "text-slate-500")}>
            {term.months} tháng · {term.monthlyRate === 0 ? "0% lãi" : `${term.monthlyRate}%/tháng`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(plan.monthlyPayment)}</p>
          <p className={cn("text-xs", isSelected ? "text-white/50" : "text-slate-400")}>/tháng</p>
        </div>
      </div>
      {plan.totalInterest > 0 && (
        <p className={cn("mt-2 text-xs", isSelected ? "text-white/60" : "text-slate-500")}>
          Tổng lãi: <span className="font-medium">{formatCurrency(plan.totalInterest)}</span>
        </p>
      )}
    </button>
  );
}

function ComparisonTable({
  providers,
  price,
  downPayment,
  selectedProviderIdx,
  selectedTermIdx,
  onSelect,
}: {
  providers: FinancingProvider[];
  price: number;
  downPayment: number;
  selectedProviderIdx: number;
  selectedTermIdx: number;
  onSelect: (providerIdx: number, termIdx: number) => void;
}) {
  const allTerms = useMemo(() => {
    const terms = new Set<number>();
    providers.forEach((p) => p.terms.forEach((t) => terms.add(t.months)));
    return Array.from(terms).sort((a, b) => a - b);
  }, [providers]);

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full min-w-[500px] text-sm sm:min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="sticky left-0 bg-slate-50 py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              Nhà cung cấp
            </th>
            {allTerms.map((months) => (
              <th key={months} className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                {months} tháng
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {providers.map((provider, pIdx) => (
            <tr key={provider.id} className="border-b border-slate-100">
              <td className="sticky left-0 bg-white py-3 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">{PROVIDER_ICONS[provider.id] || "💳"}</span>
                  <div>
                    <p className="font-medium text-slate-900">{provider.name}</p>
                    <p className="text-xs text-slate-500">{provider.minDownPercent}% trả trước</p>
                  </div>
                </div>
              </td>
              {allTerms.map((months) => {
                const term = provider.terms.find((t) => t.months === months);
                if (!term) {
                  return (
                    <td key={months} className="px-2 py-3 text-center text-slate-300">
                      —
                    </td>
                  );
                }
                const plan = calcInstallment(price, downPayment, term, provider.conversionFeePercent ?? 0);
                const isSelected = pIdx === selectedProviderIdx && selectedTermIdx === provider.terms.indexOf(term);
                return (
                  <td key={months} className="px-2 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => onSelect(pIdx, provider.terms.indexOf(term))}
                      className={cn(
                        "rounded-lg px-2 py-2 text-center transition-all min-w-[80px]",
                        isSelected
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                      )}
                    >
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(plan.monthlyPayment)}</p>
                      <p className={cn("text-[10px]", isSelected ? "text-white/60" : "text-slate-400")}>
                        {term.monthlyRate === 0 ? "0% lãi" : `${term.monthlyRate}%`}
                      </p>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EligibilityList({ items }: { items: { label: string; value: string }[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div>
            <span className="text-xs font-medium text-slate-500">{item.label}: </span>
            <span className="text-xs text-slate-700">{item.value}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RequirementsList({ required, optional }: { required: string[]; optional: string[] }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Bắt buộc</p>
        <ul className="space-y-1.5">
          {required.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-slate-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                {idx + 1}
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      {optional.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Bổ sung (nếu có)</p>
          <ul className="space-y-1.5">
            {optional.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-slate-500">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-400">
                  +
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const faqs = [
    {
      q: "Lãi suất 0% là gì và có thật sự miễn phí không?",
      a: "Trả góp 0% là chương trình của ngân hàng hoặc đơn vị tài chính hỗ trợ trả góp mà không tính lãi. Tuy nhiên, một số trường hợp có thể có phí chuyển đổi trả góp từ 1-5% tùy ngân hàng. Số liệu trên chưa bao gồm phí này.",
    },
    {
      q: "Mirae Asset có gì khác biệt so với Home Credit, FE Credit?",
      a: "Mirae Asset là công ty tài chính hàng đầu Việt Nam, cung cấp kỳ hạn trả góp dài hơn lên đến 24 tháng với lãi suất cạnh tranh. Đặc biệt phù hợp với khách hàng muốn giảm áp lực trả nợ hàng tháng. Quy trình duyệt nhanh, hồ sơ đơn giản.",
    },
    {
      q: "Tôi cần bao lâu để được duyệt hồ sơ trả góp?",
      a: "Thời gian duyệt hồ sơ phụ thuộc vào nhà cung cấp: Thẻ tín dụng thường duyệt trong 1-3 ngày làm việc. Home Credit, FE Credit và Mirae Asset có thể duyệt trong 15-30 phút nếu hồ sơ đầy đủ.",
    },
    {
      q: "Kỳ hạn 24 tháng có lợi không?",
      a: "Kỳ hạn 24 tháng giúp giảm số tiền trả hàng tháng, giảm áp lực tài chính. Tuy nhiên, tổng lãi phải trả sẽ cao hơn kỳ hạn ngắn. Nên chọn kỳ hạn ngắn nhất có thể để tiết kiệm chi phí lãi.",
    },
    {
      q: "Tôi có thể thanh toán trước hạn không?",
      a: "Có, bạn có thể thanh toán trước hạn. Tuy nhiên, một số nhà cung cấp có thể tính phí phạt thanh toán trước hạn từ 2-5% số tiền còn lại. Hãy hỏi kỹ nhân viên trước khi ký hợp đồng.",
    },
    {
      q: "Điểm tín dụng ảnh hưởng thế nào đến việc duyệt trả góp?",
      a: "Điểm tín dụng tốt giúp bạn được duyệt nhanh hơn và có thể nhận được lãi suất ưu đãi hơn. Nếu có nợ xấu hoặc lịch sử tín dụng không tốt, một số nhà cung cấp như Home Credit có thể vẫn hỗ trợ nhưng với lãi suất cao hơn.",
    },
    {
      q: "Tôi có thể trả góp bao nhiêu sản phẩm cùng lúc?",
      a: "Tùy thuộc vào thu nhập và khả năng chi trả của bạn. Thông thường, tổng số tiền trả góp hàng tháng không nên vượt quá 40-50% thu nhập hàng tháng để đảm bảo cuộc sống sinh hoạt.",
    },
  ];

  return (
    <div className="space-y-2">
      {faqs.map((faq, idx) => (
        <div key={idx} className="rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <span className="pr-4 text-sm font-medium text-slate-900">{faq.q}</span>
            {openIdx === idx ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            )}
          </button>
          {openIdx === idx && (
            <div className="border-t border-slate-100 px-4 pb-4 pt-3">
              <p className="text-sm leading-relaxed text-slate-600">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InterestComparison({
  price,
  downPayment,
  months,
}: {
  price: number;
  downPayment: number;
  months: number;
}) {
  const reference = calcWithReferenceRate(price, downPayment, months);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        So sánh lãi suất tham khảo
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white p-3 text-center">
          <p className="text-xs text-slate-500">0% Lãi suất</p>
          <p className="mt-1 text-lg font-semibold text-emerald-600 tabular-nums">
            {formatCurrency(Math.round(price / months))}
          </p>
          <p className="text-[11px] text-slate-400">/tháng</p>
        </div>
        <div className="rounded-lg bg-white p-3 text-center">
          <p className="text-xs text-slate-500">~{REFERENCE_RATE}% Lãi suất</p>
          <p className="mt-1 text-lg font-semibold text-slate-600 tabular-nums">
            {formatCurrency(reference.monthlyPayment)}
          </p>
          <p className="text-[11px] text-slate-400">/tháng</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 p-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-medium text-amber-800">Chênh lệch lãi ước tính:</span>
        </div>
        <span className="text-sm font-semibold text-amber-800 tabular-nums">
          {formatCurrency(reference.totalInterest)}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        * Lãi suất thực tế dao động 3%–3.5%/tháng tùy hồ sơ và nhà cung cấp
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Amortization Schedule Component
// ─────────────────────────────────────────────────────────────────────────────

function AmortizationSchedule({
  plan,
  price,
}: {
  plan: InstallmentPlan;
  price: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const financed = price - plan.downPayment;
  const monthlyInterestRate = plan.monthlyRate / 100;
  const interestPerMonth = plan.monthlyRate === 0 ? 0 : financed * monthlyInterestRate;

  const schedule = useMemo(() => {
    const rows = [];
    const principalPayment = financed / plan.months;

    for (let month = 1; month <= plan.months; month++) {
      const remainingPrincipal = financed - (principalPayment * month);
      const interestPortion = plan.monthlyRate === 0 ? 0 : interestPerMonth;
      const principalPortion = principalPayment;
      const totalPayment = principalPortion + interestPortion;

      rows.push({
        month,
        principal: Math.round(principalPortion),
        interest: Math.round(interestPortion),
        total: Math.round(totalPayment),
        remaining: Math.max(0, Math.round(remainingPrincipal)),
      });
    }
    return rows;
  }, [plan, financed, interestPerMonth]);

  const displayedSchedule = showAll ? schedule : schedule.slice(0, 6);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-white/80" />
            <h4 className="text-sm font-semibold text-white">Lịch sử trả góp</h4>
          </div>
          <span className="text-xs text-white/60">
            {plan.months} tháng · {formatCurrency(plan.monthlyPayment)}/tháng
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-500">Kỳ</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-500">Gốc</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-500">Lãi</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-500">Tổng</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-500">Còn lại</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedSchedule.map((row) => (
              <tr key={row.month} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-700">Tháng {row.month}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                  {formatCurrency(row.principal)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-600">
                  {row.interest > 0 ? formatCurrency(row.interest) : "-"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                  {formatCurrency(row.total)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                  {formatCurrency(row.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plan.months > 6 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="w-full border-t border-slate-100 py-2.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          {showAll ? "Thu gọn" : `Xem tất cả ${plan.months} tháng`}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cash vs Installment Comparison Component
// ─────────────────────────────────────────────────────────────────────────────

function CashVsInstallmentComparison({
  price,
  downPayment,
  plan,
  referencePlan,
}: {
  price: number;
  downPayment: number;
  plan: InstallmentPlan;
  referencePlan: { monthlyPayment: number; totalInterest: number; totalPayable: number } | null;
}) {
  const cashSavings = plan.totalPayable - price;
  const cashSavingsPercent = ((cashSavings / price) * 100).toFixed(1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-white" />
          <h4 className="text-sm font-semibold text-white">So sánh Trả tiền mặt vs Trả góp</h4>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-emerald-900">Trả tiền mặt</p>
              <p className="text-xs text-emerald-600">Thanh toán toàn bộ</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{formatCurrency(price)}</p>
            <p className="text-xs text-emerald-500">Tiết kiệm nhất</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-600 text-white">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Trả góp {plan.months} tháng</p>
              <p className="text-xs text-slate-500">
                {plan.monthlyRate === 0 ? "0% lãi suất" : `${plan.monthlyRate}%/tháng`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-700 tabular-nums">{formatCurrency(plan.totalPayable)}</p>
            <p className="text-xs text-slate-400">
              {plan.totalInterest > 0 ? `+${formatCurrency(plan.totalInterest)} lãi` : "Không lãi"}
            </p>
          </div>
        </div>

        {plan.totalInterest > 0 && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Chi phí trả góp cao hơn tiền mặt
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Bạn sẽ trả thêm <span className="font-semibold">{formatCurrency(cashSavings)}</span>
                ({cashSavingsPercent}%) so với thanh toán toàn bộ ngay.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Content Component (reusable)
// ─────────────────────────────────────────────────────────────────────────────

export function InstallmentCalculatorContent({ price }: { price: number }) {
  const { data, isLoading } = useFinancing();
  const config = data ?? DEFAULT_FINANCING;

  const providers = config.providers;
  const minPrice = config.minPrice ?? 0;

  const [providerIdx, setProviderIdx] = useState(0);
  const [termIdx, setTermIdx] = useState(0);
  const [downRaw, setDownRaw] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"calculator" | "schedule" | "compare" | "faq">("calculator");

  const provider = providers[Math.min(providerIdx, providers.length - 1)];
  const term = provider?.terms[Math.min(termIdx, provider.terms.length - 1)];

  const minDown = useMemo(
    () => Math.round((price * (provider?.minDownPercent ?? 0)) / 100),
    [price, provider?.minDownPercent],
  );

  const downPayment = downRaw === null ? minDown : Math.min(parseAmount(downRaw), price);
  const belowMin = downPayment < minDown;

  const plan = useMemo(
    () =>
      term
        ? calcInstallment(price, downPayment, term, provider?.conversionFeePercent ?? 0)
        : null,
    [price, downPayment, term, provider?.conversionFeePercent],
  );

  const teaser = useMemo(() => {
    const p = providers[0];
    const longest = p?.terms[p.terms.length - 1];
    if (!longest) return null;
    return calcInstallment(
      price,
      Math.round((price * (p.minDownPercent ?? 0)) / 100),
      longest,
      p.conversionFeePercent ?? 0,
    );
  }, [providers, price]);

  const referencePlan = useMemo(() => {
    if (!term) return null;
    return calcWithReferenceRate(price, downPayment, term.months);
  }, [price, downPayment, term]);

  if (!config.enabled || price < minPrice || providers.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
        <Calculator className="mx-auto h-12 w-12 text-slate-300" />
        <p className="mt-4 text-slate-500">Tính năng trả góp hiện không khả dụng.</p>
      </div>
    );
  }

  function selectProvider(idx: number) {
    setProviderIdx(idx);
    setTermIdx(0);
    setDownRaw(null);
  }

  function selectPlan(pIdx: number, tIdx: number) {
    setProviderIdx(pIdx);
    setTermIdx(tIdx);
  }

  const providerDocs = provider ? PROVIDER_DOCS[provider.id] : null;
  const providerEligibility = provider ? PROVIDER_ELIGIBILITY[provider.id] : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="container py-4">
          <div className="flex items-center gap-4">
          <button
              type="button"
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Quay lại</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Tính trả góp</h1>
                <p className="text-sm text-slate-500">
                  Giá sản phẩm {formatCurrency(price)} · Lãi suất tham khảo ~{REFERENCE_RATE}%/tháng
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <div className="container">
          <div className="flex gap-1">
            {[
              { id: "calculator", label: "Tính toán", icon: Calculator },
              { id: "schedule", label: "Lịch trình", icon: Calendar },
              { id: "compare", label: "So sánh", icon: TrendingUp },
              { id: "faq", label: "Hỏi đáp", icon: FileText },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải phương án trả góp…
          </div>
        ) : (
          <>
            {/* Calculator Tab */}
            {activeTab === "calculator" && (
              <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Provider Selection */}
                  <div className="space-y-3">
                    <SectionHeader icon={PiggyBank} title="Chọn nhà cung cấp" />
                    <div className="grid gap-2.5">
                      {providers.map((p, idx) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectProvider(idx)}
                          className={cn(
                            "relative rounded-xl border-2 px-4 py-4 text-left transition-all overflow-hidden",
                            idx === providerIdx
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white hover:border-slate-400 hover:shadow-md",
                          )}
                        >
                          <div
                            className={cn(
                              "absolute left-0 top-0 bottom-0 w-1",
                              PROVIDER_ACCENT[p.id] || "bg-slate-600"
                            )}
                          />
                          <div className="flex items-start justify-between gap-2 pl-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{PROVIDER_ICONS[p.id] || "💳"}</span>
                                <p className="text-[15px] font-semibold">{p.name}</p>
                              </div>
                              {p.note && (
                                <p
                                  className={cn(
                                    "mt-1 text-[12px] leading-relaxed pl-6",
                                    idx === providerIdx ? "text-white/60" : "text-slate-500",
                                  )}
                                >
                                  {p.note}
                                </p>
                              )}
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[11px] font-semibold shrink-0 ml-2",
                                idx === providerIdx
                                  ? "bg-white/20 text-white"
                                  : "bg-slate-100 text-slate-600",
                              )}
                            >
                              {p.minDownPercent}% trả trước
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Down Payment */}
                  <div className="space-y-3">
                    <SectionHeader icon={Wallet} title="Số tiền trả trước" />
                    <div className="relative">
                      <Wallet className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={downPayment > 0 ? downPayment.toLocaleString("vi-VN") : ""}
                        onChange={(e) => setDownRaw(e.target.value)}
                        placeholder="0"
                        aria-label="Số tiền trả trước"
                        className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-lg font-semibold tabular-nums text-slate-900 transition-colors placeholder:font-normal placeholder:text-slate-300 focus-visible:border-slate-900 focus-visible:outline-none"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-slate-400">
                        đ
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={price}
                      step={500_000}
                      value={downPayment}
                      onChange={(e) => setDownRaw(e.target.value)}
                      aria-label="Kéo chọn số tiền trả trước"
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-900"
                    />

                    <div className="flex flex-wrap gap-2">
                      {[0, 20, 30, 50].map((pct) => {
                        const value = Math.round((price * pct) / 100);
                        const active = downPayment === value;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setDownRaw(String(value))}
                            className={cn(
                              "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                              active
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400",
                            )}
                          >
                            {pct === 0 ? "Không trả trước" : `${pct}% · ${formatCurrency(value)}`}
                          </button>
                        );
                      })}
                    </div>

                    {(provider?.minDownPercent ?? 0) > 0 && (
                      <p className="text-xs text-slate-500">
                        Yêu cầu tối thiểu: {provider?.minDownPercent}% · {formatCurrency(minDown)}
                      </p>
                    )}

                    {belowMin && (
                      <p className="flex items-center gap-2 text-[13px] font-medium text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        {provider?.name} yêu cầu trả trước tối thiểu {formatCurrency(minDown)}.
                      </p>
                    )}
                  </div>

                  {/* Term Selection */}
                  {provider && (
                    <div className="space-y-3">
                      <SectionHeader icon={CreditCard} title="Chọn kỳ hạn" />
                      <div className={cn(
                        "grid gap-2.5",
                        provider.terms.length <= 3 ? "grid-cols-3" :
                          provider.terms.length === 4 ? "grid-cols-2 sm:grid-cols-4" :
                            "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                      )}>
                        {provider.terms.map((t, idx) => {
                          const p = calcInstallment(
                            price,
                            downPayment,
                            t,
                            provider.conversionFeePercent ?? 0,
                          );
                          const active = idx === termIdx;
                          const isZeroPercent = t.monthlyRate === 0;
                          return (
                            <button
                              key={t.months}
                              type="button"
                              onClick={() => setTermIdx(idx)}
                              className={cn(
                                "relative rounded-xl border-2 px-2 py-3 text-center transition-all",
                                active
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white hover:border-slate-400",
                              )}
                            >
                              {isZeroPercent && (
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap">
                                  0% LÃI
                                </span>
                              )}
                              <p className="text-[14px] font-semibold">{t.months} tháng</p>
                              <p
                                className={cn(
                                  "mt-1 text-base font-semibold tabular-nums",
                                  active ? "text-white" : "text-slate-900",
                                )}
                              >
                                {formatCurrency(p.monthlyPayment)}
                              </p>
                              <p
                                className={cn(
                                  "mt-0.5 text-[10px]",
                                  active ? "text-white/60" : "text-slate-400",
                                )}
                              >
                                {t.monthlyRate === 0 ? "0% lãi" : `${t.monthlyRate}%/tháng`}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Interest Comparison */}
                  {term && <InterestComparison price={price} downPayment={downPayment} months={term.months} />}

                  {/* Eligibility */}
                  {providerEligibility && (
                    <div className="space-y-3">
                      <SectionHeader icon={Check} title="Yêu cầu hồ sơ" />
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="mb-4 grid grid-cols-3 gap-3">
                          <div className="rounded-lg bg-slate-50 p-3 text-center">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">Thu nhập</p>
                            <p className="mt-1 text-xs font-medium text-slate-700">
                              {providerEligibility.income.split("từ ")[1]?.split(" trở")[0] || providerEligibility.income}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3 text-center">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">Độ tuổi</p>
                            <p className="mt-1 text-xs font-medium text-slate-700">{providerEligibility.age}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3 text-center">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">Tín dụng</p>
                            <p className="mt-1 text-xs font-medium text-slate-700">
                              {providerEligibility.credit.includes("Không") ? "Không yêu cầu" : "Xem xét"}
                            </p>
                          </div>
                        </div>
                        <EligibilityList
                          items={[
                            { label: "Thu nhập", value: providerEligibility.income },
                            { label: "Tín dụng", value: providerEligibility.credit },
                            { label: "Độ tuổi", value: providerEligibility.age },
                          ]}
                        />
                      </div>
                    </div>
                  )}

                  {/* Document Requirements */}
                  {providerDocs && (
                    <div className="space-y-3">
                      <SectionHeader icon={FileText} title="Giấy tờ cần chuẩn bị" />
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <RequirementsList required={providerDocs.required} optional={providerDocs.optional} />
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-3">
                    <SectionHeader icon={Info} title="Lưu ý quan trọng" />
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <ul className="space-y-2 text-sm text-amber-800">
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          Số liệu trên chỉ mang tính tham khảo, lãi suất thực tế có thể dao động 3%-3.5%/tháng tùy
                          hồ sơ của bạn.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          Phí chuyển đổi trả góp (nếu có) sẽ được thông báo trước khi ký hợp đồng.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          Thời gian duyệt hồ sơ: 15 phút - 3 ngày làm việc tùy nhà cung cấp.
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          Bạn có thể thanh toán trước hạn, vui lòng hỏi phí phạt trước khi ký.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Right Column - Results */}
                <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                  {/* Main Result */}
                  {plan && (
                    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-xl">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                            Trả mỗi tháng
                          </p>
                          <p className="mt-1 text-[32px] font-bold leading-none tracking-tight tabular-nums sm:text-4xl">
                            {formatCurrency(plan.monthlyPayment)}
                          </p>
                        </div>
                        {plan.monthlyRate === 0 && (
                          <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white">
                            0% LÃI
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-white/50">
                        {plan.months} tháng · {provider?.name}
                        {plan.monthlyRate > 0 && ` · Lãi ${plan.monthlyRate}%/tháng`}
                      </p>

                      <div className="mt-5 space-y-2.5 border-t border-white/10 pt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Giá sản phẩm</span>
                          <span className="font-medium text-white tabular-nums">{formatCurrency(price)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Trả trước</span>
                          <span className="font-medium text-white tabular-nums">{formatCurrency(plan.downPayment)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Số tiền vay</span>
                          <span className="font-medium text-white tabular-nums">{formatCurrency(plan.financedAmount)}</span>
                        </div>
                        {plan.totalInterest > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-amber-400">Tổng lãi phải trả</span>
                            <span className="font-semibold text-amber-400 tabular-nums">{formatCurrency(plan.totalInterest)}</span>
                          </div>
                        )}
                        {plan.conversionFee > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Phí chuyển đổi</span>
                            <span className="font-medium text-white tabular-nums">{formatCurrency(plan.conversionFee)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t border-white/20 pt-3 text-base font-bold text-white">
                          <span>Tổng phải trả</span>
                          <span className="tabular-nums text-lg">{formatCurrency(plan.totalPayable)}</span>
                        </div>
                      </div>

                      {/* Quick Cash Comparison */}
                      {plan.totalInterest > 0 && (
                        <div className="mt-4 rounded-lg bg-white/10 p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/60">Thanh toán tiền mặt</span>
                            <span className="font-semibold text-emerald-400 tabular-nums">
                              {formatCurrency(price)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-xs">
                            <span className="text-amber-300">Chênh lệch khi trả góp</span>
                            <span className="font-semibold text-amber-300 tabular-nums">
                              +{formatCurrency(plan.totalInterest)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reference Rate Notice */}
                  {referencePlan && plan && plan.totalInterest > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Tham khảo lãi suất thị trường
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-slate-600">Lãi suất ~{REFERENCE_RATE}%/tháng</span>
                        <span className="text-sm font-semibold text-slate-900">
                          ~{formatCurrency(referencePlan.monthlyPayment)}/tháng
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm text-slate-600">Tổng lãi ước tính</span>
                        <span className="text-sm font-semibold text-amber-600">
                          {formatCurrency(referencePlan.totalInterest)}
                        </span>
                      </div>
                      <p className="mt-3 text-[11px] text-slate-400">
                        * Lãi suất thực tế phụ thuộc vào điểm tín dụng và nhà cung cấp
                      </p>
                    </div>
                  )}

                  {/* Provider Info */}
                  {provider && (
                    <div
                      className={cn(
                        "rounded-xl border-2 p-4",
                        PROVIDER_COLORS[provider.id] || "bg-slate-50 border-slate-200",
                      )}
                    >
                      <p className="font-semibold text-slate-900">{provider.name}</p>
                      {provider.note && <p className="mt-1 text-sm text-slate-600">{provider.note}</p>}
                      <div className="mt-3 flex items-center gap-3 text-xs">
                        <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-700">
                          {provider.minDownPercent}% trả trước
                        </span>
                        {provider.conversionFeePercent !== 0 && (
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-700">
                            Phí {provider.conversionFeePercent}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <p className="text-[13px] leading-relaxed text-slate-500">
                      Số liệu trên <span className="font-semibold text-slate-700">chỉ mang tính tham khảo</span>.
                      Lãi suất và phí thực tế do bên tài chính quyết định sau khi duyệt hồ sơ. Vui lòng liên hệ
                      cửa hàng để được tư vấn chính xác.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Tab */}
            {activeTab === "schedule" && plan && (
              <div className="space-y-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Lịch trình & So sánh</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Xem chi tiết số tiền trả góp mỗi tháng và so sánh với thanh toán tiền mặt
                  </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                    <p className="text-xs text-slate-500">Giá sản phẩm</p>
                    <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{formatCurrency(price)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                    <p className="text-xs text-slate-500">Trả trước</p>
                    <p className="mt-1 text-lg font-bold text-slate-700 tabular-nums">{formatCurrency(plan.downPayment)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                    <p className="text-xs text-slate-500">Số tiền vay</p>
                    <p className="mt-1 text-lg font-bold text-blue-600 tabular-nums">{formatCurrency(plan.financedAmount)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                    <p className="text-xs text-slate-500">Tổng lãi</p>
                    <p className={`mt-1 text-lg font-bold tabular-nums ${plan.totalInterest > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {plan.totalInterest > 0 ? formatCurrency(plan.totalInterest) : '0đ'}
                    </p>
                  </div>
                </div>

                <CashVsInstallmentComparison
                  price={price}
                  downPayment={downPayment}
                  plan={plan}
                  referencePlan={referencePlan}
                />

                <AmortizationSchedule plan={plan} price={price} />

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div className="text-sm text-slate-600 space-y-1">
                      <p><strong>Lãi suất tham khảo:</strong> ~{REFERENCE_RATE}%/tháng (thực tế 3-3.5% tùy hồ sơ)</p>
                      <p><strong>Lịch thanh toán:</strong> Hàng tháng, ngày cố định theo hợp đồng</p>
                      <p><strong>Phí phạt:</strong> Có thể áp dụng nếu thanh toán trước hạn (2-5%)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Compare Tab */}
            {activeTab === "compare" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">So sánh các phương án trả góp</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Xem nhanh số tiền trả góp với {formatCurrency(downPayment)} trả trước
                  </p>
                </div>

                <ComparisonTable
                  providers={providers}
                  price={price}
                  downPayment={downPayment}
                  selectedProviderIdx={providerIdx}
                  selectedTermIdx={termIdx}
                  onSelect={selectPlan}
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {providers.map((p, pIdx) =>
                    p.terms.map((t, tIdx) => (
                      <ComparisonCard
                        key={`${p.id}-${t.months}`}
                        provider={p}
                        price={price}
                        downPayment={downPayment}
                        term={t}
                        isSelected={pIdx === providerIdx && tIdx === termIdx}
                        onSelect={() => selectPlan(pIdx, tIdx)}
                      />
                    ))
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    So sánh 0% lãi vs Lãi suất thị trường
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {[6, 9, 12, 18, 24].map((months) => {
                      const zeroPercent = calcInstallment(price, downPayment, { months, monthlyRate: 0 }, 0);
                      const withInterest = calcWithReferenceRate(price, downPayment, months);
                      const diff = withInterest.totalInterest;

                      return (
                        <div key={months} className="rounded-lg bg-white p-3">
                          <p className="text-xs text-slate-500">{months} tháng</p>
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-emerald-600">0% lãi</span>
                              <span className="font-medium text-emerald-700">
                                {formatCurrency(zeroPercent.monthlyPayment)}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">~{REFERENCE_RATE}% lãi</span>
                              <span className="font-medium text-slate-700">
                                {formatCurrency(withInterest.monthlyPayment)}
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-slate-100 pt-1 text-xs">
                              <span className="text-amber-600">Chênh lệch lãi</span>
                              <span className="font-semibold text-amber-700">{formatCurrency(diff)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* FAQ Tab */}
            {activeTab === "faq" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Câu hỏi thường gặp</h3>
                  <p className="mt-1 text-sm text-slate-500">Giải đáp thắc mắc về trả góp</p>
                </div>
                <FAQSection />

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">Bạn cần thêm hỗ trợ?</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Liên hệ cửa hàng để được tư vấn chi tiết về các phương án trả góp phù hợp với bạn.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Monitor,
  CircuitBoard,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { PublicProduct } from "./use-home-data";

// Bảng thông số hiển thị ở mặt sau — theo thứ tự ưu tiên
const SPEC_ROWS: { keys: string[]; label: string; Icon: LucideIcon }[] = [
  { keys: ["cpu"], label: "CPU", Icon: Cpu },
  { keys: ["ram"], label: "RAM", Icon: MemoryStick },
  { keys: ["ssd", "storage"], label: "Lưu trữ", Icon: HardDrive },
  { keys: ["gpu", "vga"], label: "Card", Icon: CircuitBoard },
  { keys: ["screen", "display", "man_hinh"], label: "Màn hình", Icon: Monitor },
];

function buildSpecRows(specs: Record<string, string>) {
  const out: { label: string; text: string; Icon: LucideIcon }[] = [];
  for (const row of SPEC_ROWS) {
    const key = row.keys.find((k) => specs[k]?.trim());
    if (!key) continue;
    const text = specs[key].replace(/\s*\(.*?\)\s*/g, "").trim();
    out.push({ label: row.label, text, Icon: row.Icon });
  }
  return out;
}

export function HomeProductCard({
  product,
  className,
}: {
  product: PublicProduct;
  className?: string;
}) {
  const rows = buildSpecRows(product.specs);

  return (
    <Link
      href={`/products/${product.slug}`}
      title={product.name}
      className={cn("flip-card group relative block h-[340px] w-full", className)}
    >
      <div className="flip-card-inner relative h-full w-full">
        {/* ===== MẶT TRƯỚC: ảnh · tên · giá ===== */}
        <div className="flip-card-face absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-300 group-hover:shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
          <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100/60">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-contain p-5 transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl font-bold text-slate-200">
                LapLap
              </div>
            )}

            {!product.inStock && (
              <span className="absolute left-3 top-3 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                Hết hàng
              </span>
            )}

            {/* Gợi ý lật khi hover */}
            <div className="absolute inset-x-0 bottom-0 flex justify-center pb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
                <ArrowUpRight className="h-3 w-3" />
                Xem cấu hình
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
            <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800 sm:text-sm">
              {product.name}
            </h3>
            <div className="mt-auto">
              <span className="text-sm font-bold text-slate-900 sm:text-base">
                {product.price > 0 ? formatCurrency(product.price) : "Liên hệ"}
              </span>
            </div>
          </div>
        </div>

        {/* ===== MẶT SAU: thông số (hiện khi hover) ===== */}
        <div className="flip-card-face flip-card-back absolute inset-0 overflow-hidden rounded-2xl">
          {/* Viền sáng chạy vòng */}
          <span className="flip-card-glow" aria-hidden />
          {/* Tấm nền che, chừa mép sáng */}
          <div className="absolute inset-[2px] flex flex-col rounded-[14px] bg-slate-900 p-4 text-white">
            <p className="line-clamp-2 text-xs font-bold leading-snug text-white">
              {product.name}
            </p>

            <div className="mt-3 flex-1 space-y-2.5 overflow-hidden">
              {rows.length > 0 ? (
                rows.map(({ label, text, Icon }, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                    <span className="w-14 shrink-0 text-slate-400">{label}</span>
                    <span className="line-clamp-2 flex-1 font-medium text-slate-100">
                      {text}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-400">
                  Liên hệ để biết thêm cấu hình chi tiết.
                </p>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-sm font-bold text-white">
                {product.price > 0 ? formatCurrency(product.price) : "Liên hệ"}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400">
                Chi tiết
                <ArrowUpRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

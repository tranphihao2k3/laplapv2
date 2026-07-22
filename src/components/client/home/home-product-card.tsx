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

// Bảng thông số hiển thị trong panel trượt lên — theo thứ tự ưu tiên
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
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        "transform-gpu transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:border-slate-300 hover:shadow-[0_16px_40px_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      {/* Ảnh + panel thông số trượt lên */}
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
          <span className="absolute left-3 top-3 z-20 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">
            Hết hàng
          </span>
        )}

        {/* Panel thông số: nằm dưới, trượt lên khi hover */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-10 translate-y-full bg-slate-900/95 p-3.5 text-white backdrop-blur-sm",
            "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0",
          )}
        >
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
            <ArrowUpRight className="h-3 w-3" />
            Cấu hình
          </p>
          {rows.length > 0 ? (
            <div className="space-y-1.5">
              {rows.map(({ label, text, Icon }, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                  <span className="w-12 shrink-0 text-slate-400">{label}</span>
                  <span className="line-clamp-1 flex-1 font-medium text-slate-100">{text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">Liên hệ để biết thêm cấu hình chi tiết.</p>
          )}
        </div>
      </div>

      {/* Nội dung: tên · giá */}
      <div className="relative z-0 flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <h3 className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800 group-hover:text-slate-900 sm:text-sm">
          {product.name}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-sm font-bold text-slate-900 sm:text-base">
            {product.price > 0 ? formatCurrency(product.price) : "Liên hệ"}
          </span>
          <span className="text-xs text-slate-400 transition-colors group-hover:text-slate-600">
            →
          </span>
        </div>
      </div>

      {/* Vạch nhấn bên trái khi hover */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 rounded-full bg-blue-600 transition-transform duration-300 group-hover:scale-y-100" />
    </Link>
  );
}

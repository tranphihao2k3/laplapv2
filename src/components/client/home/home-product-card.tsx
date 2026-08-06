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
import { CompareToggle } from "@/components/client/compare/compare-toggle";
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
  showCompare = true,
}: {
  product: PublicProduct;
  className?: string;
  /** Cho phép tắt nút "So sánh" ở những chỗ không cần (vd. slider trang chủ). */
  showCompare?: boolean;
}) {
  const rows = buildSpecRows(product.specs);

  return (
    /*
      Dùng "stretched link": vỏ ngoài là <div>, một <Link> phủ toàn bộ ở z-20.
      Trước đây cả card là một <Link> — khi đó nút "So sánh" (thẻ <button>) sẽ bị
      lồng trong <a>, vừa sai HTML vừa bị thẻ a nuốt click.
      Phân tầng: nội dung z-0 · panel specs z-10 · link phủ z-20 · nút so sánh z-30.
    */
    <div
      title={product.name}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white",
        "transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)]",
        className,
      )}
    >
      <Link
        href={`/products/${product.slug}`}
        aria-label={product.name}
        className="absolute inset-0 z-20 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />

      {showCompare && (
        <CompareToggle
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            image: product.image ?? null,
            price: product.price,
          }}
        />
      )}

      {/* Ảnh + panel thông số trượt lên */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-6 transition-transform duration-600 ease-out group-hover:scale-[1.05]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-semibold tracking-tight text-slate-200">
            LapLap
          </div>
        )}

        {/* Xuống dưới khi có nút So sánh để không đè nhau ở góc trên trái. */}
        {!product.inStock && (
          <span
            className={cn(
              "absolute left-3 z-20 rounded-full bg-slate-900/85 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white backdrop-blur-sm",
              showCompare ? "top-12" : "top-3",
            )}
          >
            Hết hàng
          </span>
        )}

        {/* Nút xem nhanh — thuần trang trí, để link phủ bên dưới nhận click */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm",
            "translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100",
          )}
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>

      {/* Panel thông số: phủ vùng ảnh, trượt lên khi hover */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex aspect-[4/3] flex-col bg-slate-950 p-4 text-white",
          "translate-y-[-101%] transition-transform duration-300 ease-smooth group-hover:translate-y-0",
        )}
      >
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Cấu hình
        </p>
        {rows.length > 0 ? (
          <div className="space-y-2.5">
            {rows.map(({ label, text, Icon }, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[11px]">
                <Icon className="mt-px h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span className="w-12 shrink-0 text-slate-500">{label}</span>
                <span className="line-clamp-1 flex-1 font-medium text-slate-100">{text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-slate-400">
            Liên hệ để biết thêm cấu hình chi tiết.
          </p>
        )}

        <div className="mt-auto flex items-center gap-1.5 pt-3 text-[11px] font-medium text-slate-300">
          Xem chi tiết
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Nội dung: tên · giá */}
      <div className="relative z-0 flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-700 transition-colors group-hover:text-slate-900 sm:text-sm">
          {product.name}
        </h3>
        <div className="mt-auto flex items-end justify-between pt-1">
          <span className="text-[15px] font-semibold tracking-tight text-slate-900 sm:text-base">
            {product.price > 0 ? formatCurrency(product.price) : "Liên hệ"}
          </span>
        </div>
      </div>
    </div>
  );
}

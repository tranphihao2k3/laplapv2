import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  image?: string;
  badge?: string;
};

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  return (
    <Card
      className={cn(
        "group relative transform-gpu overflow-hidden rounded-2xl border-slate-200/80 shadow-none [will-change:transform]",
        "transition-transform duration-300 ease-smooth",
        "hover:-translate-y-1 hover:border-slate-300",
        className,
      )}
    >
      {/* Bóng đổ dùng lớp phủ opacity (mượt hơn animate box-shadow trực tiếp) */}
      <div className="pointer-events-none absolute inset-0 z-0 rounded-2xl opacity-0 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] transition-opacity duration-300 group-hover:opacity-100" />

      <Link href={`/products/${product.slug}`} className="relative z-10 block">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 to-white">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-contain p-3 transition-transform duration-700 ease-glide will-change-transform group-hover:scale-[1.08]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="text-4xl font-bold text-muted-foreground/30">LapLap</div>
          )}

          {product.badge && (
            <Badge
              className="absolute left-3 top-3 transition-transform duration-300 group-hover:-translate-y-0.5"
              variant={discount > 0 ? "destructive" : "default"}
            >
              {product.badge}
            </Badge>
          )}
          {discount > 0 && (
            <Badge
              variant="destructive"
              className="absolute right-3 top-3 transition-transform duration-300 group-hover:scale-110"
            >
              -{discount}%
            </Badge>
          )}

          {/* Lớp phủ tối nhẹ khi hover */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Pill "Xem nhanh" trồi lên khi hover */}
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-3 opacity-0 transition-all duration-300 translate-y-3 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
              <ArrowUpRight className="h-3 w-3" />
              Xem nhanh
            </span>
          </div>
        </div>
      </Link>

      <CardContent className="relative z-10 p-4">
        <Link href={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 text-[13px] font-medium text-slate-700 transition-colors group-hover:text-slate-900 sm:text-sm">
            {product.name}
          </h3>
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-semibold tracking-tight text-slate-900 sm:text-base">
            {formatCurrency(product.price)}
          </span>
          {product.originalPrice && (
            <span className="text-xs text-slate-400 line-through sm:text-sm">
              {formatCurrency(product.originalPrice)}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="relative z-10 p-4 pt-0">
        <Button className="w-full rounded-xl" size="sm">
          <ShoppingCart className="mr-1 h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
          <span className="truncate">Thêm vào giỏ</span>
        </Button>
      </CardFooter>
    </Card>
  );
}

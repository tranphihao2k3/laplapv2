import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ProductCard } from "./product-card";

type RelatedProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  thumbnail_url: string | null;
};

type Props = {
  products: RelatedProduct[];
};

export function RelatedProducts({ products }: Props) {
  if (!products.length) return null;

  return (
    <section className="relative">
      {/* Decorative background */}
      <div className="pointer-events-none absolute -top-12 left-1/2 h-32 w-[120%] -translate-x-1/2 bg-gradient-to-b from-primary/[0.04] to-transparent blur-2xl" />

      <div className="relative mb-6 flex items-end justify-between gap-4 sm:mb-8">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            Có thể bạn thích
          </div>
          <div className="flex items-center gap-2.5">
            <span className="h-px w-6 bg-foreground" />
            <h2 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
              Sản phẩm liên quan
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Những sản phẩm tương tự bạn có thể quan tâm
          </p>
        </div>
        <Link
          href="/products"
          className="group hidden shrink-0 items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground sm:inline-flex"
        >
          Xem tất cả
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {products.map((p, idx) => (
          <div
            key={p.id}
            className="animate-slide-in-bottom"
            style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "backwards" }}
          >
            <ProductCard
              product={{
                id: p.id,
                name: p.name,
                slug: p.slug,
                price: p.price,
                image: p.thumbnail_url ?? undefined,
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

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
    <section>
      <div className="mb-6 flex items-center gap-2.5 sm:mb-8">
        <span className="h-px w-6 bg-slate-900" />
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
          Sản phẩm liên quan
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={{
              id: p.id,
              name: p.name,
              slug: p.slug,
              price: p.price,
              image: p.thumbnail_url ?? undefined,
            }}
          />
        ))}
      </div>
    </section>
  );
}

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
      <h2 className="text-lg font-bold tracking-tight mb-4 sm:text-xl sm:mb-6">Sản phẩm liên quan</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
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

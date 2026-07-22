import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Breadcrumb } from "@/components/client/product/breadcrumb";
import { ProductGallery } from "@/components/client/product/product-gallery";
import { ProductInfo } from "@/components/client/product/product-info";
import { ProductSpecs } from "@/components/client/product/product-specs";
import { ProductDescription } from "@/components/client/product/product-description";
import { WarrantyPolicy } from "@/components/client/product/warranty-policy";
import { RelatedProducts } from "@/components/client/product/related-products";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProductWithVariants } from "@/components/client/product/types";

async function getProductBySlug(slug: string): Promise<ProductWithVariants | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, name, slug, short_description, description, thumbnail_url, images, status, tags, updated_at, brand_id, category_id",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!product) return null;

  let brand: { id: string; name: string } | null = null;
  if (product.brand_id) {
    const { data: b } = await supabase.from("brands").select("id, name").eq("id", product.brand_id).maybeSingle();
    if (b) brand = b;
  }
  let category: { id: string; name: string } | null = null;
  if (product.category_id) {
    const { data: c } = await supabase.from("categories").select("id, name").eq("id", product.category_id).maybeSingle();
    if (c) category = c;
  }

  const { data: rawVariants } = await supabase
    .from("product_variants")
    .select("id, sku, name, attributes, specs, selling_price, cost_price, weight, is_active")
    .eq("product_id", product.id)
    .order("selling_price", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variants: any[] = rawVariants ?? [];
  const activeVariants = variants.filter((v: { is_active?: boolean | null }) => v.is_active !== false);

  // Gallery: ưu tiên mảng images, fallback về thumbnail_url.
  const galleryUrls: string[] = Array.isArray(product.images) && product.images.length > 0
    ? (product.images as string[]).filter(Boolean)
    : product.thumbnail_url
      ? [product.thumbnail_url]
      : [];
  const images: { url: string; alt: string }[] = galleryUrls.map((url, idx) => ({
    url,
    alt: idx === 0 ? product.name : `${product.name} - Ảnh ${idx + 1}`,
  }));

  const price =
    activeVariants.length > 0
      ? Math.min(...activeVariants.map((v: { selling_price?: number | null }) => v.selling_price ?? Infinity))
      : null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    short_description: product.short_description,
    description: product.description,
    thumbnail_url: product.thumbnail_url,
    status: product.status,
    tags: product.tags,
    updated_at: product.updated_at,
    price: Number.isFinite(price) ? price : null,
    brand,
    category,
    variants: activeVariants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      attributes: v.attributes as Record<string, string> | null,
      specs: v.specs as Record<string, string> | null,
      selling_price: v.selling_price,
      cost_price: v.cost_price,
      weight: v.weight,
      is_active: v.is_active,
    })),
    images,
  };
}

async function getRelatedProducts(
  categoryId: string | null,
  excludeId: string,
): Promise<{ id: string; name: string; slug: string; price: number; thumbnail_url: string | null }[]> {
  if (!categoryId) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data } = await supabase
    .from("products")
    .select("id, name, slug, thumbnail_url")
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .eq("status", "active")
    .limit(8);

  if (!data) return [];

  const { data: rawAllVariants } = await supabase
    .from("product_variants")
    .select("product_id, selling_price")
    .in(
      "product_id",
      data.map((p: { id: string }) => p.id),
    )
    .is("is_active", true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allVariants: any[] = rawAllVariants ?? [];
  const priceMap = new Map<string, number>();
  for (const v of allVariants) {
    const current = priceMap.get(v.product_id) ?? Infinity;
    if ((v.selling_price ?? Infinity) < current) {
      priceMap.set(v.product_id, v.selling_price ?? 0);
    }
  }

  return data.map((p: { id: string; name: string; slug: string | null; thumbnail_url: string | null }) => ({
    id: p.id,
    name: p.name,
    slug: p.slug ?? "",
    price: priceMap.get(p.id) ?? 0,
    thumbnail_url: p.thumbnail_url,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return { title: "Không tìm thấy sản phẩm" };
  }

  const description =
    product.short_description?.trim() ||
    (product.description ? product.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) : "") ||
    `Mua ${product.name} chính hãng tại LapLap - Laptop Cần Thơ. Giá tốt, bảo hành uy tín.`;

  const ogImages = product.images.length > 0 ? product.images.map((i) => i.url) : undefined;
  const canonical = `/products/${product.slug}`;

  return {
    title: product.name,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${product.name} | LapLap`,
      description,
      url: canonical,
      type: "website",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: ogImages,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product.category?.id ?? null, product.id);

  const hasSpecs = (product.variants?.[0]?.specs &&
    Object.values(product.variants[0].specs as Record<string, string>).some((v) => v?.trim())) as boolean | undefined;
  const inStock = product.variants.length > 0;
  const firstSku = product.variants[0]?.sku ?? undefined;

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const productUrl = `${baseUrl}/products/${product.slug}`;

  // Structured data — Product + BreadcrumbList (chuẩn SEO Google Rich Results)
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images.map((i) => i.url),
    description:
      product.short_description?.trim() ||
      (product.description ? product.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) : product.name),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
    ...(firstSku ? { sku: firstSku } : {}),
    ...(product.category ? { category: product.category.name } : {}),
    ...(product.price != null
      ? {
          offers: {
            "@type": "Offer",
            url: productUrl,
            priceCurrency: "VND",
            price: product.price,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            seller: { "@type": "Organization", name: "LapLap" },
          },
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Sản phẩm", item: `${baseUrl}/products` },
      ...(product.category
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: product.category.name,
              item: `${baseUrl}/products?category=${product.category.id}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: product.category ? 4 : 3,
        name: product.name,
        item: productUrl,
      },
    ],
  };

  return (
    <div className="container py-6 pb-24 lg:py-8 lg:pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Trang chủ", href: "/" },
          { label: "Sản phẩm", href: "/products" },
          ...(product.category
            ? [{ label: product.category.name, href: `/products?category=${product.category.id}` }]
            : []),
          { label: product.name },
        ]}
      />

      {/* Main section */}
      <div className="mt-4 grid gap-6 sm:mt-6 sm:gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <ProductGallery images={product.images} productName={product.name} />
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductInfo product={product} />
        </div>
      </div>

      {/* Detail tabs */}
      <div className="mt-8 sm:mt-12">
        <Tabs defaultValue="description" className="w-full">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
            <TabsTrigger value="description" className="px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
              Mô tả chi tiết
            </TabsTrigger>
            {hasSpecs && (
              <TabsTrigger value="specs" className="px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
                Thông số kỹ thuật
              </TabsTrigger>
            )}
            <TabsTrigger value="policy" className="px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
              Bảo hành &amp; Chính sách
            </TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="mt-4 sm:mt-6">
            <ProductDescription
              description={product.description}
              shortDescription={product.short_description}
              productName={product.name}
              specs={product.variants?.[0]?.specs as Record<string, string> | null}
            />
          </TabsContent>

          {hasSpecs && (
            <TabsContent value="specs" className="mt-4 sm:mt-6">
              <ProductSpecs product={product} />
            </TabsContent>
          )}

          <TabsContent value="policy" className="mt-4 sm:mt-6">
            <WarrantyPolicy />
          </TabsContent>
        </Tabs>
      </div>

      {/* Related products */}
      <div className="mt-10 sm:mt-14">
        <RelatedProducts products={related} />
      </div>
    </div>
  );
}

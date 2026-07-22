export type ProductVariant = {
  id: string;
  sku: string;
  name: string | null;
  attributes: Record<string, string> | null;
  specs: Record<string, string> | null;
  selling_price: number | null;
  cost_price: number | null;
  weight: number | null;
  is_active: boolean | null;
};

export type ProductWithVariants = {
  id: string;
  name: string;
  slug: string | null;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  status: string | null;
  tags: string[] | null;
  updated_at: string | null;
  price: number | null;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  variants: ProductVariant[];
  images: { url: string; alt: string }[];
};

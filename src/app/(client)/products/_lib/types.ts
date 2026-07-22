export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  price: number;
  createdAt: string | null;
  brandId: string | null;
  categoryId: string | null;
  tags: string[];
  specs: Record<string, string>;
  inStock?: boolean;
};

export type ProductListResponse = {
  items: PublicProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type FilterOption = { value: string; label: string; count: number };

export type ProductFilters = {
  brands: FilterOption[];
  categories: FilterOption[];
  needTags: FilterOption[];
  priceBuckets: FilterOption[];
  ram: FilterOption[];
  cpu: FilterOption[];
  storage: FilterOption[];
  priceRange: { min: number; max: number };
};

export type SortValue = "newest" | "price_asc" | "price_desc" | "name_asc";

export const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "price_asc", label: "Giá: Thấp đến cao" },
  { value: "price_desc", label: "Giá: Cao đến thấp" },
  { value: "name_asc", label: "Tên: A → Z" },
];

export type ProductQuery = {
  q: string;
  brand: string;
  category: string;
  tag: string;
  priceBucket: string;
  minPrice: number;
  maxPrice: number;
  ram: string;
  cpu: string;
  storage: string;
  sort: SortValue;
  page: number;
};

export const DEFAULT_QUERY: ProductQuery = {
  q: "",
  brand: "",
  category: "",
  tag: "",
  priceBucket: "",
  minPrice: 0,
  maxPrice: 0,
  ram: "",
  cpu: "",
  storage: "",
  sort: "newest",
  page: 1,
};

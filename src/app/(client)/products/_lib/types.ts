import type { ProductKind } from "@/lib/product-kind";

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
  /** Số tồn kho của variant đầu tiên — dùng để giới hạn add-to-cart. */
  stockQty?: number;
  /** ID của biến thể đầu tiên còn hàng — dùng để add-to-cart trực tiếp từ card. */
  variantId?: string;
  /** Phân loại: laptop | pc_component. Mặc định "laptop". */
  kind: ProductKind;
  /** Rating trung bình 0–5, optional — undefined khi DB chưa có column. */
  rating?: number;
  /** Số lượng đánh giá. */
  reviewCount?: number;
  /** Số lượng đã bán. */
  soldCount?: number;
  /** Badge "Mới về". */
  isNew?: boolean;
  /** Badge "Hot". */
  isHot?: boolean;
};

export type ProductListResponse = {
  items: PublicProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  kind?: ProductKind;
};

export type FilterOption = {
  value: string;
  label: string;
  count: number;
  /** Slug — chỉ categories, dùng để dựng URL đẹp thay vì UUID. */
  slug?: string | null;
  /** Phân loại để client filter / group. */
  kind?: ProductKind;
  parentId?: string | null;
  parentSlug?: string | null;
};

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
  /** Mặc định "laptop". Đổi sang "pc_component" qua URL ?kind=pc_component. */
  kind: ProductKind;
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
  limit?: number;
};

export const DEFAULT_QUERY: ProductQuery = {
  kind: "laptop",
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
  limit: 24,
};

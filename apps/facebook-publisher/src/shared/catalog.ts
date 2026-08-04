/**
 * Shared contract cho catalog sync — main ↔ renderer.
 */
export type SyncStatus =
  | "ok"
  | "empty"
  | "token_expired"
  | "network"
  | "http_error";

export type SyncResult = {
  pages: number;
  upserted: number;
  lastSyncAt: string;
  status: SyncStatus;
  total?: number;
};

export type CatalogQuery = {
  q?: string;
  page: number;
  pageSize: number;
};

export type ProductSummary = {
  productId: string;
  name: string;
  slug: string | null;
  shortDescription: string | null;
  thumbnailUrl: string | null;
  status: string;
  productUrl: string | null;
  updatedAt: string | null;
  syncedAt: string;
  variantsCount: number;
  inStock: boolean;
  /** Local absolute paths (MED-001) — dùng cho <img src="file://...">. */
  localImagePaths: string[];
  /** URLs gốc từ API /products/:id. */
  imageUrls: string[];
  /** Specs gọn của variant đầu tiên (nếu có) — chỉ string string string
   *  hiển thị trên card. CatalogGet mới trả đầy đủ. */
  previewSpecs: Record<string, string>;
};

export type ProductVariantSummary = {
  variantId: string;
  productId: string;
  sku: string;
  name: string | null;
  attributes: unknown;
  specs: unknown;
  sellingPrice: number | null;
  isActive: boolean;
  availableQty: number;
  syncedAt: string;
};

/** Detail payload cho modal "Xem chi tiết" — CatalogGet trả về. */
export type ProductDetail = ProductSummary & {
  variants: ProductVariantSummary[];
};
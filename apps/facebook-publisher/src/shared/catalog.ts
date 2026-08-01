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
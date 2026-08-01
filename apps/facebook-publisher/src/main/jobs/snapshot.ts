/**
 * JobSnapshot — bản chụp bất biến cho mỗi job đăng (CMP-002).
 *
 * Lưu vào post_jobs.snapshot_json (cột mở rộng ở schema v6) hoặc tách
 * bảng nếu cần. Ở đây, schema v5 chưa có snapshot_json — ta thêm cột
 * qua ALTER TABLE trong migration v6 (idempotent).
 *
 * Mục tiêu: sửa template/product sau khi enqueue KHÔNG ảnh hưởng job cũ.
 */
import type { ProductSummary, ProductVariantSummary } from "../../shared/catalog";

export type JobSnapshot = {
  /** ISO timestamp chụp. */
  capturedAt: string;
  product: {
    productId: string;
    name: string;
    slug: string | null;
    shortDescription: string | null;
    thumbnailUrl: string | null;
    updatedAt: string | null;
  };
  variant: {
    variantId: string;
    sku: string;
    name: string | null;
    sellingPrice: number | null;
    availableQty: number;
    isActive: boolean;
  };
  template: {
    templateId: string;
    name: string;
    body: string;
  };
  group: {
    groupId: string;
    name: string;
    url: string;
  };
  images: {
    urls: string[]; // input URLs lúc enqueue
    paths: string[]; // local file paths (sau MED-001 download)
    sha256s: string[]; // sorted
  };
  renderedText: string; // final text sau TPL-001 render.
};

/** Helper: build snapshot từ UI submit payload. */
export function buildSnapshot(input: {
  product: ProductSummary;
  variant: ProductVariantSummary;
  template: { id: string; name: string; body: string };
  group: { id: string; name: string; url: string };
  images: Array<{ url: string; filePath: string; sha256: string }>;
  renderedText: string;
}): JobSnapshot {
  const sha256s = input.images.map((i) => i.sha256).sort();
  return {
    capturedAt: new Date().toISOString(),
    product: {
      productId: input.product.productId,
      name: input.product.name,
      slug: input.product.slug,
      shortDescription: input.product.shortDescription,
      thumbnailUrl: input.product.thumbnailUrl,
      updatedAt: input.product.updatedAt,
    },
    variant: {
      variantId: input.variant.variantId,
      sku: input.variant.sku,
      name: input.variant.name,
      sellingPrice: input.variant.sellingPrice,
      availableQty: input.variant.availableQty,
      isActive: input.variant.isActive,
    },
    template: {
      templateId: input.template.id,
      name: input.template.name,
      body: input.template.body,
    },
    group: {
      groupId: input.group.id,
      name: input.group.name,
      url: input.group.url,
    },
    images: {
      urls: input.images.map((i) => i.url),
      paths: input.images.map((i) => i.filePath),
      sha256s,
    },
    renderedText: input.renderedText,
  };
}
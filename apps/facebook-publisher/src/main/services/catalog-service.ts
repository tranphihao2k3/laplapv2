/**
 * CatalogService — CAT-001.
 *
 * Nhiệm vụ:
 *  - Gọi /api/v1/desktop-posting/products (Bearer access token) lấy
 *    trang sản phẩm active.
 *  - Bulk upsert vào product_cache (transaction cho mỗi page).
 *  - Ghi `lastSyncAt` vào settings.
 *  - Phân biệt trạng thái: online, offline (network error), token_expired
 *    (401), empty (0 product).
 *  - Auto tải ảnh gallery về local (qua ImageService) cho mỗi product
 *    để PW-004 composer có file path đính kèm khi đăng bài.
 *
 * Important (docs §11 CAT-001):
 *  - Cache KHONG duoc coi la ton kho hien tai khi enqueue/post.
 *    Stock se refetch o QUE-004 preflight.
 */
import { AppError } from "../../shared/errors";
import { apiFetch, HttpError } from "../api/http-client";
import { ProductRepository } from "../db/repositories/products";
import { SettingsRepository } from "../db/repositories/settings";
import { ImageService } from "./image-service";

export type SyncResult = {
  /** So page da goi. */
  pages: number;
  /** Tong product upsert (co the trung neu product da co). */
  upserted: number;
  /** Thoi diem sync xong (ISO). */
  lastSyncAt: string;
  /** Trang thai phan loai (UI se hien thi). */
  status: "ok" | "empty" | "token_expired" | "network" | "http_error";
  /** Neu empty → tong product active. */
  total?: number;
};

export type CatalogQuery = {
  q?: string;
  page: number;
  pageSize: number;
};

type ListResponseItem = {
  id: string;
  name: string;
  slug: string | null;
  shortDescription: string | null;
  thumbnailUrl: string | null;
  status: "active" | "draft" | "archived";
  updatedAt: string | null;
  variantsCount: number;
  inStock: boolean;
};

type ListResponse = {
  items: ListResponseItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ProductDetailResponse = {
  product: {
    id: string;
    name: string;
    slug: string | null;
    shortDescription: string | null;
    plainTextDescription: string;
    thumbnailUrl: string | null;
    images: string[];
    productUrl: string;
    updatedAt: string | null;
  };
  /**
   * Variants đầy đủ kèm specs — khớp với `getPublishingProductDetail`
   * ở web (`src/server/services/desktop-posting-service.ts`). Specs là
   * Record<string, unknown> chứa CPU/RAM/SSD/GPU/Màn hình/Pin/Phím...
   * từ admin nhập tay. Desktop phải lưu vào variant_cache.specs_json để
   * template engine (CAT-005) render ra {{variant.specs.cpu}}.
   */
  variants: {
    id: string;
    sku: string;
    name: string | null;
    attributes: Record<string, unknown> | null;
    specs: Record<string, unknown> | null;
    sellingPrice: number | null;
    availableQty: number;
    isActive: boolean;
  }[];
};

/**
 * Repo API wrap success response trong `{ ok: true, data: ... }`
 * (xem `src/lib/api/response.ts` → `ok()`). Desktop client phải unwrap
 * `.data` trước khi dùng.
 */
type ApiSuccessEnvelope<T> = { ok: true; data: T };

export class CatalogService {
  constructor(
    private readonly products: ProductRepository,
    private readonly settings: SettingsRepository,
    private readonly images: ImageService,
    private readonly getApiBaseUrl: () => string,
    private readonly getAccessToken: () => string | null,
  ) {}

  /**
   * Sync 1 page. Caller (renderer) goi nhieu page neu can.
   * Tra SyncResult voi status typed.
   */
  async syncPage(orgId: string, query: CatalogQuery): Promise<SyncResult> {
    const token = this.getAccessToken();
    if (!token) {
      throw new AppError("UNAUTHORIZED", "Chưa login — không gọi được API", 401);
    }

    const baseUrl = this.getApiBaseUrl();
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    params.set("page", String(query.page));
    params.set("pageSize", String(query.pageSize));

    let envelope: ApiSuccessEnvelope<ListResponse>;
    try {
      envelope = await apiFetch<ApiSuccessEnvelope<ListResponse>>(
        baseUrl,
        `/api/v1/desktop-posting/products?${params.toString()}`,
        "GET",
        {
          headers: { Authorization: `Bearer ${token}` },
          timeoutMs: this.settings.get().httpTimeoutMs,
        },
      );
    } catch (err) {
      throw CatalogService.classifyError(err);
    }

    // Repo API wrap mọi success response trong `{ ok: true, data: ... }`
    // (src/lib/api/response.ts → `ok()`). Nếu thiếu wrapper (vd API legacy
    // hoặc proxy tuột), fallback dùng envelope làm payload để tránh crash.
    const result: ListResponse =
      envelope && typeof envelope === "object" && "data" in envelope
        ? (envelope.data ?? { items: [], total: 0, page: query.page, pageSize: query.pageSize, totalPages: 1 })
        : (envelope as unknown as ListResponse);

    if (!Array.isArray(result.items)) {
      throw new AppError(
        "CATALOG_INVALID_PAYLOAD",
        "API trả về payload không hợp lệ (thiếu items)",
        502,
      );
    }

    const lastSyncAt = new Date().toISOString();

    // Bulk upsert trong transaction — khi crash giữa page, không để lại
    // half-state.
    this.products.transaction(() => {
      for (const item of result.items) {
        this.products.upsertProduct(
          {
            product_id: item.id,
            org_id: orgId,
            name: item.name,
            slug: item.slug,
            short_description: item.shortDescription,
            thumbnail_url: item.thumbnailUrl,
            status: item.status,
            product_url: null, // list API không trả productUrl
            updated_at: item.updatedAt,
            raw_json: JSON.stringify(item),
          },
          lastSyncAt,
        );
      }
    });

    // Auto-download gallery ảnh + upsert variants (kèm specs) cho từng
    // product. Chạy NGOÀI transaction để không giữ DB lock lâu + cho phép
    // một số product fail mà vẫn tiếp tục các product khác.
    await this.refreshDetailForItems(result.items, lastSyncAt);

    return {
      pages: 1,
      upserted: result.items.length,
      lastSyncAt,
      status: result.items.length === 0 ? "empty" : "ok",
      total: result.total,
    };
  }

  /**
   * Cho mỗi item: refetch /products/:id → lấy gallery (tải về local) +
   * upsert variants (kèm specs_json) vào variant_cache.
   *
   * Refetch chạy concurrency=4 để không spike mạng.
   * Download/variant upsert thất bại → vẫn tiếp tục các product khác.
   */
  private async refreshDetailForItems(
    items: ListResponseItem[],
    syncedAt: string,
  ): Promise<void> {
    const baseUrl = this.getApiBaseUrl();
    const token = this.getAccessToken();
    if (!token) return;

    // Phase 1: refetch detail song song (cap 4) → images + variants.
    const detailResults = await mapWithConcurrency(items, 4, async (item) => {
      try {
        const envelope = await apiFetch<ApiSuccessEnvelope<ProductDetailResponse>>(
          baseUrl,
          `/api/v1/desktop-posting/products/${item.id}`,
          "GET",
          { headers: { Authorization: `Bearer ${token}` }, timeoutMs: this.settings.get().httpTimeoutMs },
        );
        const data = envelope && "data" in envelope
          ? envelope.data
          : (envelope as unknown as ProductDetailResponse);
        return {
          productId: item.id,
          imageUrls: Array.isArray(data?.product?.images) ? data.product.images : [],
          variants: Array.isArray(data?.variants) ? data.variants : [],
        };
      } catch {
        // Refetch fail → để local_paths rỗng, image_urls rỗng, không
        // upsert variant. User có thể gọi ensureLocalImages sau.
        return { productId: item.id, imageUrls: [] as string[], variants: [] as ProductDetailResponse["variants"] };
      }
    });

    // Phase 2: download images + upsert variants cho từng product.
    for (const { productId, imageUrls, variants } of detailResults) {
      // Lưu image URLs trước (kể cả khi download fail) để lazy retry.
      this.products.setImageUrls(productId, imageUrls);

      // Upsert variants (kèm specs_json) — transaction để consistency.
      if (variants.length > 0) {
        try {
          this.products.transaction(() => {
            for (const v of variants) {
              this.products.upsertVariant(
                {
                  variant_id: v.id,
                  product_id: productId,
                  sku: v.sku,
                  name: v.name,
                  attributes_json: v.attributes ? JSON.stringify(v.attributes) : null,
                  // QUAN TRỌNG: specs lưu JSON string để variant_cache có dữ liệu
                  // cho buildSpecMap() trong template engine. Trước đây bị bỏ
                  // qua → template render {{variant.specs.cpu}} = "".
                  specs_json: v.specs ? JSON.stringify(v.specs) : null,
                  selling_price: v.sellingPrice,
                  is_active: v.isActive ? 1 : 0,
                  available_qty: v.availableQty,
                },
                syncedAt,
              );
            }
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`[catalog] upsert variants thất bại cho product ${productId}:`, err);
        }
      }

      // Download images.
      if (imageUrls.length === 0) {
        this.products.setLocalImagePaths(productId, []);
        continue;
      }

      const results = await this.images.downloadMany({ urls: imageUrls, concurrency: 4 });
      const localPaths: string[] = [];
      let lastErr: string | null = null;
      for (let i = 0; i < imageUrls.length; i++) {
        const r = results[i];
        if (r && r.ok) {
          localPaths.push(r.downloaded.filePath);
        } else {
          localPaths.push("");
          if (r && !r.ok) lastErr = `${r.errorCode}: ${r.message}`;
        }
      }
      this.products.setLocalImagePaths(productId, localPaths);
      if (lastErr && localPaths.every((p) => p === "")) {
        // Tất cả URL fail → log warning qua console (main process).
        // Không throw — sync vẫn coi là ok.
        // eslint-disable-next-line no-console
        console.warn(`[catalog] download ảnh thất bại cho product ${productId}: ${lastErr}`);
      }
    }
  }

  /**
   * Lazy path: nếu product_cache chưa có local_image_paths (sync cũ, host
   * bị deny lúc sync, ...) thì tải lại từ image_urls_json. Trả local
   * paths hiện có (kể cả khi rỗng).
   *
   * Gọi từ CampaignService trước khi enqueue nếu imagePaths trong campaign
   * rỗng.
   */
  async ensureLocalImages(productId: string): Promise<string[]> {
    const info = this.products.getImageInfo(productId);
    // Có local paths rồi (kể cả rỗng nếu product gốc không có ảnh) → trả luôn.
    if (info.localPaths.length > 0) return info.localPaths;
    // Không có URLs để retry → trả rỗng.
    if (info.urls.length === 0) return [];
    // Tải lại.
    const results = await this.images.downloadMany({ urls: info.urls, concurrency: 4 });
    const localPaths: string[] = [];
    for (let i = 0; i < info.urls.length; i++) {
      const r = results[i];
      if (r && r.ok) localPaths.push(r.downloaded.filePath);
      else localPaths.push("");
    }
    this.products.setLocalImagePaths(productId, localPaths);
    return localPaths.filter((p) => p.length > 0);
  }

  /**
   * Sync toàn bộ (tất cả page) đến khi totalPages xong.
   * UI CAT-001 goi 1 lan luc "Đồng bộ ngay" → spinner + progress % ước
   * tính = page/totalPages.
   */
  async syncAll(orgId: string, query: { q?: string; pageSize?: number } = {}): Promise<SyncResult> {
    const pageSize = query.pageSize ?? 50;
    const firstPage = await this.syncPage(orgId, {
      q: query.q,
      page: 1,
      pageSize,
    });

    if (firstPage.total === undefined || firstPage.total === 0) {
      return firstPage;
    }

    const totalPages = Math.max(1, Math.ceil(firstPage.total / pageSize));
    let upsertedTotal = firstPage.upserted;
    let lastSyncAt = firstPage.lastSyncAt;

    for (let page = 2; page <= totalPages; page++) {
      const next = await this.syncPage(orgId, {
        q: query.q,
        page,
        pageSize,
      });
      upsertedTotal += next.upserted;
      lastSyncAt = next.lastSyncAt;
      // Neu mot page fail, tra error typed cho UI hien thi.
      if (next.status !== "ok" && next.status !== "empty") {
        return next;
      }
    }

    return {
      pages: totalPages,
      upserted: upsertedTotal,
      lastSyncAt,
      status: "ok",
      total: firstPage.total,
    };
  }

  /**
   * Map HttpError → AppError typed. Token expired → AUTH_REFRESH_FAILED
   * để UI goi refresh; network/timeout → AUTH_PROVIDER_UNAVAILABLE.
   */
  static classifyError(err: unknown): AppError {
    if (err instanceof AppError) return err;
    if (err instanceof HttpError) {
      if (err.status === 401 || err.status === 403) {
        return new AppError(
          "AUTH_REFRESH_FAILED",
          "Token hết hạn hoặc không đủ quyền — cần refresh hoặc login lại",
          401,
        );
      }
      if (err.status === 0) {
        return new AppError(
          "AUTH_PROVIDER_UNAVAILABLE",
          `Không liên lạc được LapLap API: ${err.message}`,
          503,
        );
      }
      return new AppError(
        "CATALOG_HTTP_ERROR",
        `Lỗi API: ${err.status} ${err.message}`,
        err.status || 500,
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return new AppError("CATALOG_INTERNAL", msg, 500);
  }
}

/**
 * Chạy `fn` cho từng item trong `items` với concurrency cap. Kết quả
 * trả về theo thứ tự input. Lỗi 1 item KHÔNG fail cả batch (catch trong
 * fn là trách nhiệm của caller).
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  cap: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, cap);
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}
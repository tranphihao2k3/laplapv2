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
 *
 * KHÔNG goi /products/:id ở đây — đó là MED-001 (image picker).
 *
 * Important (docs §11 CAT-001):
 *  - Cache KHONG duoc coi la ton kho hien tai khi enqueue/post.
 *    Stock se refetch o QUE-004 preflight.
 */
import { AppError } from "../../shared/errors";
import { apiFetch, HttpError } from "../api/http-client";
import { ProductRepository } from "../db/repositories/products";
import { SettingsRepository } from "../db/repositories/settings";

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

export class CatalogService {
  constructor(
    private readonly products: ProductRepository,
    private readonly settings: SettingsRepository,
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

    let result: ListResponse;
    try {
      result = await apiFetch<ListResponse>(
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

    return {
      pages: 1,
      upserted: result.items.length,
      lastSyncAt,
      status: result.items.length === 0 ? "empty" : "ok",
      total: result.total,
    };
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
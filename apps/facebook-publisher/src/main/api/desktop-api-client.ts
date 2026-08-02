/**
 * DesktopApiClient — wrapper fetch gọi LapLap API cho desktop.
 *
 * API-006: contract chuẩn.
 *  - Bearer token (qua callback để refresh in-memory).
 *  - Phân loại lỗi: TOKEN_EXPIRED (401), FORBIDDEN (403), NOT_FOUND (404),
 *    VALIDATION_ERROR (400), SERVER_ERROR (5xx), NETWORK_ERROR.
 *  - updatedSince qua query string để incremental sync.
 *  - Pagination: page + pageSize.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string; status?: number } };

export type ApiErrorCode =
  | "TOKEN_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "SERVER_ERROR"
  | "NETWORK_ERROR";

export type ProductSummary = {
  id: string;
  name: string;
  slug: string | null;
  shortDescription: string | null;
  thumbnailUrl: string | null;
  updatedAt: string;
  status: string;
  productUrl: string | null;
  syncedAt: string;
  variantsCount: number;
  inStock: boolean;
};

export type ProductDetail = {
  product: ProductSummary & {
    images: string[];
    plainTextDescription: string;
  };
  variants: Array<{
    productId: string;
    variantId: string;
    sku: string;
    name: string | null;
    attributes: unknown;
    specs: unknown;
    sellingPrice: number | null;
    isActive: boolean;
    availableQty: number;
  }>;
};

export type ListProductsQuery = {
  q: string;
  page: number;
  pageSize: number;
  updatedSince?: string;
};

export type ListProductsResponse = {
  items: ProductSummary[];
  total: number;
};

export type DesktopApiClientOptions = {
  baseUrl: string;
  accessToken: () => string | null;
  fetch?: typeof fetch;
};

export class DesktopApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: DesktopApiClientOptions) {
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async listProducts(q: ListProductsQuery): Promise<ApiResult<ListProductsResponse>> {
    const url = new URL("/api/v1/desktop-posting/products", this.opts.baseUrl);
    if (q.q) url.searchParams.set("q", q.q);
    url.searchParams.set("page", String(q.page));
    url.searchParams.set("pageSize", String(q.pageSize));
    if (q.updatedSince) url.searchParams.set("updatedSince", q.updatedSince);
    return this.request<ListProductsResponse>(url.toString(), { method: "GET" });
  }

  async getProduct(id: string): Promise<ApiResult<ProductDetail>> {
    const url = new URL(
      `/api/v1/desktop-posting/products/${encodeURIComponent(id)}`,
      this.opts.baseUrl,
    );
    return this.request<ProductDetail>(url.toString(), { method: "GET" });
  }

  private async request<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
    const token = this.opts.accessToken();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let res: Response;
    try {
      res = await this.fetchImpl(url, { ...init, headers });
    } catch (err) {
      return {
        ok: false,
        error: {
          code: "NETWORK_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
    if (res.status === 200 || res.status === 201) {
      try {
        const data = (await res.json()) as T;
        return { ok: true, data };
      } catch (err) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
          },
        };
      }
    }
    return {
      ok: false,
      error: {
        code: mapStatusToCode(res.status),
        message: `HTTP ${res.status}`,
        status: res.status,
      },
    };
  }
}

function mapStatusToCode(status: number): ApiErrorCode {
  if (status === 401) return "TOKEN_EXPIRED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status >= 400 && status < 500) return "VALIDATION_ERROR";
  return "SERVER_ERROR";
}

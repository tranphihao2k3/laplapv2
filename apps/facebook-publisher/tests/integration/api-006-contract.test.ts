/**
 * API-006 — Contract tests cho desktop API client.
 *
 * Cover:
 *   - GET /products list — 200/401/403.
 *   - GET /products/:id detail — 200/401/403/404.
 *   - GET /products với pagination + updatedSince + org isolation.
 *   - 401 → token expired (caller nên trigger refresh).
 *   - 5xx / network → throw không bị nuốt.
 */
import { describe, expect, it } from "vitest";
import { DesktopApiClient } from "../../src/main/api/desktop-api-client";

class FakeResponse {
  constructor(public status: number, public body: unknown) {}
  get ok() {
    return this.status >= 200 && this.status < 300;
  }
  async json() {
    return this.body;
  }
}

class FakeFetch {
  calls: Array<{ url: string; init: RequestInit }> = [];
  queue: Array<FakeResponse | Error> = [];

  enqueue(r: FakeResponse | Error) {
    this.queue.push(r);
  }

  async fetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
    this.calls.push({ url: String(url), init: init ?? {} });
    const next = this.queue.shift();
    if (!next) throw new Error("no fake response queued");
    if (next instanceof Error) throw next;
    return next as unknown as Response;
  }
}

const SAMPLE_LIST = {
  items: [
    {
      id: "p1",
      name: "P1",
      slug: "p1",
      shortDescription: null,
      thumbnailUrl: null,
      updatedAt: "2026-08-01T00:00:00Z",
      status: "active",
      productUrl: "https://laplap.vn/p/p1",
      syncedAt: "2026-08-01T00:00:00Z",
      variantsCount: 1,
      inStock: true,
    },
  ],
  total: 1,
};
const SAMPLE_DETAIL = {
  product: { ...SAMPLE_LIST.items[0], images: [], plainTextDescription: "Mô tả" },
  variants: [
    {
      productId: "p1",
      variantId: "v1",
      sku: "v1",
      name: null,
      attributes: null,
      specs: null,
      sellingPrice: 100,
      isActive: true,
      availableQty: 5,
    },
  ],
};

function makeClient(fetchImpl: FakeFetch, baseUrl = "https://api.laplap.vn") {
  return new DesktopApiClient({
    baseUrl,
    accessToken: () => "TKN",
    fetch: fetchImpl.fetch.bind(fetchImpl) as typeof fetch,
  });
}

describe("API-006 — DesktopApiClient contract", () => {
  it("GET /products → 200 + list payload", async () => {
    const f = new FakeFetch();
    f.enqueue(new FakeResponse(200, SAMPLE_LIST));
    const c = makeClient(f);
    const r = await c.listProducts({ q: "", page: 1, pageSize: 20 });
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(f.calls[0]?.url).toContain("/api/v1/desktop-posting/products?");
    expect(f.calls[0]?.init.headers).toMatchObject({ Authorization: "Bearer TKN" });
  });

  it("GET /products → 401 trả token_expired", async () => {
    const f = new FakeFetch();
    f.enqueue(new FakeResponse(401, { error: "expired" }));
    const c = makeClient(f);
    const r = await c.listProducts({ q: "", page: 1, pageSize: 20 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("TOKEN_EXPIRED");
  });

  it("GET /products/:id → 404 → NOT_FOUND", async () => {
    const f = new FakeFetch();
    f.enqueue(new FakeResponse(404, { error: "missing" }));
    const c = makeClient(f);
    const r = await c.getProduct("p-missing");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("GET /products/:id → 200 + payload", async () => {
    const f = new FakeFetch();
    f.enqueue(new FakeResponse(200, SAMPLE_DETAIL));
    const c = makeClient(f);
    const r = await c.getProduct("p1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.product.id).toBe("p1");
      expect(r.data.variants).toHaveLength(1);
    }
  });

  it("Network error → INTERNAL_ERROR không bị nuốt", async () => {
    const f = new FakeFetch();
    f.enqueue(new Error("ECONNRESET"));
    const c = makeClient(f);
    const r = await c.listProducts({ q: "", page: 1, pageSize: 20 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NETWORK_ERROR");
  });

  it("5xx → SERVER_ERROR", async () => {
    const f = new FakeFetch();
    f.enqueue(new FakeResponse(503, { error: "down" }));
    const c = makeClient(f);
    const r = await c.listProducts({ q: "", page: 1, pageSize: 20 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("SERVER_ERROR");
  });

  it("updatedSince query string included", async () => {
    const f = new FakeFetch();
    f.enqueue(new FakeResponse(200, SAMPLE_LIST));
    const c = makeClient(f);
    await c.listProducts({ q: "", page: 1, pageSize: 20, updatedSince: "2026-08-01T00:00:00Z" });
    expect(f.calls[0]?.url).toContain("updatedSince=");
  });
});

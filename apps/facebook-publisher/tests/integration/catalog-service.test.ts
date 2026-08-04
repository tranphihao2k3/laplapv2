/**
 * CAT-001 — CatalogService + ProductRepository tests.
 */
import Database from "better-sqlite3";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/main/db/migrations";
import { ProductRepository } from "../../src/main/db/repositories/products";
import { SettingsRepository } from "../../src/main/db/repositories/settings";
import { CatalogService } from "../../src/main/services/catalog-service";
import { ImageService } from "../../src/main/services/image-service";
import { HttpError } from "../../src/main/api/http-client";

let db: Database.Database;
let products: ProductRepository;
let settings: SettingsRepository;
let images: ImageService;
let tempDir: string;

beforeEach(async () => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  products = new ProductRepository(db);
  settings = new SettingsRepository(db);
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "laplap-catalog-"));
  images = new ImageService(settings, tempDir);
});

afterEach(async () => {
  db.close();
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
});

describe("ProductRepository — CRUD", () => {
  it("upsertProduct: insert + read back", () => {
    products.upsertProduct(
      {
        product_id: "p1",
        org_id: "org1",
        name: "Laptop A",
        slug: "laptop-a",
        short_description: "desc",
        thumbnail_url: "https://cdn/a.jpg",
        status: "active",
        product_url: null,
        updated_at: "2026-08-01T00:00:00Z",
        raw_json: null,
      },
      "2026-08-01T00:00:00Z",
    );
    expect(products.findById("p1")?.name).toBe("Laptop A");
  });

  it("upsertProduct: ON CONFLICT update không tạo row mới", () => {
    products.upsertProduct(
      { product_id: "p1", org_id: "org1", name: "A", slug: null, short_description: null, thumbnail_url: null, status: "active", product_url: null, updated_at: null, raw_json: null },
      "2026-08-01T00:00:00Z",
    );
    products.upsertProduct(
      { product_id: "p1", org_id: "org1", name: "A2", slug: null, short_description: null, thumbnail_url: null, status: "active", product_url: null, updated_at: null, raw_json: null },
      "2026-08-01T01:00:00Z",
    );
    expect(products.countActive("org1")).toBe(1);
    expect(products.findById("p1")?.name).toBe("A2");
  });

  it("searchByOrg escape pattern: % và _", () => {
    products.upsertProduct(
      { product_id: "p1", org_id: "org1", name: "100% cotton", slug: null, short_description: null, thumbnail_url: null, status: "active", product_url: null, updated_at: null, raw_json: null },
      "2026-08-01T00:00:00Z",
    );
    products.upsertProduct(
      { product_id: "p2", org_id: "org1", name: "laptop", slug: null, short_description: null, thumbnail_url: null, status: "active", product_url: null, updated_at: null, raw_json: null },
      "2026-08-01T00:00:00Z",
    );
    // Search 'laptop' không nên match '100% cotton'.
    expect(products.searchByOrg("org1", "laptop", 50, 0).map((r) => r.product_id)).toEqual(["p2"]);
    // Search '100%' khớp đúng p1 (escape %).
    expect(products.searchByOrg("org1", "100%", 50, 0).map((r) => r.product_id)).toEqual(["p1"]);
  });

  it("listVariants + cascade deleteProduct", () => {
    products.upsertProduct(
      { product_id: "p1", org_id: "org1", name: "X", slug: null, short_description: null, thumbnail_url: null, status: "active", product_url: null, updated_at: null, raw_json: null },
      "2026-08-01T00:00:00Z",
    );
    products.upsertVariant(
      { variant_id: "v1", product_id: "p1", sku: "SKU-1", name: null, attributes_json: null, specs_json: null, selling_price: 1000, is_active: 1, available_qty: 5 },
      "2026-08-01T00:00:00Z",
    );
    expect(products.listVariants("p1")).toHaveLength(1);
    products.deleteById("p1");
    expect(products.listVariants("p1")).toHaveLength(0);
  });

  it("lastSyncedAt: null khi rỗng, ISO sau khi insert", () => {
    expect(products.lastSyncedAt("org1")).toBeNull();
    products.upsertProduct(
      { product_id: "p1", org_id: "org1", name: "X", slug: null, short_description: null, thumbnail_url: null, status: "active", product_url: null, updated_at: null, raw_json: null },
      "2026-08-01T00:00:00Z",
    );
    expect(products.lastSyncedAt("org1")).toBe("2026-08-01T00:00:00Z");
  });
});

describe("CatalogService — sync flow", () => {
  it("syncPage 401 → throw AUTH_REFRESH_FAILED", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => JSON.stringify({ error: "invalid_token" }),
        json: async () => ({}),
      }) as Response;
    try {
      const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => "fake-token");
      await expect(
        svc.syncPage("org1", { page: 1, pageSize: 20 }),
      ).rejects.toThrowError(/AUTH_REFRESH_FAILED/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("syncPage network error → AUTH_PROVIDER_UNAVAILABLE", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    try {
      const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => "fake-token");
      await expect(
        svc.syncPage("org1", { page: 1, pageSize: 20 }),
      ).rejects.toThrowError(/AUTH_PROVIDER_UNAVAILABLE|NETWORK/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("syncPage OK → upsert + status ok", async () => {
    const items = [
      { id: "p1", name: "A", slug: "a", shortDescription: null, thumbnailUrl: null, status: "active", updatedAt: "2026-08-01", variantsCount: 1, inStock: true },
      { id: "p2", name: "B", slug: "b", shortDescription: null, thumbnailUrl: null, status: "active", updatedAt: null, variantsCount: 0, inStock: false },
    ];
    // Repo API wrap mọi success response trong `{ ok: true, data: ... }`
    // (src/lib/api/response.ts → `ok()`). Test phải phản ánh đúng wire shape.
    const body = { ok: true, data: { items, total: 2, page: 1, pageSize: 20, totalPages: 1 } };
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(body),
        json: async () => body,
      }) as Response;
    try {
      const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => "fake-token");
      const result = await svc.syncPage("org1", { page: 1, pageSize: 20 });
      expect(result.status).toBe("ok");
      expect(result.upserted).toBe(2);
      expect(products.countActive("org1")).toBe(2);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("syncPage empty → status empty", async () => {
    const body = { ok: true, data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 } };
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(body),
        json: async () => ({}),
      }) as Response;
    try {
      const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => "fake-token");
      const result = await svc.syncPage("org1", { page: 1, pageSize: 20 });
      expect(result.status).toBe("empty");
      expect(result.upserted).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("syncPage legacy payload (no wrapper) → fallback upsert OK", async () => {
    // Proxy tuột wrapper — defensive fallback vẫn unwrap đúng.
    const items = [
      { id: "p9", name: "Legacy", slug: null, shortDescription: null, thumbnailUrl: null, status: "active", updatedAt: null, variantsCount: 0, inStock: false },
    ];
    const body = { items, total: 1, page: 1, pageSize: 20, totalPages: 1 };
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(body),
        json: async () => body,
      }) as Response;
    try {
      const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => "fake-token");
      const result = await svc.syncPage("org1", { page: 1, pageSize: 20 });
      expect(result.status).toBe("ok");
      expect(result.upserted).toBe(1);
      expect(products.findById("p9")?.name).toBe("Legacy");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("syncPage payload không có items → throw CATALOG_INVALID_PAYLOAD", async () => {
    const body = { ok: true, data: { total: 0 } };
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(body),
        json: async () => body,
      }) as Response;
    try {
      const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => "fake-token");
      await expect(svc.syncPage("org1", { page: 1, pageSize: 20 })).rejects.toThrowError(/CATALOG_INVALID_PAYLOAD/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("syncPage UNAUTHORIZED khi không có access token", async () => {
    const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => null);
    await expect(svc.syncPage("org1", { page: 1, pageSize: 20 })).rejects.toThrowError(/UNAUTHORIZED/);
  });

  it("CatalogService.classifyError map 500 → CATALOG_HTTP_ERROR", () => {
    const err = new HttpError(500, "HTTP_500", "Internal Server Error");
    const mapped = CatalogService.classifyError(err);
    expect(mapped.code).toBe("CATALOG_HTTP_ERROR");
  });

  it("syncPage auto-download gallery + lưu local_image_paths_json", async () => {
    // Mock fetch: trả list OK, sau đó detail trả images[], image tải về OK.
    const items = [
      { id: "p1", name: "A", slug: "a", shortDescription: null, thumbnailUrl: null, status: "active", updatedAt: null, variantsCount: 0, inStock: false },
    ];
    const listBody = { ok: true, data: { items, total: 1, page: 1, pageSize: 20, totalPages: 1 } };
    const detailBody = { ok: true, data: { id: "p1", images: ["https://abc123.supabase.co/a.jpg"], thumbnailUrl: null } };
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("/products?") || u.includes("/products/?")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: { get: () => "application/json" },
          text: async () => JSON.stringify(listBody),
          arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(listBody)).buffer,
        } as unknown as Response;
      }
      if (u.endsWith("/products/p1")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: { get: () => "application/json" },
          text: async () => JSON.stringify(detailBody),
          arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(detailBody)).buffer,
        } as unknown as Response;
      }
      // Image asset fetch.
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: (n: string) => {
            if (n.toLowerCase() === "content-type") return "image/jpeg";
            if (n.toLowerCase() === "content-length") return String(jpegBytes.byteLength);
            return null;
          },
        },
        arrayBuffer: async () => jpegBytes.buffer.slice(jpegBytes.byteOffset, jpegBytes.byteOffset + jpegBytes.byteLength),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    try {
      const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => "fake-token");
      const result = await svc.syncPage("org1", { page: 1, pageSize: 20 });
      expect(result.status).toBe("ok");
      // Image URLs + local paths đã được lưu.
      const info = products.getImageInfo("p1");
      expect(info.urls).toEqual(["https://abc123.supabase.co/a.jpg"]);
      expect(info.localPaths).toHaveLength(1);
      expect(info.localPaths[0]).toMatch(/\.jpg$/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("ensureLocalImages: tải lại khi sync trước chưa kịp tải", async () => {
    // Giả lập product đã có image_urls_json nhưng local_paths rỗng.
    products.upsertProduct(
      {
        product_id: "p-lazy",
        org_id: "org1",
        name: "Lazy",
        slug: null,
        short_description: null,
        thumbnail_url: null,
        status: "active",
        product_url: null,
        updated_at: null,
        raw_json: null,
      },
      "2026-08-01T00:00:00Z",
    );
    products.setImageUrls("p-lazy", ["https://abc123.supabase.co/lazy.jpg"]);

    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff]);
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: (n: string) => {
            if (n.toLowerCase() === "content-type") return "image/jpeg";
            if (n.toLowerCase() === "content-length") return String(jpegBytes.byteLength);
            return null;
          },
        },
        arrayBuffer: async () => jpegBytes.buffer.slice(jpegBytes.byteOffset, jpegBytes.byteOffset + jpegBytes.byteLength),
      }) as unknown as Response);
    try {
      const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => "fake-token");
      const paths = await svc.ensureLocalImages("p-lazy");
      expect(paths).toHaveLength(1);
      expect(paths[0]).toMatch(/\.jpg$/);
    } finally {
      globalThis.fetch = original;
    }
  });
});

/**
 * CAT-005 — syncPage phải upsert variants (kèm specs_json) vào
 * variant_cache. Trước đây detail chỉ parse images, bỏ qua variants →
 * template {{variant.specs.cpu}} render ra "".
 */
describe("CatalogService — syncPage upsert variants + specs", () => {
  function mockJsonResponse(body: unknown): Response {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify(body),
      arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(body)).buffer,
    } as unknown as Response;
  }

  it("upsert variants với specs_json từ detail API", async () => {
    const items = [
      { id: "p1", name: "Lenovo Ideapad", slug: "lenovo-ideapad", shortDescription: null, thumbnailUrl: null, status: "active", updatedAt: null, variantsCount: 1, inStock: true },
    ];
    const listBody = { ok: true, data: { items, total: 1, page: 1, pageSize: 20, totalPages: 1 } };
    // Shape khớp `ProductDetailResponse` từ web service.
    const detailBody = {
      ok: true,
      data: {
        product: {
          id: "p1",
          name: "Lenovo Ideapad",
          slug: "lenovo-ideapad",
          shortDescription: null,
          plainTextDescription: "",
          thumbnailUrl: null,
          images: [],
          productUrl: "",
          updatedAt: null,
        },
        variants: [
          {
            id: "v1",
            sku: "LAP-IDP-15IAH8",
            name: "Bản 16GB/256GB",
            attributes: { color: "Xám" },
            specs: {
              CPU: "I5-12450H (8 nhân 12 luồng)",
              RAM: "16GB",
              SSD: "NVMe 256GB",
              "Màn hình": '15.6" FHD IPS',
              Pin: "2-4h",
              "Bàn phím": "Full Size",
            },
            sellingPrice: 8500000,
            availableQty: 3,
            isActive: true,
          },
        ],
      },
    };

    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("/products?")) return mockJsonResponse(listBody);
      if (u.endsWith("/products/p1")) return mockJsonResponse(detailBody);
      throw new Error(`unexpected fetch: ${u}`);
    }) as unknown as typeof fetch;
    try {
      const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => "fake-token");
      const result = await svc.syncPage("org1", { page: 1, pageSize: 20 });
      expect(result.status).toBe("ok");

      // Verify variant_cache có dữ liệu.
      const variants = products.listVariants("p1");
      expect(variants).toHaveLength(1);
      const v = variants[0]!;
      expect(v.sku).toBe("LAP-IDP-15IAH8");
      expect(v.selling_price).toBe(8500000);
      expect(v.available_qty).toBe(3);
      expect(v.is_active).toBe(1);

      // Specs_json phải là JSON string parse được, chứa CPU/RAM/SSD.
      expect(v.specs_json).toBeTruthy();
      const specs = JSON.parse(v.specs_json!) as Record<string, unknown>;
      expect(specs["CPU"]).toBe("I5-12450H (8 nhân 12 luồng)");
      expect(specs["RAM"]).toBe("16GB");
      expect(specs["SSD"]).toBe("NVMe 256GB");
      expect(specs["Pin"]).toBe("2-4h");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("variants[].specs null → specs_json = null (không crash)", async () => {
    const items = [
      { id: "p2", name: "X", slug: null, shortDescription: null, thumbnailUrl: null, status: "active", updatedAt: null, variantsCount: 0, inStock: false },
    ];
    const listBody = { ok: true, data: { items, total: 1, page: 1, pageSize: 20, totalPages: 1 } };
    const detailBody = {
      ok: true,
      data: {
        product: { id: "p2", name: "X", slug: null, shortDescription: null, plainTextDescription: "", thumbnailUrl: null, images: [], productUrl: "", updatedAt: null },
        variants: [
          { id: "v2", sku: "SKU-2", name: null, attributes: null, specs: null, sellingPrice: null, availableQty: 0, isActive: false },
        ],
      },
    };

    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("/products?")) return mockJsonResponse(listBody);
      if (u.endsWith("/products/p2")) return mockJsonResponse(detailBody);
      throw new Error(`unexpected fetch: ${u}`);
    }) as unknown as typeof fetch;
    try {
      const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => "fake-token");
      await svc.syncPage("org1", { page: 1, pageSize: 20 });
      const v = products.listVariants("p2")[0]!;
      expect(v.specs_json).toBeNull();
      expect(v.is_active).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("detail API fail → variants không được upsert (nhưng product vẫn ok)", async () => {
    const items = [
      { id: "p3", name: "Y", slug: null, shortDescription: null, thumbnailUrl: null, status: "active", updatedAt: null, variantsCount: 0, inStock: false },
    ];
    const listBody = { ok: true, data: { items, total: 1, page: 1, pageSize: 20, totalPages: 1 } };

    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("/products?")) return mockJsonResponse(listBody);
      if (u.includes("/products/p3")) throw new Error("ECONNREFUSED");
      throw new Error(`unexpected fetch: ${u}`);
    }) as unknown as typeof fetch;
    try {
      const svc = new CatalogService(products, settings, images, () => "https://api.laplap.vn", () => "fake-token");
      const result = await svc.syncPage("org1", { page: 1, pageSize: 20 });
      expect(result.status).toBe("ok");
      // Product vẫn được upsert.
      expect(products.findById("p3")?.name).toBe("Y");
      // Variants không có vì detail fail.
      expect(products.listVariants("p3")).toHaveLength(0);
    } finally {
      globalThis.fetch = original;
    }
  });
});

/**
 * spec-map — coverage cho alias backend thật sự dùng (CPU/RAM/SSD/Storage).
 */
describe("spec-map — alias backend thật (theo src/app/api/public/products)", () => {
  it("map 'Storage' (cũ) → ssd", async () => {
    const { buildSpecMap } = await import("../../src/main/template/spec-map");
    const map = buildSpecMap(JSON.stringify({ Storage: "256GB NVMe", CPU: "I5" }));
    expect(map["ssd"]).toBe("256GB NVMe");
    expect(map["cpu"]).toBe("I5");
  });

  it("map 'SSD' (mới) → ssd, override nếu cả 2 key", async () => {
    const { buildSpecMap } = await import("../../src/main/template/spec-map");
    // Thứ tự Object.entries: SSD xuất hiện trước → giữ giá trị SSD.
    const map = buildSpecMap(JSON.stringify({ SSD: "NVMe", Storage: "HDD" }));
    expect(map["ssd"]).toBe("NVMe");
  });
});
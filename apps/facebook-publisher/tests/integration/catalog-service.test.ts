/**
 * CAT-001 — CatalogService + ProductRepository tests.
 */
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/main/db/migrations";
import { ProductRepository } from "../../src/main/db/repositories/products";
import { SettingsRepository } from "../../src/main/db/repositories/settings";
import { CatalogService } from "../../src/main/services/catalog-service";
import { HttpError } from "../../src/main/api/http-client";

let db: Database.Database;
let products: ProductRepository;
let settings: SettingsRepository;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  products = new ProductRepository(db);
  settings = new SettingsRepository(db);
});

afterEach(() => {
  db.close();
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
      const svc = new CatalogService(products, settings, () => "https://api.laplap.vn", () => "fake-token");
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
      const svc = new CatalogService(products, settings, () => "https://api.laplap.vn", () => "fake-token");
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
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ items, total: 2, page: 1, pageSize: 20, totalPages: 1 }),
        json: async () => ({ items, total: 2, page: 1, pageSize: 20, totalPages: 1 }),
      }) as Response;
    try {
      const svc = new CatalogService(products, settings, () => "https://api.laplap.vn", () => "fake-token");
      const result = await svc.syncPage("org1", { page: 1, pageSize: 20 });
      expect(result.status).toBe("ok");
      expect(result.upserted).toBe(2);
      expect(products.countActive("org1")).toBe(2);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("syncPage empty → status empty", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
        json: async () => ({}),
      }) as Response;
    try {
      const svc = new CatalogService(products, settings, () => "https://api.laplap.vn", () => "fake-token");
      const result = await svc.syncPage("org1", { page: 1, pageSize: 20 });
      expect(result.status).toBe("empty");
      expect(result.upserted).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("syncPage UNAUTHORIZED khi không có access token", async () => {
    const svc = new CatalogService(products, settings, () => "https://api.laplap.vn", () => null);
    await expect(svc.syncPage("org1", { page: 1, pageSize: 20 })).rejects.toThrowError(/UNAUTHORIZED/);
  });

  it("CatalogService.classifyError map 500 → CATALOG_HTTP_ERROR", () => {
    const err = new HttpError(500, "HTTP_500", "Internal Server Error");
    const mapped = CatalogService.classifyError(err);
    expect(mapped.code).toBe("CATALOG_HTTP_ERROR");
  });
});
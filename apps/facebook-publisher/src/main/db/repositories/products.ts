/**
 * Repository cho product_cache + variant_cache (DB-001).
 *
 * CAT-001 acceptance:
 *  - Bulk upsert theo page (sync engine goi nhieu page, moi page transaction).
 *  - KHONG tự parse JSON thanh object — stringified lai can thiet cho raw.
 *    Khi can, service layer parse.
 *  - Cung cap page-by-page query voi offset/limit phu hop cho UI render.
 *  - Luu synced_at de sau nay UI hien 'last sync'.
 */
import type Database from "better-sqlite3";
import { BaseRepo } from "./base";
import type { ProductCacheRow, VariantCacheRow } from "../../../shared/db-types";

export type ProductUpsert = {
  product_id: string;
  org_id: string;
  name: string;
  slug: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  status: string;
  product_url: string | null;
  updated_at: string | null;
  raw_json: string | null;
};

export type VariantUpsert = {
  variant_id: string;
  product_id: string;
  sku: string;
  name: string | null;
  attributes_json: string | null;
  specs_json: string | null;
  selling_price: number | null;
  is_active: number;
  available_qty: number;
};

export class ProductRepository extends BaseRepo {
  private readonly upsertProductStmt: Database.Statement;
  private readonly upsertVariantStmt: Database.Statement;
  private readonly listByOrgStmt: Database.Statement;
  private readonly findProductStmt: Database.Statement;
  private readonly listVariantsStmt: Database.Statement;
  private readonly countActiveStmt: Database.Statement;
  private readonly maxSyncedAtStmt: Database.Statement;

  constructor(db: Database.Database) {
    super(db);
    this.upsertProductStmt = db.prepare(`
      INSERT INTO product_cache
        (product_id, org_id, name, slug, short_description, thumbnail_url,
         status, product_url, updated_at, synced_at, raw_json)
      VALUES
        (@product_id, @org_id, @name, @slug, @short_description, @thumbnail_url,
         @status, @product_url, @updated_at, @synced_at, @raw_json)
      ON CONFLICT(product_id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        short_description = excluded.short_description,
        thumbnail_url = excluded.thumbnail_url,
        status = excluded.status,
        product_url = excluded.product_url,
        updated_at = excluded.updated_at,
        synced_at = excluded.synced_at,
        raw_json = excluded.raw_json
    `);
    this.upsertVariantStmt = db.prepare(`
      INSERT INTO variant_cache
        (variant_id, product_id, sku, name, attributes_json, specs_json,
         selling_price, is_active, available_qty, synced_at)
      VALUES
        (@variant_id, @product_id, @sku, @name, @attributes_json, @specs_json,
         @selling_price, @is_active, @available_qty, @synced_at)
      ON CONFLICT(variant_id) DO UPDATE SET
        sku = excluded.sku,
        name = excluded.name,
        attributes_json = excluded.attributes_json,
        specs_json = excluded.specs_json,
        selling_price = excluded.selling_price,
        is_active = excluded.is_active,
        available_qty = excluded.available_qty,
        synced_at = excluded.synced_at
    `);
    this.listByOrgStmt = db.prepare(`
      SELECT * FROM product_cache
      WHERE org_id = ? AND status = 'active'
      ORDER BY updated_at DESC NULLS LAST, name ASC
      LIMIT ? OFFSET ?
    `);
    this.findProductStmt = db.prepare(`SELECT * FROM product_cache WHERE product_id = ?`);
    this.listVariantsStmt = db.prepare(`
      SELECT * FROM variant_cache
      WHERE product_id = ? AND is_active = 1
      ORDER BY selling_price ASC NULLS LAST, sku ASC
    `);
    this.countActiveStmt = db.prepare(`
      SELECT COUNT(*) AS n FROM product_cache WHERE org_id = ? AND status = 'active'
    `);
    this.maxSyncedAtStmt = db.prepare(`
      SELECT MAX(synced_at) AS s FROM product_cache WHERE org_id = ?
    `);
  }

  /** Upsert 1 product. Dùng trong transaction bulk. */
  upsertProduct(p: ProductUpsert, syncedAt: string): void {
    this.upsertProductStmt.run({ ...p, synced_at: syncedAt });
  }

  /** Upsert 1 variant. Dùng trong transaction bulk. */
  upsertVariant(v: VariantUpsert, syncedAt: string): void {
    this.upsertVariantStmt.run({ ...v, synced_at: syncedAt });
  }

  /** List product active trong org, phan trang. */
  listByOrg(orgId: string, limit: number, offset: number): ProductCacheRow[] {
    return this.listByOrgStmt.all(orgId, limit, offset) as ProductCacheRow[];
  }

  /** Search theo name/slug — dung cho UI CAT-002. */
  searchByOrg(orgId: string, query: string, limit: number, offset: number): ProductCacheRow[] {
    const pat = `%${query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    const stmt = this.db.prepare(
      `SELECT * FROM product_cache
       WHERE org_id = ? AND status = 'active'
         AND (name LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\')
       ORDER BY updated_at DESC NULLS LAST, name ASC
       LIMIT ? OFFSET ?`,
    );
    return stmt.all(orgId, pat, pat, limit, offset) as ProductCacheRow[];
  }

  findById(productId: string): ProductCacheRow | undefined {
    return this.findProductStmt.get(productId) as ProductCacheRow | undefined;
  }

  listVariants(productId: string): VariantCacheRow[] {
    return this.listVariantsStmt.all(productId) as VariantCacheRow[];
  }

  countActive(orgId: string): number {
    const row = this.countActiveStmt.get(orgId) as { n: number };
    return row?.n ?? 0;
  }

  /** Tra ISO timestamp cua lan sync gan nhat. Null neu chua co. */
  lastSyncedAt(orgId: string): string | null {
    const row = this.maxSyncedAtStmt.get(orgId) as { s: string | null };
    return row?.s ?? null;
  }

  /**
   * Xoa product + cascade variants. Dung khi product archive/remove.
   * Caller (sync engine) phai quyet dinh khi nao xoa (vd khi API tra 404).
   */
  deleteById(productId: string): void {
    this.db.prepare(`DELETE FROM product_cache WHERE product_id = ?`).run(productId);
  }
}
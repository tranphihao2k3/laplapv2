/**
 * CampaignRepository — CRUD cho campaigns table.
 */
import type Database from "better-sqlite3";
import { BaseRepo } from "./base";
import type { CampaignRow, CampaignStatus } from "../../../shared/db-types";

export type CampaignInput = {
  name: string;
  productId: string;
  variantId: string;
  templateId: string;
  groupSetId?: string | null;
  imagePaths?: string[];
  status?: CampaignStatus;
};

export class CampaignRepository extends BaseRepo {
  private readonly insertStmt: Database.Statement;
  private readonly updateStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly listAllStmt: Database.Statement;

  constructor(db: Database.Database) {
    super(db);
    this.insertStmt = db.prepare(`
      INSERT INTO campaigns
        (id, name, product_id, variant_id, template_id, group_set_id, image_paths_json, status)
      VALUES
        (@id, @name, @product_id, @variant_id, @template_id, @group_set_id, @image_paths_json, @status)
    `);
    this.updateStmt = db.prepare(`
      UPDATE campaigns SET
        name = @name,
        product_id = @product_id,
        variant_id = @variant_id,
        template_id = @template_id,
        group_set_id = @group_set_id,
        image_paths_json = @image_paths_json,
        status = @status,
        updated_at = @updated_at
      WHERE id = @id
    `);
    this.deleteStmt = db.prepare(`DELETE FROM campaigns WHERE id = ?`);
    this.findByIdStmt = db.prepare(`SELECT * FROM campaigns WHERE id = ?`);
    this.listAllStmt = db.prepare(`SELECT * FROM campaigns ORDER BY created_at DESC`);
  }

  insert(id: string, input: CampaignInput): void {
    this.insertStmt.run({
      id,
      name: input.name,
      product_id: input.productId,
      variant_id: input.variantId,
      template_id: input.templateId,
      group_set_id: input.groupSetId ?? null,
      image_paths_json: JSON.stringify(input.imagePaths ?? []),
      status: input.status ?? "draft",
    });
  }

  update(id: string, patch: Partial<CampaignInput>): void {
    const existing = this.findById(id);
    if (!existing) throw new Error(`Campaign not found: ${id}`);
    this.updateStmt.run({
      id,
      name: patch.name ?? existing.name,
      product_id: patch.productId ?? existing.product_id,
      variant_id: patch.variantId ?? existing.variant_id,
      template_id: patch.templateId ?? existing.template_id,
      group_set_id:
        patch.groupSetId !== undefined ? patch.groupSetId : existing.group_set_id,
      image_paths_json:
        patch.imagePaths !== undefined
          ? JSON.stringify(patch.imagePaths)
          : existing.image_paths_json,
      status: patch.status ?? existing.status,
      updated_at: new Date().toISOString(),
    });
  }

  delete(id: string): void {
    // post_jobs FK ON DELETE CASCADE sẽ xoá theo.
    this.deleteStmt.run(id);
  }

  findById(id: string): CampaignRow | undefined {
    return this.findByIdStmt.get(id) as CampaignRow | undefined;
  }

  listAll(): CampaignRow[] {
    return this.listAllStmt.all() as CampaignRow[];
  }
}
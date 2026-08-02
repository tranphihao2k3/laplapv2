/**
 * TemplateRepository — CRUD cho templates table.
 *
 * Schema: id, name (UNIQUE), body, allowlisted_variables_json, content_text,
 * created_at, updated_at.
 */
import type Database from "better-sqlite3";
import { BaseRepo } from "./base";
import type { TemplateRow } from "../../../shared/db-types";

export class TemplateRepository extends BaseRepo {
  private readonly insertStmt: any;
  private readonly updateStmt: any;
  private readonly deleteStmt: any;
  private readonly findByIdStmt: any;
  private readonly findByNameStmt: any;
  private readonly listAllStmt: any;

  constructor(db: any) {
    super(db);
    this.insertStmt = db.prepare(`
      INSERT INTO templates (id, name, body, allowlisted_variables_json, content_text)
      VALUES (@id, @name, @body, @allowlisted_variables_json, @content_text)
    `);
    this.updateStmt = db.prepare(`
      UPDATE templates SET
        name = @name,
        body = @body,
        allowlisted_variables_json = @allowlisted_variables_json,
        content_text = @content_text,
        updated_at = @updated_at
      WHERE id = @id
    `);
    this.deleteStmt = db.prepare(`DELETE FROM templates WHERE id = ?`);
    this.findByIdStmt = db.prepare(`SELECT * FROM templates WHERE id = ?`);
    this.findByNameStmt = db.prepare(`SELECT * FROM templates WHERE name = ?`);
    this.listAllStmt = db.prepare(`SELECT * FROM templates ORDER BY name ASC`);
  }

  insert(input: Omit<TemplateRow, "created_at" | "updated_at">): void {
    this.insertStmt.run(input);
  }

  update(id: string, patch: Partial<Omit<TemplateRow, "id" | "created_at">>): void {
    const existing = this.findById(id);
    if (!existing) throw new Error(`Template not found: ${id}`);
    this.updateStmt.run({
      id,
      name: patch.name ?? existing.name,
      body: patch.body ?? existing.body,
      allowlisted_variables_json:
        patch.allowlisted_variables_json ?? existing.allowlisted_variables_json,
      content_text: patch.content_text ?? existing.content_text,
      updated_at: new Date().toISOString(),
    });
  }

  delete(id: string): void {
    this.deleteStmt.run(id);
  }

  findById(id: string): TemplateRow | undefined {
    return this.findByIdStmt.get(id) as TemplateRow | undefined;
  }

  findByName(name: string): TemplateRow | undefined {
    return this.findByNameStmt.get(name) as TemplateRow | undefined;
  }

  listAll(): TemplateRow[] {
    return this.listAllStmt.all() as TemplateRow[];
  }
}
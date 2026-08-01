/**
 * Repository cho facebook_groups — bảng người dùng tự thêm thủ công.
 *
 * DB-002 acceptance: typed CRUD, không string-concat SQL, prepared cached.
 */
import type Database from "better-sqlite3";
import { BaseRepo } from "./base";
import type {
  FacebookGroupRow,
  GroupSetGroupRow,
  GroupSetRow,
  PostingMode,
} from "../../../shared/db-types";

export class FacebookGroupRepository extends BaseRepo {
  private readonly insertStmt: Database.Statement;
  private readonly updateStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly listAllStmt: Database.Statement;
  private readonly listEnabledStmt: Database.Statement;

  constructor(db: Database.Database) {
    super(db);
    this.insertStmt = db.prepare(`
      INSERT INTO facebook_groups
        (id, name, url, enabled, locale, notes, max_images, allow_link, posting_mode)
      VALUES (@id, @name, @url, @enabled, @locale, @notes, @max_images, @allow_link, @posting_mode)
    `);
    this.updateStmt = db.prepare(`
      UPDATE facebook_groups SET
        name = @name, url = @url, enabled = @enabled, locale = @locale,
        notes = @notes, max_images = @max_images, allow_link = @allow_link,
        posting_mode = @posting_mode, updated_at = @updated_at
      WHERE id = @id
    `);
    this.deleteStmt = db.prepare(`DELETE FROM facebook_groups WHERE id = ?`);
    this.findByIdStmt = db.prepare(`SELECT * FROM facebook_groups WHERE id = ?`);
    this.listAllStmt = db.prepare(`SELECT * FROM facebook_groups ORDER BY name ASC`);
    this.listEnabledStmt = db.prepare(
      `SELECT * FROM facebook_groups WHERE enabled = 1 ORDER BY name ASC`,
    );
  }

  /** Insert 1 group. Throw UNIQUE nếu url trùng. */
  insert(input: Omit<FacebookGroupRow, "created_at" | "updated_at">): void {
    this.insertStmt.run({
      id: input.id,
      name: input.name,
      url: input.url,
      enabled: input.enabled,
      locale: input.locale,
      notes: input.notes,
      max_images: input.max_images,
      allow_link: input.allow_link,
      posting_mode: input.posting_mode,
    });
  }

  update(
    id: string,
    patch: Partial<Omit<FacebookGroupRow, "id" | "created_at">>,
  ): void {
    const existing = this.findById(id);
    if (!existing) throw new Error(`Facebook group not found: ${id}`);
    this.updateStmt.run({
      id,
      name: patch.name ?? existing.name,
      url: patch.url ?? existing.url,
      enabled: patch.enabled ?? existing.enabled,
      locale: patch.locale ?? existing.locale,
      notes: patch.notes ?? existing.notes,
      max_images: patch.max_images ?? existing.max_images,
      allow_link: patch.allow_link ?? existing.allow_link,
      posting_mode: patch.posting_mode ?? existing.posting_mode,
      updated_at: new Date().toISOString(),
    });
  }

  delete(id: string): void {
    this.deleteStmt.run(id);
  }

  findById(id: string): FacebookGroupRow | undefined {
    return this.findByIdStmt.get(id) as FacebookGroupRow | undefined;
  }

  listAll(): FacebookGroupRow[] {
    return this.listAllStmt.all() as FacebookGroupRow[];
  }

  listEnabled(): FacebookGroupRow[] {
    return this.listEnabledStmt.all() as FacebookGroupRow[];
  }
}

/** Repository cho group_sets + group_set_groups. */
export class GroupSetRepository extends BaseRepo {
  private readonly insertSetStmt: Database.Statement;
  private readonly addLinkStmt: Database.Statement;
  private readonly removeLinkStmt: Database.Statement;
  private readonly listSetStmt: Database.Statement;
  private readonly listMembersStmt: Database.Statement;
  private readonly deleteSetStmt: Database.Statement;

  constructor(db: Database.Database) {
    super(db);
    this.insertSetStmt = db.prepare(`INSERT INTO group_sets (id, name) VALUES (?, ?)`);
    this.addLinkStmt = db.prepare(
      `INSERT OR IGNORE INTO group_set_groups (group_set_id, group_id) VALUES (?, ?)`,
    );
    this.removeLinkStmt = db.prepare(
      `DELETE FROM group_set_groups WHERE group_set_id = ? AND group_id = ?`,
    );
    this.listSetStmt = db.prepare(`SELECT * FROM group_sets ORDER BY name ASC`);
    this.listMembersStmt = db.prepare(`
      SELECT g.* FROM facebook_groups g
      INNER JOIN group_set_groups link ON link.group_id = g.id
      WHERE link.group_set_id = ?
      ORDER BY g.name ASC
    `);
    this.deleteSetStmt = db.prepare(`DELETE FROM group_sets WHERE id = ?`);
  }

  createSet(id: string, name: string): void {
    this.insertSetStmt.run(id, name);
  }

  addToSet(groupSetId: string, groupId: string): void {
    this.addLinkStmt.run(groupSetId, groupId);
  }

  removeFromSet(groupSetId: string, groupId: string): void {
    this.removeLinkStmt.run(groupSetId, groupId);
  }

  listSets(): GroupSetRow[] {
    return this.listSetStmt.all() as GroupSetRow[];
  }

  listMembers(groupSetId: string): FacebookGroupRow[] {
    return this.listMembersStmt.all(groupSetId) as FacebookGroupRow[];
  }

  deleteSet(id: string): void {
    // FK ON DELETE CASCADE tự xoá group_set_groups.
    this.deleteSetStmt.run(id);
  }
}

/** Helper để normalize/sanitize URL group. */
export function normalizeFacebookGroupUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.hostname.endsWith("facebook.com")) {
      // Đường dẫn phải là /groups/<id> hoặc /groups/<slug>.
      const match = /^\/groups\/([\w.-]+)\/?$/.exec(url.pathname);
      if (!match) return null;
      return `${url.protocol}//${url.hostname}/groups/${match[1]}`;
    }
    return null;
  } catch {
    return null;
  }
}

export type { FacebookGroupRow, GroupSetGroupRow, GroupSetRow, PostingMode };

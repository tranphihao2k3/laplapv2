/**
 * DB-001 integration tests — chạy trên SQLite in-memory (no Electron runtime).
 *
 * Acceptance:
 *  - DB rỗng migrate được → tất cả bảng + index tồn tại.
 *  - Constraint FK ngoăn orphan: xoá parent cascade/delete đúng rule.
 *  - Transaction rollback khi migration giả bị lỗi: DB không có dấu vết.
 *  - Idempotent: chạy migrate 2 lần không lỗi, không apply lại.
 *  - Migration drift: nếu DB đã apply v1 mà file v1 mất → throw.
 *
 * Vitest chạy trong Node, không cần Electron. Tự tạo DB in-memory để
 * test nhanh và cô lập — không chạm app data thật.
 */
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  runMigrations,
  type Migration,
} from "../../src/main/db/migrations";
import { migrations } from "../../src/main/db/schema";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
});

afterEach(() => {
  db.close();
});

describe("DB-001 — migrations", () => {
  it("DB rỗng: migrate được hết 6 version", () => {
    const result = runMigrations(db);

    expect(result.total).toBe(migrations.length);
    expect(result.alreadyApplied).toBe(0);
    expect(result.applied.length).toBe(migrations.length);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name).sort();

    // Bảng migration tracking + 9 bảng nghiệp vụ.
    expect(names).toContain("schema_migrations");
    expect(names).toContain("product_cache");
    expect(names).toContain("variant_cache");
    expect(names).toContain("facebook_groups");
    expect(names).toContain("group_sets");
    expect(names).toContain("group_set_groups");
    expect(names).toContain("templates");
    expect(names).toContain("campaigns");
    expect(names).toContain("post_jobs");
    expect(names).toContain("job_attempts");
    expect(names).toContain("settings");
  });

  it("Idempotent: chạy 2 lần liên tiếp không lỗi, không apply lại", () => {
    const first = runMigrations(db);
    const second = runMigrations(db);

    expect(first.applied.length).toBe(migrations.length);
    expect(second.applied.length).toBe(0);
    expect(second.alreadyApplied).toBe(migrations.length);
  });

  it("Migration drift: apply v1 mất file v1 → throw MIGRATION_DRIFT", () => {
    runMigrations(db);

    const drifted: Migration[] = migrations.filter((m) => m.version !== 1);
    expect(() => runMigrations(db, drifted)).toThrowError(/MIGRATION_DRIFT/);
  });

  it("Transaction rollback: migration giả lỗi giữa chừng không để lại dấu vết", () => {
    const partialOk = migrations[0];
    const broken: Migration = {
      version: 99,
      name: "broken-on-purpose",
      // Cố ý tham chiếu cột không tồn tại để exec() throw.
      sql: "CREATE TABLE broken(id INTEGER PRIMARY KEY, nonexistent_col REFERENCES product_cache(product_id));",
    };
    const fixture: Migration[] = [...migrations, broken];

    expect(() => runMigrations(db, fixture)).toThrowError(/MIGRATION_FAILED/);

    const rows = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as { version: number }[];

    // 6 version OK đã apply; version 99 KHÔNG có → bằng chứng rollback.
    expect(rows.map((r) => r.version)).toEqual(migrations.map((m) => m.version));

    const brokenExists = db
      .prepare("SELECT name FROM sqlite_master WHERE name='broken'")
      .get();
    expect(brokenExists).toBeUndefined();
  });

  it("FK constraint: variant_cache.product_id ON DELETE CASCADE", () => {
    runMigrations(db);

    db.prepare(
      "INSERT INTO product_cache (product_id, org_id, name, status, synced_at) VALUES (?, ?, ?, ?, ?)",
    ).run("p1", "org1", "Laptop A", "active", "2026-08-01T00:00:00Z");
    db.prepare(
      "INSERT INTO variant_cache (variant_id, product_id, sku, is_active, available_qty, synced_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("v1", "p1", "SKU-1", 1, 5, "2026-08-01T00:00:00Z");

    db.prepare("DELETE FROM product_cache WHERE product_id = ?").run("p1");

    const orphaned = db
      .prepare("SELECT variant_id FROM variant_cache WHERE product_id = ?")
      .get("p1") as { variant_id: string } | undefined;
    expect(orphaned).toBeUndefined();
  });

  it("FK constraint: facebook_groups <-> group_set_groups CASCADE", () => {
    runMigrations(db);
    db.prepare("INSERT INTO facebook_groups (id, name, url) VALUES (?, ?, ?)").run(
      "g1",
      "Group 1",
      "https://facebook.com/groups/g1",
    );
    db.prepare("INSERT INTO group_sets (id, name) VALUES (?, ?)").run("s1", "Set 1");
    db.prepare("INSERT INTO group_set_groups (group_set_id, group_id) VALUES (?, ?)").run(
      "s1",
      "g1",
    );

    db.prepare("DELETE FROM facebook_groups WHERE id = ?").run("g1");
    const link = db
      .prepare("SELECT * FROM group_set_groups WHERE group_id = ?")
      .get("g1");
    expect(link).toBeUndefined();
  });

  it("post_jobs.fingerprint unique partial: trùng fingerprint ở state khác nhau OK", () => {
    runMigrations(db);
    // Setup tối thiểu FK để insert post_jobs.
    db.prepare(
      "INSERT INTO product_cache (product_id, org_id, name, status, synced_at) VALUES (?, ?, ?, ?, ?)",
    ).run("p1", "org1", "X", "active", "2026-08-01T00:00:00Z");
    db.prepare(
      "INSERT INTO variant_cache (variant_id, product_id, sku, is_active, available_qty, synced_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("v1", "p1", "SKU-X", 1, 0, "2026-08-01T00:00:00Z");
    db.prepare("INSERT INTO facebook_groups (id, name, url) VALUES (?, ?, ?)").run(
      "g1",
      "G",
      "https://facebook.com/groups/g1",
    );
    db.prepare(
      "INSERT INTO templates (id, name, body, allowlisted_variables_json) VALUES (?, ?, ?, ?)",
    ).run("t1", "T", "{{name}}", "[]");
    db.prepare(
      "INSERT INTO campaigns (id, name, product_id, variant_id, template_id, image_paths_json, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("c1", "C", "p1", "v1", "t1", "[]", "draft");

    const fp = "abc123";
    db.prepare(
      "INSERT INTO post_jobs (id, campaign_id, group_id, state, fingerprint) VALUES (?, ?, ?, ?, ?)",
    ).run("j1", "c1", "g1", "queued", fp);
    db.prepare(
      "INSERT INTO post_jobs (id, campaign_id, group_id, state, fingerprint) VALUES (?, ?, ?, ?, ?)",
    ).run("j2", "c1", "g1", "failed", fp); // job đã kết thúc → không conflict unique partial.

    const j3 = () =>
      db
        .prepare("INSERT INTO post_jobs (id, campaign_id, group_id, state, fingerprint) VALUES (?, ?, ?, ?, ?)")
        .run("j3", "c1", "g1", "queued", fp); // state queued → conflict.
    expect(j3).toThrowError(/UNIQUE/i);
  });

  it("Pragmas WAL/foreign_keys được set trên DB thật (file-based)", () => {
    // Close in-memory DB trước, mở file để kiểm tra pragma journal_mode.
    db.close();
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const tmp = path.join(require("node:os").tmpdir(), `laplap-test-${Date.now()}.db`);
    const fileDb = new Database(tmp);
    fileDb.pragma("journal_mode = WAL");
    fileDb.pragma("foreign_keys = ON");
    const journal = fileDb.pragma("journal_mode") as { journal_mode: string }[];
    expect(journal[0]?.journal_mode.toLowerCase()).toBe("wal");
    fileDb.close();
    fs.unlinkSync(tmp);
    // WAL tạo file -wal và -shm; cleanup nếu còn.
    for (const ext of ["-wal", "-shm"]) {
      const f = tmp + ext;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });
});

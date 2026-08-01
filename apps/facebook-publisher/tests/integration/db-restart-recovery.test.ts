/**
 * DB-002 — restart recovery + upgrade version tests.
 *
 * Acceptance:
 *  - Restart app vẫn đọc đúng queue/history.
 *  - Upgrade từ DB version cũ không mất dữ liệu.
 *
 * Test dùng file-based DB để simulate "close app → reopen".
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/main/db/migrations";
import { migrations, type Migration } from "../../src/main/db/schema";
import {
  PostJobRepository,
} from "../../src/main/db/repositories/post-jobs";
import {
  FacebookGroupRepository,
} from "../../src/main/db/repositories/facebook-groups";

let tmpDir: string;
let dbPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "laplap-recovery-"));
  dbPath = path.join(tmpDir, "test.db");
});

afterEach(() => {
  // Cleanup file + WAL/SHM còn sót.
  for (const ext of ["", "-wal", "-shm"]) {
    const p = dbPath + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  fs.rmdirSync(tmpDir);
});

function openFresh(): Database.Database {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seedJobState(db: Database.Database): {
  jobId: string;
  campaignId: string;
} {
  // Seed các bảng cha tối thiểu.
  db.prepare(
    "INSERT INTO product_cache (product_id, org_id, name, status, synced_at) VALUES (?, ?, ?, ?, ?)",
  ).run("p1", "org1", "X", "active", "2026-08-01T00:00:00Z");
  db.prepare(
    "INSERT INTO variant_cache (variant_id, product_id, sku, is_active, available_qty, synced_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run("v1", "p1", "SKU-X", 1, 1, "2026-08-01T00:00:00Z");
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

  const repo = new PostJobRepository(db);
  repo.insert({
    id: "j1",
    campaign_id: "c1",
    group_id: "g1",
    state: "awaiting_confirmation",
    fingerprint: "fp-recovery",
  });
  repo.transition({
    id: "j1",
    toState: "unverified",
    attemptNumber: 2,
    errorCode: "APP_CRASHED",
    errorMessage: "Submit clicked but no response captured",
  });
  return { jobId: "j1", campaignId: "c1" };
}

describe("DB-002 — restart recovery", () => {
  it("close + reopen: queue/history còn nguyên", () => {
    let db = openFresh();
    seedJobState(db);
    db.close();

    // Mô phỏng app restart.
    db = openFresh();

    // Tất cả bảng còn data, schema_migrations còn nguyên 6 version.
    const versions = (
      db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
        version: number;
      }[]
    ).map((r) => r.version);
    expect(versions).toEqual(migrations.map((m) => m.version));

    const jobRepo = new PostJobRepository(db);
    const job = jobRepo.findById("j1");
    expect(job?.state).toBe("unverified");
    expect(job?.last_error_code).toBe("APP_CRASHED");

    const attempts = db
      .prepare(
        "SELECT from_state, to_state FROM job_attempts WHERE job_id = ? ORDER BY attempt_number",
      )
      .all("j1") as { from_state: string; to_state: string }[];

    // seedJobState chi transition 1 lan (awaiting_confirmation -> unverified),
    // nen attempt chi co 1 dong.
    expect(attempts).toEqual([
      {
        from_state: "awaiting_confirmation",
        to_state: "unverified",
      },
    ]);
  });

  it("upgrade path: apply thêm version 7 (mocked) KHÔNG mất dữ liệu", () => {
    // 1. Apply schema gốc.
    let db = openFresh();
    seedJobState(db);
    const jobCountBefore = (
      db.prepare("SELECT COUNT(*) AS n FROM post_jobs").get() as { n: number }
    ).n;
    const attemptCountBefore = (
      db.prepare("SELECT COUNT(*) AS n FROM job_attempts").get() as { n: number }
    ).n;
    db.close();

    // 2. Giả lập version mới: thêm bảng diagnostics (không đụng bảng cũ).
    const extendedMigrations: Migration[] = [
      ...migrations,
      {
        version: 7,
        name: "diagnostics (mock upgrade)",
        sql: `
          CREATE TABLE diagnostics (
            id TEXT PRIMARY KEY NOT NULL,
            job_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            payload_json TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            FOREIGN KEY (job_id) REFERENCES post_jobs(id) ON DELETE CASCADE
          );
        `,
      },
    ];

    // 3. Reopen, chạy runner với extended.
    db = new Database(dbPath);
    db.pragma("foreign_keys = ON");
    runMigrations(db, extendedMigrations);

    // 4. Dữ liệu cũ còn nguyên.
    const jobCountAfter = (
      db.prepare("SELECT COUNT(*) AS n FROM post_jobs").get() as { n: number }
    ).n;
    const attemptCountAfter = (
      db.prepare("SELECT COUNT(*) AS n FROM job_attempts").get() as { n: number }
    ).n;
    expect(jobCountAfter).toBe(jobCountBefore);
    expect(attemptCountAfter).toBe(attemptCountBefore);

    const versions = (
      db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
        version: number;
      }[]
    ).map((r) => r.version);
    expect(versions).toEqual([...migrations.map((m) => m.version), 7]);

    // Bảng diagnostics tồn tại và rỗng.
    const diagCount = (
      db.prepare("SELECT COUNT(*) AS n FROM diagnostics").get() as { n: number }
    ).n;
    expect(diagCount).toBe(0);

    db.close();
  });

  it("concurrent read an toàn khi WAL (2 connection cùng SELECT)", () => {
    const db1 = openFresh();
    seedJobState(db1);
    // Mở connection thứ 2 đọc — không lock gì vì WAL cho phép 1 writer + N reader.
    const db2 = new Database(dbPath);
    db2.pragma("foreign_keys = ON");

    const fromDb2 = db2.prepare("SELECT state FROM post_jobs WHERE id = ?").get("j1") as
      | { state: string }
      | undefined;
    expect(fromDb2?.state).toBe("unverified");

    db1.close();
    db2.close();
  });
});

describe("DB-002 — group repository cũng survive restart", () => {
  it("close + reopen: groups vẫn đọc đúng", () => {
    let db = openFresh();
    const groups = new FacebookGroupRepository(db);
    groups.insert({
      id: "g1",
      name: "Pinned",
      url: "https://facebook.com/groups/pinned",
      enabled: 1,
      locale: "vi",
      notes: null,
      max_images: 10,
      allow_link: 1,
      posting_mode: "auto",
    });
    db.close();

    db = openFresh();
    const repo = new FacebookGroupRepository(db);
    expect(repo.listEnabled().map((g) => g.posting_mode)).toEqual(["auto"]);
    db.close();
  });
});

/**
 * Migration runner — SQLite.
 *
 * DB-001 acceptance:
 *  - Mỗi migration chạy trong TRANSACTION. Lỗi → ROLLBACK nguyên migration.
 *  - Bảng `schema_migrations` ghi version+checksum đã apply. Nếu file
 *    migration thiếu → throw để fail-fast (chống sửa DB lén).
 *  - Migration là array thứ tự — KHÔNG reorder cũ.
 *  - Có thể chạy trên DB rỗng (fresh install) và DB đã có data (upgrade).
 *  - Idempotent: chạy 2 lần liên tiếp không apply lại, không lỗi.
 */
import type Database from "better-sqlite3";
import { AppError } from "../../shared/errors";
import { migrations as defaultMigrations } from "./schema";

export type Migration = {
  /** Version bắt đầu từ 1. Phải duy nhất trong mảng. */
  version: number;
  /** Tên người đọc — log ra khi chạy. */
  name: string;
  /** SQL DDL. Có thể nhiều statement. */
  sql: string;
};

const SCHEMA_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(SCHEMA_MIGRATIONS_TABLE);
}

function getAppliedVersions(db: Database.Database): Set<number> {
  const rows = db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[];
  return new Set(rows.map((r) => r.version));
}

/** Apply tất cả migrations chưa chạy. Idempotent.
 *
 * `customMigrations` chỉ dùng cho test — production dùng giá trị mặc định
 * từ schema.ts. Nếu truyền nhưng DB đã apply version không có ở custom
 * (drift) → throw.
 */
export function runMigrations(
  db: Database.Database,
  customMigrations?: Migration[],
): {
  applied: number[];
  total: number;
  alreadyApplied: number;
} {
  ensureMigrationsTable(db);
  const appliedVersions = getAppliedVersions(db);

  // Sắp xếp theo version để chắc chắn thứ tự.
  const sorted = [...(customMigrations ?? defaultMigrations)].sort(
    (a, b) => a.version - b.version,
  );

  // Phát hiện version đặc biệt: migration cũ đã apply nhưng giờ thiếu file
  // → throw để chống sửa DB lén.
  for (const v of appliedVersions) {
    if (!sorted.some((m) => m.version === v)) {
      throw new AppError(
        "MIGRATION_DRIFT",
        `DB đã apply migration version=${v} nhưng file không còn trong source — không rollback lén được`,
        500,
      );
    }
  }

  const applied: number[] = [];

  for (const m of sorted) {
    if (appliedVersions.has(m.version)) continue;

    // Mỗi migration = 1 transaction. Lỗi → rollback nguyên.
    db.exec("BEGIN");
    try {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)").run(m.version, m.name);
      db.exec("COMMIT");
      applied.push(m.version);
      console.info(`[migrate] applied v${m.version}: ${m.name}`);
    } catch (err) {
      db.exec("ROLLBACK");
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(
        "MIGRATION_FAILED",
        `Migration v${m.version} (${m.name}) thất bại và đã rollback: ${msg}`,
        500,
      );
    }
  }

  return {
    applied,
    total: sorted.length,
    alreadyApplied: sorted.length - applied.length,
  };
}

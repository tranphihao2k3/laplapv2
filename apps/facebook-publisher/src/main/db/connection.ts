/**
 * SQLite connection module — Electron main process only.
 *
 * DB-001 acceptance:
 *  - File nằm trong app data (userData) của Electron, không phải install dir.
 *  - WAL: journal_mode = WAL → concurrency đọc tốt, ghi serial.
 *  - foreign_keys = ON để constraint FK có hiệu lực (SQLite mặc định OFF).
 *  - synchronous = NORMAL đi với WAL là an toàn và nhanh hơn FULL.
 *  - busy_timeout = 5000ms: tránh SQLITE_BUSY khi migration + UI đụng nhau.
 *
 * Không expose getter global — caller phải dùng `withConnection(fn)` để đảm
 * bảo close đúng (better-sqlite3 vẫn sync, nhưng runner sau này có thể thay).
 */
import Database from "better-sqlite3";
import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import { AppError } from "../../shared/errors";

const DB_FILE_NAME = "laplap-publisher.db";

export type DB = Database.Database;

let cached: DB | null = null;

/** Lấy đường dẫn userData/DB. Tách hàm để test inject path. */
export function resolveDbPath(customDir?: string): string {
  const dir = customDir ?? app.getPath("userData");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, DB_FILE_NAME);
}

/** Mở DB với pragmas an toàn. Trả singleton để tránh mở nhiều handle. */
export function openDb(customPath?: string): DB {
  if (cached) return cached;
  const dbPath = customPath ?? resolveDbPath();
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  cached = db;
  return db;
}

/** Đóng DB (chỉ dùng khi app quit hoặc test teardown). */
export function closeDb(): void {
  if (cached) {
    cached.close();
    cached = null;
  }
}

/** Helper: chạy fn trong context có DB, dùng cho repo/repository. */
export async function withConnection<T>(fn: (db: DB) => Promise<T> | T): Promise<T> {
  if (!cached) {
    throw new AppError("DB_NOT_OPEN", "Database chưa được mở — gọi openDb() trước", 500);
  }
  return fn(cached);
}

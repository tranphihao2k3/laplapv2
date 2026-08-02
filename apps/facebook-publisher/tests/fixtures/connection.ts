/**
 * Test helper: mở SQLite in-memory, enable foreign keys, run migrations.
 */
import Database from "better-sqlite3";
import { runMigrations } from "../../src/main/db/migrations";

export function connectMemoryDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

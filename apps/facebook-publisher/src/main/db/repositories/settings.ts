/**
 * SettingsRepository — typed wrapper quanh bảng `settings` (DB-001).
 *
 * Bảng settings là K/V generic (key PK, value_json TEXT). Repo ép schema
 * từ shared/settings.ts để:
 *  - Không cho ghi key không thuộc AppSettings.
 *  - Validate object trước khi serialize JSON.
 *  - Default trả về DEFAULT_SETTINGS khi DB rỗng (không phải undefined).
 *
 * APP-003 acceptance:
 *  - validate trước khi ghi (zod throw → không persist).
 *  - Đọc mặc định trả default nếu DB rỗng.
 *  - update partial OK, validate sau merge.
 */
import type Database from "better-sqlite3";
import { BaseRepo } from "./base";
import {
  applySettingsPatch,
  DEFAULT_SETTINGS,
  type AppSettings,
} from "../../../shared/settings";

const SETTINGS_KEY = "app";

export class SettingsRepository extends BaseRepo {
  private readonly readStmt: Database.Statement;
  private readonly upsertStmt: Database.Statement;

  constructor(db: Database.Database) {
    super(db);
    this.readStmt = db.prepare(`SELECT value_json, updated_at FROM settings WHERE key = ?`);
    this.upsertStmt = db.prepare(`
      INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `);
  }

  /** Đọc settings hiện tại. Nếu DB rỗng → trả DEFAULT_SETTINGS an toàn. */
  get(): AppSettings {
    const row = this.readStmt.get(SETTINGS_KEY) as
      | { value_json: string; updated_at: string }
      | undefined;
    if (!row) return { ...DEFAULT_SETTINGS };

    try {
      const parsed: unknown = JSON.parse(row.value_json);
      // Validate lại khi đọc: phòng trường hợp DB có data cũ đã lỗi thời.
      return applySettingsPatch(DEFAULT_SETTINGS, parsed);
    } catch {
      // value_json lỗi → fallback default, không crash app.
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Ghi đè toàn bộ settings. Validate qua `applySettingsPatch` (default +
   * override) trước khi serialize — đảm bảo DB luôn chứa schema hợp lệ.
   */
  set(next: AppSettings): void {
    // applySettingsPatch với current=DEFAULTS ép mọi field qua default
    // → nếu input thiếu field, field sẽ dùng default, không bao giờ
    // undefined.
    const safe = applySettingsPatch(DEFAULT_SETTINGS, next);
    this.upsertStmt.run(SETTINGS_KEY, JSON.stringify(safe), new Date().toISOString());
  }

  /**
   * Patch 1 phần settings. Validate cả object SAU merge để chắc chắn
   * patched value không vô hiệu hóa schema (vd timeout âm).
   */
  patch(patch: Partial<AppSettings>): AppSettings {
    const current = this.get();
    const next = applySettingsPatch(current, patch);
    this.set(next);
    return next;
  }

  /** Reset về DEFAULT_SETTINGS (xóa cũ + ghi default). */
  reset(): AppSettings {
    const def = { ...DEFAULT_SETTINGS };
    this.set(def);
    return def;
  }
}

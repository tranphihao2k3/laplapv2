/**
 * Base repository — DB-002.
 *
 * Mọi repo typed kế thừa class này. Cung cấp:
 *  - Reference tới better-sqlite3 database đã open.
 *  - Helper `transaction(fn)` chạy fn trong BEGIN..COMMIT, ROLLBACK khi throw.
 *
 * Nguyên tắc:
 *  - KHÔNG tự quản lý connection lifecycle (openDb/closeDb làm ở main).
 *    Repo chỉ nhận db đã mở để test in-memory dễ.
 *  - Mỗi method repo PHẢI dùng prepared statement (cache sẵn) — không
 *    string-concat SQL.
 *  - JSON columns (attributes_json, specs_json, image_paths_json, ...) được
 *    typed ở service layer, repo chỉ chứa string text SQLite.
 */
import type Database from "better-sqlite3";

export abstract class BaseRepo {
  constructor(protected readonly db: Database.Database) {}

  /**
   * Chạy `fn` trong transaction. Nếu fn throw → ROLLBACK nguyên, không
   * để lại bất kỳ thay đổi nào (rất quan trọng cho queue state).
   *
   * better-sqlite3 transaction() tự wrap trong SAVEPOINT nếu đã ở trong
   * transaction khác. Điều này cho phép service gọi repo.transac() lồng
   * nhau an toàn.
   */
  transaction<T>(fn: () => T): T {
    const tx = this.db.transaction(fn);
    return tx();
  }
}

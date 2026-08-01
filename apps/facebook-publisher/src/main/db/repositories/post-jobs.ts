/**
 * Repository cho post_jobs + job_attempts.
 *
 * Đây là queue của app. Các method cố ý giữ tính chất "an toàn khi crash":
 *  - Mỗi state transition đều insert 1 row vào `job_attempts` với from_state/
 *    to_state để restart recovery (xem QUE-003).
 *  - Tạo job mới dùng UNIQUE PARTIAL INDEX trên fingerprint để chống
 *    trùng lặp (xem CMP-003).
 *
 * DB-002 acceptance:
 *  - CRUD typed, không raw SQL ngoài repo.
 *  - Transition sai state bị chặn qua `assertTransition()` → không có
 *    draft → published nhảy cóc.
 */
import type Database from "better-sqlite3";
import { BaseRepo } from "./base";
import type { JobAttemptRow, JobState, PostJobRow } from "../../../shared/db-types";

/** Bảng transition hợp lệ theo docs §13. */
const VALID_TRANSITIONS: ReadonlyArray<readonly [JobState, JobState]> = [
  ["draft", "queued"],
  ["draft", "cancelled"],
  ["queued", "preflight"],
  ["queued", "cancelled"],
  ["queued", "skipped"],
  ["preflight", "posting"],
  ["preflight", "skipped"],
  ["preflight", "cancelled"],
  ["preflight", "needs_action"],
  ["posting", "awaiting_confirmation"],
  ["posting", "unverified"],
  ["posting", "needs_action"],
  ["posting", "failed"],
  ["awaiting_confirmation", "published"],
  ["awaiting_confirmation", "pending_approval"],
  ["awaiting_confirmation", "unverified"],
  ["awaiting_confirmation", "needs_action"],
  ["awaiting_confirmation", "failed"],
  ["needs_action", "queued"],
];

export class PostJobRepository extends BaseRepo {
  private readonly insertStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly listByStateStmt: Database.Statement;
  private readonly listByCampaignStmt: Database.Statement;
  private readonly countAttemptsStmt: Database.Statement;
  private readonly updateStateStmt: Database.Statement;
  private readonly insertAttemptStmt: Database.Statement;

  constructor(db: Database.Database) {
    super(db);
    this.insertStmt = db.prepare(`
      INSERT INTO post_jobs (id, campaign_id, group_id, state, fingerprint, snapshot_json)
      VALUES (@id, @campaign_id, @group_id, @state, @fingerprint, @snapshot_json)
    `);
    this.findByIdStmt = db.prepare(`SELECT * FROM post_jobs WHERE id = ?`);
    this.listByStateStmt = db.prepare(
      `SELECT * FROM post_jobs WHERE state = ? ORDER BY created_at ASC`,
    );
    this.listByCampaignStmt = db.prepare(
      `SELECT * FROM post_jobs WHERE campaign_id = ? ORDER BY created_at ASC`,
    );
    this.countAttemptsStmt = db.prepare(
      `SELECT COUNT(*) AS n FROM job_attempts WHERE job_id = ?`,
    );
    this.updateStateStmt = db.prepare(`
      UPDATE post_jobs
      SET state = @state, last_error_code = @last_error_code,
          last_error_message = @last_error_message,
          submit_clicked_at = COALESCE(@submit_clicked_at, submit_clicked_at),
          post_url = COALESCE(@post_url, post_url),
          updated_at = @updated_at
      WHERE id = @id
    `);
    this.insertAttemptStmt = db.prepare(`
      INSERT INTO job_attempts
        (id, job_id, attempt_number, from_state, to_state, error_code, error_message, ended_at)
      VALUES (@id, @job_id, @attempt_number, @from_state, @to_state, @error_code, @error_message, @ended_at)
    `);
  }

  /**
   * Tạo 1 job mới. Nếu fingerprint đã tồn tại ở state chưa kết thúc
   * (active per partial index) → throw UNIQUE.
   * Caller (service CMP-*) nên bắt lỗi để phân loại duplicate vs lỗi thật.
   */
  insert(input: Omit<PostJobRow, "created_at" | "updated_at" | "submit_clicked_at" | "post_url" | "last_error_code" | "last_error_message">): void {
    this.insertStmt.run({
      id: input.id,
      campaign_id: input.campaign_id,
      group_id: input.group_id,
      state: input.state,
      fingerprint: input.fingerprint,
      snapshot_json: input.snapshot_json ?? null,
    });
  }

  findById(id: string): PostJobRow | undefined {
    return this.findByIdStmt.get(id) as PostJobRow | undefined;
  }

  listByState(state: JobState): PostJobRow[] {
    return this.listByStateStmt.all(state) as PostJobRow[];
  }

  listByCampaign(campaignId: string): PostJobRow[] {
    return this.listByCampaignStmt.all(campaignId) as PostJobRow[];
  }

  /** Đếm attempts của 1 job (QUE-001, QUE-005). */
  countAttemptsForJob(jobId: string): number {
    const row = this.countAttemptsStmt.get(jobId) as { n: number };
    return row?.n ?? 0;
  }

  /** Lấy attempt log cho UI-002 (history detail). */
  listAttemptsForJob(jobId: string): JobAttemptRow[] {
    const stmt = this.db.prepare(
      `SELECT * FROM job_attempts WHERE job_id = ? ORDER BY attempt_number ASC`,
    );
    return stmt.all(jobId) as JobAttemptRow[];
  }

  /** Đếm theo state (queue control UI-001 progress). */
  countByState(state: JobState): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) AS n FROM post_jobs WHERE state = ?`);
    const row = stmt.get(state) as { n: number };
    return row?.n ?? 0;
  }

  /**
   * Transition state có kiểm tra transition table + ghi attempt.
   * Trả void nếu OK; throw nếu from → to không hợp lệ.
   *
   * Lưu ý: `submit_clicked_at` và `post_url` chỉ set 1 lần (qua COALESCE).
   * Muốn reset phải có method riêng (sẽ thuộc QUE-003 / recovery).
   */
  transition(input: {
    id: string;
    toState: JobState;
    attemptNumber: number;
    errorCode?: string | null;
    errorMessage?: string | null;
    submitClickedAt?: string | null;
    postUrl?: string | null;
  }): void {
    const job = this.findById(input.id);
    if (!job) throw new Error(`post_job ${input.id} not found`);

    assertTransition(job.state, input.toState);

    return this.transaction(() => {
      this.updateStateStmt.run({
        id: input.id,
        state: input.toState,
        last_error_code: input.errorCode ?? null,
        last_error_message: input.errorMessage ?? null,
        submit_clicked_at: input.submitClickedAt ?? null,
        post_url: input.postUrl ?? null,
        updated_at: new Date().toISOString(),
      });
      this.insertAttemptStmt.run({
        id: cryptoRandomId(),
        job_id: input.id,
        attempt_number: input.attemptNumber,
        from_state: job.state,
        to_state: input.toState,
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
        ended_at: new Date().toISOString(),
      });
    });
  }
}

/** Throw nếu from → to không có trong bảng transition. */
export function assertTransition(from: JobState, to: JobState): void {
  if (from === to) return; // idempotent (vd ghi lại attempt)
  const ok = VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
  if (!ok) {
    throw new Error(`Invalid post_job state transition: ${from} -> ${to}`);
  }
}

/** Random id 16 byte hex — đủ cho dev/test. Production nên dùng uuid lib. */
function cryptoRandomId(): string {
  // Node 18+ có crypto.randomUUID chuẩn.
  return globalThis.crypto.randomUUID();
}

export type { PostJobRow, JobAttemptRow, JobState };

/**
 * SerialWorker — QUE-002.
 *
 * Concurrency LUÔN = 1. Worker chỉ pick up job tiếp theo khi:
 *   - state === 'queued' (sau prefight thành công).
 *   - worker đang không pause.
 *   - emergency stop chưa bật.
 *
 * Lifecycle:
 *   start()           → bắt đầu vòng lặp; idempotent.
 *   pause()           → dừng nhận job mới, job hiện tại vẫn chạy tới hết.
 *   resume()          → tiếp tục nhận job.
 *   cancelPending()   → transition tất cả job state='queued' → 'cancelled'.
 *   cancelJob(id)     → transition 1 job → 'cancelled' (chỉ khi còn queued/awaiting_confirmation).
 *   emergencyStop()   → pause + cancel mọi job ở 'queued' hoặc 'awaiting_confirmation'.
 *
 * Worker KHÔNG tự gọi Playwright — caller truyền `runner` để giữ logic posting
 * tách khỏi queue (đúng kiến trúc).
 */
import type { PostJobRepository } from "../db/repositories/post-jobs";
import { QueueService } from "./queue-service";
import { AppError } from "../../shared/errors";
import type { PostJobRow, JobState } from "../../shared/db-types";

export type WorkerStatus = {
  running: boolean;
  paused: boolean;
  emergencyStop: boolean;
  currentJobId: string | null;
  /** UI: campaign/group chứa job đang chạy — để Active Job panel biết tên. */
  currentCampaignId: string | null;
  currentGroupId: string | null;
  /** UI: state tại lúc pick — luôn 'queued' ở thời điểm này (worker pick
   *  job queued). Renderer kết hợp với queueAttempts() để hiển thị
   *  step progress (preflight/posting/awaiting_confirmation). */
  currentState: JobState | null;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  totalSkipped: number;
};

export type WorkerRunner = (job: PostJobRow) => Promise<{
  toState: JobState;
  errorCode?: string;
  errorMessage?: string;
  postUrl?: string;
}>;

const TERMINAL_STATES: ReadonlySet<JobState> = new Set([
  "published",
  "pending_approval",
  "unverified",
  "needs_action",
  "failed",
  "skipped",
  "cancelled",
]);

export class SerialWorker {
  private status: WorkerStatus = {
    running: false,
    paused: false,
    emergencyStop: false,
    currentJobId: null,
    currentCampaignId: null,
    currentGroupId: null,
    currentState: null,
    totalProcessed: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    totalSkipped: 0,
  };
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly jobs: PostJobRepository,
    private readonly queueService: QueueService,
    private readonly runner: WorkerRunner,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {}

  getStatus(): WorkerStatus {
    return { ...this.status };
  }

  /**
   * Thay runner tại runtime. Dùng khi adapter thật chưa sẵn sàng lúc
   * ServiceLocator khởi tạo SerialWorker — main/index.ts sẽ gọi
   * setRunner() sau khi FacebookGroupAdapter + BrowserProfileManager đã
   * wired xong. Có guard "đổi giữa lúc đang chạy job" → chỉ thay khi
   * idle để tránh job đang chạy bị runner khác nhận.
   */
  setRunner(runner: WorkerRunner): void {
    if (this.status.currentJobId) {
      throw new AppError(
        "WORKER_BUSY",
        "Không thể đổi runner khi worker đang xử lý job. Pause worker và đợi idle.",
        409,
      );
    }
    (this as { runner: WorkerRunner }).runner = runner;
  }

  /** Bắt đầu worker. Idempotent. */
  start(): void {
    if (this.status.running) return;
    this.status.running = true;
    this.status.emergencyStop = false;
    this.loopPromise = this.loop().catch((err) => {
      // Loop chỉ throw khi lỗi không lường trước; log nhưng không kill app.
      console.error("[worker] loop crashed:", err);
    });
  }

  /** Pause: không nhận job mới; job hiện tại chạy tới hết rồi mới dừng. */
  pause(): void {
    this.status.paused = true;
  }

  /** Resume nhận job. */
  resume(): void {
    this.status.paused = false;
    this.status.emergencyStop = false;
  }

  /** Cancel mọi job state='queued'. Job đang chạy KHÔNG bị đụng. */
  cancelPending(): { cancelled: number } {
    const pending = this.jobs.listByStates(["queued"]);
    let cancelled = 0;
    for (const j of pending) {
      try {
        this.queueService.transition({ id: j.id, toState: "cancelled" });
        cancelled++;
      } catch {
        // ignore — job có thể đã chuyển state giữa chừng.
      }
    }
    return { cancelled };
  }

  /** Cancel 1 job. */
  cancelJob(id: string): void {
    const job = this.jobs.findById(id);
    if (!job) throw new AppError("JOB_NOT_FOUND", `Không tìm thấy job: ${id}`, 404);
    if (job.state !== "queued" && job.state !== "awaiting_confirmation" && job.state !== "preflight") {
      throw new AppError(
        "JOB_NOT_CANCELLABLE",
        `Job state '${job.state}' không thể cancel`,
        409,
      );
    }
    this.queueService.transition({ id, toState: "cancelled" });
  }

  /** Emergency stop: pause + cancel tất cả queued/awaiting_confirmation. */
  emergencyStop(): { paused: boolean; cancelled: number } {
    this.status.emergencyStop = true;
    this.status.paused = true;
    return { paused: true, cancelled: this.cancelPending().cancelled };
  }

  /** Đợi loop hiện tại kết thúc (dùng khi tắt app). */
  async stopAndWait(): Promise<void> {
    this.status.running = false;
    if (this.loopPromise) {
      await this.loopPromise.catch(() => undefined);
      this.loopPromise = null;
    }
  }

  private async loop(): Promise<void> {
    while (this.status.running) {
      if (this.status.paused || this.status.emergencyStop) {
        await this.sleep(500);
        continue;
      }
      const next = this.jobs.findNextQueued();
      if (!next) {
        await this.sleep(1000);
        continue;
      }
      this.status.currentJobId = next.id;
      this.status.currentCampaignId = next.campaign_id;
      this.status.currentGroupId = next.group_id;
      this.status.currentState = next.state;
      try {
        // Move queued → preflight → posting qua runner trả về.
        const result = await this.runner(next);
        this.queueService.transition({
          id: next.id,
          toState: result.toState,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          postUrl: result.postUrl,
        });
        this.status.totalProcessed++;
        if (result.toState === "published") this.status.totalSucceeded++;
        else if (result.toState === "failed" || result.toState === "unverified")
          this.status.totalFailed++;
        else if (result.toState === "skipped") this.status.totalSkipped++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        try {
          this.queueService.transition({
            id: next.id,
            toState: "failed",
            errorCode: "WORKER_RUNTIME_ERROR",
            errorMessage: message.slice(0, 2000),
          });
        } catch {
          // ignore — job có thể đã bị cancel.
        }
        this.status.totalProcessed++;
        this.status.totalFailed++;
      } finally {
        this.status.currentJobId = null;
        this.status.currentCampaignId = null;
        this.status.currentGroupId = null;
        this.status.currentState = null;
        // Backoff nhỏ giữa 2 job để tránh spam.
        await this.sleep(250);
      }
      if (TERMINAL_STATES.size === 0) break;
    }
  }
}

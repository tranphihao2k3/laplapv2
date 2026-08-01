/**
 * QueueService — QUE-001 + QUE-005.
 *
 * - assertTransition: chuyển state hợp lệ (đã có ở PostJobRepository);
 *   tầng service log lý do + attempt number.
 * - Retry policy (QUE-005):
 *     + retryable errors (network/timeout/5xx) → retry tối đa maxAttempts.
 *     + permission / checkpoint / unverified → KHÔNG auto retry.
 *     + backoff exponential (1s, 2s, 4s, 8s) capped ở maxBackoffMs.
 * - Cancel pending jobs (QUE-002 user control).
 */
import { AppError } from "../../shared/errors";
import {
  PostJobRepository,
  assertTransition as assertTransitionValid,
} from "../db/repositories/post-jobs";
import type { JobState } from "../../shared/db-types";

const RETRYABLE_ERROR_CODES = new Set([
  "IMAGE_DOWNLOAD_FAILED",
  "CATALOG_HTTP_ERROR",
  "AUTH_PROVIDER_UNAVAILABLE",
  "BROWSER_LAUNCH_FAILED",
]);

const NON_RETRYABLE_ERROR_CODES = new Set([
  "AUTH_BAD_CREDENTIALS",
  "GROUP_NOT_FOUND",
  "GROUP_BAD_URL",
  "TEMPLATE_VAR_NOT_ALLOWED",
  "TEMPLATE_BODY_TOO_LONG",
  "IMAGE_BAD_URL",
  "IMAGE_BAD_MIME",
  "IMAGE_TOO_LARGE",
  "IMAGE_HOST_DENIED",
  "UNVERIFIED", // sau khi đã click submit
  "NEEDS_ACTION", // checkpoint/CAPTCHA
  "NO_PERMISSION",
  "PENDING_APPROVAL",
]);

export type CancelResult = {
  cancelled: number;
  notFound: number;
};

export class QueueService {
  private readonly maxAttempts: number;
  private readonly maxBackoffMs: number;

  constructor(
    private readonly jobs: PostJobRepository,
    options?: { maxAttempts?: number; maxBackoffMs?: number },
  ) {
    this.maxAttempts = options?.maxAttempts ?? 3;
    this.maxBackoffMs = options?.maxBackoffMs ?? 30_000;
  }

  /** Transition với kiểm tra hợp lệ + ghi attempt log. */
  transition(input: {
    id: string;
    toState: JobState;
    errorCode?: string;
    errorMessage?: string;
    submitClickedAt?: string;
    postUrl?: string;
  }): { attemptNumber: number } {
    const job = this.jobs.findById(input.id);
    if (!job) throw new AppError("JOB_NOT_FOUND", `Không tìm thấy job: ${input.id}`, 404);
    assertTransitionValid(job.state, input.toState);
    const attemptNumber = this.nextAttemptNumber(input.id);
    this.jobs.transition({
      id: input.id,
      toState: input.toState,
      attemptNumber,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      submitClickedAt: input.submitClickedAt ?? null,
      postUrl: input.postUrl ?? null,
    });
    return { attemptNumber };
  }

  /** Đếm attempt đã có + 1. */
  private nextAttemptNumber(jobId: string): number {
    // Chỉ cần đếm nhanh — không select full rows. Dùng COUNT trong repo.
    const n = this.jobs.countAttemptsForJob(jobId);
    return n + 1;
  }

  /** Có thể retry job khi: state ∈ {failed, needs_action}, attempt < max, errorCode retryable. */
  canRetry(input: { jobId: string; errorCode?: string | null }): boolean {
    const job = this.jobs.findById(input.jobId);
    if (!job) return false;
    if (job.state !== "failed" && job.state !== "needs_action") return false;
    const attempts = this.jobs.countAttemptsForJob(input.jobId);
    if (attempts >= this.maxAttempts) return false;
    if (input.errorCode && NON_RETRYABLE_ERROR_CODES.has(input.errorCode)) return false;
    if (input.errorCode && !RETRYABLE_ERROR_CODES.has(input.errorCode)) return false;
    return true;
  }

  /** Backoff exponential: 1s, 2s, 4s, 8s, cap maxBackoffMs. */
  backoffMs(attemptNumber: number): number {
    const base = 1000;
    const ms = base * 2 ** Math.max(0, attemptNumber - 1);
    return Math.min(ms, this.maxBackoffMs);
  }

  /**
   * Cancel tất cả job pending (state ∈ {draft, queued, preflight, posting,
   * awaiting_confirmation, needs_action}) của campaign. KHÔNG cancel
   * job đã done.
   */
  cancelPendingByCampaign(campaignId: string): CancelResult {
    const jobs = this.jobs.listByCampaign(campaignId);
    let cancelled = 0;
    let notFound = 0;
    for (const job of jobs) {
      const ACTIVE: JobState[] = [
        "draft",
        "queued",
        "preflight",
        "posting",
        "awaiting_confirmation",
        "needs_action",
      ];
      if (!ACTIVE.includes(job.state)) {
        notFound += 1;
        continue;
      }
      try {
        assertTransitionValid(job.state, "cancelled");
        this.jobs.transition({
          id: job.id,
          toState: "cancelled",
          attemptNumber: this.nextAttemptNumber(job.id),
        });
        cancelled += 1;
      } catch {
        notFound += 1;
      }
    }
    return { cancelled, notFound };
  }

  /** Cancel 1 job. */
  cancelJob(jobId: string): void {
    const job = this.jobs.findById(jobId);
    if (!job) throw new AppError("JOB_NOT_FOUND", `Không tìm thấy job: ${jobId}`, 404);
    this.transition({ id: jobId, toState: "cancelled" });
  }
}
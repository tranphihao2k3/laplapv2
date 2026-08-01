/**
 * RecoveryService — QUE-003.
 *
 * Khi app khởi động lại, đối chiếu phase + submitClickedAt:
 *  - Phase trước submit_clicked → requeue (set state=queued, cho retry).
 *  - Phase sau submit_clicked → set state=unverified (KHÔNG requeue).
 *    User phải xem queue history và xác nhận thủ công.
 *
 * Lý do: trước click, ta chưa ảnh hưởng Facebook; sau click, ta không
 * biết bài có đăng thật không → unverified chờ user.
 */
import { PostJobRepository, assertTransition } from "../db/repositories/post-jobs";
import { QueueService } from "./queue-service";
import type { JobState } from "../../shared/db-types";

const PRE_SUBMIT_STATES: JobState[] = [
  "queued",
  "preflight",
  "posting",
];

const POST_SUBMIT_STATES: JobState[] = [
  "awaiting_confirmation",
];

export type RecoveryReport = {
  requeued: number;
  markedUnverified: number;
  skipped: number;
};

export class RecoveryService {
  constructor(
    private readonly jobs: PostJobRepository,
    private readonly queue: QueueService,
  ) {}

  /** Quét tất cả job active và áp recovery rule. */
  runOnStartup(): RecoveryReport {
    const r: RecoveryReport = { requeued: 0, markedUnverified: 0, skipped: 0 };
    for (const state of ["preflight", "posting", "awaiting_confirmation"] as JobState[]) {
      const list = this.jobs.listByState(state);
      for (const job of list) {
        if (job.submit_clicked_at === null) {
          // Chưa click → requeue.
          if (PRE_SUBMIT_STATES.includes(job.state)) {
            try {
              assertTransition(job.state, "queued");
              this.jobs.transition({
                id: job.id,
                toState: "queued",
                attemptNumber: this.jobs.countAttemptsForJob(job.id) + 1,
              });
              r.requeued += 1;
            } catch {
              r.skipped += 1;
            }
          } else {
            r.skipped += 1;
          }
        } else {
          // Đã click → unverified.
          if (POST_SUBMIT_STATES.includes(job.state)) {
            try {
              assertTransition(job.state, "unverified");
              this.jobs.transition({
                id: job.id,
                toState: "unverified",
                attemptNumber: this.jobs.countAttemptsForJob(job.id) + 1,
              });
              r.markedUnverified += 1;
            } catch {
              r.skipped += 1;
            }
          } else {
            r.skipped += 1;
          }
        }
      }
    }
    return r;
  }
}
/**
 * Shared queue / recovery / preflight types — M5.
 */
import type { JobState } from "./db-types";

export type { JobState };

export type RecoveryReport = {
  requeued: number;
  markedUnverified: number;
  skipped: number;
};

export type PreflightResult =
  | { kind: "ok"; priceChanged: boolean; updatedAtChanged: boolean }
  | { kind: "out_of_stock" }
  | { kind: "product_archived" }
  | { kind: "token_expired" }
  | { kind: "network_error"; message: string };

export type JobAttemptRecord = {
  id: string;
  jobId: string;
  attemptNumber: number;
  fromState: JobState | null;
  toState: JobState;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  endedAt: string | null;
};

export type QueueCount = {
  state: JobState;
  count: number;
};

export type WorkerStatus = {
  running: boolean;
  paused: boolean;
  emergencyStop: boolean;
  currentJobId: string | null;
  currentCampaignId: string | null;
  currentGroupId: string | null;
  /** State tại lúc worker pick job — luôn 'queued'. Renderer kết hợp
   *  với queueAttempts() để hiển thị step progress. */
  currentState: JobState | null;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  totalSkipped: number;
};
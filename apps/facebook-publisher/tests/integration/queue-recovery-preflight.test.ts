/**
 * QUE-001/002/003/004/005 — Queue state machine + recovery + preflight.
 */
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/main/db/migrations";
import { PostJobRepository } from "../../src/main/db/repositories/post-jobs";
import { QueueService } from "../../src/main/services/queue-service";
import { RecoveryService } from "../../src/main/services/recovery-service";
import { PreflightService } from "../../src/main/services/preflight-service";
import { SettingsRepository } from "../../src/main/db/repositories/settings";

let db: Database.Database;
let jobs: PostJobRepository;
let settings: SettingsRepository;
let queue: QueueService;
let recovery: RecoveryService;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  jobs = new PostJobRepository(db);
  settings = new SettingsRepository(db);
  queue = new QueueService(jobs);
  recovery = new RecoveryService(jobs, queue);
});

afterEach(() => db.close());

function seedJob(state: "queued" | "preflight" | "posting" | "awaiting_confirmation", submitClickedAt: string | null) {
  jobs.insert({
    id: `00000000-0000-0000-0000-00000000${state.slice(0, 4).padStart(4, "0")}`,
    campaign_id: "00000000-0000-0000-0000-00000000c001",
    group_id: "00000000-0000-0000-0000-00000000g001",
    state,
    fingerprint: "fp" + state,
    snapshot_json: null,
  });
  if (submitClickedAt) {
    db.prepare(`UPDATE post_jobs SET submit_clicked_at = ?`).run(submitClickedAt);
  }
}

describe("QueueService.canRetry", () => {
  it("retryable: failed + NETWORK", () => {
    jobs.insert({
      id: "00000000-0000-0000-0000-00000000r001",
      campaign_id: "00000000-0000-0000-0000-00000000c001",
      group_id: "00000000-0000-0000-0000-00000000g001",
      state: "failed",
      fingerprint: "fpr1",
      snapshot_json: null,
    });
    expect(queue.canRetry({ jobId: "00000000-0000-0000-0000-00000000r001", errorCode: "CATALOG_HTTP_ERROR" })).toBe(true);
  });

  it("non-retryable: AUTH_BAD_CREDENTIALS", () => {
    jobs.insert({
      id: "00000000-0000-0000-0000-00000000r002",
      campaign_id: "00000000-0000-0000-0000-00000000c001",
      group_id: "00000000-0000-0000-0000-00000000g001",
      state: "failed",
      fingerprint: "fpr2",
      snapshot_json: null,
    });
    expect(queue.canRetry({ jobId: "00000000-0000-0000-0000-00000000r002", errorCode: "AUTH_BAD_CREDENTIALS" })).toBe(false);
  });

  it("non-retryable: UNVERIFIED", () => {
    jobs.insert({
      id: "00000000-0000-0000-0000-00000000r003",
      campaign_id: "00000000-0000-0000-0000-00000000c001",
      group_id: "00000000-0000-0000-0000-00000000g001",
      state: "failed",
      fingerprint: "fpr3",
      snapshot_json: null,
    });
    expect(queue.canRetry({ jobId: "00000000-0000-0000-0000-00000000r003", errorCode: "UNVERIFIED" })).toBe(false);
  });

  it("quá maxAttempts thì không retry", () => {
    jobs.insert({
      id: "00000000-0000-0000-0000-00000000r004",
      campaign_id: "00000000-0000-0000-0000-00000000c001",
      group_id: "00000000-0000-0000-0000-00000000g001",
      state: "failed",
      fingerprint: "fpr4",
      snapshot_json: null,
    });
    // Tạo 3 attempt.
    for (let i = 1; i <= 3; i++) {
      queue.transition({
        id: "00000000-0000-0000-0000-00000000r004",
        toState: "failed",
        errorCode: "CATALOG_HTTP_ERROR",
        errorMessage: "attempt " + i,
      });
    }
    expect(queue.canRetry({ jobId: "00000000-0000-0000-0000-00000000r004", errorCode: "CATALOG_HTTP_ERROR" })).toBe(false);
  });
});

describe("QueueService.backoffMs", () => {
  it("exponential capped 30s", () => {
    expect(queue.backoffMs(1)).toBe(1000);
    expect(queue.backoffMs(2)).toBe(2000);
    expect(queue.backoffMs(3)).toBe(4000);
    expect(queue.backoffMs(4)).toBe(8000);
    expect(queue.backoffMs(5)).toBe(16000);
    expect(queue.backoffMs(6)).toBe(30000); // cap
    expect(queue.backoffMs(10)).toBe(30000);
  });
});

describe("RecoveryService.runOnStartup", () => {
  it("pre-submit job → requeue", () => {
    seedJob("posting", null);
    const r = recovery.runOnStartup();
    expect(r.requeued).toBe(1);
    expect(r.markedUnverified).toBe(0);
    const job = jobs.findById("00000000-0000-0000-0000-00000000post");
    expect(job?.state).toBe("queued");
  });

  it("post-submit job → unverified", () => {
    seedJob("awaiting_confirmation", "2026-08-01T10:00:00Z");
    const r = recovery.runOnStartup();
    expect(r.markedUnverified).toBe(1);
    const job = jobs.findById("00000000-0000-0000-0000-00000000awai");
    expect(job?.state).toBe("unverified");
  });

  it("mixed: 2 pre-submit + 1 post-submit", () => {
    seedJob("preflight", null);
    seedJob("posting", null);
    seedJob("awaiting_confirmation", "2026-08-01T10:00:00Z");
    const r = recovery.runOnStartup();
    expect(r.requeued).toBe(2);
    expect(r.markedUnverified).toBe(1);
  });
});

describe("PreflightService.run — typed result", () => {
  it("không có snapshot → JOB_NO_SNAPSHOT", async () => {
    jobs.insert({
      id: "00000000-0000-0000-0000-00000000p001",
      campaign_id: "00000000-0000-0000-0000-00000000c001",
      group_id: "00000000-0000-0000-0000-00000000g001",
      state: "queued",
      fingerprint: "fpp1",
      snapshot_json: null,
    });
    const svc = new PreflightService(jobs, settings);
    await expect(
      svc.run({
        jobId: "00000000-0000-0000-0000-00000000p001",
        apiBaseUrl: "https://api.laplap.vn",
        accessToken: "t",
      }),
    ).rejects.toThrowError(/JOB_NO_SNAPSHOT/);
  });

  it("401 → token_expired", async () => {
    jobs.insert({
      id: "00000000-0000-0000-0000-00000000p002",
      campaign_id: "00000000-0000-0000-0000-00000000c001",
      group_id: "00000000-0000-0000-0000-00000000g001",
      state: "queued",
      fingerprint: "fpp2",
      snapshot_json: JSON.stringify({
        capturedAt: "2026-08-01T00:00:00Z",
        product: { productId: "p1", name: "P", slug: null, shortDescription: null, thumbnailUrl: null, updatedAt: null },
        variant: { variantId: "v1", sku: "S", name: null, sellingPrice: 100, availableQty: 10, isActive: true },
        template: { templateId: "t1", name: "T", body: "" },
        group: { groupId: "g1", name: "G", url: "" },
        images: { urls: [], paths: [], sha256s: [] },
        renderedText: "",
      }),
    });
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "{}",
        json: async () => ({}),
      }) as Response);
    try {
      const svc = new PreflightService(jobs, settings);
      const result = await svc.run({
        jobId: "00000000-0000-0000-0000-00000000p002",
        apiBaseUrl: "https://api.laplap.vn",
        accessToken: "t",
      });
      expect(result.kind).toBe("token_expired");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("archived → product_archived", async () => {
    jobs.insert({
      id: "00000000-0000-0000-0000-00000000p003",
      campaign_id: "00000000-0000-0000-0000-00000000c001",
      group_id: "00000000-0000-0000-0000-00000000g001",
      state: "queued",
      fingerprint: "fpp3",
      snapshot_json: JSON.stringify({
        capturedAt: "2026-08-01T00:00:00Z",
        product: { productId: "p1", name: "P", slug: null, shortDescription: null, thumbnailUrl: null, updatedAt: null },
        variant: { variantId: "v1", sku: "S", name: null, sellingPrice: 100, availableQty: 10, isActive: true },
        template: { templateId: "t1", name: "T", body: "" },
        group: { groupId: "g1", name: "G", url: "" },
        images: { urls: [], paths: [], sha256s: [] },
        renderedText: "",
      }),
    });
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ id: "p1", status: "archived", updatedAt: null, variants: [] }),
        json: async () => ({}),
      }) as Response;
    try {
      const svc = new PreflightService(jobs, settings);
      const result = await svc.run({
        jobId: "00000000-0000-0000-0000-00000000p003",
        apiBaseUrl: "https://api.laplap.vn",
        accessToken: "t",
      });
      expect(result.kind).toBe("product_archived");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("availableQty=0 → out_of_stock", async () => {
    jobs.insert({
      id: "00000000-0000-0000-0000-00000000p004",
      campaign_id: "00000000-0000-0000-0000-00000000c001",
      group_id: "00000000-0000-0000-0000-00000000g001",
      state: "queued",
      fingerprint: "fpp4",
      snapshot_json: JSON.stringify({
        capturedAt: "2026-08-01T00:00:00Z",
        product: { productId: "p1", name: "P", slug: null, shortDescription: null, thumbnailUrl: null, updatedAt: null },
        variant: { variantId: "v1", sku: "S", name: null, sellingPrice: 100, availableQty: 10, isActive: true },
        template: { templateId: "t1", name: "T", body: "" },
        group: { groupId: "g1", name: "G", url: "" },
        images: { urls: [], paths: [], sha256s: [] },
        renderedText: "",
      }),
    });
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ id: "p1", status: "active", updatedAt: null, variants: [{ id: "v1", sellingPrice: 100, availableQty: 0, isActive: true }] }),
        json: async () => ({}),
      }) as Response;
    try {
      const svc = new PreflightService(jobs, settings);
      const result = await svc.run({
        jobId: "00000000-0000-0000-0000-00000000p004",
        apiBaseUrl: "https://api.laplap.vn",
        accessToken: "t",
      });
      expect(result.kind).toBe("out_of_stock");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("giá khác → ok + priceChanged true", async () => {
    jobs.insert({
      id: "00000000-0000-0000-0000-00000000p005",
      campaign_id: "00000000-0000-0000-0000-00000000c001",
      group_id: "00000000-0000-0000-0000-00000000g001",
      state: "queued",
      fingerprint: "fpp5",
      snapshot_json: JSON.stringify({
        capturedAt: "2026-08-01T00:00:00Z",
        product: { productId: "p1", name: "P", slug: null, shortDescription: null, thumbnailUrl: null, updatedAt: "2026-08-01T00:00:00Z" },
        variant: { variantId: "v1", sku: "S", name: null, sellingPrice: 100, availableQty: 10, isActive: true },
        template: { templateId: "t1", name: "T", body: "" },
        group: { groupId: "g1", name: "G", url: "" },
        images: { urls: [], paths: [], sha256s: [] },
        renderedText: "",
      }),
    });
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ id: "p1", status: "active", updatedAt: "2026-08-01T00:00:00Z", variants: [{ id: "v1", sellingPrice: 200, availableQty: 10, isActive: true }] }),
        json: async () => ({}),
      }) as Response;
    try {
      const svc = new PreflightService(jobs, settings);
      const result = await svc.run({
        jobId: "00000000-0000-0000-0000-00000000p005",
        apiBaseUrl: "https://api.laplap.vn",
        accessToken: "t",
      });
      expect(result.kind).toBe("ok");
      if (result.kind === "ok") {
        expect(result.priceChanged).toBe(true);
        expect(result.updatedAtChanged).toBe(false);
      }
    } finally {
      globalThis.fetch = original;
    }
  });
});
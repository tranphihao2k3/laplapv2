/**
 * SerialWorker tests — QUE-002.
 *
 * Concurrency luôn = 1; start/pause/resume/cancel/emergencyStop.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SerialWorker } from "../../src/main/services/serial-worker";
import { QueueService } from "../../src/main/services/queue-service";
import { PostJobRepository } from "../../src/main/db/repositories/post-jobs";
import { CampaignRepository } from "../../src/main/db/repositories/campaigns";
import { FacebookGroupRepository } from "../../src/main/db/repositories/facebook-groups";
import { TemplateRepository } from "../../src/main/db/repositories/templates";
import { ProductRepository } from "../../src/main/db/repositories/products";
import { runMigrations } from "../../src/main/db/migrations";
import { CampaignService } from "../../src/main/services/campaign-service";
import type { PostJobRow, JobState } from "../../src/shared/db-types";
import { connectMemoryDb } from "../fixtures/connection";

function dummySnapshot() {
  return {
    product: {
      id: "p1",
      name: "P1",
      slug: "p1",
      shortDescription: null,
      thumbnailUrl: null,
      updatedAt: "2026-08-01T00:00:00Z",
      status: "active",
      productUrl: null,
      syncedAt: "2026-08-01T00:00:00Z",
      variantsCount: 1,
      inStock: true,
    },
    variant: {
      productId: "p1",
      variantId: "v1",
      sku: "v1",
      name: null,
      attributes: null,
      specs: null,
      sellingPrice: 100,
      isActive: true,
      availableQty: 5,
      syncedAt: "2026-08-01T00:00:00Z",
    },
    template: {
      body: "{{product.name}} — {{variant.sku}}",
      bodyHash: "h",
      allowlistedVariables: ["product.name", "variant.sku"],
      previewContext: {},
    },
    group: { id: "g1", name: "G1", url: "https://facebook.com/groups/g1" },
    images: [],
    fingerprint: "fp1",
    renderedText: "P1 — v1",
  };
}

function makeHarness() {
  const db = connectMemoryDb();
  runMigrations(db as any);
  const products = new ProductRepository(db as any);
  const templateRepo = new TemplateRepository(db as any);
  const groupRepo = new FacebookGroupRepository(db as any);
  const campaignRepo = new CampaignRepository(db as any);
  const jobs = new PostJobRepository(db as any);

  products.upsertProduct({
    id: "p1",
    organization_id: "org1",
    name: "P1",
    slug: "p1",
    short_description: null,
    thumbnail_url: null,
    updated_at: "2026-08-01T00:00:00Z",
    status: "active",
    product_url: null,
    synced_at: "2026-08-01T00:00:00Z",
  } as any);
  products.upsertVariant({
    product_id: "p1",
    variant_id: "v1",
    sku: "v1",
    name: null,
    attributes: null,
    specs: null,
    selling_price: 100,
    is_active: 1,
    available_qty: 5,
    synced_at: "2026-08-01T00:00:00Z",
  } as any);
  templateRepo.insert({
    id: "t1",
    name: "t1",
    body: "{{product.name}} — {{variant.sku}}",
    allowlistedVariables: ["product.name", "variant.sku"],
  } as any);
  groupRepo.create({
    id: "g1",
    name: "G1",
    url: "https://facebook.com/groups/g1",
    enabled: 1,
    posting_mode: "assisted",
  } as any);

  const queueService = new QueueService(jobs, { maxAttempts: 3, maxBackoffMs: 1000 });

  // Enqueue 3 jobs để test concurrency.
  for (let i = 0; i < 3; i++) {
    jobs.insert({
      id: `j${i}`,
      campaign_id: null,
      group_id: "g1",
      state: "queued",
      fingerprint: `fp${i}`,
      snapshot_json: JSON.stringify(dummySnapshot()),
    } as any);
  }
  return { db, jobs, queueService };
}

describe("SerialWorker — QUE-002", () => {
  let harness: ReturnType<typeof makeHarness>;

  beforeEach(() => {
    harness = makeHarness();
  });
  afterEach(() => {
    harness.db.close();
  });

  it("start + runner pick queued jobs sequentially", async () => {
    const order: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const worker = new SerialWorker(
      harness.jobs,
      harness.queueService,
      async (job: PostJobRow) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        order.push(job.id);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return { toState: "published" as JobState };
      },
      (ms) => new Promise((r) => setTimeout(r, ms)),
    );
    worker.start();
    // Wait for processing.
    const start = Date.now();
    while (Date.now() - start < 3000) {
      if (worker.getStatus().totalProcessed >= 3) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    await worker.stopAndWait();
    expect(maxInFlight).toBe(1); // concurrency === 1
    expect(order.sort()).toEqual(["j0", "j1", "j2"]);
    expect(worker.getStatus().totalSucceeded).toBe(3);
  });

  it("pause + resume: job hiện tại vẫn chạy, không pick mới", async () => {
    let startedNewJobs = 0;
    const worker = new SerialWorker(
      harness.jobs,
      harness.queueService,
      async (job) => {
        startedNewJobs++;
        return { toState: "published" };
      },
    );
    worker.start();
    // Đợi job đầu xong
    const start = Date.now();
    while (Date.now() - start < 1000 && worker.getStatus().totalProcessed < 1) {
      await new Promise((r) => setTimeout(r, 20));
    }
    worker.pause();
    const processedBefore = worker.getStatus().totalProcessed;
    await new Promise((r) => setTimeout(r, 500));
    expect(worker.getStatus().totalProcessed).toBe(processedBefore);
    worker.resume();
    const start2 = Date.now();
    while (Date.now() - start2 < 3000 && worker.getStatus().totalProcessed < 3) {
      await new Promise((r) => setTimeout(r, 50));
    }
    await worker.stopAndWait();
    expect(worker.getStatus().totalProcessed).toBe(3);
  });

  it("cancelPending chuyển queued → cancelled", () => {
    const w = new SerialWorker(harness.jobs, harness.queueService, async () => ({
      toState: "published",
    }));
    const r = w.cancelPending();
    expect(r.cancelled).toBe(3);
    expect(harness.jobs.listByState("cancelled")).toHaveLength(3);
  });

  it("emergencyStop pause + cancel queued", async () => {
    const w = new SerialWorker(harness.jobs, harness.queueService, async () => ({
      toState: "published",
    }));
    w.start();
    await new Promise((r) => setTimeout(r, 100));
    const r = w.emergencyStop();
    expect(r.paused).toBe(true);
    await w.stopAndWait();
    expect(w.getStatus().paused).toBe(true);
    expect(w.getStatus().emergencyStop).toBe(true);
  });
});

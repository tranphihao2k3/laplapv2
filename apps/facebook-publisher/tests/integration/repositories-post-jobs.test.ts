/**
 * DB-002 — PostJobRepository unit tests.
 *
 * Focus: state transition table + transaction boundary + fingerprint dedupe.
 */
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/main/db/migrations";
import {
  PostJobRepository,
  assertTransition,
} from "../../src/main/db/repositories/post-jobs";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  seedRequiredParents();
});

afterEach(() => {
  db.close();
});

/** Tạo campaign, variant, group, template — tối thiểu để insert post_jobs. */
function seedRequiredParents(): void {
  db.prepare(
    "INSERT INTO product_cache (product_id, org_id, name, status, synced_at) VALUES (?, ?, ?, ?, ?)",
  ).run("p1", "org1", "X", "active", "2026-08-01T00:00:00Z");
  db.prepare(
    "INSERT INTO variant_cache (variant_id, product_id, sku, is_active, available_qty, synced_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run("v1", "p1", "SKU-X", 1, 1, "2026-08-01T00:00:00Z");
  db.prepare("INSERT INTO facebook_groups (id, name, url) VALUES (?, ?, ?)").run(
    "g1",
    "G",
    "https://facebook.com/groups/g1",
  );
  db.prepare(
    "INSERT INTO templates (id, name, body, allowlisted_variables_json) VALUES (?, ?, ?, ?)",
  ).run("t1", "T", "{{name}}", "[]");
  db.prepare(
    "INSERT INTO campaigns (id, name, product_id, variant_id, template_id, image_paths_json, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("c1", "C", "p1", "v1", "t1", "[]", "draft");
}

describe("assertTransition (docs §13 transition table)", () => {
  it("cho phép các transition hợp lệ", () => {
    expect(() => assertTransition("draft", "queued")).not.toThrow();
    expect(() => assertTransition("queued", "preflight")).not.toThrow();
    expect(() => assertTransition("preflight", "posting")).not.toThrow();
    expect(() =>
      assertTransition("awaiting_confirmation", "unverified"),
    ).not.toThrow();
    expect(() => assertTransition("needs_action", "queued")).not.toThrow();
  });

  it("chặn transition nhảy cóc hoặc ngược", () => {
    expect(() => assertTransition("draft", "published")).toThrowError(/Invalid/);
    expect(() => assertTransition("published", "draft")).toThrowError(/Invalid/);
    expect(() => assertTransition("queued", "awaiting_confirmation")).toThrowError(
      /Invalid/,
    );
    expect(() => assertTransition("cancelled", "queued")).toThrowError(/Invalid/);
  });

  it("idempotent same state OK", () => {
    expect(() => assertTransition("preflight", "preflight")).not.toThrow();
  });
});

describe("PostJobRepository — CRUD", () => {
  it("insert + findById + listByState", () => {
    const repo = new PostJobRepository(db);
    repo.insert({
      id: "j1",
      campaign_id: "c1",
      group_id: "g1",
      state: "queued",
      fingerprint: "fp1",
    });
    repo.insert({
      id: "j2",
      campaign_id: "c1",
      group_id: "g1",
      state: "failed",
      fingerprint: "fp2",
    });

    expect(repo.findById("j1")?.state).toBe("queued");
    expect(repo.listByState("queued").map((j) => j.id)).toEqual(["j1"]);
    expect(repo.listByCampaign("c1")).toHaveLength(2);
  });

  it("fingerprint UNIQUE PARTIAL: trùng ở state queued bị chặn", () => {
    const repo = new PostJobRepository(db);
    repo.insert({
      id: "j1",
      campaign_id: "c1",
      group_id: "g1",
      state: "queued",
      fingerprint: "fp-same",
    });
    expect(() =>
      repo.insert({
        id: "j2",
        campaign_id: "c1",
        group_id: "g1",
        state: "queued",
        fingerprint: "fp-same",
      }),
    ).toThrowError(/UNIQUE/i);
  });

  it("fingerprint trùng nhưng state đã kết thúc (failed) thì OK", () => {
    const repo = new PostJobRepository(db);
    repo.insert({
      id: "j1",
      campaign_id: "c1",
      group_id: "g1",
      state: "failed",
      fingerprint: "fp-same",
    });
    expect(() =>
      repo.insert({
        id: "j2",
        campaign_id: "c1",
        group_id: "g1",
        state: "queued",
        fingerprint: "fp-same",
      }),
    ).not.toThrow();
  });
});

describe("PostJobRepository — transition + transaction", () => {
  it("transition queue → preflight insert attempt + update state", () => {
    const repo = new PostJobRepository(db);
    repo.insert({
      id: "j1",
      campaign_id: "c1",
      group_id: "g1",
      state: "queued",
      fingerprint: "fp",
    });

    repo.transition({
      id: "j1",
      toState: "preflight",
      attemptNumber: 1,
    });

    const job = repo.findById("j1");
    expect(job?.state).toBe("preflight");

    const attempts = db
      .prepare(
        "SELECT from_state, to_state FROM job_attempts WHERE job_id = ? ORDER BY attempt_number",
      )
      .all("j1") as { from_state: string; to_state: string }[];
    expect(attempts).toEqual([{ from_state: "queued", to_state: "preflight" }]);
  });

  it("transition invalid throw, DB không thay đổi", () => {
    const repo = new PostJobRepository(db);
    repo.insert({
      id: "j1",
      campaign_id: "c1",
      group_id: "g1",
      state: "queued",
      fingerprint: "fp",
    });
    expect(() =>
      repo.transition({
        id: "j1",
        toState: "published", // nhảy cóc
        attemptNumber: 1,
      }),
    ).toThrowError(/Invalid/);

    const job = repo.findById("j1");
    expect(job?.state).toBe("queued"); // không đổi
    const attempts = db
      .prepare("SELECT COUNT(*) AS n FROM job_attempts WHERE job_id = ?")
      .get("j1") as { n: number };
    expect(attempts.n).toBe(0); // không có attempt vì transaction rollback
  });

  it("transition có errorCode ghi vào job + attempt", () => {
    const repo = new PostJobRepository(db);
    repo.insert({
      id: "j1",
      campaign_id: "c1",
      group_id: "g1",
      state: "preflight",
      fingerprint: "fp",
    });
    repo.transition({
      id: "j1",
      toState: "needs_action",
      attemptNumber: 1,
      errorCode: "FACEBOOK_CHECKPOINT",
      errorMessage: "Facebook yêu cầu xác minh",
    });

    const job = repo.findById("j1");
    expect(job?.state).toBe("needs_action");
    expect(job?.last_error_code).toBe("FACEBOOK_CHECKPOINT");
  });
});

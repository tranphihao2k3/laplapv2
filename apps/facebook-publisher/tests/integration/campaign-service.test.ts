/**
 * CMP-001/002/003 — CampaignService + fingerprint tests.
 */
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/main/db/migrations";
import { ProductRepository } from "../../src/main/db/repositories/products";
import { TemplateRepository } from "../../src/main/db/repositories/templates";
import { CampaignRepository } from "../../src/main/db/repositories/campaigns";
import { PostJobRepository } from "../../src/main/db/repositories/post-jobs";
import { FacebookGroupRepository, GroupSetRepository } from "../../src/main/db/repositories/facebook-groups";
import { CampaignService } from "../../src/main/services/campaign-service";
import { computeFingerprint, normalizeText } from "../../src/main/jobs/fingerprint";

let db: Database.Database;
let products: ProductRepository;
let templates: TemplateRepository;
let campaigns: CampaignRepository;
let jobs: PostJobRepository;
let groups: FacebookGroupRepository;
let sets: GroupSetRepository;
let svc: CampaignService;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  products = new ProductRepository(db);
  templates = new TemplateRepository(db);
  campaigns = new CampaignRepository(db);
  jobs = new PostJobRepository(db);
  groups = new FacebookGroupRepository(db);
  sets = new GroupSetRepository(db);
  svc = new CampaignService(campaigns, jobs, products, templates, groups, sets);

  // Seed: 1 product, 1 variant, 1 template, 2 groups.
  products.upsertProduct(
    {
      product_id: "00000000-0000-0000-0000-000000000001",
      org_id: "default-org",
      name: "Laptop A",
      slug: "laptop-a",
      short_description: "Mô tả",
      thumbnail_url: null,
      status: "active",
      product_url: null,
      updated_at: "2026-08-01T00:00:00Z",
      raw_json: null,
    },
    "2026-08-01T00:00:00Z",
  );
  products.upsertVariant(
    {
      variant_id: "00000000-0000-0000-0000-000000000010",
      product_id: "00000000-0000-0000-0000-000000000001",
      sku: "SKU-1",
      name: "Bản 16GB",
      attributes_json: null,
      specs_json: null,
      selling_price: 2000000,
      is_active: 1,
      available_qty: 10,
    },
    "2026-08-01T00:00:00Z",
  );
  templates.insert({
    id: "00000000-0000-0000-0000-000000000100",
    name: "T1",
    body: "{{product.name}} - {{variant.price}}",
    allowlisted_variables_json: "[]",
    content_text: null,
  });
  groups.insert({
    id: "00000000-0000-0000-0000-000000001000",
    name: "G1",
    url: "https://facebook.com/groups/g1",
    enabled: 1,
    locale: null,
    notes: null,
    max_images: 10,
    allow_link: 1,
    posting_mode: "assisted",
  });
  groups.insert({
    id: "00000000-0000-0000-0000-000000001001",
    name: "G2",
    url: "https://facebook.com/groups/g2",
    enabled: 1,
    locale: null,
    notes: null,
    max_images: 10,
    allow_link: 1,
    posting_mode: "assisted",
  });
});

afterEach(() => db.close());

describe("fingerprint", () => {
  it("computeFingerprint: ổn định cho cùng input", () => {
    const a = computeFingerprint({
      groupId: "g1",
      variantId: "v1",
      renderedText: "Hello",
      imageSha256s: ["abc"],
    });
    const b = computeFingerprint({
      groupId: "g1",
      variantId: "v1",
      renderedText: "Hello",
      imageSha256s: ["abc"],
    });
    expect(a).toBe(b);
  });

  it("khác group_id → khác fingerprint", () => {
    const a = computeFingerprint({ groupId: "g1", variantId: "v1", renderedText: "X", imageSha256s: [] });
    const b = computeFingerprint({ groupId: "g2", variantId: "v1", renderedText: "X", imageSha256s: [] });
    expect(a).not.toBe(b);
  });

  it("thứ tự sha256s được sort trước khi hash", () => {
    const a = computeFingerprint({ groupId: "g1", variantId: "v1", renderedText: "X", imageSha256s: ["a", "b"] });
    const b = computeFingerprint({ groupId: "g1", variantId: "v1", renderedText: "X", imageSha256s: ["b", "a"] });
    expect(a).toBe(b);
  });

  it("renderedText qua normalize (Unicode + lowercase + whitespace)", () => {
    const a = computeFingerprint({
      groupId: "g1",
      variantId: "v1",
      renderedText: "Xin chào  Việt Nam",
      imageSha256s: [],
    });
    const b = computeFingerprint({
      groupId: "g1",
      variantId: "v1",
      renderedText: "  xin chào việt nam  ",
      imageSha256s: [],
    });
    expect(a).toBe(b);
  });

  it("normalizeText: NFC + strip control chars + lowercase", () => {
    const input = "  Xin Chào \u0007 VIỆT  ";
    const out = normalizeText(input);
    expect(out).toBe("xin chào việt");
  });
});

describe("CampaignService — CRUD + enqueue", () => {
  it("create: ok khi product/variant/template tồn tại", () => {
    const c = svc.createCampaign({
      name: "C1",
      productId: "00000000-0000-0000-0000-000000000001",
      variantId: "00000000-0000-0000-0000-000000000010",
      templateId: "00000000-0000-0000-0000-000000000100",
    });
    expect(c.id).toBeTruthy();
  });

  it("create: CAMPAIGN_NAME_REQUIRED khi tên rỗng", () => {
    expect(() =>
      svc.createCampaign({
        name: "  ",
        productId: "00000000-0000-0000-0000-000000000001",
        variantId: "00000000-0000-0000-0000-000000000010",
        templateId: "00000000-0000-0000-0000-000000000100",
      }),
    ).toThrowError(/CAMPAIGN_NAME_REQUIRED/);
  });

  it("create: PRODUCT_NOT_FOUND", () => {
    expect(() =>
      svc.createCampaign({
        name: "C1",
        productId: "00000000-0000-0000-0000-000000009999",
        variantId: "00000000-0000-0000-0000-000000000010",
        templateId: "00000000-0000-0000-0000-000000000100",
      }),
    ).toThrowError(/CAMPAIGN_PRODUCT_NOT_FOUND/);
  });

  it("enqueue: tạo job cho mỗi enabled group + snapshot JSON", () => {
    const c = svc.createCampaign({
      name: "C1",
      productId: "00000000-0000-0000-0000-000000000001",
      variantId: "00000000-0000-0000-0000-000000000010",
      templateId: "00000000-0000-0000-0000-000000000100",
    });
    const result = svc.enqueue({ campaignId: c.id });
    expect(result.jobsCreated).toBe(2);
    expect(result.duplicates).toBe(0);
    expect(result.errors).toHaveLength(0);

    const jobsList = jobs.listByCampaign(c.id);
    expect(jobsList).toHaveLength(2);
    for (const j of jobsList) {
      expect(j.snapshot_json).toBeTruthy();
      const snap = JSON.parse(j.snapshot_json!);
      expect(snap.product.productId).toBe("00000000-0000-0000-0000-000000000001");
      expect(snap.variant.variantId).toBe("00000000-0000-0000-0000-000000000010");
      expect(snap.renderedText).toContain("Laptop A");
      expect(j.fingerprint).toHaveLength(64);
    }
  });

  it("enqueue: duplicate fingerprint bị bỏ qua (UNIQUE PARTIAL INDEX)", () => {
    const c = svc.createCampaign({
      name: "C1",
      productId: "00000000-0000-0000-0000-000000000001",
      variantId: "00000000-0000-0000-0000-000000000010",
      templateId: "00000000-0000-0000-0000-000000000100",
    });
    svc.enqueue({ campaignId: c.id });
    // Second enqueue → duplicate cho cùng group.
    const second = svc.enqueue({ campaignId: c.id });
    expect(second.jobsCreated).toBe(0);
    expect(second.duplicates).toBe(2);
  });

  it("sau khi enqueue, sửa template không ảnh hưởng snapshot (CMP-002)", () => {
    const c = svc.createCampaign({
      name: "C1",
      productId: "00000000-0000-0000-0000-000000000001",
      variantId: "00000000-0000-0000-0000-000000000010",
      templateId: "00000000-0000-0000-0000-000000000100",
    });
    svc.enqueue({ campaignId: c.id });
    const beforeSnap = jobs.listByCampaign(c.id)[0].snapshot_json!;

    // Sửa template body.
    templates.update("00000000-0000-0000-0000-000000000100", { body: "MỚI" });
    const afterSnap = jobs.listByCampaign(c.id)[0].snapshot_json!;
    expect(afterSnap).toBe(beforeSnap);
  });

  it("enqueue: CAMPAIGN_NO_GROUPS khi không có nhóm enabled", () => {
    // Tắt hết group.
    db.prepare("UPDATE facebook_groups SET enabled = 0").run();
    const c = svc.createCampaign({
      name: "C1",
      productId: "00000000-0000-0000-0000-000000000001",
      variantId: "00000000-0000-0000-0000-000000000010",
      templateId: "00000000-0000-0000-0000-000000000100",
    });
    expect(() => svc.enqueue({ campaignId: c.id })).toThrowError(/CAMPAIGN_NO_GROUPS/);
  });

  it("deleteCampaign xoá kèm post_jobs (CASCADE)", () => {
    const c = svc.createCampaign({
      name: "C1",
      productId: "00000000-0000-0000-0000-000000000001",
      variantId: "00000000-0000-0000-0000-000000000010",
      templateId: "00000000-0000-0000-0000-000000000100",
    });
    svc.enqueue({ campaignId: c.id });
    expect(jobs.listByCampaign(c.id)).toHaveLength(2);
    svc.deleteCampaign(c.id);
    expect(jobs.listByCampaign(c.id)).toHaveLength(0);
  });
});
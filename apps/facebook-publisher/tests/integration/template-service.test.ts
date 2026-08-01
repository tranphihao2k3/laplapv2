/**
 * TPL-001 + TPL-002 — Template engine + service tests.
 *
 * Coverage:
 *  - extractVariables: nested, duplicate, broken token, ký tự Unicode
 *    tiếng Việt, nội dung dài.
 *  - assertAllowlist: cho phép product./variant./group./post.; throw nếu
 *    có biến ngoài allowlist.
 *  - render: thay biến, format tiền (>1000 có " ₫"), ngày dd/MM/yyyy,
 *    null → fallback, unknown → fallback.
 *  - formatValue: number, string ISO date, boolean, array, object.
 *  - Service CRUD: create + render contentText, update, duplicate name,
 *    delete, NOT_FOUND, body > 20k.
 *  - Unicode tiếng Việt bảo toàn qua render.
 */
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/main/db/migrations";
import { TemplateRepository } from "../../src/main/db/repositories/templates";
import { TemplateService } from "../../src/main/services/template-service";
import {
  ALLOWED_VARIABLE_PREFIXES,
  assertAllowlist,
  extractVariables,
  formatValue,
  makeResolver,
  render,
} from "../../src/main/template/engine";

describe("engine.extractVariables", () => {
  it("trả duy nhất", () => {
    expect(
      extractVariables("Xin chào {{product.name}} — {{product.name}}"),
    ).toEqual(["product.name"]);
  });

  it("không match khi không có }} đóng", () => {
    expect(extractVariables("Hello {{product.name")).toEqual([]);
  });

  it("hỗ trợ Unicode tiếng Việt", () => {
    const body = "Sản phẩm {{product.name}} giá {{variant.price}} — đẹp!";
    expect(extractVariables(body).sort()).toEqual(["product.name", "variant.price"].sort());
  });

  it("bỏ qua var > 200 ký tự", () => {
    const long = "a".repeat(250);
    const body = `{{${long}}}`;
    expect(extractVariables(body)).toEqual([]);
  });

  it("nội dung dài 50k ký tự render < 100ms", () => {
    const long = "{{product.name}}".repeat(5000);
    const start = Date.now();
    const out = extractVariables(long);
    expect(Date.now() - start).toBeLessThan(100);
    expect(out).toEqual(["product.name"]);
  });
});

describe("engine.assertAllowlist", () => {
  it("accept tất cả prefix cho phép", () => {
    for (const p of ALLOWED_VARIABLE_PREFIXES) {
      expect(() => assertAllowlist(`Xin chào {{${p}name}}`)).not.toThrow();
    }
  });

  it("reject biến ngoài allowlist", () => {
    expect(() => assertAllowlist("Hello {{evil.code}}")).toThrowError(
      /VAR_NOT_ALLOWED|allowlist/i,
    );
  });
});

describe("engine.render", () => {
  it("replace biến đơn giản", () => {
    const out = render(
      "Sản phẩm {{product.name}} giá {{variant.price}}",
      makeResolver({ "product.name": "Laptop A", "variant.price": 1500000 }),
    );
    expect(out).toBe("Sản phẩm Laptop A giá 1.500.000 ₫");
  });

  it("null → fallback ''", () => {
    const out = render(
      "Tên: {{product.name}}",
      makeResolver({ "product.name": null }),
    );
    expect(out).toBe("Tên: ");
  });

  it("unknown biến → fallback", () => {
    const out = render("X {{unknown.x}} Y", makeResolver({}));
    expect(out).toBe("X  Y");
  });

  it("ngày ISO → dd/MM/yyyy", () => {
    const out = render(
      "Cập nhật: {{product.updatedAt}}",
      makeResolver({ "product.updatedAt": "2026-08-01T10:00:00Z" }),
    );
    expect(out).toMatch(/Cập nhật: \d{2}\/\d{2}\/\d{4}/);
  });

  it("Unicode tiếng Việt bảo toàn", () => {
    const out = render(
      "Đặc điểm: {{product.desc}}",
      makeResolver({ "product.desc": "Đẹp, bền, rẻ" }),
    );
    expect(out).toBe("Đặc điểm: Đẹp, bền, rẻ");
  });

  it("không đóng }} — giữ nguyên văn bản", () => {
    const out = render("Hi {{product.name không đóng", makeResolver({ "product.name không đóng": "x" }));
    expect(out).toBe("Hi {{product.name không đóng");
  });
});

describe("engine.formatValue", () => {
  it("number < 1000 không có ₫", () => {
    expect(formatValue(500, "vi-VN")).toBe("500");
  });
  it("number >= 1000 có ₫", () => {
    expect(formatValue(1500, "vi-VN")).toBe("1.500 ₫");
  });
  it("boolean true → Có", () => {
    expect(formatValue(true, "vi-VN")).toBe("Có");
  });
  it("Date → dd/MM/yyyy", () => {
    const out = formatValue(new Date("2026-08-01T10:00:00Z"), "vi-VN");
    expect(out).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
  it("Array → join comma", () => {
    expect(formatValue(["a", "b"], "vi-VN")).toBe("a, b");
  });
  it("Object → key=value", () => {
    const out = formatValue({ a: 1, b: "x" }, "vi-VN");
    expect(out).toContain("a=1");
    expect(out).toContain("b=x");
  });
});

describe("TemplateService — CRUD + preview", () => {
  let db: Database.Database;
  let repo: TemplateRepository;
  let svc: TemplateService;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
    repo = new TemplateRepository(db);
    svc = new TemplateService(repo);
  });
  afterEach(() => db.close());

  it("create: ok với body đơn giản", () => {
    const t = svc.create({
      name: "Sale 50%",
      body: "Sản phẩm {{product.name}} giá {{variant.price}}",
      allowlistedVariables: ["product.name", "variant.price"],
    });
    expect(t.name).toBe("Sale 50%");
    expect(t.body).toContain("{{product.name}}");
  });

  it("create: render contentText khi previewContext có", () => {
    const t = svc.create({
      name: "T1",
      body: "{{product.name}} — {{variant.price}}",
      allowlistedVariables: ["product.name", "variant.price"],
      previewContext: { "product.name": "Laptop", "variant.price": 2000000 },
    });
    expect(t.content_text).toBe("Laptop — 2.000.000 ₫");
  });

  it("create: VARIABLE_NOT_ALLOWED khi body có evil.code", () => {
    expect(() =>
      svc.create({
        name: "T1",
        body: "{{evil.code}}",
        allowlistedVariables: [],
      }),
    ).toThrowError(/TEMPLATE_VAR_NOT_ALLOWED/);
  });

  it("create: TEMPLATE_NAME_REQUIRED khi tên rỗng", () => {
    expect(() =>
      svc.create({ name: "  ", body: "{{product.name}}", allowlistedVariables: [] }),
    ).toThrowError(/TEMPLATE_NAME_REQUIRED/);
  });

  it("create: TEMPLATE_BODY_TOO_LONG khi body > 20k", () => {
    const body = "{{product.name}}".repeat(2000); // >20k
    expect(() =>
      svc.create({ name: "T1", body, allowlistedVariables: [] }),
    ).toThrowError(/TEMPLATE_BODY_TOO_LONG/);
  });

  it("create: TEMPLATE_DUPLICATE_NAME khi trùng tên", () => {
    svc.create({ name: "T1", body: "{{product.name}}", allowlistedVariables: [] });
    expect(() =>
      svc.create({ name: "T1", body: "{{product.name}}", allowlistedVariables: [] }),
    ).toThrowError(/TEMPLATE_DUPLICATE_NAME/);
  });

  it("update + re-render contentText", () => {
    const t = svc.create({
      name: "T1",
      body: "{{product.name}}",
      allowlistedVariables: [],
      previewContext: { "product.name": "A" },
    });
    expect(t.content_text).toBe("A");
    svc.update(t.id, {
      name: "T1",
      body: "{{product.name}}",
      allowlistedVariables: [],
      previewContext: { "product.name": "B" },
    });
    const after = svc.findById(t.id);
    expect(after?.content_text).toBe("B");
  });

  it("update: TEMPLATE_NOT_FOUND", () => {
    expect(() =>
      svc.update("00000000-0000-0000-0000-000000000000", { name: "X", body: "{{product.name}}" }),
    ).toThrowError(/TEMPLATE_NOT_FOUND/);
  });

  it("delete + listAll", () => {
    const t = svc.create({ name: "T1", body: "{{product.name}}", allowlistedVariables: [] });
    expect(svc.list()).toHaveLength(1);
    svc.delete(t.id);
    expect(svc.list()).toHaveLength(0);
  });

  it("renderPreview không lưu DB", () => {
    const out = svc.renderPreview(
      "{{product.name}} - {{variant.price}}",
      { "product.name": "X", "variant.price": 100 },
      "vi-VN",
    );
    expect(out).toBe("X - 100");
    expect(svc.list()).toHaveLength(0);
  });
});
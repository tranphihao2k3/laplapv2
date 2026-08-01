/**
 * GRP-001 + GRP-002 — GroupService tests.
 */
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/main/db/migrations";
import {
  FacebookGroupRepository,
  GroupSetRepository,
  normalizeFacebookGroupUrl,
} from "../../src/main/db/repositories/facebook-groups";
import { GroupService, GroupSetService } from "../../src/main/services/group-service";

let db: Database.Database;
let groups: FacebookGroupRepository;
let sets: GroupSetRepository;
let svc: GroupService;
let setSvc: GroupSetService;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  groups = new FacebookGroupRepository(db);
  sets = new GroupSetRepository(db);
  svc = new GroupService(groups, sets);
  setSvc = new GroupSetService(sets);
});

afterEach(() => db.close());

describe("normalizeFacebookGroupUrl", () => {
  it("chuẩn hoá URL về facebook.com/groups/<id>", () => {
    expect(normalizeFacebookGroupUrl("https://www.facebook.com/groups/12345/")).toBe(
      "https://www.facebook.com/groups/12345",
    );
  });
  it("URL không phải facebook.com trả null", () => {
    expect(normalizeFacebookGroupUrl("https://google.com/groups/123")).toBeNull();
  });
  it("URL không đúng path /groups/<id> trả null", () => {
    expect(normalizeFacebookGroupUrl("https://facebook.com/something/123")).toBeNull();
  });
  it("input không phải URL trả null", () => {
    expect(normalizeFacebookGroupUrl("not a url")).toBeNull();
  });
});

describe("GroupService — CRUD", () => {
  it("create: ok với URL hợp lệ", () => {
    const g = svc.create({
      name: "Mua bán đồ cũ",
      url: "https://facebook.com/groups/12345",
      postingMode: "assisted",
    });
    expect(g.id).toBeTruthy();
    expect(g.url).toBe("https://facebook.com/groups/12345");
    expect(g.enabled).toBe(1);
  });

  it("create: GROUP_BAD_URL khi URL không hợp lệ", () => {
    expect(() =>
      svc.create({ name: "x", url: "https://google.com/x" }),
    ).toThrowError(/GROUP_BAD_URL/);
  });

  it("create: GROUP_NAME_REQUIRED khi tên rỗng", () => {
    expect(() =>
      svc.create({ name: "  ", url: "https://facebook.com/groups/1" }),
    ).toThrowError(/GROUP_NAME_REQUIRED/);
  });

  it("create: GROUP_BAD_POSTING_MODE khi mode sai", () => {
    expect(() =>
      svc.create({
        name: "x",
        url: "https://facebook.com/groups/1",
        postingMode: "auto-all" as never,
      }),
    ).toThrowError(/GROUP_BAD_POSTING_MODE/);
  });

  it("create: GROUP_DUPLICATE_URL khi URL trùng", () => {
    svc.create({ name: "A", url: "https://facebook.com/groups/1" });
    expect(() =>
      svc.create({ name: "B", url: "https://facebook.com/groups/1" }),
    ).toThrowError(/GROUP_DUPLICATE_URL/);
  });

  it("update: đổi URL, enabled, mode", () => {
    const g = svc.create({ name: "A", url: "https://facebook.com/groups/1" });
    const updated = svc.update(g.id, {
      url: "https://facebook.com/groups/2",
      enabled: false,
      postingMode: "auto",
    });
    expect(updated.url).toBe("https://facebook.com/groups/2");
    expect(updated.enabled).toBe(0);
    expect(updated.posting_mode).toBe("auto");
  });

  it("update: GROUP_NOT_FOUND", () => {
    expect(() =>
      svc.update("00000000-0000-0000-0000-000000000000", { name: "x" }),
    ).toThrowError(/GROUP_NOT_FOUND/);
  });

  it("delete: GROUP_NOT_FOUND", () => {
    expect(() => svc.delete("00000000-0000-0000-0000-000000000000")).toThrowError(
      /GROUP_NOT_FOUND/,
    );
  });

  it("delete: xoá group thành công (không cascade post_jobs)", () => {
    const g = svc.create({ name: "A", url: "https://facebook.com/groups/1" });
    svc.delete(g.id);
    expect(groups.findById(g.id)).toBeUndefined();
  });

  it("listAll/listEnabled", () => {
    svc.create({ name: "A", url: "https://facebook.com/groups/1", enabled: true });
    svc.create({ name: "B", url: "https://facebook.com/groups/2", enabled: false });
    expect(groups.listAll()).toHaveLength(2);
    expect(groups.listEnabled()).toHaveLength(1);
  });
});

describe("GroupSetService", () => {
  it("create + add + remove + delete member", () => {
    const a = svc.create({ name: "A", url: "https://facebook.com/groups/1" });
    const b = svc.create({ name: "B", url: "https://facebook.com/groups/2" });
    const s = setSvc.create("Nhóm test");
    expect(s.id).toBeTruthy();
    setSvc.addMember(s.id, a.id);
    setSvc.addMember(s.id, b.id);
    expect(setSvc.members(s.id).map((g) => g.id).sort()).toEqual([a.id, b.id].sort());
    setSvc.removeMember(s.id, a.id);
    expect(setSvc.members(s.id).map((g) => g.id)).toEqual([b.id]);
  });

  it("delete set không xoá group", () => {
    const a = svc.create({ name: "A", url: "https://facebook.com/groups/1" });
    const s = setSvc.create("S");
    setSvc.addMember(s.id, a.id);
    setSvc.delete(s.id);
    expect(setSvc.list()).toHaveLength(0);
    expect(groups.findById(a.id)).toBeTruthy(); // group vẫn còn
  });
});
/**
 * DB-002 — FacebookGroupRepository + GroupSetRepository unit tests.
 */
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/main/db/migrations";
import {
  FacebookGroupRepository,
  GroupSetRepository,
  normalizeFacebookGroupUrl,
} from "../../src/main/db/repositories/facebook-groups";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("FacebookGroupRepository", () => {
  it("insert + findById + listAll", () => {
    const repo = new FacebookGroupRepository(db);
    repo.insert({
      id: "g1",
      name: "Laptop Cần Thơ",
      url: "https://facebook.com/groups/laptopcantho",
      enabled: 1,
      locale: "vi",
      notes: null,
      max_images: 10,
      allow_link: 1,
      posting_mode: "assisted",
    });

    const got = repo.findById("g1");
    expect(got?.name).toBe("Laptop Cần Thơ");
    expect(got?.enabled).toBe(1);

    expect(repo.listAll()).toHaveLength(1);
  });

  it("URL UNIQUE: insert trùng url throw", () => {
    const repo = new FacebookGroupRepository(db);
    repo.insert({
      id: "g1",
      name: "A",
      url: "https://facebook.com/groups/x",
      enabled: 1,
      locale: null,
      notes: null,
      max_images: 10,
      allow_link: 1,
      posting_mode: "assisted",
    });
    expect(() =>
      repo.insert({
        id: "g2",
        name: "B",
        url: "https://facebook.com/groups/x",
        enabled: 1,
        locale: null,
        notes: null,
        max_images: 10,
        allow_link: 1,
        posting_mode: "assisted",
      }),
    ).toThrowError(/UNIQUE/i);
  });

  it("listEnabled: nhóm disabled bị loại", () => {
    const repo = new FacebookGroupRepository(db);
    repo.insert({
      id: "g1",
      name: "on",
      url: "https://facebook.com/groups/on",
      enabled: 1,
      locale: null,
      notes: null,
      max_images: 10,
      allow_link: 1,
      posting_mode: "assisted",
    });
    repo.insert({
      id: "g2",
      name: "off",
      url: "https://facebook.com/groups/off",
      enabled: 0,
      locale: null,
      notes: null,
      max_images: 10,
      allow_link: 1,
      posting_mode: "assisted",
    });

    const enabled = repo.listEnabled();
    expect(enabled.map((g) => g.id)).toEqual(["g1"]);
  });

  it("update partial: giữ nguyên field không patch", () => {
    const repo = new FacebookGroupRepository(db);
    repo.insert({
      id: "g1",
      name: "A",
      url: "https://facebook.com/groups/a",
      enabled: 1,
      locale: "vi",
      notes: "note gốc",
      max_images: 10,
      allow_link: 1,
      posting_mode: "assisted",
    });
    repo.update("g1", { name: "A2" });

    const got = repo.findById("g1");
    expect(got?.name).toBe("A2");
    expect(got?.notes).toBe("note gốc");
    expect(got?.updated_at).not.toBeNull();
  });

  it("update id không tồn tại throw", () => {
    const repo = new FacebookGroupRepository(db);
    expect(() => repo.update("missing", { name: "x" })).toThrowError(/not found/);
  });
});

describe("GroupSetRepository + URL normalize", () => {
  it("addToSet xuất hiện trong listMembers; deleteSet xoá link cascade", () => {
    const groups = new FacebookGroupRepository(db);
    const sets = new GroupSetRepository(db);

    groups.insert({
      id: "g1",
      name: "G1",
      url: "https://facebook.com/groups/g1",
      enabled: 1,
      locale: null,
      notes: null,
      max_images: 10,
      allow_link: 1,
      posting_mode: "assisted",
    });
    sets.createSet("s1", "Set A");
    sets.addToSet("s1", "g1");

    expect(sets.listMembers("s1").map((g) => g.id)).toEqual(["g1"]);

    // Xoá group → cascade xoá link.
    groups.delete("g1");
    expect(sets.listMembers("s1")).toHaveLength(0);

    // Xoá set → cascade xoá link còn lại (không lỗi nếu rỗng).
    sets.createSet("s2", "Set B");
    sets.addToSet("s2", "g1"); // noop vì g1 đã xoá — IGNORE
    sets.deleteSet("s2");
    expect(sets.listSets()).toHaveLength(1); // chỉ còn s1
  });

  it("normalizeFacebookGroupUrl: hợp lệ / bậy", () => {
    expect(
      normalizeFacebookGroupUrl("https://www.facebook.com/groups/laptopcantho"),
    ).toBe("https://www.facebook.com/groups/laptopcantho");
    expect(
      normalizeFacebookGroupUrl("  https://facebook.com/groups/x/?  "),
    ).toBe("https://facebook.com/groups/x");
    expect(normalizeFacebookGroupUrl("https://example.com/groups/x")).toBeNull();
    expect(normalizeFacebookGroupUrl("https://facebook.com/notgroups/x")).toBeNull();
    expect(normalizeFacebookGroupUrl("not-a-url")).toBeNull();
  });
});

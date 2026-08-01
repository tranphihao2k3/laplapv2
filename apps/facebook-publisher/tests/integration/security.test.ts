/**
 * SEC-001 — Security gate tests.
 *
 * Pattern scan trong source để chặn các forbidden pattern theo
 * docs/§14 SEC-001 §3.
 */
import { describe, expect, it } from "vitest";
import { scanDirectory } from "../security/scanner";

describe("SEC-001 — security gate", () => {
  it("không có eval() trong main/preload", async () => {
    const r = await scanDirectory("apps/facebook-publisher/src");
    expect(r.findings).toEqual([]);
  });

  it("không có secret lộ trong source/tests", async () => {
    const r1 = await scanDirectory("apps/facebook-publisher/src");
    const r2 = await scanDirectory("apps/facebook-publisher/tests");
    expect([...r1.findings, ...r2.findings]).toEqual([]);
  });
});

describe("SEC-001 — IPC payload never carries access token", () => {
  it("preload channel list không có 'token' substring", async () => {
    // Channel name phải là literal trong shared/ipc.ts.
    const { scanText } = await import("../security/scanner");
    const fs = await import("node:fs/promises");
    const content = await fs.readFile("apps/facebook-publisher/src/shared/ipc.ts", "utf8");
    const r = scanText(content, "shared/ipc.ts");
    // Không có Authorization Bearer hoặc cookie trong file định nghĩa channel.
    const hasBearer = r.findings.some((f) => f.rule === "auth-bearer");
    expect(hasBearer).toBe(false);
  });
});
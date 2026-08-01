/**
 * SEC-001 — secret scanner tests.
 */
import { describe, expect, it } from "vitest";
import { scanText, scanDirectory } from "./scanner";

describe("scanText — JWT", () => {
  it("phát hiện JWT 3 phần", () => {
    const text = "token=eyJabc.eyJxyz.signature1234";
    const r = scanText(text);
    expect(r.clean).toBe(false);
    expect(r.findings.some((f) => f.rule === "jwt-token")).toBe(true);
  });

  it("phát hiện supabase service role key", () => {
    const text = "key=sb_secret_abc123def456ghi789jkl012mno345";
    const r = scanText(text);
    expect(r.clean).toBe(false);
    expect(r.findings.some((f) => f.rule === "supabase-service-role-key")).toBe(true);
  });

  it("phát hiện Authorization Bearer", () => {
    const text = "Authorization: Bearer abc123def456ghi789";
    const r = scanText(text);
    expect(r.clean).toBe(false);
    expect(r.findings.some((f) => f.rule === "auth-bearer")).toBe(true);
  });

  it("phát hiện cookie c_user", () => {
    const text = "Cookie: c_user=1234567890; xs=abcdefghijklmnopqrstu";
    const r = scanText(text);
    expect(r.clean).toBe(false);
    expect(r.findings.some((f) => f.rule === "cookie-cuser")).toBe(true);
  });

  it("text thường KHÔNG có secret → clean", () => {
    const text = "const api = window.publisherApi; await api.authGetStatus();";
    const r = scanText(text);
    expect(r.clean).toBe(true);
  });

  it("password= trong URL", () => {
    const text = "https://example.com?password=secret123";
    const r = scanText(text);
    expect(r.clean).toBe(false);
    expect(r.findings.some((f) => f.rule === "password-url")).toBe(true);
  });
});

describe("scanDirectory — repo src", () => {
  it("quét apps/facebook-publisher/src không có secret", async () => {
    const r = await scanDirectory("apps/facebook-publisher/src");
    expect(r.findings).toEqual([]);
  });

  it("quét apps/facebook-publisher/tests không có secret", async () => {
    const r = await scanDirectory("apps/facebook-publisher/tests");
    expect(r.findings).toEqual([]);
  });
});
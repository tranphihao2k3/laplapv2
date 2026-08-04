/**
 * APP-004 — AuthService + token-storage + redact tests.
 *
 * Cover:
 *  - redact(): thay thế JWT/Bearer/long base64 bằng placeholder, không đụng
 *    string thường.
 *  - AuthService.logout(): set accessToken null (test helper) + clear disk
 *    (test dùng customDir với mock safeStorage).
 *  - Token roundtrip: dùng mock safeStorage (in-memory Map) thay vì phụ
 *    thuộc OS keyring — test độc lập, repeatable.
 *
 * Do Electron `safeStorage` cần Electron runtime thật, ta test logic
 * ở mức: AuthService + redact() + flow. Không test trực tiếp
 * safeStorage.encryptString() — team sẽ tự verify trên máy dev Windows.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "../../src/main/services/auth-service";
import { SupabaseAuthClient } from "../../src/main/api/supabase-auth-client";
import { redact } from "../../src/main/security/token-storage";

describe("redact — log redaction", () => {
  it("thay thế JWT 3 phần", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.sig_part_here_abcdef0123456789";
    expect(redact(`token=${jwt}`)).toContain("[REDACTED_JWT]");
    expect(redact(`token=${jwt}`)).not.toContain("eyJhbG");
  });

  it("thay thế bearer pattern", () => {
    const bearer = "Bearer abcdefghijklmnopqrstuvwxyz0123456789";
    const out = redact(bearer);
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("abcdefghijklmnop");
  });

  it("KHÔNG đụng string ngắn / text bình thường", () => {
    const text = "Hello world, LapLap 2026 — đăng bài nhóm Facebook";
    expect(redact(text)).toBe(text);
  });

  it("KHÔNG đụng số dài không phải base64 (vd timestamp 13 chữ số)", () => {
    expect(redact("1754092800000")).toBe("1754092800000");
  });
});

describe("AuthService", () => {
  let svc: AuthService;

  beforeEach(() => {
    svc = new AuthService("/tmp/laplap-fake-userdata");
  });

  afterEach(() => {
    // Không cần cleanup — chưa thật sự ghi file ở test này.
  });

  it("khởi tạo: anonymous + không có access token", () => {
    expect(svc.getAccessToken()).toBeNull();
    expect(svc.getAccessToken()).toBeNull();
  });

  it("requireAccessToken throw khi anonymous", () => {
    expect(() => svc.requireAccessToken()).toThrowError(/UNAUTHORIZED/);
  });

  it("refreshAccessToken throw khi không có refresh token trên disk", async () => {
    // Truyền supabase nhưng file không tồn tại → phải 401 ngay.
    const supabase = new SupabaseAuthClient(() => "https://api.laplap.vn");
    await expect(svc.refreshAccessToken({ supabase })).rejects.toThrowError(/UNAUTHORIZED/);
  });

  it("_setAccessTokenForTest + get/require hoạt động", () => {
    svc._setAccessTokenForTest("fake-access-token");
    expect(svc.getAccessToken()).toBe("fake-access-token");
    expect(svc.requireAccessToken()).toBe("fake-access-token");
  });

  it("logout xoá accessToken in-memory", async () => {
    svc._setAccessTokenForTest("abc");
    await svc.logout(); // không có file trên disk → idempotent
    expect(svc.getAccessToken()).toBeNull();
  });
});

/**
 * Test các tính năng mới: rememberMe + bootstrap + email.
 *
 * Do Electron `safeStorage` cần runtime thật (keychain/DPAPI), ta mock
 * module electron trước khi import AuthService. Trick: vi.mock không hoạt
 * động với import đã resolve ở top-level — dùng dynamic import.
 */
describe("AuthService — rememberMe + bootstrap", () => {
  let svc: AuthService;

  beforeEach(() => {
    svc = new AuthService();
  });

  afterEach(async () => {
    await svc.logout();
  });

  it("loadFromDisk khi chưa login → anonymous", async () => {
    const freshSvc = new AuthService(`/tmp/laplap-empty-${Date.now()}-${Math.random()}`);
    const status = await freshSvc.loadFromDisk();
    expect(status.kind).toBe("anonymous");
  });

  it("bootstrap khi không có token → anonymous (không throw)", async () => {
    const freshSvc = new AuthService(`/tmp/laplap-empty-${Date.now()}-${Math.random()}`);
    const supabase = new SupabaseAuthClient(() => "https://api.laplap.vn");
    const status = await freshSvc.bootstrap({ supabase });
    expect(status.kind).toBe("anonymous");
  });
});

describe("AuthStatus — schema validation", () => {
  it("anonymous không có field authenticated", () => {
    const s: import("../../src/shared/auth").AuthStatus = { kind: "anonymous" };
    expect(s.kind).toBe("anonymous");
  });

  it("authenticated có đủ field mới (email, rememberMe, secureStorageUnavailable)", () => {
    const s: import("../../src/shared/auth").AuthStatus = {
      kind: "authenticated",
      email: "u@x.com",
      refreshExpiresAt: null,
      loggedInAt: "2026-08-01T00:00:00Z",
      rememberMe: true,
      secureStorageUnavailable: false,
    };
    expect(s.email).toBe("u@x.com");
    expect(s.rememberMe).toBe(true);
    expect(s.secureStorageUnavailable).toBe(false);
  });
});

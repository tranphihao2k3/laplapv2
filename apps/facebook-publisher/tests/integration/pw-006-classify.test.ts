/**
 * PW-006 — Post result classification.
 *
 * Sau khi user bấm Submit trên Facebook composer (assisted mode) hoặc auto-submit
 * click Submit, cần phân loại kết quả cuối:
 *   - published:        thấy "Bài viết của bạn" / post URL.
 *   - pending_approval: bài chờ admin duyệt.
 *   - unverified:       click xong nhưng mất tín hiệu (timeout, navigation, lỗi
 *                       không rõ) — KHÔNG auto retry, đợi user check.
 *   - needs_action:     checkpoint / 2FA / CAPTCHA / warning.
 *   - failed:           lỗi rõ ràng (no permission, content quá dài, v.v.).
 *
 * Quyết định dựa trên URL + DOM marker; KHÔNG dựa vào "đã click = success".
 */
import { describe, expect, it } from "vitest";
import {
  classifyPostResult,
  classifyPostResultAsync,
} from "../../src/main/browser/facebook-group-adapter";
import type { Page } from "playwright-core";

class FakePage {
  urlValue = "";
  evaluateImpl: ((fn: any) => Promise<unknown>) | null = null;
  url() {
    return this.urlValue;
  }
  evaluate(fn: any) {
    if (this.evaluateImpl) return this.evaluateImpl(fn);
    return Promise.resolve(false);
  }
}

function pageWith(url: string, markers: Record<string, boolean>): any {
  const p = new FakePage();
  p.urlValue = url;
  p.evaluateImpl = async (fn: any) => {
    // Page-side helper sẽ trả về boolean marker nếu tìm thấy element.
    const src = fn.toString();
    const m = src.match(/getAttribute\("data-marker"\)/);
    if (m) {
      const keyMatch = src.match(/"data-([a-z-]+)"/);
      const key = keyMatch ? keyMatch[1] : "";
      return Boolean(markers[key]);
    }
    return false;
  };
  return p as unknown as Page;
}

describe("PW-006 — classifyPostResult", () => {
  it("URL /permalink/ → published + postUrl", () => {
    const url = "https://facebook.com/groups/g1/posts/permalink.12345/";
    const r = classifyPostResult({ page: pageWith(url, {}), postUrlHint: "" });
    expect(r.kind).toBe("published");
    if (r.kind === "published") expect(r.postUrl).toBe(url);
  });

  it("DOM có pending_approval marker → pending_approval", async () => {
    const r = await classifyPostResultAsync({
      page: pageWith("https://facebook.com/groups/g1", { "pending-approval": true }),
      postUrlHint: "",
    });
    expect(r.kind).toBe("pending_approval");
  });

  it("DOM có needs_action marker → needs_action", async () => {
    const r = await classifyPostResultAsync({
      page: pageWith("https://facebook.com/groups/g1", { "needs-action": true }),
      postUrlHint: "",
    });
    expect(r.kind).toBe("needs_action");
  });

  it("URL chứa checkpoint/captcha → needs_action", () => {
    const r = classifyPostResult({
      page: pageWith("https://facebook.com/checkpoint/abc", {}),
      postUrlHint: "",
    });
    expect(r.kind).toBe("needs_action");
  });

  it("Không thấy gì → unverified (KHÔNG coi là published)", () => {
    const r = classifyPostResult({
      page: pageWith("https://facebook.com/groups/g1", {}),
      postUrlHint: "",
    });
    expect(r.kind).toBe("unverified");
  });

  it("postUrlHint từ caller (vd. nút Bài viết của tôi) → published", () => {
    const r = classifyPostResult({
      page: pageWith("https://facebook.com/groups/g1", {}),
      postUrlHint: "https://facebook.com/groups/g1/posts/p.987",
    });
    expect(r.kind).toBe("published");
    if (r.kind === "published") expect(r.postUrl).toBe("https://facebook.com/groups/g1/posts/p.987");
  });
});

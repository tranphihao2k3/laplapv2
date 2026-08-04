/**
 * Facebook posting runner — PW-003 + PW-004 thực thi qua WorkerRunner.
 *
 * Phase production: thay dev-runner bằng runner này trong main/index.ts.
 *
 * Flow mỗi job:
 *   1. Parse snapshot_json → group.url, renderedText, images.paths.
 *   2. BrowserProfileManager.launch() (idempotent) — headless=false nên
 *      cửa sổ Chromium sẽ TỰ HIỆN trên màn hình user (docs §12 PW-002).
 *   3. FacebookGroupAdapter.openGroup(url) → page | error state.
 *   4. fillText + uploadImages (nếu có).
 *   5. detectObstacle (checkpoint/captcha/2fa) → needs_action nếu có.
 *   6. submit (auto/assisted tuỳ AutoSubmitGate).
 *   7. detectPostResult → published | pending_approval | no_permission | page_error.
 *
 * Mọi AppError/exception đều được convert sang state transition rõ ràng —
 * KHÔNG nuốt lỗi (khác với dev-runner).
 */
import path from "node:path";
import fs from "node:fs/promises";
import type { PostJobRow } from "../../shared/db-types";
import type { WorkerRunner } from "./serial-worker";
import type { JobSnapshot } from "../jobs/snapshot";
import type { BrowserProfileManager } from "../browser/profile-manager";
import { FacebookGroupAdapter } from "../browser/facebook-group-adapter";

/** Convert local file path để Playwright `setInputFiles` nhận đúng. */
function normalizeImagePaths(paths: string[]): string[] {
  return paths.map((p) => (path.isAbsolute(p) ? p : path.resolve(p)));
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function safeParseSnapshot(raw: string | null): JobSnapshot | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JobSnapshot;
  } catch {
    return null;
  }
}

export function createFbRunner(
  profileManager: BrowserProfileManager,
): WorkerRunner {
  return async (job: PostJobRow) => {
    const snap = safeParseSnapshot(job.snapshot_json);
    if (!snap) {
      return {
        toState: "failed",
        errorCode: "SNAPSHOT_MISSING",
        errorMessage: `Job ${job.id} không có snapshot — không thể đăng.`,
      };
    }

    const groupUrl = snap.group.url;
    const groupName = snap.group.name;

    // 1. Ensure browser đang chạy (headed — cửa sổ Chromium tự hiện).
    try {
      const status = profileManager.status();
      if (status.kind !== "running") {
        console.log(`[fb-runner] launching browser for job ${job.id.slice(0, 8)}…`);
        console.log(`[fb-runner] state BEFORE launch: ${JSON.stringify(status)}`);
        const launchResult = await profileManager.launch();
        console.log(`[fb-runner] launch returned: ${JSON.stringify(launchResult)}`);
        if (launchResult.kind !== "running") {
          const code = launchResult.kind === "missing_binary"
            ? "BROWSER_PLAYWRIGHT_MISSING"
            : launchResult.kind === "lock_held"
              ? "BROWSER_LOCK_HELD"
              : "BROWSER_LAUNCH_FAILED";
          return {
            toState: "failed",
            errorCode: code,
            errorMessage: `Browser launch trả về ${launchResult.kind}. Kiểm tra settings/chromium binary.`,
          };
        }
        console.log(`[fb-runner] browser ready → entering openGroup`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[fb-runner] browser launch crashed for job ${job.id.slice(0, 8)}:`, err);
      return {
        toState: "failed",
        errorCode: "BROWSER_LAUNCH_EXCEPTION",
        errorMessage: msg.slice(0, 2000),
      };
    }

    const context = profileManager.context();
    if (!context) {
      return {
        toState: "failed",
        errorCode: "BROWSER_CONTEXT_NULL",
        errorMessage: "Browser context null sau launch — không rõ nguyên nhân.",
      };
    }

    // 2. Adapter thật — mở group page.
    const adapter = new FacebookGroupAdapter(context);
    console.log(
      `[fb-runner] ${job.id.slice(0, 8)} → openGroup "${groupName}" (${groupUrl})`,
    );

    const composer = await adapter.openGroup(groupUrl);

    if (composer.kind === "pending_approval") {
      return {
        toState: "pending_approval",
        errorCode: "GROUP_PENDING_APPROVAL",
        errorMessage: `Group "${groupName}" đang chờ duyệt.`,
      };
    }
    if (composer.kind === "no_permission") {
      return {
        toState: "failed",
        errorCode: "GROUP_NO_PERMISSION",
        errorMessage: `Không có quyền đăng vào "${groupName}".`,
      };
    }
    if (composer.kind === "not_member") {
      return {
        toState: "failed",
        errorCode: "GROUP_NOT_MEMBER",
        errorMessage: `User chưa tham gia "${groupName}" — Facebook không hiển thị composer cho non-member. Hãy join group trước.`,
      };
    }
    if (composer.kind === "closed") {
      return {
        toState: "failed",
        errorCode: "GROUP_NO_COMPOSER",
        errorMessage: `Group "${groupName}" không có composer (có thể cần approval admin hoặc bị restrict).`,
      };
    }
    if (composer.kind === "page_error") {
      return {
        toState: "failed",
        errorCode: "GROUP_PAGE_ERROR",
        errorMessage: composer.message,
      };
    }

    const page = composer.page;

    try {
      // 3. Fill text.
      await adapter.fillText(page, { renderedText: snap.renderedText });

      // 4. Upload ảnh nếu có.
      const validImagePaths: string[] = [];
      for (const p of normalizeImagePaths(snap.images.paths)) {
        if (await fileExists(p)) validImagePaths.push(p);
        else console.warn(`[fb-runner] image missing on disk: ${p}`);
      }
      if (validImagePaths.length > 0) {
        await adapter.uploadImages(page, { filePaths: validImagePaths });
      }

      // 5. Obstacle check (checkpoint/captcha/2fa) TRƯỚC khi submit.
      const obstacle = await adapter.detectObstacle(page);
      if (obstacle.kind === "checkpoint") {
        return {
          toState: "needs_action",
          errorCode: "OBSTACLE_CHECKPOINT",
          errorMessage: `Facebook yêu cầu xác minh danh tính (checkpoint). User cần login lại.`,
        };
      }
      if (obstacle.kind === "captcha") {
        return {
          toState: "needs_action",
          errorCode: "OBSTACLE_CAPTCHA",
          errorMessage: `Facebook hiển thị CAPTCHA — cần giải thủ công.`,
        };
      }
      if (obstacle.kind === "two_factor") {
        return {
          toState: "needs_action",
          errorCode: "OBSTACLE_2FA",
          errorMessage: `Facebook yêu cầu 2FA. Mở browser xác minh rồi retry job.`,
        };
      }
      if (obstacle.kind === "unknown") {
        return {
          toState: "needs_action",
          errorCode: "OBSTACLE_UNKNOWN_UI",
          errorMessage: `Composer không xuất hiện (selector: ${obstacle.selector}). Có thể UI Facebook đổi.`,
        };
      }

      // 6. Submit.
      await adapter.submit(page);

      // 7. Detect kết quả.
      const result = await adapter.detectPostResult(page);
      if (result.kind === "pending_approval") {
        return {
          toState: "pending_approval",
          errorCode: "POST_PENDING_APPROVAL",
          errorMessage: `Bài đăng đang chờ admin duyệt.`,
        };
      }
      if (result.kind === "no_permission") {
        return {
          toState: "failed",
          errorCode: "POST_NO_PERMISSION",
          errorMessage: `Bị từ chối quyền sau khi submit.`,
        };
      }
      if (result.kind === "page_error") {
        return {
          toState: "failed",
          errorCode: "POST_PAGE_ERROR",
          errorMessage: result.message,
        };
      }
      // ok → published.
      return {
        toState: "published",
        postUrl: result.postUrl ?? null,
      };
    } catch (err) {
      // Playwright exception → report + leave page open để user xem.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[fb-runner] job ${job.id.slice(0, 8)} crashed:`, err);
      return {
        toState: "failed",
        errorCode: "RUNNER_RUNTIME_ERROR",
        errorMessage: message.slice(0, 2000),
      };
    } finally {
      // ĐÓNG page — nhưng giữ browser context để job tiếp theo nhanh hơn.
      await adapter.close(page);
    }
  };
}
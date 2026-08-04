/**
 * Shared auth contract — dùng chung main, preload, renderer.
 *
 * Không bao giờ expose `accessToken` qua IPC — nó chỉ tồn tại in-memory
 * ở main. Renderer biết trạng thái qua `AuthStatus` (`anonymous` hay
 * `authenticated` chỉ với `refreshExpiresAt` + `loggedInAt`).
 *
 * Login thật sẽ thuộc APP-005 — file này chỉ đặt type + IPC contract.
 */
import type { IpcResult } from "./ipc";

export type AuthStatus =
  | { kind: "anonymous" }
  | {
      kind: "authenticated";
      email: string | null;
      refreshExpiresAt: string | null;
      loggedInAt: string;
      rememberMe: boolean;
      /** True khi safeStorage không khả dụng — file token không mã hoá.
       *  UI nên cảnh báo user (production không chạy Linux). */
      secureStorageUnavailable: boolean;
    };

export type { IpcResult };

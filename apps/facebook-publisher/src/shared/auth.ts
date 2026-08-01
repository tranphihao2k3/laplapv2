/**
 * Shared auth contract — dùng chung main, preload, renderer.
 *
 * Không bao giờ expose `accessToken` qua IPC — nó chỉ tồn tại in-memory
 * ở main. Renderer biết trạng thái qua `AuthStatus` (`anonymous` hay
 * `authenticated` chỉ với `refreshExpiresAt` + `loggedInAt`).
 *
 * Login thật sẽ thuộc APP-005 — file này chỉ đặt type + IPC contract.
 */
import type { IpcResult } from "../ipc";

export type AuthStatus =
  | { kind: "anonymous" }
  | {
      kind: "authenticated";
      refreshExpiresAt: string | null;
      loggedInAt: string;
    };

export type { IpcResult };

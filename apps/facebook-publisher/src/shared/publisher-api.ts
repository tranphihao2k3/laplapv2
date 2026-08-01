/**
 * Shared type definitions exposed to renderer.
 *
 * Renderer chỉ nên `import type` từ đây (không kéo theo electron).
 * Implementation thực sự nằm ở preload/index.ts và chỉ expose object
 * `publisherApi` qua contextBridge — không có require/electron ngoài.
 */
import type { IpcResult } from "../ipc";

export type { IpcResult };

export interface PublisherApi {
  getAppVersion: () => Promise<IpcResult<string>>;
}

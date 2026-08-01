/**
 * Electron preload — typed bridge giữa main và renderer.
 *
 * APP-002 hardening:
 *  - Chỉ gọi đúng channel allowlist trong shared/ipc.ts. Channel name
 *    được giấu — renderer không có cách nào tự truyền channel khác.
 *  - Payload được Zod validate ở cả 2 phía: preload (fail-fast khi renderer
 *    gửi sai), main (defense in depth).
 *  - contextBridge.exposeInMainWorld chỉ lộ object `publisherApi` —
 *    KHÔNG để lộ electron, ipcRenderer, require, Buffer.
 */
import { contextBridge, ipcRenderer } from "electron";
import { z } from "zod";
import { IpcChannel } from "../shared/ipc";
import type { IpcResult, PublisherApi } from "../shared/publisher-api";

/**
 * Schema đối chiếu main/ipc.ts. Preload validate TRƯỚC khi gửi sang main
 * để: (a) fail-fast cho dev, (b) tránh 1 hop IPC vô ích, (c) đảm bảo
 * main cũng có schema riêng nhưng khớp shape để defense in depth.
 */
const getAppVersionInputSchema = z.tuple([]);

function invoke<TArgs extends unknown[], TData>(
  channel: (typeof IpcChannel)[keyof typeof IpcChannel],
  schema: z.ZodType<TArgs>,
  ...args: TArgs
): Promise<IpcResult<TData>> {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    return Promise.resolve({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Invalid payload for ${channel}: ${parsed.error.issues
          .map((i) => i.path.join(".") || "(root)")
          .join(", ")}`,
      },
    });
  }
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<TData>>;
}

const api: PublisherApi = {
  getAppVersion: () => invoke(IpcChannel.AppGetVersion, getAppVersionInputSchema),
};

try {
  contextBridge.exposeInMainWorld("publisherApi", api);
} catch (err) {
  // contextBridge throw nếu contextIsolation=false (cấu hình sai).
  // APP-002 enforce contextIsolation=true trong main — log để debug.
  console.error("[preload] failed to expose publisherApi:", err);
}

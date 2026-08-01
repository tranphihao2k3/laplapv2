/**
 * Electron preload — typed bridge giữa main và renderer.
 *
 * APP-002 mới chốt API surface đầy đủ (auth, settings, queue, products).
 * Stub này chỉ expose 1 hàm demo để APP-001 typecheck/build pass.
 * Khi mở rộng: thêm method vào interface `PublisherApi` BÊN DƯỚI,
 * implement ở main, gọi qua ipcRenderer.invoke với channel allowlist.
 */
import { contextBridge } from "electron";

export interface PublisherApi {
  /** Trả version của app — dùng cho About dialog và diagnostics. */
  getAppVersion: () => Promise<string>;
}

const api: PublisherApi = {
  async getAppVersion() {
    // Tránh require trực tiếp 'electron' ở main từ renderer — main process
    // sẽ xử lý qua IPC ở APP-002. Tạm thời trả process.versions.electron
    // vì preload chạy trong cùng process với main nhưng có contextIsolation.
    return process.versions.electron ?? "unknown";
  },
};

try {
  contextBridge.exposeInMainWorld("publisherApi", api);
} catch (err) {
  // contextBridge throw nếu contextIsolation=false (cấu hình sai).
  // APP-002 sẽ enforce contextIsolation=true — log để debug khi scaffold.
  console.error("[preload] failed to expose publisherApi:", err);
}

export type { PublisherApi };

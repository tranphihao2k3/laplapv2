/**
 * Shared IPC contract — dùng chung main, preload, renderer.
 *
 * Channel name là string literal KHÔNG lộ ra renderer; preload phải dùng
 * đúng tên này để qua allowlist `ipcMain.handle` ở main. Renderer không
 * trực tiếp thấy channel — chỉ thấy method trên `publisherApi`.
 */
export const IpcChannel = {
  AppGetVersion: "app:get-version",
} as const;
export type IpcChannelValue = (typeof IpcChannel)[keyof typeof IpcChannel];

/** Kết quả IPC chuẩn — renderer xử lý theo discriminator `ok`. */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

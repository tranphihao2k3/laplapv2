/**
 * Shared error class dùng chung main + preload + renderer.
 * Mọi AppError đều có code string để renderer/i18n dịch nghĩa.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Các error code dùng trong IPC. Định nghĩa tập trung để dễ dịch nghĩa UI. */
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

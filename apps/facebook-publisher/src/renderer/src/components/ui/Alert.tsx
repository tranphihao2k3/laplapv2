/**
 * Alert — banner inline cho info/error/warning/success.
 *
 * Variants:
 *  - danger: lỗi (vd API fail).
 *  - warning: cảnh báo.
 *  - success: thông báo thành công.
 *  - info: thông tin thường.
 */
import type { ReactNode } from "react";
import { IconAlert, IconCircleCheck } from "./icons";

type Variant = "danger" | "warning" | "success" | "info";

type Props = {
  variant?: Variant;
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
};

const variantClass: Record<Variant, string> = {
  danger: "border-danger-200 bg-danger-50 text-danger-700",
  warning: "border-warning-200 bg-warning-50 text-warning-700",
  success: "border-success-200 bg-success-50 text-success-700",
  info: "border-primary-200 bg-primary-50 text-primary-700",
};

const defaultIcon: Record<Variant, ReactNode> = {
  danger: <IconAlert size={18} />,
  warning: <IconAlert size={18} />,
  success: <IconCircleCheck size={18} />,
  info: <IconAlert size={18} />,
};

export function Alert({ variant = "info", title, children, icon, onClose }: Props) {
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={[
        "flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm",
        variantClass[variant],
      ].join(" ")}
    >
      <span className="mt-0.5 shrink-0">{icon ?? defaultIcon[variant]}</span>
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-xs opacity-90" : ""}>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="shrink-0 rounded p-0.5 opacity-70 transition hover:bg-black/5 hover:opacity-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
/**
 * Button — primary action component.
 *
 * Variants:
 *  - primary: brand blue (CTA chính).
 *  - secondary: white surface, border (hành động phụ).
 *  - ghost: không border, dùng trong toolbar.
 *  - danger: red (xoá, emergency stop).
 *  - success: green (start worker).
 *  - warning: amber (pause).
 *
 * Size: sm (h-8), md (h-9), lg (h-10). Touch target ≥ 36-40px.
 *
 * State:
 *  - loading: spinner + disabled, giữ width (tránh layout shift).
 *  - disabled: opacity 0.5 + cursor-not-allowed.
 *
 * Hover/active/focus ring theo design system.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { IconSpinner } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-primary-300",
  secondary:
    "bg-white text-muted-800 border border-muted-200 hover:bg-muted-50 hover:border-muted-300 active:bg-muted-100 disabled:bg-muted-50 disabled:text-muted-400",
  ghost:
    "bg-transparent text-muted-700 hover:bg-muted-100 active:bg-muted-200 disabled:text-muted-400",
  danger:
    "bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 disabled:bg-danger-300",
  success:
    "bg-success-600 text-white hover:bg-success-700 active:bg-success-700 disabled:bg-success-300",
  warning:
    "bg-warning-600 text-white hover:bg-warning-700 active:bg-warning-700 disabled:bg-warning-300",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3 text-sm gap-2",
  lg: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconRight,
  block = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center rounded-md font-medium",
        "transition duration-fast ease-out",
        "focus-visible:outline-none focus-visible:shadow-ring focus-visible:ring-0",
        "disabled:cursor-not-allowed",
        variantClass[variant],
        sizeClass[size],
        block ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? <IconSpinner size={size === "sm" ? 14 : 16} className="animate-spin-slow" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}
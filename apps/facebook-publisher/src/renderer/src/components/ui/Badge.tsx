/**
 * Badge — small status pill (state, count, label).
 *
 * Variants theo semantic:
 *  - neutral: muted gray (mặc định).
 *  - primary: blue tint.
 *  - success: green tint.
 *  - warning: amber tint.
 *  - danger: red tint.
 *
 * Size: sm (h-5), md (h-6).
 */
import type { HTMLAttributes, ReactNode } from "react";

type Variant = "neutral" | "primary" | "success" | "warning" | "danger";
type Size = "sm" | "md";

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  size?: Size;
  dot?: boolean;
  children?: ReactNode;
};

const variantClass: Record<Variant, string> = {
  neutral: "bg-muted-100 text-muted-700",
  primary: "bg-primary-50 text-primary-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
};

const dotColor: Record<Variant, string> = {
  neutral: "bg-muted-500",
  primary: "bg-primary-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
};

const sizeClass: Record<Size, string> = {
  sm: "h-5 px-1.5 text-[10px] gap-1",
  md: "h-6 px-2 text-xs gap-1.5",
};

export function Badge({
  variant = "neutral",
  size = "md",
  dot = false,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full font-medium",
        variantClass[variant],
        sizeClass[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColor[variant]}`} />}
      {children}
    </span>
  );
}
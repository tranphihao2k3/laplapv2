/**
 * Card — surface container có elevation + hover transition.
 *
 * Variants:
 *  - default: trắng + shadow-sm + border mỏng.
 *  - flat: chỉ border, không shadow (cho list dày).
 *  - elevated: shadow-md, dùng cho card nổi bật.
 *
 * Hover: hover:shadow-md + translate-y(-1px) cho cảm giác nổi.
 *
 * Padding scale: sm/md/lg.
 */
import type { HTMLAttributes, ReactNode } from "react";

type Variant = "default" | "flat" | "elevated";
type Padding = "none" | "sm" | "md" | "lg";

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  padding?: Padding;
  interactive?: boolean;
  as?: "div" | "article" | "section";
  children?: ReactNode;
};

const variantClass: Record<Variant, string> = {
  default: "bg-white border border-muted-100 shadow-sm",
  flat: "bg-white border border-muted-100",
  elevated: "bg-white border border-muted-100 shadow-md",
};

const paddingClass: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export function Card({
  variant = "default",
  padding = "md",
  interactive = false,
  as: As = "div",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <As
      className={[
        "rounded-lg",
        variantClass[variant],
        paddingClass[padding],
        interactive
          ? "cursor-pointer transition duration-fast ease-out hover:shadow-md hover:-translate-y-px focus-visible:outline-none focus-visible:shadow-ring"
          : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </As>
  );
}
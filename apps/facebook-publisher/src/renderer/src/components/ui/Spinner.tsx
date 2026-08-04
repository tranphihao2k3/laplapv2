/**
 * Spinner — loading indicator.
 *
 * Variants:
 *  - inline: 14px (trong button).
 *  - md: 24px (full-section).
 *  - lg: 36px (hero).
 *
 * Kèm optional label cho screen reader.
 */
import { IconSpinner } from "./icons";

type Size = "sm" | "md" | "lg";

const sizeClass: Record<Size, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-6 w-6",
  lg: "h-9 w-9",
};

const iconSize: Record<Size, number> = {
  sm: 14,
  md: 24,
  lg: 36,
};

type Props = {
  size?: Size;
  label?: string;
  className?: string;
};

export function Spinner({ size = "md", label = "Đang tải", className = "" }: Props) {
  return (
    <span role="status" aria-live="polite" className={["inline-flex items-center gap-2 text-muted-500", className].join(" ")}>
      <IconSpinner size={iconSize[size]} className={`${sizeClass[size]} animate-spin-slow text-primary-600`} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
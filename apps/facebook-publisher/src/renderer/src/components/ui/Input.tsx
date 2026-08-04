/**
 * Input — form input với label + helper + error state.
 *
 * - Visible label (không chỉ placeholder).
 * - Focus ring primary.
 * - Disabled state rõ ràng.
 * - Error: border-danger + message dưới.
 * - Có thể truyền `iconLeft` (search icon, ...).
 */
import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helper?: string;
  error?: string | null;
  iconLeft?: ReactNode;
};

export function Input({
  label,
  helper,
  error,
  iconLeft,
  className = "",
  id,
  ...rest
}: Props) {
  const inputId = id ?? `input-${label ?? Math.random().toString(36).slice(2, 8)}`;
  const hasError = !!error;
  return (
    <label htmlFor={inputId} className="block">
      {label && (
        <span className="mb-1 block text-xs font-medium text-muted-700">{label}</span>
      )}
      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-400">
            {iconLeft}
          </span>
        )}
        <input
          id={inputId}
          className={[
            "block w-full rounded-md border bg-white text-sm",
            "h-9 px-2.5 transition duration-fast ease-out",
            "placeholder:text-muted-400",
            "focus:outline-none focus:shadow-ring",
            hasError
              ? "border-danger-500 focus:border-danger-500 focus:shadow-ring-danger"
              : "border-muted-200 focus:border-primary-500",
            "disabled:cursor-not-allowed disabled:bg-muted-50 disabled:text-muted-500",
            iconLeft ? "pl-8" : "",
            className,
          ].join(" ")}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${inputId}-err` : helper ? `${inputId}-help` : undefined
          }
          {...rest}
        />
      </div>
      {hasError && (
        <p id={`${inputId}-err`} className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      )}
      {!hasError && helper && (
        <p id={`${inputId}-help`} className="mt-1 text-xs text-muted-500">
          {helper}
        </p>
      )}
    </label>
  );
}
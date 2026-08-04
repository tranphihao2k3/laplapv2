/**
 * EmptyState — placeholder khi list rỗng.
 *
 * - Icon (SVG, không emoji).
 * - Title + mô tả.
 * - CTA tuỳ chọn (vd "Đồng bộ ngay", "Tạo mẫu").
 */
import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted-100 text-muted-500">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-muted-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
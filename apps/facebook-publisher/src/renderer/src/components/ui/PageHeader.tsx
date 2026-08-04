/**
 * PageHeader — header nhất quán cho mọi page.
 *
 * - Title + subtitle (mô tả ngắn hoặc metadata).
 * - Action bên phải (vd nút "+ Tạo").
 * - Optional: badge ngay sau title.
 */
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, badge, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-muted-100 pb-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-muted-900">{title}</h1>
          {badge}
        </div>
        {subtitle && <div className="mt-0.5 text-xs text-muted-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Số lượng item con đã điền (hiện thành badge bên cạnh tiêu đề) */
  badge?: number | string | null;
  /** Mặc định đóng/mở */
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * Section collapsible đơn giản — không cần thư viện ngoài.
 * Click vào header để toggle, animation chevron xoay.
 */
export function Section({ title, description, icon, badge, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/40"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          />
          {icon}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{title}</span>
              {badge != null && badge !== 0 && badge !== "" && (
                <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {badge}
                </span>
              )}
            </div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        </div>
      </button>
      {open && <div className="border-t px-4 py-4">{children}</div>}
    </div>
  );
}

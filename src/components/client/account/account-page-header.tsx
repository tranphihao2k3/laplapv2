"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ACCOUNT_NAV, isAccountNavActive } from "./account-nav";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  /** Optional: render slot on right side of header (e.g. CTA buttons). */
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Page header cho /account/* pages — breadcrumb + title + actions.
 * Dùng đồng nhất visual cho toàn bộ protected pages.
 */
export function AccountPageHeader({ title, description, actions, className }: Props) {
  const pathname = usePathname();
  const active = ACCOUNT_NAV.find((n) => isAccountNavActive(pathname, n.href));
  const crumbs = pathname?.split("/").filter(Boolean) ?? [];

  return (
    <div className={cn("mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {crumbs.length > 1 && (
          <nav className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/account" className="hover:text-primary">
              Tài khoản
            </Link>
            {crumbs.slice(1).map((c, i) => {
              const href = "/" + crumbs.slice(0, i + 2).join("/");
              const last = i === crumbs.length - 2;
              return (
                <span key={href} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  {last ? (
                    <span className="text-foreground">{active?.label ?? c}</span>
                  ) : (
                    <Link href={href} className="hover:text-primary">
                      {c}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        )}
        <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="group flex flex-wrap items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-sm transition-colors hover:border-primary/30 sm:gap-2 sm:px-4 sm:py-2"
    >
      {items.map((item, idx) => {
        const isFirst = idx === 0;
        return (
          <span
            key={idx}
            className="flex items-center gap-1.5 transition-opacity"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {idx > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-primary/60" />
            )}
            {item.href ? (
              <Link
                href={item.href}
                className="group/link inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-muted-foreground transition-all hover:bg-primary/5 hover:text-foreground"
              >
                {isFirst && (
                  <Home className="h-3.5 w-3.5 transition-transform group-hover/link:-translate-y-0.5" />
                )}
                <span className="hover-underline-grow">{item.label}</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-foreground/[0.04] px-2 py-0.5 font-medium text-foreground">
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

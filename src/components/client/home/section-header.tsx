"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <Reveal variant="fade-up" threshold={0.08}>
      <div
        className={cn(
          "mb-6 gap-4 sm:mb-8",
          centered ? "flex flex-col items-center text-center" : "flex flex-col sm:flex-row sm:items-end sm:justify-between",
          className,
        )}
      >
        <div className={cn("max-w-2xl", centered && "flex flex-col items-center")}>
          {eyebrow && (
            <div className={cn("mb-2 flex items-center gap-2", centered && "justify-center")}>
              <span className="h-px w-6 bg-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</span>
            </div>
          )}
          <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
          {description && (
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {action && (
          <Link
            href={action.href}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors sm:self-auto"
          >
            {action.label} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </Reveal>
  );
}

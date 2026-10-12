"use client";

/**
 * Accordion đơn giản, dùng native <details> để tránh kéo thêm dependency Radix.
 * Dùng cho FAQ trong landing page /test-laptop.
 */
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type AccordionContextValue = {
  openValue: string | null;
  setOpenValue: (v: string | null) => void;
  type: "single" | "multiple";
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function useAccordionContext(component: string) {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) {
    throw new Error(`${component} phải nằm trong <Accordion>`);
  }
  return ctx;
}

export function Accordion({
  type = "single",
  collapsible = true,
  className,
  children,
  defaultValue,
}: {
  type?: "single" | "multiple";
  collapsible?: boolean;
  className?: string;
  children: React.ReactNode;
  defaultValue?: string | string[];
}) {
  // Luôn quản lý state nội bộ cho gọn; phục vụ 'single' collapsible là đủ cho FAQ.
  const [openValue, setOpenValue] = React.useState<string | null>(() => {
    if (type === "single") {
      return Array.isArray(defaultValue) ? defaultValue[0] ?? null : defaultValue ?? null;
    }
    return null;
  });

  return (
    <AccordionContext.Provider value={{ openValue, setOpenValue, type }}>
      <div className={cn("w-full", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { openValue, setOpenValue, type } = useAccordionContext("AccordionItem");
  const isOpen = type === "single" ? openValue === value : false;
  const toggle = () => {
    if (type === "single") {
      setOpenValue(isOpen ? null : value);
    }
  };

  return (
    <div
      data-state={isOpen ? "open" : "closed"}
      data-value={value}
      className={cn("border-b border-zinc-200 last:border-b-0", className)}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        if (child.type === AccordionTrigger) {
          return React.cloneElement(child as React.ReactElement<{ onClick: () => void; open: boolean }>, {
            onClick: toggle,
            open: isOpen,
          });
        }
        if (child.type === AccordionContent) {
          return React.cloneElement(child as React.ReactElement<{ open: boolean }>, {
            open: isOpen,
          });
        }
        return child;
      })}
    </div>
  );
}

export function AccordionTrigger({
  className,
  children,
  onClick,
  open,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  open?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center justify-between gap-2 py-3.5 text-left text-sm font-medium transition-colors hover:text-violet-700",
        open && "text-violet-700",
        className,
      )}
    >
      <span className="flex-1">{children}</span>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

export function AccordionContent({
  className,
  children,
  open,
}: {
  className?: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  if (!open) return null;
  return (
    <div className={cn("pb-4 text-sm leading-relaxed text-muted-foreground", className)}>
      {children}
    </div>
  );
}

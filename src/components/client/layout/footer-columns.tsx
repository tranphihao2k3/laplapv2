"use client";

/**
 * FooterColumns — render link columns của footer.
 *
 * Mobile (<lg): mỗi cột là một accordion item collapsed theo mặc định,
 * giúp footer gọn đi rất nhiều so với việc list thẳng 3×5=15 link ra ngoài.
 * Desktop (lg+): render expanded list giống layout cũ để không phá design.
 *
 * Tách file riêng (thay vì để trong client-footer.tsx) vì file cha là server
 * component (async, data fetching từ Supabase). Một file chỉ có thể ở một
 * boundary server/client trong Next.js App Router.
 */
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { FooterColumn } from "@/lib/footer-settings";

export function FooterColumns({ columns }: { columns: FooterColumn[] }) {
  if (columns.length === 0) return null;

  return (
    <>
      {/* Mobile: accordion collapsed, mỗi cột là một trong tick được. */}
      <div className="lg:hidden">
        <Accordion type="single" collapsible className="w-full">
          {columns.map((column) => (
            <AccordionItem key={column.id} value={column.id}>
              <AccordionTrigger className="py-3 text-sm font-semibold tracking-wide hover:text-foreground">
                <span className="flex-1">{column.title}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <ul className="space-y-2">
                  {column.links.map((link) => (
                    <li key={link.id}>
                      <Link
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Desktop: 3 cột expanded, giữ nguyên layout cũ. */}
      {columns.map((column) => (
        <div key={column.id} className="hidden space-y-3 lg:block">
          <h4 className="text-sm font-semibold tracking-wide">{column.title}</h4>
          <ul className="space-y-2">
            {column.links.map((link) => (
              <li key={link.id}>
                <Link
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
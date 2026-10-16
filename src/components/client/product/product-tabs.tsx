"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  hasSpecs: boolean;
  description: React.ReactNode;
  specs: React.ReactNode;
  policy: React.ReactNode;
};

/**
 * Sticky tabs cho mobile: khi user cuộn xuống khỏi tabs header,
 * tabs sẽ "pin" vào top viewport với backdrop blur + shadow.
 * Trên desktop giữ nguyên behavior bình thường (không sticky).
 */
export function ProductTabs({ hasSpecs, description, specs, policy }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    // Chỉ apply sticky trên mobile (< lg)
    const media = window.matchMedia("(max-width: 1023px)");
    if (!media.matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setStuck(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px 0px 0px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Sentinel — invisible div above tabs, used to detect "tab header out of view" */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      <Tabs defaultValue="description" className="w-full">
        {/* Sticky wrapper chỉ active khi stuck=true trên mobile */}
        <div
          className={
            stuck
              ? "sticky top-0 z-30 -mx-4 border-b bg-background/90 px-4 pb-2 pt-2 shadow-sm backdrop-blur-md transition-all sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:shadow-none sm:backdrop-blur-0"
              : "relative sm:static"
          }
        >
          <div className="relative -mx-1 overflow-x-auto px-1 scrollbar-none sm:mx-0 sm:px-0">
            <TabsList className="inline-flex h-auto w-auto min-w-full gap-1 rounded-2xl border bg-card/80 p-1 shadow-sm backdrop-blur-sm sm:flex">
              <TabsTrigger
                value="description"
                className="tab-underline relative whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-fuchsia-500/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:text-sm"
              >
                Mô tả chi tiết
              </TabsTrigger>
              {hasSpecs && (
                <TabsTrigger
                  value="specs"
                  className="tab-underline relative whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-fuchsia-500/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:text-sm"
                >
                  Thông số kỹ thuật
                </TabsTrigger>
              )}
              <TabsTrigger
                value="policy"
                className="tab-underline relative whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-fuchsia-500/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:text-sm"
              >
                Bảo hành &amp; Chính sách
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="description" className="mt-4 animate-fade-in-up sm:mt-8">
          {description}
        </TabsContent>

        {hasSpecs && (
          <TabsContent value="specs" className="mt-4 animate-fade-in-up sm:mt-8">
            {specs}
          </TabsContent>
        )}

        <TabsContent value="policy" className="mt-4 animate-fade-in-up sm:mt-8">
          {policy}
        </TabsContent>
      </Tabs>
    </>
  );
}

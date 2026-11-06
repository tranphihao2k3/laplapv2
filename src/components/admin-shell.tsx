"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useBrandName } from "@/lib/hooks/use-brand";

type AdminShellUser = {
  name: string;
  email: string;
  avatar?: string;
};

export function AdminShell({
  user,
  children,
}: {
  user: AdminShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const brandName = useBrandName();

  if (pathname === "/quanly/pos") {
    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3 bg-card lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 px-2">
              <Link href="/quanly">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Quay lại Dashboard</span>
              </Link>
            </Button>
            <Separator orientation="vertical" className="hidden h-4 shrink-0 sm:block" />
            <h1 className="min-w-0 truncate text-xs font-semibold uppercase tracking-tight text-primary sm:text-sm">
              Máy bán hàng POS
            </h1>
          </div>
          <div className="hidden shrink-0 font-mono text-xs text-muted-foreground md:block">
            {`Hệ thống ${brandName} v1.0`}
          </div>
        </header>
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-4">
          {children}
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" user={user} />
      <SidebarInset className="min-w-0 md:peer-data-[variant=inset]:ml-2">
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2 px-3 sm:px-4 md:px-6">
            <div key={pathname} className="flex min-w-0 flex-col gap-4 py-4 animate-fade-in md:gap-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

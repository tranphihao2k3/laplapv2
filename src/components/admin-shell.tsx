"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

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

  if (pathname === "/quanly/pos") {
    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center justify-between border-b px-4 lg:px-6 bg-card">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <Link href="/quanly">
                <ArrowLeft className="h-4 w-4" />
                <span>Quay lại Dashboard</span>
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <h1 className="text-sm font-semibold tracking-tight uppercase text-primary">Máy bán hàng POS</h1>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Hệ thống LapLap v1.0
          </div>
        </header>
        <div className="flex-1 overflow-auto p-2 sm:p-4">
          {children}
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" user={user} />
      <SidebarInset className="md:peer-data-[variant=inset]:ml-2">
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2 px-4 md:px-6">
            <div key={pathname} className="flex flex-col gap-4 py-4 animate-fade-in md:gap-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

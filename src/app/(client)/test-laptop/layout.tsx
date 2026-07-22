"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Cpu,
  Camera,
  Volume2,
  Monitor,
  Keyboard,
  Download,
  Trophy,
  Upload,
  Flame,
} from "lucide-react";

const tabs = [
  { id: "ranking",     label: "Bảng xếp hạng", href: "/test-laptop",                icon: Trophy,   exact: true },
  { id: "system-scan", label: "Quét hệ thống",  href: "/test-laptop/system-scan",    icon: Cpu },
  { id: "camera-mic",  label: "Camera & Mic",   href: "/test-laptop/camera-mic",     icon: Camera },
  { id: "speakers",    label: "Loa",            href: "/test-laptop/speakers",       icon: Volume2 },
  { id: "display",     label: "Màn hình",       href: "/test-laptop/display",        icon: Monitor },
  { id: "keyboard",    label: "Bàn phím",       href: "/test-laptop/keyboard",       icon: Keyboard },
  { id: "benchmark",   label: "GPU Benchmark",  href: "/test-laptop/benchmark",      icon: Flame },
  { id: "tools",       label: "Công cụ",        href: "/test-laptop/tools",          icon: Download },
  { id: "submit",      label: "Lưu kết quả",    href: "/test-laptop/submit",         icon: Upload },
];

export default function TestLaptopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-3 py-3 border-b border-zinc-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900">
              <Cpu className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none text-zinc-900">Laptop Test Suite</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Kiểm tra laptop toàn diện</p>
            </div>
          </div>

          {/* Tab navigation */}
          <nav className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href);

              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                    isActive
                      ? "border-zinc-900 text-zinc-900"
                      : "border-transparent text-muted-foreground hover:text-zinc-700 hover:border-zinc-300"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page content */}
      <main>{children}</main>
    </div>
  );
}

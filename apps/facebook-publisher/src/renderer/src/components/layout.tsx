/**
 * Layout shell — top bar + sidebar + main outlet.
 *
 * - Sidebar có icon (SVG), active indicator (vertical bar primary).
 * - Top bar: brand mark + status badge + auth action.
 * - Background app: muted-50 (subtle off-white) → content card nổi bật.
 * - Padding main: page (2rem desktop, 1rem mobile).
 */
import { Link, NavLink, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import { useAppStore, useAuth } from "../store/app-store";
import { Badge, Button } from "./ui";
import {
  IconHistory,
  IconLogout,
  IconPackage,
  IconQueue,
  IconRocket,
  IconSettings,
  IconTemplate,
  IconUsers,
} from "./ui/icons";

function TopBar() {
  const status = useAuth();
  const refresh = useAppStore((s) => s.refreshAuth);
  const logout = useAppStore((s) => s.logout);

  const authenticated = status?.kind === "authenticated";
  const refreshExpires = status?.kind === "authenticated" ? status.refreshExpiresAt : null;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-muted-100 bg-white/90 px-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm">
          <IconRocket size={18} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-muted-900">LapLap Publisher</span>
          <span className="text-[10px] text-muted-500">Facebook auto-poster</span>
        </div>
        <Badge
          variant={authenticated ? "success" : "neutral"}
          size="sm"
          dot
          className="ml-2"
        >
          {authenticated
            ? `Đã đăng nhập${refreshExpires ? ` · ${new Date(refreshExpires).toLocaleDateString("vi-VN")}` : ""}`
            : "Chưa đăng nhập"}
        </Badge>
      </div>
      <div className="flex gap-2">
        {authenticated ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<IconLogout size={14} />}
            onClick={() => {
              void logout().then(() => refresh());
            }}
          >
            Đăng xuất
          </Button>
        ) : (
          <Link to="/login">
            <Button variant="primary" size="sm">
              Đăng nhập
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

type NavItem = { to: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { to: "/catalog", label: "Sản phẩm", icon: <IconPackage size={18} /> },
  { to: "/groups", label: "Nhóm Facebook", icon: <IconUsers size={18} /> },
  { to: "/templates", label: "Mẫu đăng", icon: <IconTemplate size={18} /> },
  { to: "/campaigns", label: "Chiến dịch", icon: <IconRocket size={18} /> },
  { to: "/queue", label: "Queue", icon: <IconQueue size={18} /> },
  { to: "/history", label: "Lịch sử", icon: <IconHistory size={18} /> },
  { to: "/settings", label: "Cấu hình", icon: <IconSettings size={18} /> },
];

function Sidebar() {
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-muted-100 bg-white px-3 py-4">
      <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-400">
        Menu
      </p>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [
              "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition duration-fast",
              "focus-visible:outline-none focus-visible:shadow-ring",
              isActive
                ? "bg-primary-50 font-medium text-primary-700"
                : "text-muted-700 hover:bg-muted-50 hover:text-muted-900",
            ].join(" ")
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary-600"
                />
              )}
              <span
                className={
                  isActive
                    ? "text-primary-600"
                    : "text-muted-400 transition group-hover:text-muted-600"
                }
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function Layout() {
  return (
    <div className="flex h-screen flex-col bg-muted-50">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
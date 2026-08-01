/**
 * Layout shell — top bar + sidebar + main outlet.
 *
 * M3 chỉ là khung điều hướng. Các màn CAT/MED/GRP/TPL/CMP sẽ thêm vào
 * <Outlet />. Nút login/logout + indicator "đồng bộ" ở top bar.
 */
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAppStore, useAuth } from "../store/app-store";

function TopBar() {
  const status = useAuth();
  const refresh = useAppStore((s) => s.refreshAuth);
  const logout = useAppStore((s) => s.logout);

  const authenticated = status?.kind === "authenticated";

  return (
    <header className="flex items-center justify-between border-b border-muted-100 bg-white px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">LapLap Facebook Publisher</span>
        <span className="rounded bg-muted-50 px-2 py-0.5 text-xs text-muted-500">
          {authenticated ? `Đã đăng nhập${status?.kind === "authenticated" && status.refreshExpiresAt ? ` · hết hạn ${new Date(status.refreshExpiresAt).toLocaleDateString("vi-VN")}` : ""}` : "Chưa đăng nhập"}
        </span>
      </div>
      <div className="flex gap-2">
        {authenticated ? (
          <button
            type="button"
            className="rounded border border-muted-100 px-3 py-1 text-xs hover:bg-muted-50"
            onClick={() => {
              void logout().then(() => refresh());
            }}
          >
            Đăng xuất
          </button>
        ) : (
          <Link
            to="/login"
            className="rounded bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-700"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}

function Sidebar() {
  const items = [
    { to: "/catalog", label: "Sản phẩm" },
    { to: "/groups", label: "Nhóm Facebook" },
    { to: "/templates", label: "Mẫu đăng" },
    { to: "/settings", label: "Cấu hình" },
  ];
  return (
    <nav className="w-56 shrink-0 border-r border-muted-100 bg-white p-3 text-sm">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `block rounded px-3 py-2 hover:bg-muted-50 ${
                  isActive ? "bg-primary-50 text-primary-700" : "text-muted-900"
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Layout() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
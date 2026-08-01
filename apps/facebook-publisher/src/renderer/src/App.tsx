/**
 * App root — Router + bootstrap.
 *
 * Mount trong main.tsx. Bootstrap gọi publisherApi.authGetStatus +
 * settingsGet song song → render Layout với auth guard tuỳ route.
 *
 * Trong M3, các route /catalog, /groups, /templates là placeholder —
 * CAT-001 / GRP-001 / TPL-001 sẽ gắn vào sau.
 */
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout";
import { useAppStore, useAuth } from "./store/app-store";
import { CatalogPage } from "./pages/catalog";
import { GroupsPage } from "./pages/groups";
import { TemplatesPage } from "./pages/templates";
import { SettingsPage } from "./pages/settings";
import { LoginPage } from "./pages/login";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuth();
  // status null = chưa bootstrap; hiển thị loading ngắn.
  if (status === null) return <p className="text-sm text-muted-500">Đang tải…</p>;
  if (status.kind !== "authenticated") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  const bootstrap = useAppStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/catalog" replace />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
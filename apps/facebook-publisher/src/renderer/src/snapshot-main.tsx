/**
 * Snapshot entry — giống renderer/src/main.tsx nhưng dùng HashRouter.
 *
 * BrowserRouter không hoạt động với file:// scheme (Electron load snapshot
 * HTML qua file://). HashRouter đọc hash từ window.location.hash — match
 * đúng với URL `file:///path/index.html#/catalog` mà snapshot script tạo ra.
 *
 * Boot giống production main.tsx (load CSS, expose store, set bypass flag
 * từ localStorage), nhưng KHÔNG gọi publisherApi.authGetStatus — snapshot
 * mode set status qua main process executeJavaScript sau khi mount.
 */
import "./styles.css";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout";
import { useAppStore } from "./store/app-store";
import { CatalogPage } from "./pages/catalog";
import { GroupsPage } from "./pages/groups";
import { TemplatesPage } from "./pages/templates";
import { SettingsPage } from "./pages/settings";
import { LoginPage } from "./pages/login";
import { CampaignPage } from "./pages/campaign";
import { QueuePage } from "./pages/queue";
import { HistoryPage } from "./pages/history";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAppStore((s) => s.status);
  // Snapshot mode luôn bypass — set qua window flag bởi snapshot/index.html
  // hoặc qua localStorage nếu page reload.
  if (typeof window !== "undefined") {
    const wFlag = (window as unknown as { __SNAPSHOT_BYPASS__?: boolean }).__SNAPSHOT_BYPASS__;
    let lsFlag = false;
    try {
      lsFlag = localStorage.getItem("__SNAPSHOT_BYPASS__") === "1";
    } catch {
      // ignore
    }
    if (wFlag || lsFlag) {
      return <>{children}</>;
    }
  }
  if (status === null) return <p className="text-sm text-muted-500">Đang tải…</p>;
  if (status.kind !== "authenticated") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <HashRouter>
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
          <Route path="/campaigns" element={<CampaignPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root container in snapshot/index.html");

(window as unknown as { __APP_STORE__: typeof useAppStore }).__APP_STORE__ = useAppStore;
try {
  if (localStorage.getItem("__SNAPSHOT_BYPASS__") === "1") {
    (window as unknown as { __SNAPSHOT_BYPASS__: boolean }).__SNAPSHOT_BYPASS__ = true;
  }
} catch {
  // ignore
}

createRoot(container).render(<App />);

// Báo cho main process biết mount OK.
try {
  if ((window as unknown as { __SNAPSHOT_BYPASS__?: boolean }).__SNAPSHOT_BYPASS__) {
    (window as unknown as { __SNAPSHOT_MOUNTED__: boolean }).__SNAPSHOT_MOUNTED__ = true;
  }
} catch {
  // ignore
}
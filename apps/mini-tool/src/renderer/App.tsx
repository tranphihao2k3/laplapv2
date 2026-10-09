import * as React from "react";
import {
  LayoutDashboard,
  Link2,
  Cpu,
  Gauge,
  Wrench,
  ClipboardCheck,
  Send,
  LogOut,
  User,
  Sparkles,
  X,
} from "lucide-react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SessionStoreProvider, useSessionStore } from "@/store";
import { Dashboard } from "@/pages/Dashboard";
import { ConnectTab } from "@/pages/ConnectTab";
import { HardwareTab } from "@/pages/HardwareTab";
import { BenchmarkTab } from "@/pages/BenchmarkTab";
import { OptimizeTab } from "@/pages/OptimizeTab";
import { TestTab } from "@/pages/TestTab";
import { UploadTab } from "@/pages/UploadTab";
import { cn } from "@/lib/utils";

interface TabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "connect", label: "Kết nối", icon: Link2 },
  { id: "hardware", label: "Phần cứng", icon: Cpu },
  { id: "benchmark", label: "Benchmark", icon: Gauge },
  { id: "test", label: "Kiểm tra", icon: ClipboardCheck },
  { id: "optimize", label: "Tối ưu", icon: Wrench },
  { id: "upload", label: "Tải lên", icon: Send },
];

interface ErrorBoundaryState {
  error: Error | null;
}

class TabErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[TabErrorBoundary]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-semibold">Đã xảy ra lỗi:</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/40 bg-card/30 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Sidebar({
  active,
  onChange,
  appVersion,
}: {
  active: string;
  onChange: (id: string) => void;
  appVersion: string;
}) {
  const { ktvMode, setKtvMode, settings, updateSettings, resetAll } = useSessionStore();
  const [showSettings, setShowSettings] = React.useState(false);
  const [showAccount, setShowAccount] = React.useState(false);

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-slate-800/60 bg-slate-950/95 backdrop-blur-md">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 blur-md opacity-50" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold shadow-[0_0_20px_rgba(34,211,238,0.4)]">
            LL
          </div>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            LapLap
          </span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Mini Tool · v{appVersion}
          </span>
        </div>
      </div>

      <Separator className="bg-slate-800/60" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Tính năng
        </p>
        <ul className="space-y-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => onChange(tab.id)}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.18)] border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isActive ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300",
                    )}
                  />
                  {tab.label}
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="px-2 pt-6 pb-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Tuỳ chọn
        </p>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setShowAccount(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 transition-colors"
          >
            <User className="h-4 w-4 text-slate-500" />
            Tài khoản
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 transition-colors"
          >
            <Sparkles className="h-4 w-4 text-slate-500" />
            Cài đặt
          </button>
        </div>
      </nav>

      {/* Bottom: KTV + Thoát */}
      <Separator className="bg-slate-800/60" />
      <div className="px-3 py-3 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2 border border-slate-800/40">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Sparkles
              className={cn(
                "h-3 w-3",
                ktvMode ? "text-emerald-400" : "text-slate-500",
              )}
            />
            <span>Chế độ KTV</span>
          </div>
          <Switch checked={ktvMode} onCheckedChange={setKtvMode} aria-label="KTV mode" />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 text-slate-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => window.close()}
        >
          <LogOut className="h-4 w-4" />
          Thoát
        </Button>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cài đặt</DialogTitle>
            <DialogDescription>
              Tùy chỉnh hành vi của app. Settings được lưu cục bộ trên máy này.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Giao diện
              </p>
              <SettingRow
                label="Dark theme"
                description="Giao diện tối (hiện tại luôn bật)."
                checked={settings.darkTheme}
                onChange={(v) => updateSettings({ darkTheme: v })}
              />
              <SettingRow
                label="Chế độ KTV mặc định"
                description="Mở app sẽ tự bật chế độ KTV."
                checked={settings.ktvModeDefault}
                onChange={(v) => updateSettings({ ktvModeDefault: v })}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quét
              </p>
              <SettingRow
                label="Tự quét phần cứng khi mở app"
                description="Tab Phần cứng sẽ tự động bắt đầu quét ngay khi mở app."
                checked={settings.autoScanOnStartup}
                onChange={(v) => updateSettings({ autoScanOnStartup: v })}
              />
            </div>
            <Separator />
            <div className="rounded-lg border border-border/40 bg-card/30 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Reset toàn bộ</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Xoá hardware, benchmark, tests và session đã lưu. Không ảnh hưởng settings.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetAll();
                    alert("Đã reset toàn bộ dữ liệu");
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
            <Separator />
            <div className="rounded-lg border border-border/40 bg-card/30 px-3 py-2.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">LapLap Mini Tool</p>
              <p className="mt-0.5">Phiên bản {appVersion}</p>
              <p className="mt-0.5">
                Electron {window.lap?.versions?.electron ?? "?"} · Node {window.lap?.versions?.node ?? "?"} · {window.lap?.platform ?? "?"}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAccount} onOpenChange={setShowAccount}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tài khoản</DialogTitle>
            <DialogDescription>
              Tính năng đồng bộ đám mây sẽ được thêm trong bản cập nhật tiếp theo.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/40 bg-card/30 px-3 py-4 text-xs text-muted-foreground">
            Hiện tại bạn đang dùng chế độ local. Tất cả dữ liệu (hardware, benchmark, tests, settings) lưu trên máy này.
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

export function App() {
  const [appVersion, setAppVersion] = React.useState("0.1.0");
  const [activeTab, setActiveTab] = React.useState("dashboard");

  React.useEffect(() => {
    void window.lap.upload
      .status()
      .then((res) => {
        if (res.ok && res.data?.appVersion) setAppVersion(res.data.appVersion);
      })
      .catch(() => undefined);
  }, []);

  return (
    <SessionStoreProvider>
      <TooltipProvider delayDuration={150}>
        <div className="flex h-screen overflow-hidden bg-slate-950 text-foreground">
          <Sidebar active={activeTab} onChange={setActiveTab} appVersion={appVersion} />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1480px] px-6 py-5">
              {activeTab === "dashboard" && <Dashboard />}
              {activeTab === "connect" && <ConnectTab />}
              {activeTab === "hardware" && (
                <TabErrorBoundary>
                  <HardwareTab />
                </TabErrorBoundary>
              )}
              {activeTab === "benchmark" && (
                <TabErrorBoundary>
                  <BenchmarkTab />
                </TabErrorBoundary>
              )}
              {activeTab === "test" && (
                <TabErrorBoundary>
                  <TestTab />
                </TabErrorBoundary>
              )}
              {activeTab === "optimize" && (
                <TabErrorBoundary>
                  <OptimizeTab />
                </TabErrorBoundary>
              )}
              {activeTab === "upload" && (
                <TabErrorBoundary>
                  <UploadTab />
                </TabErrorBoundary>
              )}
            </div>
          </main>

          <Toaster position="top-right" />
        </div>
      </TooltipProvider>
    </SessionStoreProvider>
  );
}

export default App;

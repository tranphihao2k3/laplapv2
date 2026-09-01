// Header.tsx
import { Laptop, Settings, ShieldCheck, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useSessionStore } from "@/store";

interface HeaderProps {
  appVersion: string;
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

export function Header({ appVersion }: HeaderProps) {
  const { ktvMode, setKtvMode, settings, updateSettings, resetAll } = useSessionStore();

  const handleResetAll = () => {
    resetAll();
    toast.success("Đã reset toàn bộ dữ liệu");
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Laptop className="h-5 w-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">LapLap Mini Tool</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            v{appVersion}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground sm:flex"
          title={ktvMode
            ? "Đang bật: hiện các thao tác nâng cao (Xoá thùng rác, Tắt ứng dụng khởi động, Defrag, Tắt BitLocker, Đổi tên máy)."
            : "Bật để hiện thao tác nâng cao (KTV = Kỹ Thuật Viên)."}
        >
          <ShieldCheck className={`h-3.5 w-3.5 ${ktvMode ? "text-emerald-500" : "text-zinc-400"}`} />
          <span>Chế độ KTV</span>
          <Switch
            checked={ktvMode}
            onCheckedChange={setKtvMode}
            aria-label="Bật chế độ KTV"
          />
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Cài đặt">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cài đặt</DialogTitle>
              <DialogDescription>
                Tùy chỉnh hành vi của app. Settings được lưu cục bộ trên máy này.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* KTV Mode */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Giao diện</p>
                <SettingRow
                  label="Chế độ KTV mặc định"
                  description="Mở app sẽ tự bật chế độ KTV (hiện tất cả thao tác nâng cao)."
                  checked={settings.ktvModeDefault}
                  onChange={(v) => updateSettings({ ktvModeDefault: v })}
                />
                <SettingRow
                  label="Dark theme"
                  description="Giao diện tối (hiện tại luôn bật)."
                  checked={settings.darkTheme}
                  onChange={(v) => updateSettings({ darkTheme: v })}
                />
              </div>

              <Separator />

              {/* Scan */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quét</p>
                <SettingRow
                  label="Tự quét phần cứng khi mở app"
                  description="Tab Phần cứng sẽ tự động bắt đầu quét ngay khi mở app."
                  checked={settings.autoScanOnStartup}
                  onChange={(v) => updateSettings({ autoScanOnStartup: v })}
                />
              </div>

              <Separator />

              {/* Test */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kiểm tra</p>
                <SettingRow
                  label="Bật test loa khi mở app"
                  description="Tự động phát test tone khi mở tab Kiểm tra."
                  checked={settings.soundTestEnabled}
                  onChange={(v) => updateSettings({ soundTestEnabled: v })}
                />
              </div>

              <Separator />

              {/* Reset */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dữ liệu</p>
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
                      onClick={handleResetAll}
                      className="ml-3 shrink-0"
                    >
                      <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* About */}
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
      </div>
    </header>
  );
}

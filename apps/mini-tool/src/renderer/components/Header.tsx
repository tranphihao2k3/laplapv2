import { Laptop, Settings, ShieldCheck } from "lucide-react";

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
import { useSessionStore } from "@/store";

interface HeaderProps {
  appVersion: string;
}

export function Header({ appVersion }: HeaderProps) {
  const { ktvMode, setKtvMode } = useSessionStore();

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
        <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground sm:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cài đặt</DialogTitle>
              <DialogDescription>
                Tùy chọn cục bộ cho máy KTV.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2">
                <div>
                  <p className="font-medium">Chế độ KTV</p>
                  <p className="text-xs text-muted-foreground">
                    Hiện thêm các tùy chọn tối ưu nâng cao (BitLocker, đổi tên máy, đổi hình nền).
                  </p>
                </div>
                <Switch
                  checked={ktvMode}
                  onCheckedChange={setKtvMode}
                  aria-label="Bật chế độ KTV"
                />
              </div>
              <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Phiên bản</p>
                <p className="mt-0.5">LapLap Mini Tool v{appVersion}</p>
                <p className="mt-0.5">Electron {window.lap?.versions?.electron ?? "?"} · Node {window.lap?.versions?.node ?? "?"}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
// OptimizeTab.tsx — Các thao tác tối ưu máy
import * as React from "react";
import {
  Trash2,
  PowerOff,
  Recycle,
  HardDrive,
  ShieldOff,
  PencilLine,
  Image as ImageIcon,
  AlertTriangle,
  PlayCircle,
  ImagePlus,
  Zap,
  RefreshCcw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSessionStore } from "@/store";

interface OptimizeAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  dangerous?: boolean;
  category: "clean" | "system" | "hardware" | "security";
  run: (setLoading: (v: boolean) => void) => Promise<void>;
}

function runPwshAction(
  setLoading: (v: boolean) => void,
  promise: () => Promise<{ ok: boolean; error?: string }>,
  onSuccess?: string,
): Promise<void> {
  setLoading(true);
  return promise()
    .then((res) => {
      if (res.ok) {
        toast.success(onSuccess ?? "Hoàn tất");
      } else {
        toast.error(res.error ?? "Thất bại");
      }
    })
    .catch((err: Error) => toast.error(err.message))
    .finally(() => setLoading(false)) as unknown as Promise<void>;
}

function buildActions(
  setLoading: (id: string, v: boolean) => void,
  drives: { deviceId: string; volumeName: string | null; freeGb: number; totalGb: number }[],
): OptimizeAction[] {
  const a: OptimizeAction[] = [
    // ── Clean ──────────────────────────────────────────────────────
    {
      id: "clean-temp",
      title: "Dọn rác (Temp + Prefetch)",
      description: "Xoá file tạm trong %TEMP%, %LOCALAPPDATA%\\Temp, C:\\Windows\\Temp và C:\\Windows\\Prefetch.",
      icon: <Trash2 className="h-4 w-4" />,
      category: "clean",
      dangerous: false,
      run: (setL) =>
        runPwshAction(setL, async () => {
          const res = await window.lap.optimize.cleanTemp();
          return res.ok ? { ok: true } : { ok: false, error: res.error };
        }, "Đã dọn file tạm"),
    },
    {
      id: "empty-recycle",
      title: "Làm trống Thùng rác",
      description: "Xoá vĩnh viễn tất cả file trong Recycle Bin của tất cả ổ đĩa.",
      icon: <Recycle className="h-4 w-4" />,
      category: "clean",
      dangerous: true,
      run: (setL) =>
        runPwshAction(setL, async () => {
          const res = await window.lap.optimize.emptyRecycle();
          return res.ok ? { ok: true } : { ok: false, error: res.error };
        }, "Đã làm trống Thùng rác"),
    },
    {
      id: "disable-startup",
      title: "Tắt ứng dụng khởi động",
      description: "Gỡ bỏ các ứng dụng chạy cùng Windows khỏi registry HKCU (HKLM cần quyền admin).",
      icon: <PowerOff className="h-4 w-4" />,
      category: "clean",
      dangerous: true,
      run: (setL) =>
        runPwshAction(setL, async () => {
          const res = await window.lap.optimize.disableStartup();
          if (!res.ok) return { ok: false, error: res.error };
          try {
            const parsed = JSON.parse(res.data?.stdout ?? "{}");
            const disabled = parsed.disabled ?? 0;
            const failed = parsed.failed ?? 0;
            toast.success(`Đã tắt ${disabled} ứng dụng${failed > 0 ? `, ${failed} cần quyền admin` : ""}`);
            return { ok: true };
          } catch {
            return res.ok ? { ok: true } : { ok: false, error: res.error };
          }
        }, "Đã tắt ứng dụng khởi động"),
    },

    // ── Hardware ─────────────────────────────────────────────────
    {
      id: "defrag-hdd",
      title: "Tối ưu / Chống phân mảnh ổ",
      description: "Chạy defrag trên ổ HDD. SSD sẽ tự bỏ qua (Windows tối ưu tự động).",
      icon: <HardDrive className="h-4 w-4" />,
      category: "hardware",
      dangerous: false,
      run: (setL) =>
        runPwshAction(setL, async () => {
          if (drives.length === 0) {
            toast.info("Không tìm thấy ổ đĩa");
            return { ok: true };
          }
          const selectedDrive = drives[0].deviceId.replace(/:/, "");
          const res = await window.lap.optimize.optimizeDrive(selectedDrive);
          if (!res.ok) return { ok: false, error: res.error };
          const out = res.data?.stdout ?? "";
          if (out.includes("SKIP") || out.toLowerCase().includes("ssd")) {
            toast.info("SSD detected — defrag không cần thiết cho SSD");
          } else {
            toast.success("Đã tối ưu ổ " + selectedDrive);
          }
          return { ok: true };
        }, ""),
    },

    // ── Security ────────────────────────────────────────────────
    {
      id: "disable-bitlocker",
      title: "Tắt BitLocker (C:)",
      description: "Giải mã ổ C: — cần quyền admin. Có thể mất nhiều giờ tuỳ dung lượng ổ.",
      icon: <ShieldOff className="h-4 w-4" />,
      category: "security",
      dangerous: true,
      run: (setL) =>
        runPwshAction(setL, async () => {
          const res = await window.lap.optimize.disableBitlocker();
          return res.ok ? { ok: true } : { ok: false, error: res.error };
        }, "Đã yêu cầu tắt BitLocker (chạy nền)"),
    },

    // ── System ──────────────────────────────────────────────────
    {
      id: "rename-pc",
      title: "Đổi tên máy tính",
      description: "Đổi Computer Name — yêu cầu restart để hoàn tất.",
      icon: <PencilLine className="h-4 w-4" />,
      category: "system",
      dangerous: true,
      run: (setL) => {
        const input = document.getElementById("rename-pc-input") as HTMLInputElement | null;
        if (!input?.value) {
          toast.error("Chưa nhập tên mới");
          return Promise.resolve();
        }
        return runPwshAction(setL, async () => {
          const res = await window.lap.optimize.renamePc(input.value);
          return res.ok ? { ok: true } : { ok: false, error: res.error };
        }, "Đã đổi tên máy (khởi động lại để áp dụng)");
      },
    },
    {
      id: "set-wallpaper",
      title: "Đổi hình nền",
      description: "Chọn file ảnh rồi set làm wallpaper cho màn hình chính.",
      icon: <ImageIcon className="h-4 w-4" />,
      category: "system",
      dangerous: false,
      run: (setL) => {
        const input = document.getElementById("wallpaper-input") as HTMLInputElement | null;
        if (!input?.value) {
          toast.error("Chưa chọn file");
          return Promise.resolve();
        }
        return runPwshAction(setL, async () => {
          const res = await window.lap.optimize.setWallpaper(input.value);
          return res.ok ? { ok: true } : { ok: false, error: res.error };
        }, "Đã đổi hình nền");
      },
    },
  ];
  return a;
}

function DriveSelector({
  drives,
  selected,
  onChange,
}: {
  drives: { deviceId: string; volumeName: string | null; freeGb: number; totalGb: number }[];
  selected: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2 w-full rounded-md border border-border/60 bg-card px-2 py-1.5 text-sm"
    >
      {drives.map((d) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.deviceId} {d.volumeName ? `(${d.volumeName})` : ""} — {d.totalGb} GB ({d.freeGb} GB trống)
        </option>
      ))}
    </select>
  );
}

interface ActionCardProps {
  action: OptimizeAction;
  isLoading: boolean;
  onRun: () => void;
}

function ActionCard({ action, isLoading, onRun }: ActionCardProps) {
  if (action.id === "rename-pc") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={action.dangerous ? "destructive" : "default"} className="w-full">
            <PlayCircle className="mr-1 h-4 w-4" /> Chạy
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{action.title}</AlertDialogTitle>
            <AlertDialogDescription>
              Cần khởi động lại máy để tên mới có hiệu lực. KTV chịu trách nhiệm về thay đổi này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-pc-input">Tên máy mới</Label>
            <Input
              id="rename-pc-input"
              placeholder="VD: LAPTOP-CANTHO-01"
              spellCheck={false}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction disabled={isLoading} onClick={onRun}>
              {isLoading ? "Đang chạy..." : "Tiếp tục"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (action.id === "set-wallpaper") {
    const [path, setPath] = React.useState("");
    const handlePick = async () => {
      const res = await window.lap.dialog.pickFile([
        { name: "Hình ảnh", extensions: ["jpg", "jpeg", "png", "bmp", "webp"] },
      ]);
      if (res.ok && res.data && !res.data.canceled && res.data.filePaths[0]) {
        setPath(res.data.filePaths[0]);
        const input = document.getElementById("wallpaper-input") as HTMLInputElement;
        if (input) input.value = res.data.filePaths[0];
      }
    };
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={action.dangerous ? "destructive" : "default"} className="w-full">
            <PlayCircle className="mr-1 h-4 w-4" /> Chạy
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{action.title}</AlertDialogTitle>
            <AlertDialogDescription>
              Hình nền sẽ được áp dụng cho tất cả user trên máy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Đường dẫn ảnh</Label>
            <div className="flex gap-2">
              <Input
                id="wallpaper-input"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="C:\\Wallpapers\\laptop.jpg"
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={handlePick}>
                <ImagePlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction disabled={!path.trim() || isLoading} onClick={onRun}>
              {isLoading ? "Đang chạy..." : "Áp dụng"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (action.id === "defrag-hdd") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={action.dangerous ? "destructive" : "default"} className="w-full">
            <PlayCircle className="mr-1 h-4 w-4" /> Chạy
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{action.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {action.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction disabled={isLoading} onClick={onRun}>
              {isLoading ? "Đang tối ưu..." : "Bắt đầu tối ưu"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Default: confirm dialog for dangerous, direct run for safe
  if (action.dangerous) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-full">
            <PlayCircle className="mr-1 h-4 w-4" /> {isLoading ? "Đang chạy..." : "Chạy"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{action.title}</AlertDialogTitle>
            <AlertDialogDescription>
              Thao tác có thể ảnh hưởng tới hệ thống. KTV chịu trách nhiệm về thay đổi này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction disabled={isLoading} onClick={onRun}>
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button
      variant="default"
      className="w-full"
      disabled={isLoading}
      onClick={onRun}
    >
      {isLoading ? (
        <RefreshCcw className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <PlayCircle className="mr-1 h-4 w-4" />
      )}
      {isLoading ? "Đang chạy..." : "Chạy"}
    </Button>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  clean: "Dọn dẹp",
  system: "Hệ thống",
  hardware: "Phần cứng",
  security: "Bảo mật",
};

const CATEGORY_ORDER = ["clean", "system", "hardware", "security"];

export function OptimizeTab() {
  const { ktvMode } = useSessionStore();
  const [loadingSet, setLoadingSet] = React.useState<Set<string>>(new Set());
  const [drives, setDrives] = React.useState<
    { deviceId: string; volumeName: string | null; freeGb: number; totalGb: number }[]
  >([]);

  const setLoading = React.useCallback(
    (id: string, v: boolean) => {
      setLoadingSet((prev) => {
        const next = new Set(prev);
        if (v) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [],
  );

  React.useEffect(() => {
    void window.lap.optimize.getDrives().then((res) => {
      if (!res.ok || !res.data?.stdout) return;
      try {
        const raw = res.data.stdout.trim();
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        setDrives(
          list.map((d: Record<string, unknown>) => ({
            deviceId: String(d.DeviceID ?? d.deviceId ?? ""),
            volumeName: d.VolumeName ? String(d.VolumeName) : null,
            freeGb: typeof d.freeGb === "number" ? d.freeGb : 0,
            totalGb: typeof d.totalGb === "number" ? d.totalGb : 0,
          })),
        );
      } catch {
        // ignore parse errors
      }
    });
  }, []);

  const actions = React.useMemo(
    () => buildActions((id, v) => setLoading(id, v), drives),
    [drives, setLoading],
  );

  const grouped = React.useMemo(() => {
    const map: Record<string, OptimizeAction[]> = {};
    for (const action of actions) {
      if (!map[action.category]) map[action.category] = [];
      map[action.category].push(action);
    }
    return map;
  }, [actions]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Tối ưu máy</h2>
        <p className="text-sm text-muted-foreground">
          Các thao tác dọn dẹp, bảo trì và tinh chỉnh Windows. Một số thao tác cần quyền admin.
        </p>
        {!ktvMode && (
          <p className="mt-1 text-xs text-muted-foreground">
            Một số thao tác nâng cao chỉ hiển thị khi bật chế độ KTV.
          </p>
        )}
      </div>

      {/* Drives info */}
      {drives.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {drives.map((d) => (
            <div
              key={d.deviceId}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 text-xs"
            >
              <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{d.deviceId}</span>
              <span className="text-muted-foreground">
                {d.totalGb} GB ({d.freeGb} GB trống)
              </span>
            </div>
          ))}
        </div>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const catActions = grouped[cat];
        if (!catActions || catActions.length === 0) return null;
        return (
          <div key={cat}>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-semibold">{CATEGORY_LABELS[cat] ?? cat}</h3>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {catActions.map((action) => {
                const isLoading = loadingSet.has(action.id);
                return (
                  <Card key={action.id} className="flex flex-col">
                    <CardHeader className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-primary/10 p-1.5 text-primary">
                          {action.icon}
                        </span>
                        <CardTitle className="text-sm">{action.title}</CardTitle>
                        {action.dangerous ? (
                          <Badge variant="destructive" className="ml-auto">
                            Nguy hiểm
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription className="text-xs">{action.description}</CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="flex flex-1 items-end pt-4">
                      <ActionCard
                        action={action}
                        isLoading={isLoading}
                        onRun={() => action.run((v) => setLoading(action.id, v))}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

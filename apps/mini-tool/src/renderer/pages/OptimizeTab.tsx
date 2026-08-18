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
  notImplemented?: boolean;
  renderTrigger?: (state: ActionState) => React.ReactNode;
  run: (state: ActionState) => Promise<void>;
}

interface ActionState {
  isLoading: boolean;
  setLoading: (v: boolean) => void;
}

function runPwshAction(
  state: ActionState,
  promise: () => Promise<{ ok: boolean; error?: string }>,
  onSuccess?: (msg: string) => void,
): Promise<void> {
  state.setLoading(true);
  return promise()
    .then((res) => {
      if (res.ok) {
        const msg = "Hoàn tất";
        toast.success(onSuccess ? onSuccess(msg) ?? msg : msg);
      } else {
        toast.error(res.error ?? "Thất bại");
      }
    })
    .catch((err: Error) => toast.error(err.message))
    .finally(() => state.setLoading(false)) as unknown as Promise<void>;
}

function buildAction(state: ActionState): OptimizeAction[] {
  return [
    {
      id: "clean-temp",
      title: "Dọn rác (Temp + Prefetch)",
      description:
        "Xoá file tạm trong %TEMP%, %LOCALAPPDATA%\\Temp, C:\\Windows\\Temp và C:\\Windows\\Prefetch.",
      icon: <Trash2 className="h-4 w-4" />,
      run: () =>
        runPwshAction(
          state,
          async () => {
            const res = await window.lap.optimize.cleanTemp();
            return res.ok
              ? { ok: true }
              : { ok: false, error: res.error ?? "Lỗi không xác định" };
          },
          () => "Đã dọn file tạm",
        ),
    },
    {
      id: "disable-startup",
      title: "Tắt ứng dụng khởi động cùng Windows",
      description:
        "(chưa tích hợp — dùng Task Manager > Startup hoặc Autoruns trên máy thật).",
      icon: <PowerOff className="h-4 w-4" />,
      notImplemented: true,
      run: async () => {
        toast.info("Chưa hỗ trợ trong phiên bản này");
      },
    },
    {
      id: "empty-recycle",
      title: "Làm trống thùng rác",
      description:
        "(chưa tích hợp — chuẩn bị cho Phase 2).",
      icon: <Recycle className="h-4 w-4" />,
      notImplemented: true,
      run: async () => {
        toast.info("Chưa hỗ trợ trong phiên bản này");
      },
    },
    {
      id: "defrag-hdd",
      title: "Chống phân mảnh (HDD)",
      description:
        "(chưa tích hợp — chỉ áp dụng cho HDD; SSD tự động bỏ qua).",
      icon: <HardDrive className="h-4 w-4" />,
      notImplemented: true,
      run: async () => {
        toast.info("Chưa hỗ trợ trong phiên bản này");
      },
    },
    {
      id: "disable-bitlocker",
      title: "Tắt BitLocker (C:)",
      description:
        "Giải mã ổ C: — cần quyền admin. Có thể mất nhiều giờ tuỳ dung lượng ổ.",
      icon: <ShieldOff className="h-4 w-4" />,
      dangerous: true,
      run: () =>
        runPwshAction(
          state,
          async () => {
            const res = await window.lap.optimize.disableBitlocker();
            return res.ok
              ? { ok: true }
              : { ok: false, error: res.error ?? "Lỗi không xác định" };
          },
          () => "Đã yêu cầu tắt BitLocker (chạy nền)",
        ),
    },
    {
      id: "rename-pc",
      title: "Đổi tên máy tính",
      description: "Đổi Computer Name — yêu cầu restart để hoàn tất.",
      icon: <PencilLine className="h-4 w-4" />,
      dangerous: true,
      renderTrigger: (s) => <RenamePcTrigger loading={s.isLoading} />,
      run: () =>
        runPwshAction(
          state,
          async () => {
            const input = document.getElementById(
              "rename-pc-input",
            ) as HTMLInputElement | null;
            if (!input?.value) {
              return { ok: false, error: "Chưa nhập tên mới" };
            }
            const res = await window.lap.optimize.renamePc(input.value);
            return res.ok
              ? { ok: true }
              : { ok: false, error: res.error ?? "Lỗi không xác định" };
          },
          () => "Đã đổi tên máy (khởi động lại để áp dụng)",
        ),
    },
    {
      id: "set-wallpaper",
      title: "Đổi hình nền",
      description: "Chọn file ảnh rồi set làm wallpaper cho màn hình chính.",
      icon: <ImageIcon className="h-4 w-4" />,
      dangerous: true,
      renderTrigger: (s) => <SetWallpaperTrigger loading={s.isLoading} />,
      run: () =>
        runPwshAction(
          state,
          async () => {
            const input = document.getElementById(
              "wallpaper-input",
            ) as HTMLInputElement | null;
            if (!input?.value) {
              return { ok: false, error: "Chưa chọn file" };
            }
            const res = await window.lap.optimize.setWallpaper(input.value);
            return res.ok
              ? { ok: true }
              : { ok: false, error: res.error ?? "Lỗi không xác định" };
          },
          () => "Đã đổi hình nền",
        ),
    },
  ];
}

function RenamePcTrigger({ loading }: { loading: boolean }) {
  const [name, setName] = React.useState("");

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={loading} variant="destructive">
          <AlertTriangle className="h-4 w-4" /> Chạy
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Đổi tên máy tính?</AlertDialogTitle>
          <AlertDialogDescription>
            Cần khởi động lại máy để tên mới có hiệu lực. KTV chịu trách nhiệm về thay đổi này.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rename-pc-input">Tên máy mới</Label>
          <Input
            id="rename-pc-input"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="VD: LAPTOP-CANTHO-01"
            spellCheck={false}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Huỷ</AlertDialogCancel>
          <AlertDialogAction disabled={!name.trim()}>Tiếp tục</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SetWallpaperTrigger({ loading }: { loading: boolean }) {
  const [path, setPath] = React.useState("");
  const handlePick = async () => {
    const res = await window.lap.dialog.pickFile([
      { name: "Hình ảnh", extensions: ["jpg", "jpeg", "png", "bmp", "webp"] },
    ]);
    if (res.ok && res.data && !res.data.canceled && res.data.filePaths[0]) {
      setPath(res.data.filePaths[0]);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={loading} variant="destructive">
          <ImagePlus className="h-4 w-4" /> Chạy
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Đổi hình nền?</AlertDialogTitle>
          <AlertDialogDescription>
            Hình nền sẽ được áp dụng cho tất cả user trên máy. Có thể đổi lại bất kỳ lúc nào.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="wallpaper-input">Đường dẫn ảnh</Label>
          <div className="flex gap-2">
            <Input
              id="wallpaper-input"
              value={path}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPath(e.target.value)}
              placeholder="C:\\Wallpapers\\laptop.jpg"
              className="font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={handlePick} aria-label="Chọn file">
              <ImageIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Huỷ</AlertDialogCancel>
          <AlertDialogAction disabled={!path.trim()}>Áp dụng</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ActionButtonProps {
  action: OptimizeAction;
  state: ActionState;
}

function ActionButton({ action, state }: ActionButtonProps) {
  if (action.renderTrigger) {
    return action.renderTrigger(state);
  }
  return (
    <Button
      variant={action.dangerous ? "destructive" : "default"}
      disabled={state.isLoading}
      onClick={() => void action.run(state)}
    >
      <PlayCircle className="h-4 w-4" /> Chạy
    </Button>
  );
}

function ConfirmActionButton({
  action,
  state,
}: ActionButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={action.dangerous ? "destructive" : "default"}>
          <PlayCircle className="h-4 w-4" /> Chạy
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{action.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {action.dangerous
              ? "Thao tác có thể ảnh hưởng tới hệ thống. KTV chịu trách nhiệm về thay đổi này."
              : "Xác nhận chạy thao tác tối ưu?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Huỷ</AlertDialogCancel>
          <AlertDialogAction onClick={() => void action.run(state)}>
            Xác nhận
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function OptimizeTab() {
  const { ktvMode } = useSessionStore();
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const stateRef = React.useRef<ActionState>({
    isLoading: false,
    setLoading: (v: boolean) => setLoadingId(v ? loadingId : null),
  });

  // Keep the ref in sync with latest loadingId
  React.useEffect(() => {
    stateRef.current = {
      get isLoading() {
        return loadingId !== null;
      },
      setLoading: (v: boolean) => setLoadingId(v ? loadingId : null),
    };
  }, [loadingId]);

  const actions = React.useMemo(() => buildAction(stateRef.current), [loadingId]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Tối ưu máy</h2>
        <p className="text-sm text-muted-foreground">
          Các thao tác dọn dẹp, bảo trì và tinh chỉnh Windows. Một số thao tác cần quyền admin.
        </p>
        {!ktvMode ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Một số thao tác nâng cao chỉ hiển thị khi bật chế độ KTV.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          const visible = !action.notImplemented || ktvMode;
          if (!visible) return null;
          const isLoading = loadingId === action.id;
          const state: ActionState = {
            isLoading,
            setLoading: (v: boolean) => setLoadingId(v ? action.id : null),
          };
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
                  {action.notImplemented ? (
                    <Badge variant="outline" className="ml-auto">
                      Sắp có
                    </Badge>
                  ) : null}
                </div>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="flex flex-1 items-end justify-between pt-4">
                {action.dangerous ? (
                  <ConfirmActionButton action={action} state={state} />
                ) : (
                  <ActionButton action={action} state={state} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
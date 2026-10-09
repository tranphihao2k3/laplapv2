"use client";

/**
 * Dialog hỏi user có muốn lưu build guest hiện tại vào tài khoản sau khi login.
 *
 * Luồng:
 *  - Sau khi auth state chuyển từ null → user (login thành công), và `loadGuestBuild()`
 *    trả về build có items → hiển thị dialog.
 *  - "Có, lưu vào tài khoản" → gọi `createBuild(state, { userId })`.
 *  - "Không, bỏ qua" → xoá build guest.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  LogIn,
  ArrowRight,
  Trash2,
  Save,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import {
  clearGuestBuild,
  loadGuestBuild,
  calculateTotal,
} from "@/lib/pc-builder/storage";
import { createBuild } from "@/lib/pc-builder/api";
import type { BuildState } from "@/lib/pc-builder/types";
import { formatCurrency } from "@/lib/utils";

const ASKED_KEY = "pc_builder_migrate_asked";

export function GuestMigratePrompt() {
  const router = useRouter();
  const { data: user } = useUser();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guestState, setGuestState] = useState<BuildState | null>(null);

  useEffect(() => {
    if (!user) return;
    const state = loadGuestBuild();
    const hasItems = Object.values(state).some(
      (arr) => Array.isArray(arr) && arr.length > 0,
    );
    if (!hasItems) return;
    // Đánh dấu đã hỏi trong phiên này để tránh hiện dialog nhiều lần.
    if (typeof window !== "undefined") {
      try {
        if (window.sessionStorage.getItem(ASKED_KEY) === "1") return;
      } catch {
        /* ignore */
      }
    }
    setGuestState(state);
    setOpen(true);
  }, [user]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(ASKED_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
  };

  const handleMigrate = async () => {
    if (!guestState || !user) return;
    try {
      setBusy(true);
      const result = await createBuild(guestState, {
        userId: user.id,
        name: "Cấu hình di chuyển từ guest",
      });
      if (result) {
        clearGuestBuild();
        dismiss();
        toast.success("Đã lưu cấu hình vào tài khoản", {
          action: {
            label: "Xem",
            onClick: () => router.push("/pc-builder/saved"),
          },
        });
      } else {
        toast.error("Không lưu được cấu hình. Vui lòng thử lại.");
      }
    } catch {
      toast.error("Có lỗi khi lưu. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = () => {
    clearGuestBuild();
    dismiss();
  };

  const total = guestState ? calculateTotal(guestState) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-4 w-4 text-primary" />
            Lưu cấu hình đang thử vào tài khoản?
          </DialogTitle>
          <DialogDescription>
            Bạn vừa đăng nhập và có một cấu hình đang thử ({formatCurrency(total)}).
            Bạn có muốn lưu nó vào tài khoản để mở lại sau không?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={busy}
            className="rounded-lg"
          >
            <Trash2 className="h-4 w-4" />
            Bỏ qua
          </Button>
          <Button
            type="button"
            onClick={handleMigrate}
            disabled={busy}
            className="rounded-lg"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lưu vào tài khoản
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

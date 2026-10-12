"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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

export function DeleteAccountSection() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const expected = "XOÁ TÀI KHOẢN";

  function handleDelete() {
    if (confirmText !== expected) {
      toast.error("Vui lòng nhập đúng cụm từ xác nhận");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/account/settings/account", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "self_service" }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message ?? "Không thể vô hiệu hoá");
        }
        toast.success("Tài khoản đã được vô hiệu hoá");
        // Force signOut via supabase (cookie đã xoá ở server)
        setOpen(false);
        // Reload sẽ trigger middleware → redirect về /account/login
        window.location.href = "/account/login?deleted=1";
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Thất bại");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Vô hiệu hoá tài khoản
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Vô hiệu hoá tài khoản?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Sau khi vô hiệu hoá:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Không thể đăng nhập bằng email này.</li>
              <li>Đơn hàng, bảo hành, phiếu sửa cũ vẫn được tra cứu qua SĐT/email tại quầy.</li>
              <li>Bạn có thể tạo tài khoản mới với cùng email sau khi CSKH mở lại.</li>
            </ul>
            <p className="mt-3">
              Để xác nhận, gõ chính xác: <strong>{expected}</strong>
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Cụm từ xác nhận</Label>
          <Input
            id="confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expected}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Đóng</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending || confirmText !== expected}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Tôi hiểu — vô hiệu hoá
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

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
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpDelete } from "@/lib/api/http";
import { toast } from "sonner";
import type { ReactNode } from "react";

type ConfirmDeleteDialogProps = {
  entity: string;
  id: string;
  title?: string;
  description?: string;
  onSuccess?: () => void;
  trigger?: ReactNode;
  disabled?: boolean;
};

export function ConfirmDeleteDialog({
  entity,
  id,
  title = "Xác nhận xóa",
  description = "Hành động này không thể hoàn tác. Dữ liệu sẽ bị xóa vĩnh viễn.",
  onSuccess,
  trigger,
  disabled = false,
}: ConfirmDeleteDialogProps) {
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => httpDelete<{ id: string }>(`/v1/${entity}/${id}`),
    onSuccess: () => {
      toast.success("Đã xóa thành công");
      qc.invalidateQueries({ queryKey: ["admin-crud", entity] });
      onSuccess?.();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate()}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
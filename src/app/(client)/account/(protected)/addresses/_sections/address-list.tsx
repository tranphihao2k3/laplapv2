"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin,
  Pencil,
  Trash2,
  Plus,
  Star,
  Loader2,
  Home,
  Building2,
  MoreHorizontal,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { AddressFormDialog, type AddressInput } from "./address-form-dialog";
import { cn } from "@/lib/utils";

export type Address = {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  province: string | null;
  district: string | null;
  ward: string | null;
  street: string;
  is_default: boolean | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Nhà riêng": Home,
  "Văn phòng": Building2,
};

function addressIcon(label: string | null) {
  if (!label) return MapPin;
  return ICONS[label] ?? MapPin;
}

function fullAddress(a: Address) {
  return [a.street, a.ward, a.district, a.province]
    .filter(Boolean)
    .join(", ");
}

export function AddressList({
  initial,
  canEdit,
}: {
  initial: Address[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);

  // Hydrate với server data một lần, sau đó dùng cache
  const { data: addresses = initial } = useQuery({
    queryKey: ["account", "addresses"],
    queryFn: async () => {
      const res = await fetch("/api/v1/account/addresses");
      if (!res.ok) throw new Error("Không tải được địa chỉ");
      const json = await res.json();
      return (json.items ?? json) as Address[];
    },
    initialData: initial,
    staleTime: 30_000,
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/account/addresses/${id}/default`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Lỗi");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "addresses"] });
      toast.success("Đã đặt làm địa chỉ mặc định");
    },
    onError: () => toast.error("Không đặt được mặc định"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/account/addresses/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Lỗi");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account", "addresses"] });
      toast.success("Đã xoá địa chỉ");
      setDeleting(null);
    },
    onError: () => {
      toast.error("Không xoá được địa chỉ");
      setDeleting(null);
    },
  });

  if (!canEdit) {
    return (
      <Card className="rounded-2xl border-amber-200 bg-amber-50/50">
        <CardContent className="p-5 text-amber-900">
          Cần hoàn tất hồ sơ trước khi quản lý sổ địa chỉ.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full sm:w-auto">
            <Plus className="mr-1.5 h-4 w-4" />
            Thêm địa chỉ mới
          </Button>
        </DialogTrigger>
        <DialogContent>
          <AddressFormDialogContent
            mode="create"
            onClose={() => setCreateOpen(false)}
            onSaved={() => {
              setCreateOpen(false);
              qc.invalidateQueries({ queryKey: ["account", "addresses"] });
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {addresses.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MapPin className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold">Chưa có địa chỉ nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Lưu địa chỉ thường gặp để đặt hàng nhanh hơn.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {addresses.map((a) => {
            const Icon = addressIcon(a.label);
            return (
              <Card
                key={a.id}
                className={cn(
                  "group rounded-2xl border-border/60 transition-all hover:border-primary/30 hover:shadow-sm",
                  a.is_default && "ring-2 ring-primary/30",
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        a.is_default
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {a.label ?? "Địa chỉ"}
                        </p>
                        {a.is_default && (
                          <Badge className="bg-primary/10 text-primary">
                            <Star className="mr-0.5 h-2.5 w-2.5 fill-current" />
                            Mặc định
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm font-medium">{a.recipient_name}</p>
                      <p className="text-xs text-muted-foreground">{a.phone}</p>
                      <p className="mt-1.5 text-sm">{fullAddress(a)}</p>
                      {a.note && (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          Ghi chú: {a.note}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Thao tác</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditing(a)}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Sửa
                        </DropdownMenuItem>
                        {!a.is_default && (
                          <DropdownMenuItem
                            onClick={() => setDefault.mutate(a.id)}
                            disabled={setDefault.isPending}
                          >
                            <Star className="mr-2 h-3.5 w-3.5" /> Đặt mặc định
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDeleting(a)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Xoá
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open={true} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <AddressFormDialogContent
              mode="edit"
              initial={editing}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["account", "addresses"] });
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá địa chỉ này?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Đơn hàng cũ vẫn giữ địa chỉ đã dùng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AddressFormDialogContent({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: Address;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Thêm địa chỉ mới" : "Sửa địa chỉ"}
        </DialogTitle>
        <DialogDescription>
          Thông tin này sẽ được dùng để giao hàng.
        </DialogDescription>
      </DialogHeader>
      <AddressFormDialog
        mode={mode}
        initial={initial}
        onCancel={onClose}
        onSaved={onSaved}
      />
    </>
  );
}

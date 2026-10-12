"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, Loader2, Pencil, Trash2, MoreHorizontal } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ReviewEditDialog } from "./review-edit-dialog";
import { cn } from "@/lib/utils";

type Review = {
  id: string;
  product_id: string;
  rating: number | null;
  comment: string | null;
  status: string;
  created_at: string;
  product: {
    id: string;
    name: string;
    slug: string;
    thumbnail_url: string | null;
  } | null;
};

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Chờ duyệt", bg: "bg-amber-50", text: "text-amber-700" },
  approved: { label: "Đã đăng", bg: "bg-emerald-50", text: "text-emerald-700" },
  rejected: { label: "Bị từ chối", bg: "bg-rose-50", text: "text-rose-700" },
};

function Stars({ value, max = 5 }: { value: number | null; max?: number }) {
  const v = value ?? 0;
  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < v
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

export function ReviewList({ items }: { items: Review[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState<Review | null>(null);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/account/reviews/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Xoá thất bại");
    },
    onSuccess: () => {
      toast.success("Đã xoá đánh giá");
      setDeleting(null);
      router.refresh();
    },
    onError: () => {
      toast.error("Xoá thất bại");
      setDeleting(null);
    },
  });

  return (
    <>
      <div className="space-y-3">
        {items.map((r) => {
          const status = STATUS_MAP[r.status] ?? {
            label: r.status,
            bg: "bg-muted",
            text: "text-muted-foreground",
          };
          return (
            <Card key={r.id} className="rounded-2xl border-border/60">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  {r.product?.thumbnail_url && (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                      <Image
                        src={r.product.thumbnail_url}
                        alt={r.product.name}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {r.product && (
                          <Link
                            href={`/products/${r.product.slug}`}
                            className="line-clamp-1 text-sm font-medium hover:text-primary"
                          >
                            {r.product.name}
                          </Link>
                        )}
                        <div className="mt-1 flex items-center gap-2">
                          <Stars value={r.rating} />
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              status.bg,
                              status.text,
                            )}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(r)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleting(r)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Xoá
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {r.comment && (
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                        {r.comment}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editing && (
        <ReviewEditDialog
          review={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá đánh giá này?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động không thể hoàn tác.
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

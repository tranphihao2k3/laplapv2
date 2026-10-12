"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Star, Loader2, Save } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export function ReviewEditDialog({
  review,
  open,
  onOpenChange,
}: {
  review: {
    id: string;
    rating: number | null;
    comment: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      rating: review.rating ?? 5,
      comment: review.comment ?? "",
    },
  });

  const rating = watch("rating");

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const res = await fetch(`/api/v1/account/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: values.rating,
          comment: values.comment || null,
        }),
      });
      if (!res.ok) {
        toast.error("Lưu thất bại");
        return;
      }
      toast.success("Đã cập nhật — đang chờ duyệt");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa đánh giá</DialogTitle>
          <DialogDescription>
            Sau khi sửa, đánh giá sẽ chờ CSKH duyệt lại.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Đánh giá của bạn</Label>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValue("rating", n, { shouldDirty: true })}
                  className="rounded p-1 transition-transform hover:scale-110"
                  aria-label={`${n} sao`}
                >
                  <Star
                    className={cn(
                      "h-7 w-7",
                      n <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30",
                    )}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                {rating} / 5
              </span>
            </div>
            {errors.rating && (
              <p className="text-xs text-destructive">{errors.rating.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comment">Nhận xét (tuỳ chọn)</Label>
            <Textarea
              id="comment"
              rows={4}
              placeholder="Chia sẻ cảm nhận của bạn về sản phẩm..."
              {...register("comment")}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

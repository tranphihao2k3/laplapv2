"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Save, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    current_password: z.string().min(6, "Tối thiểu 6 ký tự"),
    new_password: z
      .string()
      .min(8, "Mật khẩu mới tối thiểu 8 ký tự")
      .max(72),
    confirm: z.string(),
  })
  .refine((d) => d.new_password === d.confirm, {
    message: "Mật khẩu nhập lại không khớp",
    path: ["confirm"],
  })
  .refine((d) => d.new_password !== d.current_password, {
    message: "Mật khẩu mới phải khác mật khẩu hiện tại",
    path: ["new_password"],
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: "", new_password: "", confirm: "" },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/account/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_password: values.current_password,
            new_password: values.new_password,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error?.message ?? "Đổi mật khẩu thất bại");
        }
        toast.success("Đổi mật khẩu thành công");
        reset();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Đổi mật khẩu thất bại");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="current_password">Mật khẩu hiện tại</Label>
        <Input
          id="current_password"
          type="password"
          autoComplete="current-password"
          {...register("current_password")}
        />
        {errors.current_password && (
          <p className="text-xs text-destructive">{errors.current_password.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new_password">Mật khẩu mới</Label>
        <div className="relative">
          <Input
            id="new_password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className="pr-10"
            {...register("new_password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label={showPassword ? "Ẩn" : "Hiện"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.new_password && (
          <p className="text-xs text-destructive">{errors.new_password.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Tối thiểu 8 ký tự, nên có chữ hoa, chữ thường, số và ký tự đặc biệt.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Nhập lại mật khẩu mới</Label>
        <Input
          id="confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          {...register("confirm")}
        />
        {errors.confirm && (
          <p className="text-xs text-destructive">{errors.confirm.message}</p>
        )}
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="mr-2 h-4 w-4" />
        )}
        Cập nhật mật khẩu
      </Button>
    </form>
  );
}

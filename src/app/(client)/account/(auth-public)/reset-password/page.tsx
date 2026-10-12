"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { isAuthError } from "@supabase/supabase-js";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { networkError, supabaseErrorToMessage } from "@/lib/account/auth-errors";

const schema = z
  .object({
    password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Mật khẩu nhập lại không khớp",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<{ title: string; hint?: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  // Khi user click link từ email, Supabase sẽ tự redirect với ?code=... —
  // ta đợi cho đến khi có session (Supabase detect code từ URL).
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        // thử detect code trong URL
        const code = sp.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setError({
              title: "Liên kết đã hết hạn hoặc không hợp lệ",
              hint: "Vui lòng yêu cầu gửi lại email đặt lại.",
            });
            return;
          }
        } else {
          setError({
            title: "Liên kết đã hết hạn",
            hint: "Yêu cầu gửi lại email đặt lại mật khẩu ở trang đăng nhập.",
          });
          return;
        }
      }
      setReady(true);
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [sp]);

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      try {
        const { error } = await supabase.auth.updateUser({
          password: values.password,
        });
        if (error) {
          const code = isAuthError(error) ? error.code : undefined;
          const info = supabaseErrorToMessage(code, error.message);
          setError({ title: info.title, hint: info.hint });
          toast.error(info.title);
          return;
        }
        toast.success("Đổi mật khẩu thành công. Đang chuyển về trang tài khoản...");
        router.push("/account");
        router.refresh();
      } catch (e) {
        const isNet = e instanceof Error && /fetch|network/i.test(e.message);
        const info = isNet ? networkError() : supabaseErrorToMessage(undefined);
        setError({ title: info.title, hint: info.hint });
        toast.error(info.title);
      }
    });
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-lg">
      <CardHeader className="bg-gradient-to-br from-primary/5 to-transparent p-6 pb-4">
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Đặt lại mật khẩu</h1>
        <p className="text-sm text-muted-foreground">
          Nhập mật khẩu mới — tối thiểu 6 ký tự.
        </p>
      </CardHeader>
      <CardContent className="p-6 pt-3">
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-semibold">{error.title}</p>
            {error.hint && <p className="mt-1 text-xs">{error.hint}</p>}
            <div className="mt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/account/forgot-password">Yêu cầu email mới</Link>
              </Button>
            </div>
          </div>
        ) : !ready ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xác nhận liên kết...
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Mật khẩu mới</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Nhập lại mật khẩu</Label>
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
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang cập nhật...
                </>
              ) : (
                "Cập nhật mật khẩu"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

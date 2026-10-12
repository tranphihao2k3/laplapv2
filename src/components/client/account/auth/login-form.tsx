"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { isAuthError } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { networkError, supabaseErrorToMessage } from "@/lib/account/auth-errors";
import { linkGuestOrdersAction, ensureCustomerExists as ensureCustomerExistsAction } from "@/actions/account";

const schema = z.object({
  email: z.string().email("Email chưa hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  remember: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AccountLoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<{
    title: string;
    hint?: string;
    raw?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const remember = watch("remember");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const loggedOut = params.get("logged_out");
    if (loggedOut) {
      toast.success("Đã đăng xuất");
    }
  }, []);

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) {
          const code = isAuthError(error) ? error.code : undefined;
          const info = supabaseErrorToMessage(code, error.message);
          setError({ title: info.title, hint: info.hint, raw: info.raw });
          toast.error(info.title, {
            description: info.hint ?? info.raw ?? error.message,
          });
          return;
        }
        // Link guest orders (idempotent) — server action
        await linkGuestOrdersAction().catch(() => ({ linked: 0 }));

        // Đảm bảo customer + user_profile tồn tại (idempotent).
        // An toàn khi gọi cho user đã có sẵn mà chưa qua flow signup mới.
        if (data.user?.id && data.user.email) {
          void ensureCustomerExistsAction(
            data.user.id,
            data.user.email,
            (data.user.user_metadata?.full_name as string | undefined) ?? null,
          );
        }

        toast.success("Đăng nhập thành công");
        router.push(redirectTo ?? "/account");
        router.refresh();
      } catch (e) {
        const isNet = e instanceof Error && /fetch|network/i.test(e.message);
        const info = isNet ? networkError() : supabaseErrorToMessage(undefined);
        setError({ title: info.title, hint: info.hint });
        toast.error(info.title, { description: info.hint });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">{error.title}</p>
            {error.hint && <p className="text-xs">{error.hint}</p>}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="ban@email.com"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Mật khẩu</Label>
          <Link
            href="/account/forgot-password"
            className="text-xs font-medium text-primary hover:underline"
          >
            Quên mật khẩu?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="remember"
          checked={!!remember}
          onCheckedChange={(c) => setValue("remember", c === true)}
        />
        <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
          Ghi nhớ đăng nhập
        </Label>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang đăng nhập...
          </>
        ) : (
          "Đăng nhập"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link
          href={
            redirectTo
              ? `/account/signup?redirectTo=${encodeURIComponent(redirectTo)}`
              : "/account/signup"
          }
          className="font-semibold text-primary hover:underline"
        >
          Đăng ký ngay
        </Link>
      </p>
    </form>
  );
}

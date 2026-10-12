"use client";

import { useState, useTransition } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { networkError, supabaseErrorToMessage } from "@/lib/account/auth-errors";
import { ensureCustomerExists as ensureCustomerExistsAction } from "@/actions/account";

const schema = z.object({
  fullName: z.string().min(2, "Họ tên tối thiểu 2 ký tự").max(120, "Tối đa 120 ký tự"),
  email: z.string().email("Email chưa hợp lệ"),
  password: z
    .string()
    .min(6, "Mật khẩu tối thiểu 6 ký tự")
    .max(72, "Mật khẩu tối đa 72 ký tự"),
  agree: z.literal(true, {
    errorMap: () => ({ message: "Bạn cần đồng ý điều khoản để đăng ký" }),
  }),
});

type FormValues = z.infer<typeof schema>;

export function AccountSignupForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<{
    title: string;
    hint?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "", agree: false as unknown as true },
  });

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      try {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { full_name: values.fullName },
            emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(
              redirectTo ?? "/account",
            )}`,
          },
        });

        if (error) {
          const code = isAuthError(error) ? error.code : undefined;
          const info = supabaseErrorToMessage(code, error.message);
          setError({ title: info.title, hint: info.hint });
          toast.error(info.title, { description: info.hint });
          return;
        }

        // Nếu email confirmation tắt → Supabase trả session, vào /account luôn.
        if (data.session) {
          // Đảm bảo customer + user_profile tồn tại (best-effort).
          // Không block navigation nếu RPC fail — backfill sẽ chạy lần sau.
          if (data.user?.id && values.email) {
            void ensureCustomerExistsAction(
              data.user.id,
              values.email,
              values.fullName,
            );
          }
          toast.success("Đăng ký thành công");
          router.push(redirectTo ?? "/account");
          router.refresh();
          return;
        }

        // Cần xác nhận email — chuyển sang trang thông báo.
        toast.success(
          "Đã gửi email xác nhận — vui lòng kiểm tra hộp thư (kể cả spam)",
        );
        router.push(`/account/verify-email?email=${encodeURIComponent(values.email)}`);
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
        <Label htmlFor="fullName">Họ và tên</Label>
        <Input
          id="fullName"
          autoComplete="name"
          placeholder="Nguyễn Văn A"
          {...register("fullName")}
        />
        {errors.fullName && (
          <p className="text-xs text-destructive">{errors.fullName.message}</p>
        )}
      </div>

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
        <Label htmlFor="password">Mật khẩu</Label>
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
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Ít nhất 6 ký tự, nên kết hợp chữ hoa, chữ thường và số.
        </p>
      </div>

      <div className="flex items-start gap-2">
        <input
          id="agree"
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-input"
          {...register("agree")}
        />
        <Label htmlFor="agree" className="cursor-pointer text-sm font-normal leading-relaxed">
          Tôi đã đọc và đồng ý với{" "}
          <Link href="/dieu-khoan-su-dung" className="font-medium text-primary hover:underline">
            điều khoản sử dụng
          </Link>{" "}
          và{" "}
          <Link href="/chinh-sach-bao-mat" className="font-medium text-primary hover:underline">
            chính sách bảo mật
          </Link>
          .
        </Label>
      </div>
      {errors.agree && (
        <p className="text-xs text-destructive">{errors.agree.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang tạo tài khoản...
          </>
        ) : (
          "Tạo tài khoản"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link
          href={
            redirectTo
              ? `/account/login?redirectTo=${encodeURIComponent(redirectTo)}`
              : "/account/login"
          }
          className="font-semibold text-primary hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}

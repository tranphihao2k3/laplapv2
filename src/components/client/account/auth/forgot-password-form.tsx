"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { isAuthError } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { networkError, supabaseErrorToMessage } from "@/lib/account/auth-errors";

const schema = z.object({
  email: z.string().email("Email chưa hợp lệ"),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; hint?: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
          redirectTo: `${env.NEXT_PUBLIC_APP_URL}/account/reset-password`,
        });
        if (error) {
          const code = isAuthError(error) ? error.code : undefined;
          const info = supabaseErrorToMessage(code, error.message);
          setError({ title: info.title, hint: info.hint });
          return;
        }
        setSentTo(values.email);
      } catch (e) {
        const isNet = e instanceof Error && /fetch|network/i.test(e.message);
        const info = isNet ? networkError() : supabaseErrorToMessage(undefined);
        setError({ title: info.title, hint: info.hint });
      }
    });
  };

  if (sentTo) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-center text-emerald-800">
        <MailCheck className="mx-auto mb-2 h-6 w-6" />
        <p className="font-semibold">Đã gửi email đặt lại mật khẩu</p>
        <p className="mt-1 text-sm text-emerald-700">
          Vui lòng kiểm tra hộp thư <strong>{sentTo}</strong> (kể cả thư mục spam).
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/account/login">
            <ArrowLeft className="mr-1 h-3 w-3" /> Quay lại đăng nhập
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">{error.title}</p>
            {error.hint && <p className="text-xs">{error.hint}</p>}
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email đã đăng ký</Label>
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
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang gửi...
          </>
        ) : (
          "Gửi liên kết đặt lại mật khẩu"
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/account/login"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Quay lại đăng nhập
        </Link>
      </p>
    </form>
  );
}

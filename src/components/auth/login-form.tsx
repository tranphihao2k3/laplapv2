"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { isAuthError, type AuthError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  remember: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

const STORAGE_KEY = "laplap.login.remember";

type SavedCreds = {
  email: string;
  password: string;
};

function loadSavedCreds(): SavedCreds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const decoded = JSON.parse(atob(raw)) as SavedCreds;
    if (!decoded?.email || !decoded?.password) return null;
    return decoded;
  } catch {
    return null;
  }
}

function saveCreds(creds: SavedCreds) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify(creds)));
  } catch {
    // ignore quota / privacy mode errors
  }
}

function clearCreds() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Bản dịch và gợi ý hành động cho các mã lỗi auth thường gặp của Supabase. */
const AUTH_ERROR_MAP: Record<string, { title: string; hint?: string }> = {
  invalid_credentials: {
    title: "Sai email hoặc mật khẩu",
    hint: "Kiểm tra lại email và mật khẩu. Nếu quên mật khẩu hãy yêu cầu reset.",
  },
  invalid_grant: {
    title: "Sai email hoặc mật khẩu",
    hint: "Thông tin đăng nhập không khớp.",
  },
  email_not_confirmed: {
    title: "Email chưa được xác nhận",
    hint: "Mở email và bấm vào liên kết xác nhận trước khi đăng nhập.",
  },
  user_not_found: {
    title: "Không tìm thấy tài khoản",
    hint: "Email này chưa được đăng ký. Vui lòng đăng ký trước.",
  },
  user_banned: {
    title: "Tài khoản bị khóa",
    hint: "Liên hệ quản trị viên để mở khóa.",
  },
  over_request_rate_limit: {
    title: "Quá nhiều lần thử",
    hint: "Bạn đã thử đăng nhập quá nhiều. Đợi vài phút rồi thử lại.",
  },
  over_email_send_rate_limit: {
    title: "Gửi email quá nhiều",
    hint: "Đợi vài phút trước khi yêu cầu email mới.",
  },
  signup_disabled: {
    title: "Tính năng đăng ký đang tắt",
  },
  email_provider_disabled: {
    title: "Đăng nhập bằng email đang tắt",
    hint: "Liên hệ quản trị viên để bật phương thức đăng nhập email.",
  },
  validation_failed: {
    title: "Dữ liệu không hợp lệ",
    hint: "Kiểm tra lại định dạng email và mật khẩu.",
  },
  weak_password: {
    title: "Mật khẩu quá yếu",
  },
};

type DetailedError = {
  title: string;
  code?: string;
  status?: number;
  rawMessage: string;
  hint?: string;
  name?: string;
};

function buildDetailedError(error: unknown): DetailedError {
  if (isAuthError(error)) {
    const e = error as AuthError;
    const code = e.code ?? undefined;
    const mapped = code ? AUTH_ERROR_MAP[code] : undefined;
    return {
      title: mapped?.title ?? e.message ?? "Đăng nhập thất bại",
      code,
      status: e.status,
      rawMessage: e.message,
      hint: mapped?.hint,
      name: e.name,
    };
  }

  if (error instanceof Error) {
    // Lỗi network / fetch (không tới được server Supabase)
    const isNetwork = /fetch|network|failed to fetch|networkerror/i.test(
      error.message,
    );
    return {
      title: isNetwork ? "Không kết nối được máy chủ" : "Đăng nhập thất bại",
      rawMessage: error.message,
      hint: isNetwork
        ? "Kiểm tra kết nối Internet hoặc thử lại sau."
        : undefined,
      name: error.name,
    };
  }

  return {
    title: "Đăng nhập thất bại",
    rawMessage: typeof error === "string" ? error : JSON.stringify(error),
  };
}

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<DetailedError | null>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false },
  });

  useEffect(() => {
    const saved = loadSavedCreds();
    if (saved) {
      reset({ email: saved.email, password: saved.password, remember: true });
    }
  }, [reset]);

  const remember = watch("remember");

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    startTransition(async () => {
      const supabase = createClient();
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (error) {
          const detail = buildDetailedError(error);
          // Log đầy đủ ra console để dev còn debug
          // eslint-disable-next-line no-console
          console.error("[login] Supabase auth error", {
            name: error.name,
            code: detail.code,
            status: detail.status,
            message: detail.rawMessage,
            raw: error,
          });
          setServerError(detail);
          toast.error(detail.title, {
            description: detail.hint ?? detail.rawMessage,
          });
          return;
        }

        if (!data.session) {
          const detail: DetailedError = {
            title: "Đăng nhập không tạo được phiên",
            rawMessage: "Supabase không trả về session.",
            hint: "Tài khoản có thể cần xác nhận email trước khi đăng nhập.",
          };
          setServerError(detail);
          toast.error(detail.title, { description: detail.hint });
          return;
        }

        if (values.remember) {
          saveCreds({ email: values.email, password: values.password });
        } else {
          clearCreds();
        }

        toast.success("Đăng nhập thành công");
        router.push("/quanly");
        router.refresh();
      } catch (err) {
        // Lỗi ngoài Supabase (ví dụ mất mạng) — fetch tự throw
        const detail = buildDetailedError(err);
        // eslint-disable-next-line no-console
        console.error("[login] Unexpected error", err);
        setServerError(detail);
        toast.error(detail.title, {
          description: detail.hint ?? detail.rawMessage,
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div
          role="alert"
          className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium leading-tight">{serverError.title}</p>
            {serverError.hint && (
              <p className="text-xs text-destructive/90">{serverError.hint}</p>
            )}
            <p className="text-xs text-destructive/80">
              <span className="font-medium">Chi tiết:</span>{" "}
              {serverError.rawMessage}
            </p>
            {(serverError.code || serverError.status) && (
              <p className="text-[11px] font-mono text-destructive/70">
                {serverError.code && <>code: {serverError.code}</>}
                {serverError.code && serverError.status ? " · " : ""}
                {serverError.status && <>status: {serverError.status}</>}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="remember"
          checked={!!remember}
          onCheckedChange={(checked) => setValue("remember", checked === true)}
        />
        <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
          Nhớ mật khẩu trên thiết bị này
        </Label>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>  
  );
}

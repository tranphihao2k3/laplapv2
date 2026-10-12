"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Cake, Loader2, Phone, Save, ShieldCheck, User as UserIcon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateProfile } from "@/lib/hooks/use-account-profile";

const schema = z.object({
  fullName: z
    .string()
    .min(2, "Họ tên tối thiểu 2 ký tự")
    .max(120, "Tối đa 120 ký tự"),
  phone: z
    .string()
    .max(20, "Tối đa 20 ký tự")
    .regex(/^[0-9+\-\s()]*$/, "Số điện thoại không hợp lệ")
    .optional()
    .or(z.literal("")),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Ngày sinh phải có dạng YYYY-MM-DD" })
    .optional()
    .or(z.literal("")),
  gender: z.enum(["male", "female", "other", ""]).optional(),
});

type FormValues = z.infer<typeof schema>;

type Initial = {
  fullName: string;
  phone: string;
  email: string;
  birthday: string | null;
  gender: string | null;
  tier: string;
  loyaltyPoints: number;
};

const TIER_LABEL: Record<string, string> = {
  bronze: "Đồng",
  silver: "Bạc",
  gold: "Vàng",
  platinum: "Bạch kim",
};

export function ProfileForm({
  initial,
  onboarding,
}: {
  initial: Initial;
  onboarding: boolean;
}) {
  const router = useRouter();
  const update = useUpdateProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: initial.fullName,
      phone: initial.phone,
      birthday: initial.birthday ?? "",
      gender: (initial.gender as FormValues["gender"]) ?? "",
    },
  });

  useEffect(() => {
    if (onboarding) {
      toast("Hãy cập nhật hồ sơ để tiếp tục", {
        description: "Số điện thoại giúp bạn tra cứu đơn hàng và nhận thông báo bảo hành.",
        icon: <Sparkles className="h-4 w-4" />,
      });
    }
  }, [onboarding]);

  const onSubmit = (values: FormValues) => {
    const genderValue = (values.gender || undefined) as
      | "male"
      | "female"
      | "other"
      | undefined;
    update.mutate(
      {
        fullName: values.fullName,
        phone: values.phone || null,
        birthday: values.birthday || null,
        gender: genderValue ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Đã cập nhật hồ sơ");
          if (onboarding) {
            router.push("/account");
            router.refresh();
          } else {
            reset(values, { keepValues: true });
            router.refresh();
          }
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Cập nhật thất bại"),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {onboarding && (
        <Card className="rounded-2xl border-amber-200/80 bg-amber-50/50">
          <CardContent className="flex items-center gap-3 p-4 text-amber-900">
            <ShieldCheck className="h-5 w-5" />
            <p className="text-sm">
              Hãy cập nhật <strong>số điện thoại</strong> và <strong>họ tên</strong> để
              mua hàng và tra cứu đơn dễ dàng hơn.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Thông tin cơ bản</CardTitle>
          <CardDescription>
            Email đăng nhập không thể thay đổi. Liên hệ CSKH nếu cần đổi email.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Họ và tên"
            required
            error={errors.fullName?.message}
            icon={UserIcon}
          >
            <Input
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              {...register("fullName")}
            />
          </Field>
          <Field label="Email" hint="Liên hệ CSKH để đổi email" icon={UserIcon}>
            <Input value={initial.email} disabled className="bg-muted/40" />
          </Field>
          <Field
            label="Số điện thoại"
            error={errors.phone?.message}
            icon={Phone}
            hint="Dùng để tra cứu đơn và nhận thông báo bảo hành."
          >
            <Input
              inputMode="tel"
              autoComplete="tel"
              placeholder="0123 456 789"
              {...register("phone")}
            />
          </Field>
          <Field
            label="Ngày sinh"
            error={errors.birthday?.message}
            icon={Cake}
            hint="Chúng tôi tặng quà sinh nhật theo hạng thành viên."
          >
            <Input type="date" {...register("birthday")} />
          </Field>
          <Field label="Giới tính" icon={UserIcon}>
            <select
              {...register("gender")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">-- Chọn --</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác / Không muốn nói</option>
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Hạng thành viên</CardTitle>
          <CardDescription>
            Hạng được tự động nâng cấp khi tổng chi tiêu đạt ngưỡng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                Hạng {TIER_LABEL[initial.tier] ?? initial.tier}
              </p>
              <p className="text-xs text-muted-foreground">
                {initial.loyaltyPoints.toLocaleString("vi-VN")} điểm hiện có
              </p>
            </div>
            <Button asChild variant="link" size="sm" className="ml-auto h-auto p-0 text-xs">
              <a href="/account/loyalty">Xem chi tiết →</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        {isDirty && (
          <span className="mr-auto text-xs text-amber-600">
            Có thay đổi chưa lưu
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => reset()}
          disabled={!isDirty || update.isPending}
        >
          Hoàn tác
        </Button>
        <Button type="submit" disabled={!isDirty || update.isPending}>
          {update.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Lưu thay đổi
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  children,
  icon: Icon,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

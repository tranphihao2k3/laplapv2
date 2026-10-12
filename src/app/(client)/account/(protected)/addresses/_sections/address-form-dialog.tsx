"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import type { Address } from "./address-list";

const schema = z.object({
  label: z.string().max(50).optional().or(z.literal("")),
  recipient_name: z.string().min(2, "Họ tên tối thiểu 2 ký tự").max(120),
  phone: z
    .string()
    .min(8, "Số điện thoại tối thiểu 8 số")
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, "Chỉ chứa số và ký tự + - ( )"),
  province: z.string().max(80).optional().or(z.literal("")),
  district: z.string().max(80).optional().or(z.literal("")),
  ward: z.string().max(80).optional().or(z.literal("")),
  street: z.string().min(3, "Địa chỉ cụ thể tối thiểu 3 ký tự").max(255),
  is_default: z.boolean().optional(),
  note: z.string().max(255).optional().or(z.literal("")),
});

export type AddressInput = z.infer<typeof schema>;

const LABELS = [
  { value: "Nhà riêng", emoji: "🏠" },
  { value: "Văn phòng", emoji: "🏢" },
  { value: "Khác", emoji: "📍" },
];

export function AddressFormDialog({
  mode,
  initial,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: Address;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddressInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: initial?.label ?? "Nhà riêng",
      recipient_name: initial?.recipient_name ?? "",
      phone: initial?.phone ?? "",
      province: initial?.province ?? "",
      district: initial?.district ?? "",
      ward: initial?.ward ?? "",
      street: initial?.street ?? "",
      is_default: initial?.is_default ?? false,
      note: initial?.note ?? "",
    },
  });

  const isDefault = watch("is_default");

  const onSubmit = (values: AddressInput) => {
    setServerError(null);
    startTransition(async () => {
      const url = mode === "create" ? "/api/v1/account/addresses" : `/api/v1/account/addresses/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          is_default: values.is_default ?? false,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setServerError(err?.error?.message ?? "Lưu thất bại");
        toast.error("Lưu thất bại");
        return;
      }
      toast.success(mode === "create" ? "Đã thêm địa chỉ" : "Đã cập nhật địa chỉ");
      onSaved();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Loại địa chỉ</Label>
        <div className="grid grid-cols-3 gap-2">
          {LABELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setValue("label", l.value, { shouldDirty: true })}
              className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors ${
                watch("label") === l.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              <span className="text-lg">{l.emoji}</span>
              {l.value}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="recipient_name">Họ tên người nhận *</Label>
          <Input id="recipient_name" autoComplete="name" {...register("recipient_name")} />
          {errors.recipient_name && (
            <p className="text-xs text-destructive">{errors.recipient_name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Số điện thoại *</Label>
          <Input id="phone" inputMode="tel" autoComplete="tel" {...register("phone")} />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="province">Tỉnh / Thành</Label>
          <Input id="province" {...register("province")} placeholder="Cần Thơ" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="district">Quận / Huyện</Label>
          <Input id="district" {...register("district")} placeholder="Ninh Kiều" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ward">Phường / Xã</Label>
          <Input id="ward" {...register("ward")} placeholder="An Hòa" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="street">Số nhà, tên đường *</Label>
        <Input
          id="street"
          {...register("street")}
          placeholder="Số 123, đường ABC"
        />
        {errors.street && (
          <p className="text-xs text-destructive">{errors.street.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Ghi chú (tuỳ chọn)</Label>
        <Input id="note" {...register("note")} placeholder="Giao giờ hành chính, gọi trước khi giao..." />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_default"
          checked={!!isDefault}
          onCheckedChange={(c) => setValue("is_default", c === true)}
        />
        <Label htmlFor="is_default" className="cursor-pointer text-sm font-normal">
          Đặt làm địa chỉ mặc định
        </Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Huỷ
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {mode === "create" ? "Thêm" : "Lưu"}
        </Button>
      </DialogFooter>
    </form>
  );
}

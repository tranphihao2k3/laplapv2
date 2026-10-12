"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save, X } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  device_name: z.string().min(2, "Tối thiểu 2 ký tự").max(255),
  issue_description: z
    .string()
    .min(10, "Mô tả chi tiết tối thiểu 10 ký tự")
    .max(2000),
  condition_description: z.string().max(2000).optional().or(z.literal("")),
  serial_number: z.string().max(120).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export function RepairTicketCreate({
  defaultDeviceName = "",
  onCancelHref = "/account/repair-tickets",
}: {
  defaultDeviceName?: string;
  onCancelHref?: string;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      device_name: defaultDeviceName,
      issue_description: "",
      condition_description: "",
      serial_number: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await fetch("/api/v1/account/repair-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_name: values.device_name,
          issue_description: values.issue_description,
          condition_description: values.condition_description || null,
          serial_number: values.serial_number || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Tạo phiếu thất bại");
      }
      toast.success("Đã tạo phiếu sửa", {
        description: `Mã phiếu: ${data.item.ticket_code}`,
      });
      router.push(`/account/repair-tickets/${data.item.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tạo phiếu thất bại");
    }
  };

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Tạo phiếu sửa mới</CardTitle>
        <Button asChild variant="ghost" size="icon" className="h-7 w-7">
          <Link href={onCancelHref} aria-label="Đóng">
            <X className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="device_name">Tên thiết bị *</Label>
              <Input
                id="device_name"
                placeholder="VD: MacBook Air M2 13 inch"
                {...register("device_name")}
              />
              {errors.device_name && (
                <p className="text-xs text-destructive">{errors.device_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serial_number">Số serial (nếu có)</Label>
              <Input
                id="serial_number"
                placeholder="SN hoặc IMEI"
                {...register("serial_number")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issue_description">Mô tả vấn đề *</Label>
            <Textarea
              id="issue_description"
              rows={4}
              placeholder="Mô tả chi tiết triệu chứng, thời điểm xuất hiện, tình trạng máy..."
              {...register("issue_description")}
            />
            {errors.issue_description && (
              <p className="text-xs text-destructive">{errors.issue_description.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="condition_description">Tình trạng máy khi gửi (khuyến nghị)</Label>
            <Textarea
              id="condition_description"
              rows={3}
              placeholder="Trầy xước, bể góc, còn nguyên seal, đã qua sửa chữa..."
              {...register("condition_description")}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link href={onCancelHref}>Huỷ</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Gửi phiếu sửa
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Form liên hệ — gọi POST /api/v1/contact.
 * Validate client + server; gửi email thông báo cho cửa hàng.
 */
"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Status = "idle" | "submitting" | "success";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status !== "idle") return;
    setErrors({});

    const fd = new FormData(e.currentTarget);
    const payload = {
      full_name: String(fd.get("full_name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      subject: String(fd.get("subject") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
    };

    // Validate client cơ bản
    const newErrors: Record<string, string> = {};
    if (!payload.full_name) newErrors.full_name = "Vui lòng nhập họ và tên";
    if (!payload.email) newErrors.email = "Vui lòng nhập email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
      newErrors.email = "Email không đúng định dạng";
    if (payload.phone && !/^[\d\s+()-]{8,20}$/.test(payload.phone))
      newErrors.phone = "Số điện thoại không hợp lệ";
    if (!payload.message || payload.message.length < 10)
      newErrors.message = "Vui lòng nhập nội dung (tối thiểu 10 ký tự)";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg = json?.error?.message ?? "Gửi tin nhắn thất bại, vui lòng thử lại.";
        toast.error(msg);
        if (json?.error?.fields) setErrors(json.error.fields);
        setStatus("idle");
        return;
      }
      setStatus("success");
      toast.success("Đã gửi tin nhắn! Chúng tôi sẽ phản hồi sớm.");
      (e.target as HTMLFormElement).reset();
    } catch {
      toast.error("Lỗi mạng, vui lòng thử lại.");
      setStatus("idle");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/60 px-6 py-12 text-center">
        <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-600" />
        <h3 className="text-xl font-bold text-emerald-900">Đã gửi thành công!</h3>
        <p className="mt-2 max-w-md text-sm text-emerald-800">
          Cảm ơn bạn đã liên hệ. Đội ngũ LapLap sẽ phản hồi trong vòng 24 giờ làm việc (trừ
          Chủ nhật & ngày lễ).
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          onClick={() => setStatus("idle")}
        >
          Gửi tin nhắn khác
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">
            Họ và tên <span className="text-red-500">*</span>
          </Label>
          <Input
            id="full_name"
            name="full_name"
            placeholder="Nguyễn Văn A"
            required
            aria-invalid={!!errors.full_name}
            disabled={status === "submitting"}
          />
          {errors.full_name && (
            <p className="text-xs text-red-600">{errors.full_name}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">
            Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="email@example.com"
            required
            aria-invalid={!!errors.email}
            disabled={status === "submitting"}
          />
          {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Số điện thoại</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="0901 234 567"
            aria-invalid={!!errors.phone}
            disabled={status === "submitting"}
          />
          {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="subject">Tiêu đề</Label>
          <Input
            id="subject"
            name="subject"
            placeholder="Tư vấn laptop gaming..."
            disabled={status === "submitting"}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">
          Nội dung <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="message"
          name="message"
          rows={5}
          placeholder="Vui lòng nhập nội dung bạn cần hỗ trợ..."
          required
          aria-invalid={!!errors.message}
          disabled={status === "submitting"}
        />
        {errors.message && <p className="text-xs text-red-600">{errors.message}</p>}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={status === "submitting"}
        className="w-full sm:w-auto"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang gửi...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Gửi liên hệ
          </>
        )}
      </Button>

      <p className="text-xs leading-relaxed text-slate-500">
        Khi gửi liên hệ, bạn đồng ý với{" "}
        <a href="/chinh-sach-bao-mat" className="underline">
          Chính sách bảo mật
        </a>{" "}
        của chúng tôi. Thông tin của bạn chỉ được dùng để phản hồi yêu cầu hỗ trợ.
      </p>
    </form>
  );
}
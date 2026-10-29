"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { httpGet, httpPatch, httpPost } from "@/lib/api/http";
import { invalidateBrandCache } from "@/lib/brand-cache-invalidation";
import type { Paginated } from "@/lib/api/response";

// ====== Types =====
type Setting = {
  id: string;
  organization_id: string | null;
  shop_id: string | null;
  group_name: string | null;
  key: string | null;
  value: unknown;
};

function getApiErrorMsg(e: unknown) {
  const err = e as { error?: { message?: string } };
  return err?.error?.message ?? "Có lỗi xảy ra";
}

// ====== Component =====
export function StoreInfoSettings() {
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: ["settings-store-info"],
    queryFn: () =>
      httpGet<Paginated<Setting>>("/v1/settings", {
        page: 1,
        pageSize: 100,
        group_name: "store",
      }),
  });

  const items = useMemo(() => settingsQ.data?.items ?? [], [settingsQ.data]);

  const byKey = useMemo(() => {
    const m = new Map<string, Setting>();
    for (const s of items) if (s.key) m.set(s.key, s);
    return m;
  }, [items]);

  const formFromServer = useMemo(
    () => ({
      name: (byKey.get("name")?.value as string) || "",
      description: (byKey.get("description")?.value as string) || "",
      address: (byKey.get("address")?.value as string) || "",
      phone: (byKey.get("phone")?.value as string) || "",
      hotline: (byKey.get("hotline")?.value as string) || "",
      email: (byKey.get("email")?.value as string) || "",
    }),
    [byKey]
  );

  // Local form state
  const [form, setForm] = useState(formFromServer);

  // Sync from server data
  useEffect(() => {
    setForm(formFromServer);
  }, [formFromServer]);

  const upsert = useMutation({
    mutationFn: async (input: { key: string; value: unknown }) => {
      const payload: Record<string, unknown> = {
        value: input.value,
        group_name: "store",
      };
      const existing = items.find((s) => s.key === input.key);
      if (existing) {
        return httpPatch<Setting>(`/v1/settings/${existing.id}`, payload);
      }
      return httpPost<Setting>("/v1/settings", {
        key: input.key,
        value: input.value,
        group_name: "store",
        ...payload,
      });
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["settings-store-info"] });
      // Invalidate brand cache so header/footer update
      invalidateBrandCache();
      // Xoá cache server-side (store-info/footer/contact) để tên mới hiện ngay
      // thay vì đợi TTL 1h. Best-effort — lỗi mạng không chặn lưu.
      try {
        await fetch("/api/admin/revalidate-store", { method: "POST" });
      } catch {
        // ignore — cache vẫn tự hết hạn sau 1h
      }
      toast.success("Đã cập nhật thông tin cửa hàng");
    },
    onError: (e) => toast.error(getApiErrorMsg(e)),
  });

  const handleSave = useCallback(async () => {
    // Save all fields in parallel
    await Promise.all([
      upsert.mutateAsync({ key: "name", value: form.name }),
      upsert.mutateAsync({ key: "description", value: form.description }),
      upsert.mutateAsync({ key: "address", value: form.address }),
      upsert.mutateAsync({ key: "phone", value: form.phone }),
      upsert.mutateAsync({ key: "hotline", value: form.hotline }),
      upsert.mutateAsync({ key: "email", value: form.email }),
    ]);
  }, [form, upsert]);

  const isModified = useMemo(() => {
    return (
      form.name !== (byKey.get("name")?.value as string) ||
      form.description !== (byKey.get("description")?.value as string) ||
      form.address !== (byKey.get("address")?.value as string) ||
      form.phone !== (byKey.get("phone")?.value as string) ||
      form.hotline !== (byKey.get("hotline")?.value as string) ||
      form.email !== (byKey.get("email")?.value as string)
    );
  }, [form, byKey]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Thông tin cửa hàng</CardTitle>
          <CardDescription>
            Tên, địa chỉ, liên hệ và mô tả hiển thị trên Header, Footer, trang Liên hệ và trang Giới thiệu.
            <br />
            <strong>Thay đổi ở đây sẽ tự động cập nhật khắp trang web.</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="store-name">
                Tên cửa hàng / Thương hiệu <span className="text-red-500">*</span>
              </Label>
              <Input
                id="store-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="VD: Laptop Thành Võ, TechStore"
              />
              <p className="text-xs text-muted-foreground">
                Hiển thị trên Header, Footer, trang Liên hệ
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-email">Email liên hệ</Label>
              <Input
                id="store-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="info@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-phone">Số điện thoại chính</Label>
              <Input
                id="store-phone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="1900 1234"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-hotline">Hotline (nếu khác)</Label>
              <Input
                id="store-hotline"
                value={form.hotline}
                onChange={(e) => setForm((prev) => ({ ...prev, hotline: e.target.value }))}
                placeholder="0901 234 567"
              />
              <p className="text-xs text-muted-foreground">
                Nếu bỏ trống, sẽ dùng số điện thoại chính
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="store-address">Địa chỉ</Label>
              <Textarea
                id="store-address"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="123 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ"
                className="resize-none"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="store-description">Mô tả cửa hàng</Label>
              <Textarea
                id="store-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Mô tả ngắn về cửa hàng, dòng sản phẩm,..."
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Hiển thị trên trang Giới thiệu, Footer
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setForm(formFromServer)}
              disabled={!isModified}
            >
              Hoàn tác
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isModified || upsert.isPending}
            >
              <Save className="mr-1 h-4 w-4" />
              {upsert.isPending ? "Đang lưu..." : "Lưu thông tin cửa hàng"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

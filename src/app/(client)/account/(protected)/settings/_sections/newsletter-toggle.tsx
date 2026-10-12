"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function NewsletterToggle({ initial }: { initial: boolean }) {
  const [subscribed, setSubscribed] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function update(newValue: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/account/settings/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribed: newValue }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Cập nhật thất bại");
      }
      setSubscribed(newValue);
      toast.success(newValue ? "Đã bật nhận bản tin" : "Đã tắt nhận bản tin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cập nhật thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            subscribed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {subscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-sm font-semibold">
            {subscribed ? "Đang nhận bản tin" : "Đang tắt bản tin"}
          </p>
          <p className="text-xs text-muted-foreground">
            {subscribed
              ? "Bạn sẽ nhận email về sản phẩm mới và khuyến mãi."
              : "Bật để không bỏ lỡ deal hot và sản phẩm mới."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Switch
          checked={subscribed}
          onCheckedChange={update}
          disabled={busy}
          aria-label="Bật/tắt nhận bản tin"
        />
      </div>
    </div>
  );
}

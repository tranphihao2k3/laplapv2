"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowUp, ArrowDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { httpPost, httpPatch, httpDelete } from "@/lib/api/http";
import {
  type TrustBadge,
  type TrustBadgeSetting,
  DEFAULT_TRUST_BADGES,
  TRUST_BADGE_ICON_OPTIONS,
} from "@/lib/trust-badges";

type Props = {
  /** The current saved value from the settings table (may be undefined) */
  raw?: unknown;
  saving?: boolean;
  onSave?: (value: TrustBadgeSetting) => void;
  /** Setting record ID if it already exists in the DB */
  settingId?: string;
  group?: string;
  keyName?: string;
  /** Scope of the setting */
  scope?: "org" | "shop";
  shopId?: string | null;
};

export function TrustBadgesSettings({
  raw,
  saving,
  onSave,
  settingId,
  group = "store",
  keyName = "trust_badges",
  scope = "org",
  shopId,
}: Props) {
  const qc = useQueryClient();

  // Parse initial value
  const initial: TrustBadge[] = (() => {
    if (Array.isArray(raw)) return raw as TrustBadge[];
    if (typeof raw === "string") {
      try { return JSON.parse(raw) as TrustBadge[]; } catch { /* fall through */ }
    }
    return DEFAULT_TRUST_BADGES;
  })();

  const [badges, setBadges] = useState<TrustBadge[]>(initial);

  // Sync when raw prop changes (e.g. data refetched from server)
  useEffect(() => {
    if (Array.isArray(raw)) {
      setBadges(raw as TrustBadge[]);
    } else if (typeof raw === "string") {
      try { setBadges(JSON.parse(raw) as TrustBadge[]); } catch { /* no-op */ }
    }
  }, [raw]);

  const upsertMutation = useMutation({
    mutationFn: async (value: TrustBadgeSetting) => {
      const payload: Record<string, unknown> = {
        value,
        group_name: group,
        key: keyName,
      };
      if (scope === "shop" && shopId) payload.shop_id = shopId;
      if (settingId) {
        return httpPatch(`/v1/settings/${settingId}`, payload);
      }
      return httpPost("/v1/settings", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-config"] });
      toast.success("Đã lưu trust badges");
    },
    onError: () => toast.error("Lưu thất bại"),
  });

  function handleSave() {
    if (onSave) {
      onSave(badges);
    } else {
      upsertMutation.mutate(badges);
    }
  }

  function moveBadge(idx: number, dir: -1 | 1) {
    const next = [...badges];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    // Re-assign order
    next.forEach((b, i) => { b.order = i; });
    setBadges(next);
  }

  function removeBadge(id: string) {
    setBadges((prev) => prev.filter((b) => b.id !== id));
  }

  function toggleEnabled(id: string, enabled: boolean) {
    setBadges((prev) =>
      prev.map((b) => (b.id === id ? { ...b, enabled } : b)),
    );
  }

  function updateBadge(id: string, patch: Partial<TrustBadge>) {
    setBadges((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  }

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ icon: "ShieldCheck", title: "", description: "" });

  function handleAdd() {
    if (!addForm.title.trim()) return;
    const newBadge: TrustBadge = {
      id: `badge-${Date.now()}`,
      icon: addForm.icon,
      title: addForm.title.trim(),
      description: addForm.description.trim() || undefined,
      enabled: true,
      order: badges.length,
    };
    setBadges((prev) => [...prev, newBadge]);
    setAddForm({ icon: "ShieldCheck", title: "", description: "" });
    setAddOpen(false);
  }

  const enabledBadges = badges.filter((b) => b.enabled);
  const isSaving = saving || upsertMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Trust Badges / Cam kết cửa hàng</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Hiển thị trên trang chi tiết sản phẩm. Kéo để sắp xếp thứ tự.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBadges(DEFAULT_TRUST_BADGES)}>
              Khôi phục mặc định
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Thêm badge
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {badges.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Chưa có badge nào. Nhấn "Thêm badge" để bắt đầu.
          </p>
        ) : (
          <div className="space-y-2">
            {badges.map((badge, idx) => (
              <div
                key={badge.id}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-opacity ${
                  badge.enabled ? "bg-white" : "bg-slate-50 opacity-60"
                }`}
              >
                {/* Drag handle + reorder */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveBadge(idx, -1)}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBadge(idx, 1)}
                    disabled={idx === badges.length - 1}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Icon */}
                <div className="shrink-0">
                  <Select
                    value={badge.icon}
                    onValueChange={(v) => updateBadge(badge.id, { icon: v })}
                  >
                    <SelectTrigger className="w-10 p-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRUST_BADGE_ICON_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Title + description */}
                <div className="min-w-0 flex-1">
                  <Input
                    value={badge.title}
                    onChange={(e) => updateBadge(badge.id, { title: e.target.value })}
                    placeholder="Tiêu đề badge"
                    className="mb-1 font-medium"
                  />
                  <Input
                    value={badge.description ?? ""}
                    onChange={(e) =>
                      updateBadge(badge.id, {
                        description: e.target.value || undefined,
                      })
                    }
                    placeholder="Mô tả phụ (tuỳ chọn)"
                    className="text-xs"
                  />
                </div>

                {/* Enabled toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor={`tb-${badge.id}`}>
                    {badge.enabled ? "Bật" : "Tắt"}
                  </Label>
                  <Switch
                    id={`tb-${badge.id}`}
                    checked={badge.enabled}
                    onCheckedChange={(v) => toggleEnabled(badge.id, v)}
                  />
                </div>

                {/* Delete */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removeBadge(badge.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {badges.length > 0 && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        )}
      </CardContent>

      {/* Add badge dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm Trust Badge</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Biểu tượng</Label>
              <Select
                value={addForm.icon}
                onValueChange={(v) => setAddForm((p) => ({ ...p, icon: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRUST_BADGE_ICON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Tiêu đề <span className="text-destructive">*</span>
              </Label>
              <Input
                value={addForm.title}
                onChange={(e) => setAddForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ví dụ: Bảo hành 24 tháng"
              />
            </div>
            <div className="space-y-2">
              <Label>Mô tả (tuỳ chọn)</Label>
              <Input
                value={addForm.description}
                onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Ví dụ: Đổi mới 1-1 trong 24 tháng"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Huỷ
            </Button>
            <Button disabled={!addForm.title.trim()} onClick={handleAdd}>
              Thêm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowUp, ArrowDown, Plus, Trash2, GripVertical } from "lucide-react";
import { httpPost, httpPatch } from "@/lib/api/http";
import type { FooterColumn, FooterLink, FooterSettings } from "@/lib/footer-settings";
import { DEFAULT_FOOTER_SETTINGS } from "@/lib/footer-settings";

type Props = {
  /** The current saved settings from the settings table (may be undefined) */
  raw?: unknown;
  saving?: boolean;
  settingId?: string;
  group?: string;
  keyName?: string;
  /** Scope of the setting */
  scope?: "org" | "shop";
  shopId?: string | null;
};

export function FooterSettings({
  raw,
  saving,
  settingId,
  group = "store",
  keyName = "footer_settings",
  scope = "org",
  shopId,
}: Props) {
  const qc = useQueryClient();

  // Parse initial value
  const initial: FooterSettings = (() => {
    if (raw && typeof raw === "object") return raw as FooterSettings;
    if (typeof raw === "string") {
      try { return JSON.parse(raw) as FooterSettings; } catch { /* fall through */ }
    }
    return DEFAULT_FOOTER_SETTINGS;
  })();

  const [settings, setSettings] = useState<FooterSettings>(initial);
  const [columns, setColumns] = useState<FooterColumn[]>(initial.columns ?? DEFAULT_FOOTER_SETTINGS.columns ?? []);
  const [description, setDescription] = useState(initial.description ?? "");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(initial.payment_methods ?? []);

  // Sync when raw prop changes (e.g. data refetched from server)
  useEffect(() => {
    if (raw && typeof raw === "object") {
      const val = raw as FooterSettings;
      setSettings(val);
      setColumns(val.columns ?? []);
      setDescription(val.description ?? "");
      setPaymentMethods(val.payment_methods ?? []);
    } else if (typeof raw === "string") {
      try {
        const val = JSON.parse(raw) as FooterSettings;
        setSettings(val);
        setColumns(val.columns ?? []);
        setDescription(val.description ?? "");
        setPaymentMethods(val.payment_methods ?? []);
      } catch { /* no-op */ }
    }
  }, [raw]);

  const upsertMutation = useMutation({
    mutationFn: async (value: FooterSettings) => {
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
      qc.invalidateQueries({ queryKey: ["settings-config-footer"] });
      toast.success("Đã lưu cấu hình footer");
    },
    onError: () => toast.error("Lưu thất bại"),
  });

  function handleSave() {
    upsertMutation.mutate({
      description,
      payment_methods: paymentMethods,
      columns,
    });
  }

  // Column operations
  function moveColumn(idx: number, dir: -1 | 1) {
    const next = [...columns];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    next.forEach((c, i) => { c.order = i; });
    setColumns(next);
  }

  function removeColumn(id: string) {
    setColumns((prev) => prev.filter((c) => c.id !== id));
  }

  function updateColumn(id: string, patch: Partial<FooterColumn>) {
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  }

  function addColumn() {
    const newColumn: FooterColumn = {
      id: `col-${Date.now()}`,
      title: "Cột mới",
      order: columns.length,
      links: [],
    };
    setColumns((prev) => [...prev, newColumn]);
  }

  // Link operations
  function addLink(columnId: string) {
    const newLink: FooterLink = {
      id: `link-${Date.now()}`,
      href: "/",
      label: "Liên kết mới",
      order: 0,
    };
    updateColumn(columnId, {
      links: [
        ...(columns.find((c) => c.id === columnId)?.links ?? []),
        newLink,
      ],
    });
  }

  function removeLink(columnId: string, linkId: string) {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    updateColumn(columnId, {
      links: col.links.filter((l) => l.id !== linkId),
    });
  }

  function updateLink(columnId: string, linkId: string, patch: Partial<FooterLink>) {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    updateColumn(columnId, {
      links: col.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
    });
  }

  function moveLink(columnId: string, linkIdx: number, dir: -1 | 1) {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    const links = [...col.links];
    const target = linkIdx + dir;
    if (target < 0 || target >= links.length) return;
    [links[linkIdx], links[target]] = [links[target], links[linkIdx]];
    links.forEach((l, i) => { l.order = i; });
    updateColumn(columnId, { links });
  }

  // Payment methods
  function addPaymentMethod() {
    setPaymentMethods((prev) => [...prev, "Phương thức mới"]);
  }

  function updatePaymentMethod(index: number, value: string) {
    setPaymentMethods((prev) => prev.map((m, i) => (i === index ? value : m)));
  }

  function removePaymentMethod(index: number) {
    setPaymentMethods((prev) => prev.filter((_, i) => i !== index));
  }

  const isSaving = saving || upsertMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Footer / Chân trang</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Cấu hình các cột liên kết, mô tả, và phương thức thanh toán hiển thị ở chân trang.
            </p>
          </div>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Footer Description */}
        <div className="space-y-2">
          <Label>Mô tả chân trang</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Hệ thống bán lẻ laptop chính hãng hàng đầu..."
          />
          <p className="text-xs text-muted-foreground">Mô tả ngắn hiển thị trong phần thương hiệu của footer.</p>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Phương thức thanh toán</Label>
            <Button size="sm" variant="outline" onClick={addPaymentMethod}>
              <Plus className="mr-1 h-4 w-4" /> Thêm
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((method, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <Input
                  value={method}
                  onChange={(e) => updatePaymentMethod(idx, e.target.value)}
                  className="h-8 w-32 text-sm"
                  placeholder="Tên phương thức"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removePaymentMethod(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Các phương thức thanh toán hiển thị ở cuối footer (Visa, COD, MoMo, v.v.)
          </p>
        </div>

        {/* Footer Columns */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Các cột liên kết</Label>
            <Button size="sm" variant="outline" onClick={addColumn}>
              <Plus className="mr-1 h-4 w-4" /> Thêm cột
            </Button>
          </div>

          {columns.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Chưa có cột nào. Nhấn "Thêm cột" để tạo.
            </p>
          ) : (
            <div className="space-y-4">
              {columns.map((column, colIdx) => (
                <div key={column.id} className="rounded-lg border bg-white p-4 space-y-3">
                  {/* Column header */}
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveColumn(colIdx, -1)}
                        disabled={colIdx === 0}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(colIdx, 1)}
                        disabled={colIdx === columns.length - 1}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input
                      value={column.title}
                      onChange={(e) => updateColumn(column.id, { title: e.target.value })}
                      placeholder="Tiêu đề cột (VD: Chính sách)"
                      className="flex-1 font-medium"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeColumn(column.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Links in column */}
                  <div className="pl-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Liên kết</span>
                      <Button size="sm" variant="ghost" onClick={() => addLink(column.id)}>
                        <Plus className="mr-1 h-3 w-3" /> Thêm liên kết
                      </Button>
                    </div>
                    {column.links.map((link, linkIdx) => (
                      <div key={link.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveLink(column.id, linkIdx, -1)}
                          disabled={linkIdx === 0}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLink(column.id, linkIdx, 1)}
                          disabled={linkIdx === column.links.length - 1}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <Input
                          value={link.href}
                          onChange={(e) => updateLink(column.id, link.id, { href: e.target.value })}
                          placeholder="/about"
                          className="flex-1 text-xs"
                        />
                        <Input
                          value={link.label}
                          onChange={(e) => updateLink(column.id, link.id, { label: e.target.value })}
                          placeholder="Tiêu đề"
                          className="w-32 text-xs"
                        />
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor={`ext-${link.id}`}>
                            Mở tab mới
                          </Label>
                          <Switch
                            id={`ext-${link.id}`}
                            checked={link.external ?? false}
                            onCheckedChange={(v) => updateLink(column.id, link.id, { external: v })}
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removeLink(column.id, link.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Restore defaults button */}
        <div className="flex justify-start pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDescription(DEFAULT_FOOTER_SETTINGS.description ?? "");
              setPaymentMethods(DEFAULT_FOOTER_SETTINGS.payment_methods ?? []);
              setColumns(DEFAULT_FOOTER_SETTINGS.columns ?? []);
            }}
          >
            Khôi phục mặc định
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

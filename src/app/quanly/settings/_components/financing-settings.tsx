"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_FINANCING,
  calcInstallment,
  normalizeFinancing,
  type FinancingProvider,
  type FinancingSetting,
} from "@/lib/financing";
import { formatCurrency } from "@/lib/utils";

type Props = {
  /** Giá trị thô đọc từ settings (key "financing.providers"). */
  raw: unknown;
  onSave: (value: FinancingSetting) => void;
  saving?: boolean;
};

const PREVIEW_PRICE = 20_000_000;

function parseSetting(raw: unknown): FinancingSetting | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") {
    try {
      return normalizeFinancing(JSON.parse(raw));
    } catch {
      return undefined;
    }
  }
  if (typeof raw === "object") return normalizeFinancing(raw);
  return undefined;
}

export function FinancingSettings({ raw, onSave, saving }: Props) {
  const saved = useMemo(() => parseSetting(raw), [raw]);
  const [form, setForm] = useState<FinancingSetting>(saved ?? DEFAULT_FINANCING);

  useEffect(() => {
    setForm(saved ?? DEFAULT_FINANCING);
  }, [saved]);

  function patch(next: Partial<FinancingSetting>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  function patchProvider(idx: number, next: Partial<FinancingProvider>) {
    setForm((prev) => ({
      ...prev,
      providers: prev.providers.map((p, i) => (i === idx ? { ...p, ...next } : p)),
    }));
  }

  function addProvider() {
    setForm((prev) => ({
      ...prev,
      providers: [
        ...prev.providers,
        {
          id: `provider-${Date.now()}`,
          name: "Bên trả góp mới",
          note: "",
          minDownPercent: 0,
          conversionFeePercent: 0,
          terms: [{ months: 12, monthlyRate: 0 }],
        },
      ],
    }));
  }

  function removeProvider(idx: number) {
    setForm((prev) => ({ ...prev, providers: prev.providers.filter((_, i) => i !== idx) }));
  }

  function addTerm(pIdx: number) {
    const p = form.providers[pIdx];
    const last = p.terms[p.terms.length - 1];
    patchProvider(pIdx, {
      terms: [...p.terms, { months: (last?.months ?? 6) + 6, monthlyRate: last?.monthlyRate ?? 0 }],
    });
  }

  function patchTerm(pIdx: number, tIdx: number, next: Partial<{ months: number; monthlyRate: number }>) {
    const p = form.providers[pIdx];
    patchProvider(pIdx, {
      terms: p.terms.map((t, i) => (i === tIdx ? { ...t, ...next } : t)),
    });
  }

  function removeTerm(pIdx: number, tIdx: number) {
    const p = form.providers[pIdx];
    patchProvider(pIdx, { terms: p.terms.filter((_, i) => i !== tIdx) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trả góp</CardTitle>
        <CardDescription>
          Khai báo các bên trả góp và kỳ hạn. Khách xem được số tiền mỗi tháng ở trang chi tiết sản
          phẩm (số liệu ghi rõ chỉ mang tính tham khảo).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Bật/tắt + ngưỡng giá */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="financing-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => patch({ enabled: v })}
            />
            <Label htmlFor="financing-enabled" className="cursor-pointer">
              Hiện mục trả góp trên trang sản phẩm
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-sm">Chỉ hiện khi giá từ</Label>
            <Input
              type="number"
              min={0}
              step={500000}
              className="w-40"
              value={form.minPrice ?? 0}
              onChange={(e) => patch({ minPrice: Number(e.target.value) || 0 })}
            />
            <span className="text-sm text-muted-foreground">đ</span>
          </div>
        </div>

        {/* Danh sách bên trả góp */}
        <div className="space-y-4">
          {form.providers.map((p, pIdx) => (
            <div key={p.id} className="rounded-xl border p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Bên {pIdx + 1}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeProvider(pIdx)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Xoá
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tên bên trả góp</Label>
                  <Input
                    value={p.name}
                    onChange={(e) => patchProvider(pIdx, { name: e.target.value })}
                    placeholder="VD: Home Credit"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ghi chú ngắn</Label>
                  <Input
                    value={p.note ?? ""}
                    onChange={(e) => patchProvider(pIdx, { note: e.target.value })}
                    placeholder="VD: Duyệt nhanh qua CCCD"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Trả trước tối thiểu (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={p.minDownPercent ?? 0}
                    onChange={(e) =>
                      patchProvider(pIdx, { minDownPercent: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phí chuyển đổi (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={p.conversionFeePercent ?? 0}
                    onChange={(e) =>
                      patchProvider(pIdx, { conversionFeePercent: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              {/* Kỳ hạn */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <Label>Kỳ hạn</Label>
                  <Button variant="outline" size="sm" onClick={() => addTerm(pIdx)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Thêm kỳ hạn
                  </Button>
                </div>
                <div className="space-y-2">
                  {p.terms.map((t, tIdx) => {
                    const preview = calcInstallment(
                      PREVIEW_PRICE,
                      Math.round((PREVIEW_PRICE * (p.minDownPercent ?? 0)) / 100),
                      t,
                      p.conversionFeePercent ?? 0,
                    );
                    return (
                      <div key={tIdx} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2">
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          value={t.months}
                          onChange={(e) =>
                            patchTerm(pIdx, tIdx, { months: Number(e.target.value) || 1 })
                          }
                        />
                        <span className="text-sm text-muted-foreground">tháng ·</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-24"
                          value={t.monthlyRate}
                          onChange={(e) =>
                            patchTerm(pIdx, tIdx, { monthlyRate: Number(e.target.value) || 0 })
                          }
                        />
                        <span className="text-sm text-muted-foreground">%/tháng</span>
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                          Máy 20tr → {formatCurrency(preview.monthlyPayment)}/tháng
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeTerm(pIdx, tIdx)}
                          aria-label="Xoá kỳ hạn"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  {p.terms.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Chưa có kỳ hạn — bên này sẽ bị ẩn trên trang sản phẩm.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addProvider} className="w-full">
            <Plus className="mr-1 h-4 w-4" />
            Thêm bên trả góp
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setForm(saved ?? DEFAULT_FINANCING)}>
            Hoàn tác
          </Button>
          <Button onClick={() => onSave(form)} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu trả góp"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

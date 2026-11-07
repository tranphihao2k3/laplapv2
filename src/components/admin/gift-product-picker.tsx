"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, PackagePlus, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCrudList } from "@/lib/api/admin-crud";
import { httpGet, httpPost } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/response";
import {
  COMBO_GIFT_PRODUCTS,
  DEFAULT_COMBO_GIFT_STOCK,
} from "@/lib/products/combo-gifts";

export type GiftProductLite = {
  id: string;
  name: string;
  slug?: string;
  thumbnail_url: string | null;
  status?: string | null;
};

type Props = {
  /** id sản phẩm đang chỉnh sửa — sẽ bị loại khỏi kết quả search để tránh tự tặng chính nó */
  excludeProductId?: string;
  /** danh sách quà đã chọn (đầy đủ object, không chỉ id — để hiển thị chip có ảnh + tên) */
  value: GiftProductLite[];
  onChange: (next: GiftProductLite[]) => void;
  /** quà nhập thêm (free text), ngoài combo */
  extraValue?: string;
  onExtraChange?: (next: string) => void;
};

export const GIFT_COMBOS = [
  {
    id: "full",
    label: COMBO_GIFT_PRODUCTS.map((g) => g.name).join(" + "),
    items: COMBO_GIFT_PRODUCTS.map((g) => g.name),
  },
  {
    id: "basic",
    label: "Chuột + Lót chuột + Túi chống sốc",
    items: ["Chuột", "Lót chuột", "Túi chống sốc"],
  },
] as const;

export type GiftComboId = (typeof GIFT_COMBOS)[number]["id"];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreMatch(productName: string, keyword: string): number {
  const n = normalize(productName);
  const k = normalize(keyword);
  if (!n || !k) return 0;
  if (n === k) return 100;
  if (n.startsWith(k)) return 90;
  if (n.includes(k)) return 70;
  const parts = k.split(" ").filter(Boolean);
  if (parts.length > 1 && parts.every((p) => n.includes(p))) return 60;
  return 0;
}

async function findGiftProduct(
  keyword: string,
  excludeProductId?: string,
): Promise<GiftProductLite | null> {
  const data = await httpGet<Paginated<GiftProductLite>>("/v1/products", {
    search: keyword,
    page: 1,
    pageSize: 20,
  });
  const items = (data.items ?? []).filter((p) => p.id !== excludeProductId);
  let best: GiftProductLite | null = null;
  let bestScore = 0;
  for (const p of items) {
    const s = scoreMatch(p.name, keyword);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return bestScore >= 60 ? best : null;
}

/**
 * Combobox search + 2 combo sẵn cho quà tặng kèm.
 */
export function GiftProductPicker({
  excludeProductId,
  value,
  onChange,
  extraValue = "",
  onExtraChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [comboId, setComboId] = useState<GiftComboId | "">("");
  const [applying, setApplying] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [extraDraft, setExtraDraft] = useState(extraValue);
  const [addingExtra, setAddingExtra] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const comboIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setExtraDraft(extraValue);
  }, [extraValue]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const shouldFetch = open;
  const { data, isFetching } = useCrudList<GiftProductLite>(
    "products",
    { search: debounced || undefined, page: 1, pageSize: 20 },
    shouldFetch,
  );

  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);

  const results = useMemo(() => {
    const items = (data?.items ?? []) as GiftProductLite[];
    return items.filter((p) => p.id !== excludeProductId && !selectedIds.has(p.id));
  }, [data, excludeProductId, selectedIds]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const addGift = (p: GiftProductLite) => {
    if (selectedIds.has(p.id) || p.id === excludeProductId) return;
    onChange([...value, p]);
    setQuery("");
  };

  const removeGift = (id: string) => {
    comboIdsRef.current.delete(id);
    onChange(value.filter((v) => v.id !== id));
  };

  const applyCombo = useCallback(
    async (id: GiftComboId) => {
      const combo = GIFT_COMBOS.find((c) => c.id === id);
      if (!combo) return;
      setComboId(id);
      setApplying(true);
      try {
        const matched: GiftProductLite[] = [];
        const missing: string[] = [];
        for (const item of combo.items) {
          const hit = await findGiftProduct(item, excludeProductId);
          if (hit) matched.push(hit);
          else missing.push(item);
        }

        const uniq = new Map<string, GiftProductLite>();
        for (const g of matched) uniq.set(g.id, g);
        comboIdsRef.current = new Set(uniq.keys());

        // Đổi combo: gỡ quà thuộc combo (theo tên), giữ quà chọn tay / nhập thêm
        const allComboKeywords = GIFT_COMBOS.flatMap((c) => c.items);
        const keepNonCombo = value.filter(
          (g) => !allComboKeywords.some((kw) => scoreMatch(g.name, kw) >= 60),
        );

        onChange([...keepNonCombo, ...uniq.values()]);

        if (missing.length) {
          toast.warning(`Chưa tìm thấy SP quà: ${missing.join(", ")}. Thêm tay bằng ô tìm bên dưới.`);
        } else {
          toast.success(`Đã chọn combo: ${combo.label}`);
        }
      } catch {
        toast.error("Không áp dụng được combo quà tặng");
      } finally {
        setApplying(false);
      }
    },
    [excludeProductId, onChange, value],
  );

  const addExtraGift = async () => {
    const text = extraDraft.trim();
    if (!text) return;
    setAddingExtra(true);
    try {
      // Cho phép nhập nhiều món cách nhau bởi + hoặc ,
      const parts = text
        .split(/[+|,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const added: GiftProductLite[] = [];
      const missing: string[] = [];
      const next = [...value];
      const seen = new Set(next.map((g) => g.id));

      for (const part of parts) {
        const hit = await findGiftProduct(part, excludeProductId);
        if (hit && !seen.has(hit.id)) {
          next.push(hit);
          seen.add(hit.id);
          added.push(hit);
        } else if (!hit) {
          missing.push(part);
        }
      }

      onChange(next);
      onExtraChange?.(text);
      if (added.length) toast.success(`Đã thêm ${added.length} quà`);
      if (missing.length) {
        toast.warning(`Chưa khớp SP: ${missing.join(", ")}. Dùng ô tìm bên dưới.`);
      }
    } catch {
      toast.error("Không thêm được quà");
    } finally {
      setAddingExtra(false);
    }
  };

  return (
    <div ref={rootRef} className="space-y-3">
      {/* 2 combo sẵn */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Chọn 1 combo quà</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {GIFT_COMBOS.map((c) => {
            const active = comboId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                disabled={applying}
                onClick={() => applyCombo(c.id)}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:bg-accent"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.id === "full" ? "Combo 1" : "Combo 2"}
                </div>
                <div className="mt-0.5 font-medium leading-snug">{c.label}</div>
              </button>
            );
          })}
        </div>
        {applying && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Đang khớp sản phẩm quà trong kho...
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 w-full sm:w-auto"
          disabled={seeding || applying}
          onClick={async () => {
            setSeeding(true);
            try {
              const res = await httpPost<{
                items: Array<{
                  name: string;
                  product_id: string;
                  created: boolean;
                  stock_set: number;
                }>;
              }>("/v1/products/ensure-combo-gifts", {
                stock_qty: DEFAULT_COMBO_GIFT_STOCK,
              });
              const created = res.items.filter((i) => i.created).length;
              toast.success(
                `Đã sẵn sàng ${res.items.length} SP quà (tồn ${DEFAULT_COMBO_GIFT_STOCK.toLocaleString("vi-VN")}/món)` +
                  (created ? ` · mới tạo ${created}` : " · cập nhật tồn"),
              );
            } catch (e) {
              const msg =
                (e as { error?: { message?: string } })?.error?.message ??
                "Không tạo được SP quà";
              toast.error(msg);
            } finally {
              setSeeding(false);
            }
          }}
        >
          {seeding ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
          )}
          Tạo SP quà + tồn {DEFAULT_COMBO_GIFT_STOCK.toLocaleString("vi-VN")}
        </Button>
      </div>

      {/* Ô nhập thêm */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Thêm quà khác (ngoài combo)</Label>
        <div className="flex gap-2">
          <Input
            value={extraDraft}
            onChange={(e) => {
              setExtraDraft(e.target.value);
              onExtraChange?.(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addExtraGift();
              }
            }}
            placeholder="VD: Sạc dự phòng + USB..."
            className="h-9"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0"
            disabled={addingExtra || !extraDraft.trim()}
            onClick={() => void addExtraGift()}
          >
            {addingExtra ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Thêm
          </Button>
        </div>
      </div>

      {/* Chip đã chọn */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-md border border-dashed p-2">
          {value.map((g) => (
            <Badge key={g.id} variant="secondary" className="flex items-center gap-1.5 py-1 pl-1 pr-1.5">
              {g.thumbnail_url ? (
                <Image
                  src={g.thumbnail_url}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 rounded object-cover"
                />
              ) : (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted text-[9px] text-muted-foreground">
                  ?
                </span>
              )}
              <span className="max-w-[180px] truncate text-xs">{g.name}</span>
              <button
                type="button"
                onClick={() => removeGift(g.id)}
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-destructive/20 hover:text-destructive"
                aria-label={`Gỡ ${g.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Ô search multi */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Tìm thêm sản phẩm quà (chọn nhiều)..."
          className="pl-8"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}

        {open && (
          <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
            {isFetching && results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Đang tìm...</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {debounced ? `Không tìm thấy sản phẩm khớp "${debounced}"` : "Gõ tên sản phẩm để tìm"}
              </div>
            ) : (
              <ul className="py-1">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addGift(p)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      {p.thumbnail_url ? (
                        <Image
                          src={p.thumbnail_url}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 flex-shrink-0 rounded border object-cover"
                        />
                      ) : (
                        <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border bg-muted text-[10px] text-muted-foreground">
                          No img
                        </span>
                      )}
                      <span className="flex-1 truncate">{p.name}</span>
                      {p.status && p.status !== "active" && (
                        <span className="text-[10px] uppercase text-muted-foreground">{p.status}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Chọn combo hoặc tìm sản phẩm để thêm nhiều quà tặng kèm.
      </p>
    </div>
  );
}

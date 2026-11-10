"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { ProductForCompare } from "@/lib/compare/types";

type Props = {
  products: ProductForCompare[];
  onlyDiff: boolean;
  onRemove: (id: string) => void;
};

type SpecGroup = {
  title: string;
  rows: { key: string; label: string }[];
};

const GROUPS: SpecGroup[] = [
  {
    title: "Hiệu năng",
    rows: [
      { key: "cpu", label: "CPU" },
      { key: "gpu", label: "GPU / Card đồ hoạ" },
      { key: "ram", label: "RAM" },
      { key: "storage", label: "Ổ cứng" },
    ],
  },
  {
    title: "Màn hình",
    rows: [
      { key: "display", label: "Màn hình" },
      { key: "resolution", label: "Độ phân giải" },
      { key: "refreshHz", label: "Tần số quét" },
    ],
  },
  {
    title: "Pin & di động",
    rows: [
      { key: "battery", label: "Pin" },
      { key: "batteryHealth", label: "Độ chai pin" },
      { key: "weight", label: "Trọng lượng" },
    ],
  },
  {
    title: "Kết nối & khác",
    rows: [
      { key: "ports", label: "Cổng kết nối" },
      { key: "wireless", label: "Kết nối không dây" },
      { key: "os", label: "Hệ điều hành" },
      { key: "warranty", label: "Bảo hành" },
    ],
  },
];

const KEY_ALIASES: Record<string, string[]> = {
  cpu: ["cpu", "processor"],
  gpu: ["gpu", "vga", "graphics", "card_do_hoa"],
  ram: ["ram", "memory"],
  storage: ["storage", "ssd", "hdd", "o_cung", "hard_drive"],
  display: ["display", "screen", "man_hinh", "screen_size"],
  resolution: ["resolution", "do_phan_giai"],
  refreshHz: ["refresh_rate", "refresh_hz", "tan_so_quet"],
  battery: ["battery", "pin", "battery_capacity"],
  batteryHealth: ["battery_health", "do_chai_pin"],
  weight: ["weight", "trong_luong"],
  ports: ["ports", "connectivity", "cong_ket_noi", "io"],
  wireless: ["wireless", "wifi", "bluetooth", "ket_noi_khong_day"],
  os: ["os", "operating_system", "he_dieu_hanh"],
  warranty: ["warranty", "bao_hanh"],
};

function pickSpec(specs: Record<string, string> | undefined, key: string): string | null {
  if (!specs) return null;
  const aliases = KEY_ALIASES[key] ?? [key];
  for (const k of aliases) {
    const v = specs[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  // try loose case-insensitive match
  const lowerKeys = Object.keys(specs);
  for (const alias of aliases) {
    const found = lowerKeys.find((k) => k.toLowerCase() === alias.toLowerCase());
    if (found) {
      const v = specs[found as keyof typeof specs] as unknown;
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
  }
  return null;
}

function collectExtraKeys(products: ProductForCompare[]): string[] {
  const known = new Set(Object.values(KEY_ALIASES).flat().map((k) => k.toLowerCase()));
  const extra = new Set<string>();
  for (const p of products) {
    for (const [k, v] of Object.entries(p.specs ?? {})) {
      if (!known.has(k.toLowerCase()) && v != null && String(v).trim()) extra.add(k);
    }
  }
  return Array.from(extra).sort();
}

function hasDifference(values: (string | null)[]): boolean {
  const norm = values.map((v) => (v ?? "").trim().toLowerCase());
  return new Set(norm).size > 1;
}

export function CompareTable({ products, onlyDiff, onRemove }: Props) {
  const colTemplate = {
    gridTemplateColumns: `minmax(140px, 180px) repeat(${products.length}, minmax(180px, 1fr))`,
  };

  const extraKeys = collectExtraKeys(products);

  const rows: { id: string; label: string; group?: string; values: (string | null)[] }[] = [];
  for (const group of GROUPS) {
    for (const r of group.rows) {
      rows.push({
        id: r.key,
        label: r.label,
        group: group.title,
        values: products.map((p) => pickSpec(p.specs as Record<string, string>, r.key)),
      });
    }
  }
  for (const key of extraKeys) {
    rows.push({
      id: `extra:${key}`,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      group: "Thông số khác",
      values: products.map((p) => {
        const v = (p.specs as Record<string, unknown>)?.[key];
        if (typeof v === "string" && v.trim()) return v.trim();
        if (typeof v === "number" && Number.isFinite(v)) return String(v);
        return null;
      }),
    });
  }

  const visibleRows = rows.filter((r) => {
    const hasAny = r.values.some((v) => v && v.trim());
    if (!hasAny) return false;
    if (onlyDiff && !hasDifference(r.values)) return false;
    return true;
  });

  // group visible rows preserving order
  const grouped: { title: string; items: typeof visibleRows }[] = [];
  for (const row of visibleRows) {
    const title = row.group ?? "Khác";
    const last = grouped[grouped.length - 1];
    if (last && last.title === title) last.items.push(row);
    else grouped.push({ title, items: [row] });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Header */}
          <div
            className="grid border-b border-slate-200 bg-slate-50/70"
            style={colTemplate}
          >
            <div className="sticky left-0 z-10 bg-slate-50/90 p-4 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
              Sản phẩm
            </div>
            {products.map((p) => (
              <div key={p.id} className="relative border-l border-slate-200 p-4">
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  aria-label={`Bỏ ${p.name} khỏi so sánh`}
                  className="absolute right-2 top-2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
                <Link href={`/products/${p.slug}`} className="block pr-6">
                  <div className="relative mx-auto mb-3 aspect-[4/3] w-full max-w-[180px] overflow-hidden rounded-lg bg-slate-50">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        sizes="180px"
                        className="object-contain p-2"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        No image
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-blue-700">
                    {p.name}
                  </p>
                </Link>
                <p className="mt-1 text-sm font-medium text-red-600">
                  {p.price > 0 ? formatCurrency(p.price) : "Liên hệ"}
                </p>
                <p className={cn("mt-0.5 text-xs", p.inStock ? "text-emerald-600" : "text-slate-400")}>
                  {p.inStock ? "Còn hàng" : "Hết hàng"}
                </p>
              </div>
            ))}
          </div>

          {/* Spec rows */}
          {grouped.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              {onlyDiff ? "Các sản phẩm không có thông số khác nhau." : "Chưa có thông số để hiển thị."}
            </div>
          ) : (
            grouped.map((group) => (
              <Fragment key={group.title}>
                <div
                  className="grid border-t border-slate-200 bg-slate-50"
                  style={colTemplate}
                >
                  <div className="sticky left-0 z-10 col-span-full bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {group.title}
                  </div>
                </div>
                {group.items.map((row, idx) => (
                  <div
                    key={row.id}
                    className={cn(
                      "grid border-t border-slate-200",
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/30",
                    )}
                    style={colTemplate}
                  >
                    <div className="sticky left-0 z-10 bg-inherit p-3 text-sm font-medium text-slate-700 sm:p-4">
                      {row.label}
                    </div>
                    {row.values.map((val, i) => (
                      <div
                        key={products[i].id + row.id}
                        className="border-l border-slate-200 p-3 text-sm text-slate-800 sm:p-4"
                      >
                        {val && val.trim() ? (
                          <span className="whitespace-pre-wrap break-words">{val}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </Fragment>
            ))
          )}
        </div>
      </div>
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500 sm:hidden">
        Vuốt ngang để xem đầy đủ bảng so sánh.
      </div>
    </div>
  );
}

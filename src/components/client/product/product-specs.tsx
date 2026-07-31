import {
  Cpu,
  HardDrive,
  Monitor,
  Battery,
  Usb,
  Wifi,
  Weight,
  CircuitBoard,
  Layers,
  Keyboard,
  ShieldCheck,
} from "lucide-react";
import type { ProductWithVariants } from "./types";

type SpecMeta = { label: string; icon: typeof Cpu; group: string };

const SPEC_META: Record<string, SpecMeta> = {
  cpu: { label: "CPU", icon: Cpu, group: "Hiệu năng" },
  ram: { label: "RAM", icon: CircuitBoard, group: "Hiệu năng" },
  gpu: { label: "Card đồ họa", icon: Cpu, group: "Hiệu năng" },
  storage: { label: "Ổ cứng", icon: HardDrive, group: "Hiệu năng" },
  display: { label: "Màn hình", icon: Monitor, group: "Hiển thị" },
  connectivity: { label: "Cổng kết nối", icon: Usb, group: "Kết nối" },
  wireless: { label: "Không dây", icon: Wifi, group: "Kết nối" },
  battery: { label: "Pin", icon: Battery, group: "Khác" },
  weight: { label: "Trọng lượng", icon: Weight, group: "Khác" },
  ssd: { label: "SSD", icon: HardDrive, group: "Hiệu năng" },
  ban_phim: { label: "Bàn phím", icon: Keyboard, group: "Khác" },
  bao_hanh: { label: "Bảo hành", icon: ShieldCheck, group: "Khác" },
  warranty: { label: "Bảo hành", icon: ShieldCheck, group: "Khác" },
  man_hinh: { label: "Màn hình", icon: Monitor, group: "Hiển thị" },
};

const GROUP_ORDER = ["Hiệu năng", "Hiển thị", "Kết nối", "Khác"];

type Props = {
  product: ProductWithVariants;
};

export function ProductSpecs({ product }: Props) {
  const variant = product.variants?.[0];
  const rawSpecs = variant?.specs;
  if (!rawSpecs || typeof rawSpecs !== "object") {
    return null;
  }

  const specs = rawSpecs as Record<string, string>;
  
  // Merge warranty và bao_hanh thành 1 key duy nhất để tránh trùng lặp
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(specs)) {
    if (key === "bao_hanh" && specs.warranty) {
      // Nếu có cả warranty và bao_hanh, ưu tiên warranty và bỏ qua bao_hanh
      continue;
    }
    normalized[key] = value;
  }
  
  const entries = Object.entries(normalized).filter(([, v]) => v?.trim());
  if (entries.length === 0) return null;

  // Gom theo nhóm; key không có metadata → nhóm "Khác".
  const grouped = new Map<string, [string, string][]>();
  for (const [key, value] of entries) {
    const group = SPEC_META[key]?.group ?? "Khác";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push([key, value]);
  }

  const orderedGroups = [
    ...GROUP_ORDER.filter((g) => grouped.has(g)),
    ...[...grouped.keys()].filter((g) => !GROUP_ORDER.includes(g)),
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {orderedGroups.map((group) => {
        const rows = grouped.get(group)!;
        return (
          <div key={group} className="overflow-hidden rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 border-b border-slate-200/80 bg-slate-50/70 px-4 py-3">
              <Layers className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">{group}</h3>
            </div>
            <table className="block w-full text-sm sm:table">
              <tbody className="block sm:table-row-group">
                {rows.map(([key, value], idx) => {
                  const meta = SPEC_META[key];
                  const Icon = meta?.icon;
                  return (
                    <tr
                      key={key}
                      className={`flex flex-col sm:table-row ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                    >
                      <td className="px-4 pt-2.5 align-top font-medium text-slate-500 sm:w-1/3 sm:py-3.5">
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
                          <span className="min-w-0">{meta?.label ?? key}</span>
                        </div>
                      </td>
                      <td className="break-words px-4 pb-2.5 pt-0.5 text-slate-800 sm:py-3.5">{value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

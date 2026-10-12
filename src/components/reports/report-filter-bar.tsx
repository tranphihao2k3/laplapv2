"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw, Filter } from "lucide-react";

export type FilterField =
  | { kind: "date"; key: string; label: string }
  | { kind: "text"; key: string; label: string; placeholder?: string }
  | { kind: "select"; key: string; label: string; options: Array<{ value: string; label: string }>; allowAll?: boolean; allLabel?: string };

type Props = {
  /** Các field filter hiển thị — cố định, không add/remove. */
  fields: FilterField[];
  /** Giá trị filter hiện tại (controlled). */
  values: Record<string, string | number>;
  /** Callback khi user thay đổi. */
  onChange: (next: Record<string, string | number>) => void;
  /** Render thêm custom filter (vd ShopSelect) vào cuối. */
  extra?: ReactNode;
  /** Có hiển thị nút Reset không (mặc định true). */
  showReset?: boolean;
  /** Custom reset value (vd reset về 30 ngày gần nhất). */
  resetValues?: Record<string, string | number>;
};

const ALL_VALUE = "__all__";

export function ReportFilterBar({
  fields,
  values,
  onChange,
  extra,
  showReset = true,
  resetValues,
}: Props) {
  function setField(key: string, v: string) {
    onChange({ ...values, [key]: v === ALL_VALUE ? "" : v });
  }

  function reset() {
    if (resetValues) {
      onChange({ ...resetValues });
      return;
    }
    const cleared: Record<string, string | number> = {};
    for (const f of fields) cleared[f.key] = "";
    onChange(cleared);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Filter className="h-3.5 w-3.5" /> Bộ lọc
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {fields.map((f) => {
          if (f.kind === "date") {
            return (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type="date"
                  value={String(values[f.key] ?? "")}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="h-9"
                />
              </div>
            );
          }
          if (f.kind === "text") {
            return (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  value={String(values[f.key] ?? "")}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="h-9"
                />
              </div>
            );
          }
          // select
          return (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Select
                value={String(values[f.key] ?? "") || (f.allowAll ? ALL_VALUE : "")}
                onValueChange={(v) => setField(f.key, v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={f.options[0]?.label ?? "Chọn"} />
                </SelectTrigger>
                <SelectContent>
                  {f.allowAll && (
                    <SelectItem value={ALL_VALUE}>{f.allLabel ?? "Tất cả"}</SelectItem>
                  )}
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
        {extra}
        {showReset && (
          <div className="space-y-1">
            <Label className="text-xs invisible">Reset</Label>
            <Button variant="outline" size="sm" className="h-9 w-full" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Đặt lại
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

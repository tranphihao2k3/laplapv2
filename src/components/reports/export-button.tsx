"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  /** Relative endpoint vd "/api/v1/exports/revenue" */
  endpoint: string;
  /** Query string filters */
  params: Record<string, string | number | undefined | null>;
  /** Tên file fallback nếu server không set Content-Disposition */
  filename: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
};

export function ExportButton({
  endpoint,
  params,
  filename,
  label = "Xuất Excel",
  variant = "outline",
  size = "sm",
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    try {
      setLoading(true);
      const sp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v == null || v === "") return;
        sp.set(k, String(v));
      });
      const res = await fetch(`${endpoint}?${sp.toString()}`, { method: "GET" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`);
      }
      const blob = await res.blob();
      // Lấy filename từ Content-Disposition nếu có
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      const name = match?.[1] ? decodeURIComponent(match[1]) : filename;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Đã tải file Excel");
    } catch (e) {
      toast.error("Xuất Excel thất bại: " + (e instanceof Error ? e.message : ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleExport} disabled={loading} variant={variant} size={size}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4 mr-1" />
      )}
      {label}
    </Button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  Edit3,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  FlameKindling,
  Gauge,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ToolRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  r2_key: string;
  sha256: string;
  exec_name: string;
  extract: boolean;
  launch_args: string[];
  requires_admin: boolean;
  size_bytes: number;
  version: string | null;
  vendor: string | null;
  status: "active" | "hidden" | "disabled";
  sort_order: number;
  sizeLabel: string;
  verifyMode: "verified" | "required" | "skip";
};

const CATEGORIES: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "diagnostic", label: "Chẩn đoán", Icon: Cpu },
  { id: "stress", label: "Stress test", Icon: FlameKindling },
  { id: "benchmark", label: "Benchmark", Icon: Gauge },
  { id: "utility", label: "Tiện ích", Icon: Wrench },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  diagnostic: Cpu,
  stress: FlameKindling,
  benchmark: Gauge,
  utility: Wrench,
};

export default function AdminToolsPage() {
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<ToolRow | null>(null);

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "",
    category: "diagnostic",
    icon: "🔧",
    version: "",
    vendor: "",
    exec_name: "",
    extract: "true",
    launch_args: "[]",
    requires_admin: "false",
    sort_order: "100",
  });

  const loadTools = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/tools");
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Load failed");
      setTools(json.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, []);

  const resetForm = () => {
    setFile(null);
    setEditing(null);
    setForm({
      id: "",
      name: "",
      description: "",
      category: "diagnostic",
      icon: "🔧",
      version: "",
      vendor: "",
      exec_name: "",
      extract: "true",
      launch_args: "[]",
      requires_admin: "false",
      sort_order: "100",
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Chọn file tool trước");
    if (!/^[a-z0-9-]{2,64}$/.test(form.id))
      return toast.error("ID phải là chữ thường, số, dấu gạch ngang (2-64 ký tự)");
    if (!form.exec_name) return toast.error("Tên file exe chính bắt buộc");

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("id", form.id);
      fd.append("name", form.name || form.id);
      fd.append("description", form.description);
      fd.append("category", form.category);
      fd.append("icon", form.icon);
      fd.append("version", form.version);
      fd.append("vendor", form.vendor);
      fd.append("exec_name", form.exec_name);
      fd.append("extract", form.extract);
      fd.append("launch_args", form.launch_args);
      fd.append("requires_admin", form.requires_admin);
      fd.append("sort_order", form.sort_order);

      const res = await fetch("/api/v1/admin/tools/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Upload failed");
      toast.success(`Upload ${form.name || form.id} thành công`);
      resetForm();
      await loadTools();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (tool: ToolRow) => {
    if (!confirm(`Xóa tool "${tool.name}"? File R2 cũng sẽ bị xóa.`)) return;
    try {
      const res = await fetch(`/api/v1/admin/tools/${tool.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Delete failed");
      toast.success(`Đã xóa ${tool.name}`);
      await loadTools();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleToggleStatus = async (tool: ToolRow) => {
    const next = tool.status === "active" ? "hidden" : "active";
    try {
      const res = await fetch(`/api/v1/admin/tools/${tool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message || "Update failed");
      toast.success(`Đã chuyển ${tool.name} → ${next}`);
      await loadTools();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload công cụ mới
          </CardTitle>
          <CardDescription>
            File .exe / .zip được lưu trên R2 bucket <code>laplap-tools</code>.
            SHA256 sẽ tự động tính lúc upload. Max 200MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="file">File (.exe / .zip)</Label>
              <Input
                id="file"
                type="file"
                accept=".exe,.zip,.7z,.rar"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="id">ID (slug)</Label>
              <Input
                id="id"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase() })}
                placeholder="cpu-z"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Tên hiển thị</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="CPU-Z"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="2.20.2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="CPUID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Danh mục</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exec_name">File exe chính</Label>
              <Input
                id="exec_name"
                value={form.exec_name}
                onChange={(e) => setForm({ ...form, exec_name: e.target.value })}
                placeholder="cpuz_x64.exe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Icon (emoji)</Label>
              <Input
                id="icon"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="🔧"
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extract">Định dạng</Label>
              <Select
                value={form.extract}
                onValueChange={(v) => setForm({ ...form, extract: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">ZIP (cần extract)</SelectItem>
                  <SelectItem value="false">EXE (chạy trực tiếp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="description">Mô tả</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Chi tiết CPU, mainboard, RAM..."
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="launch_args">Launch args (JSON array string)</Label>
              <Input
                id="launch_args"
                value={form.launch_args}
                onChange={(e) => setForm({ ...form, launch_args: e.target.value })}
                placeholder='["-minimized"]'
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.requires_admin === "true"}
                  onChange={(e) =>
                    setForm({ ...form, requires_admin: e.target.checked ? "true" : "false" })
                  }
                />
                Cần quyền Admin
              </label>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={uploading}>
                {uploading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Đang upload & hash...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Hủy
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Công cụ đã đăng ký ({tools.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-lg border border-zinc-200 bg-zinc-50"
                />
              ))}
            </div>
          ) : tools.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Chưa có tool nào. Upload tool đầu tiên ở form phía trên.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((t) => {
                const CatIcon = CATEGORY_ICONS[t.category] ?? Wrench;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "rounded-lg border p-3 transition",
                      t.status === "active"
                        ? "border-zinc-200 bg-white"
                        : t.status === "hidden"
                          ? "border-amber-200 bg-amber-50"
                          : "border-zinc-200 bg-zinc-50 opacity-60",
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl" aria-hidden>
                          {t.icon}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">{t.name}</p>
                          <p className="text-[11px] text-zinc-500">
                            <Badge variant="outline" className="mr-1 text-[10px]">
                              <CatIcon className="mr-0.5 h-3 w-3" />
                              {t.category}
                            </Badge>
                            {t.sizeLabel}
                            {t.requires_admin && (
                              <span className="ml-1 text-amber-600">• Admin</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {t.verifyMode === "verified" && (
                          <Badge
                            variant="outline"
                            className="border-green-300 px-1.5 py-0 text-[10px] text-green-700"
                          >
                            <ShieldCheck className="mr-1 h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                        {t.verifyMode === "required" && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 px-1.5 py-0 text-[10px] text-amber-700"
                          >
                            <ShieldAlert className="mr-1 h-3 w-3" />
                            Unverified
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-1.5 py-0 text-[10px]",
                            t.status === "active"
                              ? "border-green-300 text-green-700"
                              : t.status === "hidden"
                                ? "border-amber-300 text-amber-700"
                                : "border-zinc-300 text-zinc-500",
                          )}
                        >
                          {t.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="mb-2 line-clamp-2 text-xs text-zinc-600">{t.description}</p>
                    <p className="mb-2 truncate font-mono text-[10px] text-zinc-400" title={t.r2_key}>
                      {t.r2_key}
                    </p>
                    <p className="mb-3 font-mono text-[10px] text-zinc-400">
                      exec: {t.exec_name}
                      {t.launch_args.length > 0 && ` (${t.launch_args.join(", ")})`}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleStatus(t)}
                        className="h-7 px-2 text-xs"
                      >
                        {t.status === "active" ? "Hide" : "Show"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(t)}
                        className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

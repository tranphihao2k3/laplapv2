"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Mail,
  Users,
  Send,
  AlertCircle,
  RefreshCw,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type Stats = {
  activeSubscribers: number;
  pendingConfirm: number;
  unsubscribed: number;
  outboxPending: number;
  outboxFailed: number;
  emailsSent24h: number;
};

type Subscriber = {
  id: string;
  email: string;
  brand_ids: string[] | null;
  is_active: boolean | null;
  confirmed: boolean | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string | null;
};

type OutboxRow = {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string | null;
  product_brand_name: string | null;
  product_price: number | null;
  status: string | null;
  attempts: number | null;
  last_error: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string | null;
};

type Brand = { id: string; name: string };

export default function NewsletterAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "active" | "unsubscribed">("all");
  const [outboxStatusFilter, setOutboxStatusFilter] = useState<"all" | "pending" | "sent" | "failed">("all");
  const [subsPage, setSubsPage] = useState(1);
  const [subsTotal, setSubsTotal] = useState(0);
  const [outboxPage, setOutboxPage] = useState(1);
  const [outboxTotal, setOutboxTotal] = useState(0);
  const PAGE_SIZE = 20;

  // Stats + brands
  async function loadStats() {
    try {
      const r = await fetch("/api/v1/admin/newsletter/stats");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setStats(j?.data ?? null);
    } catch (e) {
      console.error("loadStats:", e);
    }
  }
  async function loadBrands() {
    try {
      const r = await fetch("/api/v1/admin/brands");
      if (!r.ok) return;
      const j = await r.json();
      setBrands((j?.items ?? []) as Brand[]);
    } catch {}
  }
  async function loadSubs(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const r = await fetch(`/api/v1/admin/newsletter/subscribers?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setSubs((j?.data?.items ?? []) as Subscriber[]);
      setSubsTotal(j?.data?.total ?? 0);
      setSubsPage(page);
    } catch (e) {
      console.error(e);
      toast.error("Không tải được danh sách subscribers");
    } finally {
      setLoading(false);
    }
  }
  async function loadOutbox(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (outboxStatusFilter !== "all") params.set("status", outboxStatusFilter);
      const r = await fetch(`/api/v1/admin/newsletter/outbox?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setOutbox((j?.data?.items ?? []) as OutboxRow[]);
      setOutboxTotal(j?.data?.total ?? 0);
      setOutboxPage(page);
    } catch (e) {
      console.error(e);
      toast.error("Không tải được outbox");
    } finally {
      setLoading(false);
    }
  }

  // Manual dispatch (bulk hoặc single retry).
  async function handleDispatch(outboxId?: string) {
    setDispatching(true);
    try {
      const r = await fetch("/api/v1/admin/newsletter/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(outboxId ? { outboxId } : {}),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      const data = j.data;
      if (data?.processed === 0) {
        toast.info("Không có email nào trong hàng đợi.");
      } else {
        toast.success(
          `Đã xử lý ${data.processed} email, gửi thành công ${data.sent}.${data.errors ? ` Lỗi: ${data.errors.length}` : ""}`,
        );
      }
      loadOutbox(outboxPage);
      loadStats();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown";
      toast.error(`Dispatch lỗi: ${msg}`);
    } finally {
      setDispatching(false);
    }
  }

  async function handleDeleteSubscriber(id: string) {
    if (!confirm("Xóa subscriber này? Hành động không thể hoàn tác.")) return;
    try {
      const r = await fetch(`/api/v1/admin/newsletter/subscribers/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success("Đã xóa subscriber.");
      loadSubs(subsPage);
      loadStats();
    } catch (e) {
      toast.error("Xóa thất bại");
    }
  }

  // Initial load + reload stats moi 30s.
  useEffect(() => {
    loadStats();
    loadBrands();
    const t = setInterval(loadStats, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadSubs(1);
  }, [search, statusFilter]);
  useEffect(() => {
    loadOutbox(1);
  }, [outboxStatusFilter]);

  function brandNames(ids: string[] | null): string {
    if (!ids || ids.length === 0) return "Tất cả sản phẩm";
    const names = ids.map((id) => brands.find((b) => b.id === id)?.name).filter(Boolean);
    return names.join(", ") || `${ids.length} hãng`;
  }

  function statusBadge(s: Subscriber) {
    if (!s.is_active) return <Badge variant="secondary">Đã hủy</Badge>;
    if (!s.confirmed) return <Badge className="bg-amber-100 text-amber-800">Chờ xác nhận</Badge>;
    return <Badge className="bg-green-100 text-green-800">Đang nhận</Badge>;
  }

  function outboxStatusBadge(status: string | null) {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-amber-700 border-amber-300"><Clock className="mr-1 h-3 w-3" />Chờ</Badge>;
      case "sending":
        return <Badge variant="outline" className="text-blue-700 border-blue-300"><RefreshCw className="mr-1 h-3 w-3" />Đang gửi</Badge>;
      case "sent":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="mr-1 h-3 w-3" />Đã gửi</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Lỗi</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  const subsTotalPages = Math.ceil(subsTotal / PAGE_SIZE);
  const outboxTotalPages = Math.ceil(outboxTotal / PAGE_SIZE);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Newsletter</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý email đăng ký thông báo sản phẩm mới + hàng đợi gửi email.
          </p>
        </div>
        <Button
          onClick={() => handleDispatch()}
          disabled={dispatching}
          className="bg-zinc-900 text-white hover:bg-zinc-700"
        >
          {dispatching ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Gửi mail ngay
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Đang nhận" value={stats.activeSubscribers} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Chờ xác nhận" value={stats.pendingConfirm} icon={<Clock className="h-4 w-4" />} tone="amber" />
          <StatCard label="Đã hủy" value={stats.unsubscribed} icon={<XCircle className="h-4 w-4" />} tone="gray" />
          <StatCard label="Outbox chờ" value={stats.outboxPending} icon={<Inbox className="h-4 w-4" />} tone="amber" />
          <StatCard label="Outbox lỗi" value={stats.outboxFailed} icon={<AlertCircle className="h-4 w-4" />} tone="red" />
          <StatCard label="Đã gửi 24h" value={stats.emailsSent24h} icon={<Send className="h-4 w-4" />} tone="green" />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="subscribers">
        <TabsList>
          <TabsTrigger value="subscribers">
            <Users className="mr-2 h-4 w-4" /> Subscribers ({subsTotal})
          </TabsTrigger>
          <TabsTrigger value="outbox">
            <Mail className="mr-2 h-4 w-4" /> Outbox ({outboxTotal})
          </TabsTrigger>
        </TabsList>

        {/* Subscribers tab */}
        <TabsContent value="subscribers" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bộ lọc</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="active">Đang nhận</SelectItem>
                  <SelectItem value="pending">Chờ xác nhận</SelectItem>
                  <SelectItem value="unsubscribed">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Phạm vi</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Ngày đăng ký</th>
                      <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-zinc-400">
                          {loading ? "Đang tải..." : "Không có subscriber nào."}
                        </td>
                      </tr>
                    ) : (
                      subs.map((s) => (
                        <tr key={s.id} className="border-b last:border-0 hover:bg-zinc-50">
                          <td className="px-4 py-3 font-medium">{s.email}</td>
                          <td className="px-4 py-3 text-zinc-600">{brandNames(s.brand_ids)}</td>
                          <td className="px-4 py-3">{statusBadge(s)}</td>
                          <td className="px-4 py-3 text-zinc-500">
                            {s.created_at ? new Date(s.created_at).toLocaleString("vi-VN") : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSubscriber(s.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {subsTotalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-zinc-500">
                    Trang {subsPage}/{subsTotalPages} ({subsTotal} subscriber)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={subsPage <= 1}
                      onClick={() => loadSubs(subsPage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={subsPage >= subsTotalPages}
                      onClick={() => loadSubs(subsPage + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outbox tab */}
        <TabsContent value="outbox" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bộ lọc</CardTitle>
              <CardDescription>
                Trigger tự động tạo row khi admin đăng sản phẩm mới. Cron job (hoặc nút bên trên) sẽ gửi email cho subscribers phù hợp.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Select
                value={outboxStatusFilter}
                onValueChange={(v) => setOutboxStatusFilter(v as typeof outboxStatusFilter)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="pending">Chờ</SelectItem>
                  <SelectItem value="sent">Đã gửi</SelectItem>
                  <SelectItem value="failed">Lỗi</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                      <th className="px-4 py-3">Sản phẩm</th>
                      <th className="px-4 py-3">Hãng</th>
                      <th className="px-4 py-3">Giá</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Lần cuối</th>
                      <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outbox.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                          {loading ? "Đang tải..." : "Outbox trống."}
                        </td>
                      </tr>
                    ) : (
                      outbox.map((row) => (
                        <tr key={row.id} className="border-b last:border-0 hover:bg-zinc-50">
                          <td className="px-4 py-3">
                            <p className="font-medium">{row.product_name}</p>
                            {row.last_error && (
                              <p className="mt-1 text-xs text-red-600">{row.last_error}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">{row.product_brand_name ?? "—"}</td>
                          <td className="px-4 py-3 text-zinc-600">
                            {row.product_price != null
                              ? new Intl.NumberFormat("vi-VN").format(row.product_price) + " đ"
                              : "—"}
                          </td>
                          <td className="px-4 py-3">{outboxStatusBadge(row.status)}</td>
                          <td className="px-4 py-3 text-xs text-zinc-500">
                            {(row.sent_at ?? row.scheduled_at ?? row.created_at)
                              ? new Date((row.sent_at ?? row.scheduled_at ?? row.created_at)!).toLocaleString("vi-VN")
                              : "—"}
                            {row.attempts != null && row.attempts > 0 && (
                              <span className="ml-1 text-zinc-400">({row.attempts}x)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(row.status === "pending" || row.status === "failed") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDispatch(row.id)}
                                disabled={dispatching}
                              >
                                <RefreshCw className="mr-1 h-3 w-3" /> Retry
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {outboxTotalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-zinc-500">
                    Trang {outboxPage}/{outboxTotalPages} ({outboxTotal} dòng)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={outboxPage <= 1}
                      onClick={() => loadOutbox(outboxPage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={outboxPage >= outboxTotalPages}
                      onClick={() => loadOutbox(outboxPage + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "default" | "amber" | "red" | "gray" | "green";
}) {
  const toneClasses: Record<typeof tone, string> = {
    default: "text-zinc-700",
    amber: "text-amber-700",
    red: "text-red-700",
    gray: "text-zinc-400",
    green: "text-green-700",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          <span className={toneClasses[tone]}>{icon}</span>
        </div>
        <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClasses[tone]}`}>
          {value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCrudList, useCrudCreate } from "@/lib/api/admin-crud";
import { httpGet } from "@/lib/api/http";
import { formatCurrency } from "@/lib/utils";
import { Search, Plus, Star, History } from "lucide-react";

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  tier: string | null;
  loyalty_points: number | null;
};

type LoyaltyTx = {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  points: number | null;
  type: string | null;
  created_at: string | null;
};

type Order = {
  id: string;
  order_number: string | null;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  created_at: string | null;
};

type Paginated<T> = { items: T[]; total: number };

const TYPE_MAP: Record<string, { label: string; cls: string }> = {
  earn: { label: "Tích", cls: "bg-green-100 text-green-700" },
  redeem: { label: "Đổi", cls: "bg-blue-100 text-blue-700" },
  expire: { label: "Hết hạn", cls: "bg-gray-100 text-gray-600" },
  adjust: { label: "Điều chỉnh", cls: "bg-amber-100 text-amber-700" },
};

const TIER_MAP: Record<string, { label: string; cls: string }> = {
  bronze: { label: "Đồng", cls: "bg-orange-100 text-orange-700" },
  silver: { label: "Bạc", cls: "bg-gray-100 text-gray-700" },
  gold: { label: "Vàng", cls: "bg-yellow-100 text-yellow-700" },
  platinum: { label: "Bạch kim", cls: "bg-indigo-100 text-indigo-700" },
};

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("vi-VN");
  } catch {
    return d;
  }
}

/* ---------- Dialog: lịch sử của 1 thành viên ---------- */
function MemberHistoryDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const customerId = customer?.id ?? "";

  const ordersQ = useQuery({
    queryKey: ["loyalty-member-orders", customerId],
    enabled: open && !!customerId,
    queryFn: () =>
      httpGet<Paginated<Order>>("/v1/orders", {
        customer_id: customerId,
        pageSize: 100,
        sort: "created_at:desc",
      }),
  });

  const txQ = useQuery({
    queryKey: ["loyalty-member-tx", customerId],
    enabled: open && !!customerId,
    queryFn: () =>
      httpGet<Paginated<LoyaltyTx>>("/v1/loyalty-transactions", {
        customer_id: customerId,
        pageSize: 100,
        sort: "created_at:desc",
      }),
  });

  const orders = ordersQ.data?.items ?? [];
  const txs = txQ.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {customer?.full_name ?? "Thành viên"}
            {customer?.tier && (
              <Badge variant="secondary" className={TIER_MAP[customer.tier]?.cls}>
                {TIER_MAP[customer.tier]?.label ?? customer.tier}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {customer?.phone ?? "—"} · Điểm hiện có:{" "}
            <span className="font-semibold text-foreground">
              {customer?.loyalty_points ?? 0}
            </span>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="orders">Lịch sử mua hàng</TabsTrigger>
            <TabsTrigger value="points">Lịch sử cộng điểm</TabsTrigger>
          </TabsList>

          {/* Lịch sử mua hàng */}
          <TabsContent value="orders" className="max-h-[55vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead>Thời gian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersQ.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Chưa có đơn hàng
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">
                        {o.order_number ?? o.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs">{o.status ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(Number(o.total_amount ?? 0))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDateTime(o.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Lịch sử cộng điểm */}
          <TabsContent value="points" className="max-h-[55vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Loại</TableHead>
                  <TableHead className="text-right">Điểm</TableHead>
                  <TableHead>Đơn liên quan</TableHead>
                  <TableHead>Thời gian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txQ.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : txs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Chưa có giao dịch điểm
                    </TableCell>
                  </TableRow>
                ) : (
                  txs.map((tx) => {
                    const t = TYPE_MAP[tx.type ?? ""] ?? { label: tx.type ?? "-", cls: "bg-muted" };
                    const isPositive = tx.type === "earn" || tx.type === "adjust";
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.cls}`}>
                            {t.label}
                          </span>
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            isPositive ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {tx.points ?? 0}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {tx.order_id ? tx.order_id.slice(0, 8) + "..." : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDateTime(tx.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Trang chính: danh sách thành viên ---------- */
export default function LoyaltyMembersPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openNew, setOpenNew] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<Record<string, any>>({ type: "adjust", points: 0 });

  const customersQ = useCrudList<Customer>("loyalty-customers", {
    search,
    page: 1,
    pageSize: 100,
  });
  const customers = useMemo(
    () => customersQ.data?.items ?? [],
    [customersQ.data],
  );

  const createMutation = useCrudCreate("loyalty-transactions");

  function openHistory(c: Customer) {
    setSelected(c);
    setHistoryOpen(true);
  }

  async function handleSubmit() {
    if (!form.customer_id) {
      toast.error("Chọn khách hàng");
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createMutation.mutateAsync(form as any);
      toast.success("Đã tạo giao dịch điểm");
      setForm({ type: "adjust", points: 0 });
      setOpenNew(false);
      customersQ.refetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Thành viên & điểm thưởng</CardTitle>
            <CardDescription>
              Danh sách khách hàng và tổng điểm tích luỹ. Bấm để xem lịch sử mua hàng & cộng điểm.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên / SĐT / email..."
                className="w-full sm:w-56 pl-8"
              />
            </div>
            <Button
              onClick={() => {
                setForm({ type: "adjust", points: 0 });
                setOpenNew(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" /> Tạo GD điểm
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Liên hệ</TableHead>
                <TableHead className="text-center">Hạng</TableHead>
                <TableHead className="text-right">Điểm hiện có</TableHead>
                <TableHead className="text-right">Lịch sử</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customersQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Chưa có thành viên
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => {
                  const tier = TIER_MAP[c.tier ?? ""];
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => openHistory(c)}
                    >
                      <TableCell>
                        <div className="text-sm font-medium">{c.full_name ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.id.slice(0, 8)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{c.phone ?? "—"}</div>
                        <div>{c.email ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        {tier ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tier.cls}`}>
                            {tier.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                          {c.loyalty_points ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openHistory(c);
                          }}
                        >
                          <History className="mr-1 h-3.5 w-3.5" /> Xem
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MemberHistoryDialog
        customer={selected}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />

      {/* Tạo giao dịch điểm thủ công */}
      <Dialog open={openNew} onOpenChange={(o) => { if (!o) setOpenNew(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo giao dịch điểm</DialogTitle>
            <DialogDescription>Điều chỉnh thủ công điểm thưởng khách hàng.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Khách hàng *</Label>
              <Select
                value={form.customer_id ?? ""}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onValueChange={(v) => setForm((p: any) => ({ ...p, customer_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn khách hàng" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name ?? c.id.slice(0, 8)}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Loại</Label>
              <Select
                value={form.type ?? "adjust"}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onValueChange={(v) => setForm((p: any) => ({ ...p, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earn">Tích điểm</SelectItem>
                  <SelectItem value="redeem">Đổi điểm</SelectItem>
                  <SelectItem value="adjust">Điều chỉnh</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Số điểm</Label>
              <Input
                type="number"
                value={form.points ?? 0}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onChange={(e) => setForm((p: any) => ({ ...p, points: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>
              Huỷ
            </Button>
            <Button
              disabled={!form.customer_id || createMutation.isPending}
              onClick={handleSubmit}
            >
              Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

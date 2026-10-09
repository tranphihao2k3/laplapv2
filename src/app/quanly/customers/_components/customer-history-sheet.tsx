"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { httpGet } from "@/lib/api/http";
import { formatCurrency } from "@/lib/utils";
import { zaloLink } from "@/lib/contact";
import { Star, Users, Package, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  tier: string | null;
  loyalty_points?: number | null;
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

type OrderItem = {
  id: string;
  order_id: string | null;
  product_variant_id: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  product_snapshot: unknown | null;
  product_variant?: {
    id: string;
    sku?: string | null;
    name?: string | null;
    product?: {
      id: string;
      name?: string | null;
      slug?: string | null;
      thumbnail_url?: string | null;
    } | null;
  } | null;
};

type Paginated<T> = { items: T[]; total: number };

const TIER_MAP: Record<string, { label: string; cls: string }> = {
  bronze: { label: "Đồng", cls: "bg-amber-100 text-amber-800" },
  silver: { label: "Bạc", cls: "bg-gray-100 text-gray-700" },
  gold: { label: "Vàng", cls: "bg-yellow-100 text-yellow-800" },
  platinum: { label: "Bạch kim", cls: "bg-indigo-100 text-indigo-800" },
};

const TX_TYPE_MAP: Record<string, { label: string; cls: string }> = {
  earn: { label: "Tích", cls: "bg-green-100 text-green-700" },
  redeem: { label: "Đổi", cls: "bg-blue-100 text-blue-700" },
  expire: { label: "Hết hạn", cls: "bg-gray-100 text-gray-600" },
  adjust: { label: "Điều chỉnh", cls: "bg-amber-100 text-amber-700" },
};

// Phân trang lịch sử mua hàng trong sheet
const ORDERS_PAGE_SIZE = 8;
// Phân trang lịch sử cộng/trừ điểm
const TX_PAGE_SIZE = 10;

function thoiGianTuongDoi(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

/**
 * Rút tên sản phẩm "người dùng đọc được" từ 1 order item.
 * Ưu tiên: tên product từ join → variant name → snapshot.name → fallback "Sản phẩm".
 */
function getItemDisplayName(item: OrderItem): string {
  const productName = item.product_variant?.product?.name;
  if (productName) return productName;
  const variantName = item.product_variant?.name;
  if (variantName) return variantName;
  const snap = item.product_snapshot as Record<string, unknown> | null;
  const snapName = (snap?.name as string | undefined) ?? (snap?.product_name as string | undefined);
  if (snapName) return snapName;
  return "Sản phẩm";
}

/**
 * Tóm tắt danh sách sản phẩm trong 1 đơn.
 * - 0 item  → "—"
 * - 1 item  → "Acer Aspire 5 × 2"
 * - 2 items → 2 dòng
 * - >2 items → 2 dòng đầu + "+ N sản phẩm khác"
 */
function summarizeItems(items: OrderItem[], maxLines = 2): { lines: string[]; extra: number } {
  if (items.length === 0) return { lines: ["—"], extra: 0 };
  const lines: string[] = [];
  for (const it of items.slice(0, maxLines)) {
    const name = getItemDisplayName(it);
    const qty = Number(it.quantity ?? 1) || 1;
    lines.push(qty > 1 ? `${name} × ${qty}` : name);
  }
  return { lines, extra: Math.max(0, items.length - maxLines) };
}

/**
 * Sheet drawer hiển thị lịch sử mua hàng + lịch sử cộng/trừ điểm
 * của 1 khách hàng. Hai tab song song, gọi API song song khi mở.
 */
export function CustomerHistorySheet({
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
    queryKey: ["customer-history-orders", customerId],
    enabled: open && !!customerId,
    queryFn: () =>
      httpGet<Paginated<Order>>("/v1/orders", {
        customer_id: customerId,
        pageSize: 100,
        sort: "created_at:desc",
      }),
  });

  const txQ = useQuery({
    queryKey: ["customer-history-tx", customerId],
    enabled: open && !!customerId,
    queryFn: () =>
      httpGet<Paginated<LoyaltyTx>>("/v1/loyalty-transactions", {
        customer_id: customerId,
        pageSize: 100,
        sort: "created_at:desc",
      }),
  });

  // Phân trang tab "Lịch sử mua hàng" + tab "Lịch sử cộng điểm".
  // Reset về trang 1 khi đổi khách (customerId) hoặc mở lại sheet.
  const [orderPage, setOrderPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  useEffect(() => {
    setOrderPage(1);
    setTxPage(1);
  }, [customerId, open]);

  const orders = ordersQ.data?.items ?? [];
  const txs = txQ.data?.items ?? [];
  const totalSpent = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

  // Phân trang orders theo ORDERS_PAGE_SIZE (đã sort desc nên trang 1 = mới nhất)
  const orderPageCount = Math.max(1, Math.ceil(orders.length / ORDERS_PAGE_SIZE));
  const pagedOrders = useMemo(
    () => orders.slice((orderPage - 1) * ORDERS_PAGE_SIZE, orderPage * ORDERS_PAGE_SIZE),
    [orders, orderPage],
  );
  const txPageCount = Math.max(1, Math.ceil(txs.length / TX_PAGE_SIZE));
  const pagedTxs = useMemo(
    () => txs.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE),
    [txs, txPage],
  );

  // Số STT bắt đầu theo trang (giúp biết đơn thứ mấy trong tổng thể)
  const orderRowStart = (orderPage - 1) * ORDERS_PAGE_SIZE;
  const txRowStart = (txPage - 1) * TX_PAGE_SIZE;

  // Sau khi load orders, gọi tiếp 1 query order-items cho tất cả orders của khách
  // (dùng `__in` đã thêm vào factory) — trả về items kèm join product_variant:product_variants(...) + products.
  // Bật enabled khi đã có orders (kể cả rỗng, vẫn gọi để hiển thị "Chưa có đơn").
  const orderIdsKey = orders.map((o) => o.id).join(",");
  const itemsQ = useQuery({
    queryKey: ["customer-history-items", customerId, orderIdsKey],
    enabled: open && !!customerId && ordersQ.isSuccess,
    queryFn: () =>
      httpGet<Paginated<OrderItem>>("/v1/order-items", {
        order_id__in: orderIdsKey,
        pageSize: 100,
      }),
  });

  // Group items theo order_id để tra cứu nhanh khi render.
  const itemsByOrderId = useMemo(() => {
    const map = new Map<string, OrderItem[]>();
    for (const it of itemsQ.data?.items ?? []) {
      if (!it.order_id) continue;
      const arr = map.get(it.order_id) ?? [];
      arr.push(it);
      map.set(it.order_id, arr);
    }
    return map;
  }, [itemsQ.data]);

  const totalItems = itemsQ.data?.total ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="p-6 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className="truncate">{customer?.full_name ?? "Khách hàng"}</span>
            {customer?.tier && (
              <Badge variant="secondary" className={TIER_MAP[customer.tier]?.cls}>
                {TIER_MAP[customer.tier]?.label ?? customer.tier}
              </Badge>
            )}
            {(() => {
              const link = zaloLink(customer?.phone);
              if (!link) return null;
              return (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 gap-1 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800"
                  onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
                  title={`Nhắn tin Zalo cho ${customer?.full_name ?? customer?.phone}`}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Chat Zalo</span>
                </Button>
              );
            })()}
          </SheetTitle>
          <SheetDescription className="space-y-0.5">
            <div>
              {customer?.phone ?? "—"} · {customer?.email ?? ""}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
              <span>
                <Star className="inline h-3 w-3 fill-amber-500 text-amber-500 mr-0.5" />
                <b>{customer?.loyalty_points ?? 0}</b> điểm
              </span>
              <span>
                🛒 <b>{orders.length}</b> đơn
              </span>
              <span>
                📦 <b>{totalItems}</b> sản phẩm
              </span>
              <span>
                💰 <b>{formatCurrency(totalSpent)}</b> tổng chi
              </span>
            </div>
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-none border-b bg-transparent">
            <TabsTrigger value="orders">Lịch sử mua hàng ({orders.length})</TabsTrigger>
            <TabsTrigger value="points">Lịch sử cộng điểm ({txs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="m-0 p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[44px] text-center text-xs">STT</TableHead>
                  <TableHead className="w-[110px]">Mã đơn</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="w-[100px]">Trạng thái</TableHead>
                  <TableHead className="w-[110px] text-right">Tổng tiền</TableHead>
                  <TableHead className="w-[110px]">Thời gian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersQ.isLoading || itemsQ.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Chưa có đơn hàng
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedOrders.map((o, i) => {
                    const items = itemsByOrderId.get(o.id) ?? [];
                    const { lines, extra } = summarizeItems(items, 2);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="text-center text-xs text-muted-foreground align-top tabular-nums">
                          {orderRowStart + i + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs align-top">
                          {o.order_number ?? o.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="align-top">
                          {items.length === 0 ? (
                            <span className="text-xs italic text-muted-foreground">
                              (Đang tải chi tiết...)
                            </span>
                          ) : (
                            <div className="space-y-0.5 max-w-[260px]">
                              {lines.map((line, li) => (
                                <div key={li} className="flex items-start gap-1.5 text-xs">
                                  <Package className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                                  <span className="line-clamp-2 break-words">{line}</span>
                                </div>
                              ))}
                              {extra > 0 && (
                                <div className="text-[10px] text-muted-foreground pl-4.5">
                                  + {extra} sản phẩm khác
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs align-top">{o.status ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums align-top">
                          {formatCurrency(Number(o.total_amount ?? 0))}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground align-top">
                          {thoiGianTuongDoi(o.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            {/* Phân trang lịch sử mua hàng */}
            {orders.length > ORDERS_PAGE_SIZE && (
              <PaginationBar
                page={orderPage}
                totalPages={orderPageCount}
                onChange={setOrderPage}
              />
            )}
          </TabsContent>

          <TabsContent value="points" className="m-0 p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[44px] text-center text-xs">STT</TableHead>
                  <TableHead className="w-[100px] text-center">Loại</TableHead>
                  <TableHead className="w-[100px] text-right">Điểm</TableHead>
                  <TableHead>Đơn liên quan</TableHead>
                  <TableHead className="w-[110px]">Thời gian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txQ.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : txs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      Chưa có giao dịch điểm
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedTxs.map((tx, i) => {
                    const t = TX_TYPE_MAP[tx.type ?? ""] ?? { label: tx.type ?? "-", cls: "bg-muted" };
                    const isPositive = tx.type === "earn" || tx.type === "adjust";
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-center text-xs text-muted-foreground align-top tabular-nums">
                          {txRowStart + i + 1}
                        </TableCell>
                        <TableCell className="text-center align-top">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.cls}`}>
                            {t.label}
                          </span>
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold align-top ${
                            isPositive ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {tx.points ?? 0}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground align-top">
                          {tx.order_id ? tx.order_id.slice(0, 8) + "..." : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground align-top">
                          {thoiGianTuongDoi(tx.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            {/* Phân trang lịch sử điểm */}
            {txs.length > TX_PAGE_SIZE && (
              <PaginationBar
                page={txPage}
                totalPages={txPageCount}
                onChange={setTxPage}
              />
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Thanh phân trang gọn cho sheet drawer — Prev / số trang / Next.
 * Không dùng component PaginationBar ngoài (file đó phụ thuộc table admin),
 * tự render cho gọn.
 */
function PaginationBar({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2 text-xs">
      <span className="text-muted-foreground">
        Trang <b className="text-foreground">{page}</b> / {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

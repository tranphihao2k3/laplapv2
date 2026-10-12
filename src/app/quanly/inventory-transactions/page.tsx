"use client";

import { useMemo, useState } from "react";
import { useCrudList } from "@/lib/api/admin-crud";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Search, Eye, Package, ClipboardList, Hash } from "lucide-react";
import { NameCell } from "@/components/admin/name-cell";

type Transaction = {
  id: string;
  warehouse_id: string;
  product_variant_id: string;
  type: string;
  quantity: number;
  unit_cost: number;
  note: string | null;
  reference_type: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  purchase: "Nhập kho",
  sale: "Bán hàng",
  return: "Trả hàng",
  transfer_in: "Chuyển đến",
  transfer_out: "Chuyển đi",
  adjustment: "Điều chỉnh",
  damage: "Hàng hỏng",
};

const TYPE_COLORS: Record<string, string> = {
  purchase: "bg-blue-100 text-blue-800 border-blue-200",
  sale: "bg-emerald-100 text-emerald-800 border-emerald-200",
  return: "bg-amber-100 text-amber-800 border-amber-200",
  transfer_in: "bg-purple-100 text-purple-800 border-purple-200",
  transfer_out: "bg-orange-100 text-orange-800 border-orange-200",
  adjustment: "bg-slate-100 text-slate-800 border-slate-200",
  damage: "bg-red-100 text-red-800 border-red-200",
};

export default function InventoryTransactionsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data, isLoading, isError, error } = useCrudList<Transaction>(
    "inventory-transactions",
    { search, page, pageSize: 20 },
  );

  // Tải thêm warehouses + product-variants để hiển thị tên thay vì UUID
  const warehousesQ = useCrudList<{ id: string; name: string }>("warehouses", { page: 1, pageSize: 500 });
  const variantsQ = useCrudList<{ id: string; sku: string | null; name: string | null }>(
    "product-variants",
    { page: 1, pageSize: 500 },
  );
  const warehouseNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (warehousesQ.data?.items ?? []).forEach((w) => m.set(w.id, w.name));
    return m;
  }, [warehousesQ.data]);
  const variantLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    (variantsQ.data?.items ?? []).forEach((v) => {
      const label = v.name || v.sku || v.id.slice(0, 8);
      m.set(v.id, label);
    });
    return m;
  }, [variantsQ.data]);

  const transactions = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalItems = data?.total ?? 0;

  const filtered = typeFilter === "all"
    ? transactions
    : transactions.filter((tx) => tx.type === typeFilter);

  const handleView = (tx: Transaction) => {
    setSelectedTx(tx);
    setDetailOpen(true);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("vi-VN");

  if (isError) {
    toast.error(error instanceof Error ? error.message : "Không thể tải dữ liệu");
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Giao dịch kho
        </h1>
        <p className="text-muted-foreground">
          Theo dõi nhật ký giao dịch tồn kho của cửa hàng
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                Lịch sử giao dịch
              </CardTitle>
              <CardDescription className="mt-1">
                {isLoading ? (
                  "Đang tải..."
                ) : (
                  <>Hiển thị {filtered.length} giao dịch{totalItems > 0 && ` trong tổng số ${totalItems}`}</>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm ghi chú, loại tham chiếu..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả loại" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  {Object.entries(TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12 text-center font-semibold">STT</TableHead>
                  <TableHead className="font-semibold">Kho</TableHead>
                  <TableHead className="font-semibold">Sản phẩm</TableHead>
                  <TableHead className="font-semibold">Loại giao dịch</TableHead>
                  <TableHead className="text-right font-semibold">Số lượng</TableHead>
                  <TableHead className="text-right font-semibold">Đơn giá</TableHead>
                  <TableHead className="font-semibold">Ghi chú</TableHead>
                  <TableHead className="font-semibold">Tham chiếu</TableHead>
                  <TableHead className="font-semibold">Ngày tạo</TableHead>
                  <TableHead className="w-12 text-center font-semibold">Chi tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-muted-foreground">Đang tải dữ liệu...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="h-12 w-12 text-muted-foreground/50" />
                        <div>
                          <p className="font-medium text-muted-foreground">
                            {search || typeFilter !== "all"
                              ? "Không tìm thấy giao dịch nào"
                              : "Chưa có giao dịch nào"}
                          </p>
                          <p className="text-sm text-muted-foreground/70 mt-1">
                            {search || typeFilter !== "all"
                              ? "Thử thay đổi điều kiện tìm kiếm"
                              : "Các giao dịch tồn kho sẽ xuất hiện tại đây khi có thay đổi"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((tx, index) => (
                    <TableRow key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-semibold text-xs text-muted-foreground mx-auto">
                          {(page - 1) * 20 + index + 1}
                        </div>
                      </TableCell>
                      <TableCell>
                        <NameCell
                          id={tx.warehouse_id}
                          kind="warehouses"
                          name={warehouseNameMap.get(tx.warehouse_id) ?? null}
                          href={tx.warehouse_id ? `/quanly/inventory/transfer?warehouse_id=${tx.warehouse_id}` : undefined}
                          fallback={<span className="text-xs text-muted-foreground">—</span>}
                        />
                      </TableCell>
                      <TableCell>
                        <NameCell
                          id={tx.product_variant_id}
                          kind="products"
                          name={variantLabelMap.get(tx.product_variant_id) ?? null}
                          fallback={<span className="text-xs text-muted-foreground font-mono">{tx.product_variant_id.slice(0, 8)}…</span>}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={TYPE_COLORS[tx.type] ?? "bg-gray-100 text-gray-800 border-gray-200"}
                          variant="outline"
                        >
                          {TYPE_LABELS[tx.type] ?? tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono font-medium">
                          {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-sm">
                          {formatCurrency(tx.unit_cost)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <span className="truncate block" title={tx.note ?? undefined}>
                          {tx.note ?? <span className="text-muted-foreground">—</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {tx.reference_type ?? <span className="text-muted-foreground">—</span>}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(tx.created_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(tx)}
                          title="Xem chi tiết"
                          className="hover:bg-primary/10"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Trang <span className="font-medium">{page}</span> / <span className="font-medium">{totalPages}</span>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Chi tiết giao dịch
            </DialogTitle>
            <DialogDescription>
              Thông tin chi tiết giao dịch tồn kho
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">ID Giao dịch</Label>
                <p className="font-mono text-xs mt-1 break-all bg-muted p-2 rounded">
                  {selectedTx.id}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Loại giao dịch</Label>
                <div className="mt-2">
                  <Badge
                    className={TYPE_COLORS[selectedTx.type] ?? "bg-gray-100 text-gray-800 border-gray-200"}
                    variant="outline"
                  >
                    {TYPE_LABELS[selectedTx.type] ?? selectedTx.type}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Ngày tạo</Label>
                <p className="mt-2 font-medium">{formatDate(selectedTx.created_at)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Kho</Label>
                <div className="mt-1">
                  <NameCell
                    id={selectedTx.warehouse_id}
                    kind="warehouses"
                    name={warehouseNameMap.get(selectedTx.warehouse_id) ?? null}
                    href={selectedTx.warehouse_id ? `/quanly/inventory/transfer?warehouse_id=${selectedTx.warehouse_id}` : undefined}
                  />
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Biến thể sản phẩm</Label>
                <div className="mt-1">
                  <NameCell
                    id={selectedTx.product_variant_id}
                    kind="products"
                    name={variantLabelMap.get(selectedTx.product_variant_id) ?? null}
                  />
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Số lượng</Label>
                <p className="mt-1 font-mono font-semibold text-lg">
                  {selectedTx.quantity > 0 ? `+${selectedTx.quantity}` : selectedTx.quantity}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Đơn giá</Label>
                <p className="mt-1 font-mono font-semibold text-lg">
                  {formatCurrency(selectedTx.unit_cost)}
                </p>
              </div>
              <div className="col-span-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Loại tham chiếu</Label>
                <p className="mt-1">
                  {selectedTx.reference_type ?? <span className="text-muted-foreground">Không có</span>}
                </p>
              </div>
              <div className="col-span-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Ghi chú</Label>
                <p className="mt-1 whitespace-pre-wrap bg-muted/50 p-3 rounded">
                  {selectedTx.note ?? "Không có ghi chú"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

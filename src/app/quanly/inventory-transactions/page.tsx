"use client";

import { useState } from "react";
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
import { Search, Eye } from "lucide-react";

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
  purchase: "Nhập",
  sale: "Bán",
  return: "Trả",
  transfer_in: "Chuyển đến",
  transfer_out: "Chuyển đi",
  adjustment: "Điều chỉnh",
  damage: "Hỏng",
};

const TYPE_COLORS: Record<string, string> = {
  purchase: "bg-blue-100 text-blue-800",
  sale: "bg-green-100 text-green-800",
  return: "bg-yellow-100 text-yellow-800",
  transfer_in: "bg-purple-100 text-purple-800",
  transfer_out: "bg-orange-100 text-orange-800",
  adjustment: "bg-gray-100 text-gray-800",
  damage: "bg-red-100 text-red-800",
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

  const transactions = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

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
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Giao dịch kho</CardTitle>
          <CardDescription>
            Nhật ký giao dịch tồn kho (chỉ xem, chỉnh sửa tại trang tồn kho)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm ghi chú hoặc loại tham chiếu..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-[200px]">
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kho</TableHead>
                  <TableHead>Phiên bản SP</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead>Tham chiếu</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Không có giao dịch nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs">
                        {tx.warehouse_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {tx.product_variant_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={TYPE_COLORS[tx.type] ?? "bg-gray-100 text-gray-800"}
                          variant="outline"
                        >
                          {TYPE_LABELS[tx.type] ?? tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{tx.quantity}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(tx.unit_cost)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {tx.note ?? "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{tx.reference_type ?? "-"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(tx)}
                          title="Xem chi tiết"
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Trang {page} / {totalPages}
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết giao dịch</DialogTitle>
            <DialogDescription>
              Thông tin giao dịch tồn kho (chỉ xem)
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">ID</Label>
                <p className="font-mono text-xs mt-1">{selectedTx.id}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Loại</Label>
                <div className="mt-1">
                  <Badge
                    className={TYPE_COLORS[selectedTx.type] ?? "bg-gray-100 text-gray-800"}
                    variant="outline"
                  >
                    {TYPE_LABELS[selectedTx.type] ?? selectedTx.type}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Kho</Label>
                <p className="font-mono text-xs mt-1">{selectedTx.warehouse_id}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Phiên bản sản phẩm</Label>
                <p className="font-mono text-xs mt-1">{selectedTx.product_variant_id}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Số lượng</Label>
                <p className="font-mono mt-1">{selectedTx.quantity}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Đơn giá</Label>
                <p className="font-mono mt-1">{formatCurrency(selectedTx.unit_cost)}</p>
              </div>
              <div className="col-span-2">
                <Label className="text-muted-foreground">Ghi chú</Label>
                <p className="mt-1 whitespace-pre-wrap">{selectedTx.note ?? "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Loại tham chiếu</Label>
                <p className="font-mono text-xs mt-1">{selectedTx.reference_type ?? "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Ngày tạo</Label>
                <p className="text-xs mt-1">{formatDate(selectedTx.created_at)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

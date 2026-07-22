"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { useCrudList } from "@/lib/api/admin-crud";
import { httpDelete, httpGet, httpPost } from "@/lib/api/http";

type Product = { id: string; name: string };
type Gift = {
  product_id: string;
  gift_product_id: string;
  created_at: string | null;
  product: Product | null;
  gift: Product | null;
};

function getApiMsg(e: unknown) {
  return (e as { error?: { message?: string } })?.error?.message ?? "Có lỗi xảy ra";
}

export default function ProductGiftsPage() {
  const qc = useQueryClient();
  const productQ = useCrudList<Product>("products", { page: 1, pageSize: 500 });
  const products = productQ.data?.items ?? [];
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [productId, setProductId] = useState<string>("");
  const [giftId, setGiftId] = useState<string>("");

  const listQ = useQuery({
    queryKey: ["product-gifts", productId],
    enabled: !!productId,
    queryFn: () => httpGet<{ items: Gift[] }>("/v1/product-gifts", { product_id: productId }),
  });

  const addMut = useMutation({
    mutationFn: (body: { product_id: string; gift_product_id: string }) => httpPost("/v1/product-gifts", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-gifts", productId] });
      toast.success("Đã thêm quà tặng");
      setGiftId("");
    },
    onError: (e) => toast.error(getApiMsg(e)),
  });

  const delMut = useMutation({
    mutationFn: (g: { product_id: string; gift_product_id: string }) =>
      httpDelete(`/v1/product-gifts?product_id=${g.product_id}&gift_product_id=${g.gift_product_id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-gifts", productId] });
      toast.success("Đã xoá");
    },
    onError: (e) => toast.error(getApiMsg(e)),
  });

  const gifts = listQ.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quà tặng kèm sản phẩm</CardTitle>
        <CardDescription>
          Chọn sản phẩm chính, sau đó gán các sản phẩm tặng kèm (ví dụ: laptop tặng balo, chuột).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[2fr_2fr_auto]">
          <div className="space-y-2">
            <Label>Sản phẩm chính *</Label>
            <Select value={productId} onValueChange={(v) => { setProductId(v); setGiftId(""); }}>
              <SelectTrigger><SelectValue placeholder="Chọn sản phẩm" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quà tặng kèm</Label>
            <Select value={giftId} onValueChange={setGiftId} disabled={!productId}>
              <SelectTrigger><SelectValue placeholder="Chọn quà" /></SelectTrigger>
              <SelectContent>
                {products
                  .filter((p) => p.id !== productId && !gifts.some((g) => g.gift_product_id === p.id))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              disabled={!productId || !giftId || addMut.isPending}
              onClick={() => addMut.mutate({ product_id: productId, gift_product_id: giftId })}
            >Thêm</Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sản phẩm chính</TableHead>
              <TableHead>Quà tặng kèm</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!productId ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Chọn sản phẩm để xem danh sách quà tặng</TableCell></TableRow>
            ) : listQ.isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
            ) : gifts.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Chưa có quà nào</TableCell></TableRow>
            ) : (
              gifts.map((g) => (
                <TableRow key={`${g.product_id}-${g.gift_product_id}`}>
                  <TableCell>{g.product?.name ?? productMap.get(g.product_id)?.name ?? g.product_id}</TableCell>
                  <TableCell>{g.gift?.name ?? productMap.get(g.gift_product_id)?.name ?? g.gift_product_id}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="destructive" onClick={() => delMut.mutate({ product_id: g.product_id, gift_product_id: g.gift_product_id })}>Xoá</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

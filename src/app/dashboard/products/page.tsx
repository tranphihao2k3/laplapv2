"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProductRow = {
  name: string;
  sku: string;
  stock: number;
  price: string;
  status: string;
};

const sampleRows: ProductRow[] = [
  { name: "Dell XPS 13", sku: "DX13-I7", stock: 12, price: "30.000.000đ", status: "active" },
  { name: "HP Pavilion 15", sku: "HP15-I5", stock: 8, price: "18.000.000đ", status: "active" },
  { name: "Lenovo ThinkPad E14", sku: "TP-E14", stock: 3, price: "22.500.000đ", status: "low" },
];

export default function ProductsPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle>Quản lý sản phẩm</CardTitle>
            <CardDescription>Catalog brands, categories, products, variants, serial numbers.</CardDescription>
          </div>
          <Button onClick={() => setOpen(true)}>Thêm sản phẩm</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên sản phẩm</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Tồn kho</TableHead>
                <TableHead>Giá bán</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleRows.map((row) => (
                <TableRow key={row.sku}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.sku}</TableCell>
                  <TableCell>{row.stock}</TableCell>
                  <TableCell>{row.price}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "low" ? "destructive" : "secondary"}>
                      {row.status === "low" ? "Low stock" : "Active"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm sản phẩm</DialogTitle>
            <DialogDescription>Tạo nhanh sản phẩm mẫu</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Tên sản phẩm</Label>
              <Input id="product-name" placeholder="VD: MacBook Pro 14" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-sku">SKU</Label>
              <Input id="product-sku" placeholder="VD: MBP14-M3" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Giá bán</Label>
              <Input id="product-price" placeholder="VD: 35000000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                toast.success("Đã tạo sản phẩm mẫu");
              }}
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

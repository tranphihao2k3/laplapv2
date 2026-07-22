"use client";

import Link from "next/link";
import {
  Package,
  ShoppingCart,
  UserPlus,
  Truck,
  Calculator,
  Warehouse,
  FileJson,
  Wrench,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const quickItems = [
  { label: "Phiếu sửa chữa", url: "/quanly/repair-tickets", icon: Wrench },
  { label: "Sản phẩm mới", url: "/quanly/products", icon: Package },
  { label: "Đơn hàng mới", url: "/quanly/pos", icon: ShoppingCart },
  { label: "Khách hàng mới", url: "/quanly/customers", icon: UserPlus },
  { label: "Phiếu nhập mới", url: "/quanly/purchase-orders", icon: Truck },
  { label: "Ca POS mới", url: "/quanly/pos-sessions", icon: Calculator },
];

export function QuickCreateDropdown({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Tạo nhanh</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {quickItems.map((item) => (
            <DropdownMenuItem key={item.url} asChild>
              <Link href={item.url} className="flex items-center gap-2">
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

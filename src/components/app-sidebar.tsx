"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  Package,
  PackageSearch,
  ShoppingCart,
  Store,
  Users,
  Truck,
  Warehouse,
  ShieldCheck,
  Shield,
  FileJson,
  Receipt,
  ArrowRightLeft,
  ClipboardList,
  FileClock,
  Calculator,
  Tag,
  Sparkles,
  Settings,
  UserCog,
  UserPlus,
  Wrench,
} from "lucide-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navMain = [
  { title: "Tổng quan", url: "/quanly", icon: BarChart3 },
  { title: "Sản phẩm", url: "/quanly/products", icon: Package },
  { title: "Đơn hàng", url: "/quanly/orders", icon: ShoppingCart },
  { title: "POS", url: "/quanly/pos", icon: Calculator },
  { title: "Khách hàng", url: "/quanly/customers", icon: Users },
  { title: "Kho hàng", url: "/quanly/warehouses", icon: Warehouse },
  { title: "Bảo hành", url: "/quanly/warranties", icon: ShieldCheck },
];

const documents = [
  { name: "Quản lý sản phẩm", url: "/quanly/products", icon: Package, group: "Sản phẩm" },
  { name: "Biến thể", url: "/quanly/product-variants", icon: PackageSearch, group: "Sản phẩm" },
  { name: "Danh mục", url: "/quanly/categories", icon: Package, group: "Sản phẩm" },
  { name: "Thương hiệu", url: "/quanly/brands", icon: Tag, group: "Sản phẩm" },
  { name: "Quà tặng kèm", url: "/quanly/product-gifts", icon: Sparkles, group: "Sản phẩm" },
  { name: "Mẫu thông số", url: "/quanly/spec-templates", icon: FileJson, group: "Sản phẩm" },
  
  { name: "Quản lý đơn hàng", url: "/quanly/orders", icon: ShoppingCart, group: "Bán hàng" },
  { name: "POS hôm nay", url: "/quanly/pos-sessions", icon: Calculator, group: "Bán hàng" },
  { name: "Thanh toán", url: "/quanly/payments", icon: Receipt, group: "Bán hàng" },
  { name: "Đơn trả hàng", url: "/quanly/return-orders", icon: ShoppingCart, group: "Bán hàng" },
  { name: "Báo cáo doanh thu", url: "/quanly/reports/revenue", icon: FileClock, group: "Bán hàng" },

  { name: "Quản lý kho", url: "/quanly/warehouses", icon: Warehouse, group: "Kho & Tồn" },
  { name: "Tồn kho", url: "/quanly/stock-levels", icon: ClipboardList, group: "Kho & Tồn" },
  { name: "Chuyển kho", url: "/quanly/inventory/transfer", icon: ArrowRightLeft, group: "Kho & Tồn" },
  { name: "Giao dịch kho", url: "/quanly/inventory-transactions", icon: FileClock, group: "Kho & Tồn" },
  { name: "Serial/IMEI", url: "/quanly/serial-numbers", icon: Receipt, group: "Kho & Tồn" },
  { name: "Phiếu nhập", url: "/quanly/purchase-orders", icon: Truck, group: "Kho & Tồn" },
  { name: "Nhà cung cấp", url: "/quanly/suppliers", icon: Truck, group: "Kho & Tồn" },

  { name: "Quản lý khách hàng", url: "/quanly/customers", icon: Users, group: "Khách hàng" },
  { name: "Loyalty điểm", url: "/quanly/loyalty-transactions", icon: Tag, group: "Khách hàng" },
  { name: "Yêu cầu thu cũ", url: "/quanly/trade-in-requests", icon: FileJson, group: "Khách hàng" },

  { name: "Bảo hành", url: "/quanly/warranties", icon: ShieldCheck, group: "Hậu mãi" },
  { name: "Phiếu sửa chữa", url: "/quanly/repair-tickets", icon: Shield, group: "Hậu mãi" },
  { name: "Bảng giá sửa chữa", url: "/quanly/repair-services", icon: Wrench, group: "Hậu mãi" },

  { name: "Tổ chức", url: "/quanly/organizations", icon: Building2, group: "Hệ thống" },
  { name: "Cửa hàng", url: "/quanly/shops", icon: Store, group: "Hệ thống" },
  { name: "Vai trò", url: "/quanly/roles", icon: UserCog, group: "Hệ thống" },
  // "Quyền hạn" (/quanly/permissions) đã ẩn: danh mục quyền khoá cứng trong code
  // (rbac-presets.ts + seed-rbac.mjs). Gán quyền cho vai trò làm ở "Vai trò" / "Phân quyền".
  { name: "Nhân sự shop", url: "/quanly/shop-staff", icon: Users, group: "Hệ thống" },
  { name: "Tạo tài khoản", url: "/quanly/admin/users", icon: UserPlus, group: "Hệ thống" },
  { name: "Cài đặt", url: "/quanly/settings", icon: Settings, group: "Hệ thống" },
  { name: "Audit logs", url: "/quanly/audit-logs", icon: FileClock, group: "Hệ thống" },
];

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar?: string };
};

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/quanly">
                <Sparkles className="h-5 w-5" />
                <span className="text-base font-semibold">LapLap Admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavDocuments items={documents} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
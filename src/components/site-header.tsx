"use client";

import { usePathname } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { QuickCreateDropdown } from "@/components/quick-create";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrgStore } from "@/stores/org-store";
import { httpGet } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/response";

const labelMap: Record<string, string> = {
  quanly: "Tổng quan",
  dashboard: "Tổng quan",
  products: "Sản phẩm",
  categories: "Danh mục",
  "spec-templates": "Spec templates",
  brands: "Thương hiệu",
  organizations: "Tổ chức",
  shops: "Cửa hàng",
  warehouses: "Kho hàng",
  orders: "Đơn hàng",
  inventory: "Kho hàng",
  customers: "Khách hàng",
  suppliers: "Nhà cung cấp",
  warranties: "Bảo hành",
  pos: "POS",
  settings: "Cài đặt",
  "product-variants": "Biến thể",
  "serial-numbers": "Serial / IMEI",
  "stock-levels": "Tồn kho",
  "inventory-transactions": "Giao dịch kho",
  "purchase-orders": "Phiếu nhập",
  returns: "Trả hàng",
  "return-orders": "Đơn trả hàng",
  payments: "Thanh toán",
  "pos-sessions": "Ca POS",
  reports: "Báo cáo",
  "audit-logs": "Nhật ký",
  "user-profiles": "Hồ sơ",
  roles: "Vai trò",
  permissions: "Quyền",
  "role-permissions": "Gán quyền",
  "shop-staff": "Nhân sự",
  "phan-quyen": "Phân quyền",
  "product-gifts": "Quà tặng",
  "loyalty-transactions": "Loyalty",
  "repair-tickets": "Sửa chữa",
  "trade-in-requests": "Thu cũ",
};

function getTitle(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Tổng quan";
  const last = segments[segments.length - 1];
  return labelMap[last] ?? last;
}

export function SiteHeader() {
  const pathname = usePathname();
  const title = getTitle(pathname ?? "/quanly");
  const { currentOrg, availableOrgs, setCurrentOrg, setAvailableOrgs } = useOrgStore();

  // Dùng React Query để cache kết quả — chỉ fetch 1 lần, sau đó dùng lại từ cache
  // khi navigate giữa các trang mà không cần gọi API lại.
  const { isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await httpGet<Paginated<{ id: string; name: string; code: string | null }>>(
        "/v1/organizations",
        { page: 1, pageSize: 50 },
      );
      const orgs = res.items ?? [];
      setAvailableOrgs(orgs);
      if (!currentOrg && orgs.length > 0) setCurrentOrg(orgs[0]);
      return orgs;
    },
    // Đã có data trong store → không fetch lại
    enabled: availableOrgs.length === 0,
    // Cache 10 phút, không tự refetch khi focus lại tab
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-sm sm:text-base font-medium truncate">{title}</h1>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {availableOrgs.length > 1 && (
            <Select
              value={currentOrg?.id ?? ""}
              onValueChange={(id) => {
                const org = availableOrgs.find((o) => o.id === id);
                if (org) setCurrentOrg(org);
              }}
            >
              <SelectTrigger className="h-8 w-32 sm:w-48 text-xs">
                <Building2 className="mr-1 h-3.5 w-3.5 shrink-0 hidden sm:inline" />
                <SelectValue placeholder="Chọn tổ chức" />
              </SelectTrigger>
              <SelectContent>
                {availableOrgs.map((org) => (
                  <SelectItem key={org.id} value={org.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      {org.name}
                      <span className="text-muted-foreground">({org.code ?? "—"})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {availableOrgs.length === 1 && currentOrg && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>{currentOrg.name}</span>
            </div>
          )}
          <QuickCreateDropdown>
            <Button size="sm" className="h-8 w-8 sm:w-auto px-0 sm:px-3">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Create</span>
            </Button>
          </QuickCreateDropdown>
        </div>
      </div>
    </header>
  );
}

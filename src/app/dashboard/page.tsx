import { DashboardContent } from "@/components/dashboard-content";

export default function Page() {
  return (
    <div className="space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6 lg:px-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Tổng quan</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">8 nhóm thống kê chính — doanh thu, sản phẩm, kho, khách hàng, hậu mãi, ca bán</p>
      </div>
      <DashboardContent />
    </div>
  );
}

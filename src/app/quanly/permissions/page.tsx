import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Trang "Quyền hạn" đã bị khoá.
 *
 * Danh mục quyền (permissions) được ĐỊNH NGHĨA CỨNG TRONG CODE:
 *   - src/lib/rbac-presets.ts  (nguồn sự thật của toàn bộ mã quyền)
 *   - scripts/seed-rbac.mjs    (nạp vào DB)
 *
 * Không cho thêm/sửa/xoá quyền qua giao diện để tránh lệch với mã quyền mà server
 * thực sự kiểm tra (requirePermission). API POST/PATCH/DELETE /api/v1/permissions
 * cũng đã trả 403. Việc gán quyền cho từng vai trò làm ở trang "Vai trò".
 */
export default function PermissionsLockedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-lg">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle>Danh mục quyền được khoá</CardTitle>
          <CardDescription>
            Các mã quyền (permissions) được định nghĩa cứng trong mã nguồn để đảm bảo khớp với
            phần kiểm tra ở máy chủ. Vì vậy trang thêm/sửa quyền đã được gỡ bỏ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Muốn thêm / đổi mã quyền?</p>
            <p>
              Sửa trong <code className="text-xs">src/lib/rbac-presets.ts</code> rồi chạy{" "}
              <code className="text-xs">node scripts/seed-rbac.mjs</code>.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Muốn gán quyền cho nhân viên?</p>
            <p>Vào trang Vai trò để bật/tắt quyền cho từng vai trò, rồi gán vai trò cho nhân sự.</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button asChild>
              <Link href="/quanly/roles">Tới trang Vai trò</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/quanly">Về trang quản lý</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

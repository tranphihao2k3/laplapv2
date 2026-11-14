import { redirect } from "next/navigation";

/**
 * RBAC đã được rút gọn: chỉ còn admin (tài khoản thuộc tổ chức) và khách.
 * Không còn quản lý vai trò theo từng quyền → chuyển về trang tổng quan.
 */
export default function RolesPage() {
  redirect("/quanly");
}

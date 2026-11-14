import { redirect } from "next/navigation";

/**
 * RBAC đã được rút gọn: mọi tài khoản thuộc tổ chức đều có toàn quyền,
 * không còn gán từng mã quyền cho vai trò. Gán nhân sự vào shop ở "Nhân sự shop".
 */
export default function PermissionsAssignmentPage() {
  redirect("/quanly");
}

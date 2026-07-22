import { permissionsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { permissionCreateSchema } from "@/lib/validators/org";
import { fail } from "@/lib/api/response";

// Danh mục quyền (permissions) được ĐỊNH NGHĨA CỨNG TRONG CODE
// (src/lib/rbac-presets.ts + scripts/seed-rbac.mjs). KHÔNG cho tạo/sửa/xoá qua API để
// tránh lệch giữa mã quyền server thực sự kiểm tra và dữ liệu người dùng tự thêm.
// Chỉ giữ GET để trang gán quyền cho vai trò (/quanly/phan-quyen) đọc danh sách.
const handlers = makeCollectionHandlers({
  crud: permissionsService,
  createSchema: permissionCreateSchema,
  permissions: { read: "permissions.read" },
});

export const GET = handlers.GET;

export function POST() {
  return fail(
    "METHOD_LOCKED",
    "Danh mục quyền được khoá cứng trong code. Thêm quyền qua scripts/seed-rbac.mjs, không tạo qua giao diện.",
    403,
  );
}

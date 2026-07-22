import { permissionsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { permissionUpdateSchema } from "@/lib/validators/org";
import { fail } from "@/lib/api/response";

// Quyền khoá cứng trong code — xem ghi chú ở ../route.ts. Chỉ giữ GET.
const handlers = makeItemHandlers({
  crud: permissionsService,
  updateSchema: permissionUpdateSchema,
  permissions: { read: "permissions.read" },
});

export const GET = handlers.GET;

function locked() {
  return fail(
    "METHOD_LOCKED",
    "Danh mục quyền được khoá cứng trong code. Sửa/xoá quyền qua scripts/seed-rbac.mjs, không thao tác qua giao diện.",
    403,
  );
}

export const PATCH = locked;
export const DELETE = locked;

import type { CrudListParams } from "@/lib/api/admin-crud";

export type CrudModuleConfig = {
  entity: string;
  title: string;
  subtitle: string;
  fields: { key: string; label: string; placeholder?: string }[];
  params?: CrudListParams;
};

export const CRUD_MODULES: CrudModuleConfig[] = [
  { entity: "products", title: "Sản phẩm", subtitle: "CRUD products", fields: [{ key: "name", label: "Tên" }, { key: "slug", label: "Slug" }, { key: "status", label: "Trạng thái" }, { key: "short_description", label: "Mô tả" }] },
  { entity: "brands", title: "Thương hiệu", subtitle: "CRUD brands", fields: [{ key: "name", label: "Tên" }, { key: "slug", label: "Slug" }, { key: "description", label: "Mô tả" }] },
  { entity: "categories", title: "Danh mục", subtitle: "CRUD categories", fields: [{ key: "name", label: "Tên" }, { key: "slug", label: "Slug" }, { key: "description", label: "Mô tả" }] },
  { entity: "product-variants", title: "Biến thể", subtitle: "CRUD product-variants", fields: [{ key: "sku", label: "SKU" }, { key: "name", label: "Tên" }, { key: "selling_price", label: "Giá bán" }, { key: "cost_price", label: "Giá vốn" }] },
  { entity: "serial-numbers", title: "Serial numbers", subtitle: "CRUD serial-numbers", fields: [{ key: "serial", label: "Serial" }, { key: "imei", label: "IMEI" }, { key: "status", label: "Trạng thái" }] },
  { entity: "customers", title: "Khách hàng", subtitle: "CRUD customers", fields: [{ key: "full_name", label: "Họ tên" }, { key: "phone", label: "SĐT" }, { key: "email", label: "Email" }, { key: "address", label: "Địa chỉ" }] },
  { entity: "suppliers", title: "Nhà cung cấp", subtitle: "CRUD suppliers", fields: [{ key: "company_name", label: "Công ty" }, { key: "phone", label: "SĐT" }, { key: "email", label: "Email" }, { key: "address", label: "Địa chỉ" }] },
  { entity: "orders", title: "Đơn hàng", subtitle: "CRUD orders", fields: [{ key: "order_number", label: "Mã đơn" }, { key: "status", label: "Trạng thái" }, { key: "total_amount", label: "Tổng tiền" }, { key: "note", label: "Ghi chú" }] },
  { entity: "order-items", title: "Order items", subtitle: "CRUD order-items", fields: [{ key: "quantity", label: "SL" }, { key: "unit_price", label: "Đơn giá" }, { key: "total_price", label: "Thành tiền" }] },
  { entity: "payments", title: "Thanh toán", subtitle: "CRUD payments", fields: [{ key: "method", label: "Phương thức" }, { key: "amount", label: "Số tiền" }, { key: "status", label: "Trạng thái" }, { key: "transaction_code", label: "Mã GD" }] },
  { entity: "purchase-orders", title: "Phiếu nhập", subtitle: "CRUD purchase-orders", fields: [{ key: "po_number", label: "Mã PO" }, { key: "status", label: "Trạng thái" }, { key: "total_amount", label: "Tổng tiền" }, { key: "notes", label: "Ghi chú" }] },
  { entity: "purchase-order-items", title: "PO items", subtitle: "CRUD purchase-order-items", fields: [{ key: "quantity", label: "SL" }, { key: "unit_cost", label: "Giá nhập" }, { key: "line_total", label: "Thành tiền" }] },
  { entity: "warehouses", title: "Kho hàng", subtitle: "CRUD warehouses", fields: [{ key: "name", label: "Tên kho" }, { key: "code", label: "Mã" }, { key: "type", label: "Loại" }, { key: "address", label: "Địa chỉ" }] },
  { entity: "shops", title: "Cửa hàng", subtitle: "CRUD shops", fields: [{ key: "name", label: "Tên" }, { key: "code", label: "Mã" }, { key: "phone", label: "SĐT" }, { key: "address", label: "Địa chỉ" }] },
  { entity: "roles", title: "Vai trò", subtitle: "CRUD roles", fields: [{ key: "name", label: "Tên role" }, { key: "code", label: "Code" }, { key: "description", label: "Mô tả" }] },
  { entity: "permissions", title: "Permissions", subtitle: "CRUD permissions", fields: [{ key: "code", label: "Code" }, { key: "name", label: "Tên" }, { key: "description", label: "Mô tả" }] },
  { entity: "shop-staff", title: "Nhân sự cửa hàng", subtitle: "CRUD shop-staff", fields: [{ key: "user_id", label: "User ID" }, { key: "shop_id", label: "Shop ID" }, { key: "role_id", label: "Role ID" }] },
  { entity: "warranties", title: "Bảo hành", subtitle: "CRUD warranties", fields: [{ key: "status", label: "Trạng thái" }, { key: "note", label: "Ghi chú" }, { key: "warranty_months", label: "Tháng BH" }] },
  { entity: "spec-templates", title: "Spec templates", subtitle: "CRUD spec-templates", fields: [{ key: "name", label: "Tên template" }, { key: "category_id", label: "Danh mục" }, { key: "fields", label: "Fields" }] },
  { entity: "product-gifts", title: "Quà tặng kèm", subtitle: "CRUD product-gifts", fields: [{ key: "product_id", label: "Product ID" }, { key: "gift_product_id", label: "Gift ID" }] },
  { entity: "repair-tickets", title: "Phiếu sửa chữa", subtitle: "CRUD repair-tickets", fields: [{ key: "status", label: "Trạng thái" }, { key: "device_name", label: "Thiết bị" }, { key: "issue_description", label: "Lỗi" }] },
  { entity: "trade-in-requests", title: "Thu cũ đổi mới", subtitle: "CRUD trade-in-requests", fields: [{ key: "status", label: "Trạng thái" }, { key: "device_name", label: "Thiết bị" }, { key: "note", label: "Ghi chú" }] },
  { entity: "settings", title: "Cài đặt", subtitle: "CRUD settings", fields: [{ key: "key", label: "Key" }, { key: "value", label: "Value" }, { key: "group_name", label: "Nhóm" }, { key: "description", label: "Mô tả" }] },
  { entity: "pos-sessions", title: "POS sessions", subtitle: "CRUD pos-sessions", fields: [{ key: "opened_at", label: "Mở ca" }, { key: "closed_at", label: "Đóng ca" }, { key: "opening_cash", label: "Tiền đầu" }, { key: "closing_cash", label: "Tiền cuối" }] },
];

export function getCrudModule(entity: string) {
  return CRUD_MODULES.find((m) => m.entity === entity);
}

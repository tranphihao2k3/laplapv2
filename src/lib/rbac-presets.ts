export type RolePreset = { code: string; name: string };

export const ROLE_PRESETS: RolePreset[] = [
  { code: "admin", name: "Quản trị hệ thống" },
  { code: "manager", name: "Quản lý cửa hàng" },
  { code: "staff_sales", name: "Nhân viên bán hàng" },
  { code: "staff_warehouse", name: "Nhân viên kho" },
  { code: "staff_repair", name: "Nhân viên kỹ thuật/sửa chữa" },
  { code: "accountant", name: "Kế toán" },
  { code: "cashier", name: "Thu ngân" },
  { code: "marketing", name: "Marketing/CSKH" },
  { code: "viewer", name: "Chỉ xem (báo cáo)" },
];

export type PermissionPreset = {
  code: string;
  description: string;
  /**
   * true = API hiện tại thực sự kiểm tra mã quyền này (requirePermission).
   * Nguồn: grep `requirePermission(...)` toàn bộ src/app/api.
   * Khi sửa API mà thêm requirePermission mới, nhớ cập nhật danh sách này.
   */
  apiEnforced?: boolean;
  /** Nhóm hiển thị trong UI bulk-add. */
  group: string;
};

export const PERMISSION_PRESETS: PermissionPreset[] = [
  // ===== API hiện đang chặn (must-have) =====
  { code: "orders.create", description: "Tạo đơn hàng / checkout — /api/v1/checkout", group: "API yêu cầu", apiEnforced: true },
  { code: "orders.cancel", description: "Hủy đơn hàng — /api/v1/orders/{id}/cancel", group: "API yêu cầu", apiEnforced: true },
  { code: "inventory.transfer", description: "Chuyển kho nội bộ — /api/v1/inventory/transfer", group: "API yêu cầu", apiEnforced: true },
  { code: "pos.open_session", description: "Mở phiên POS — /api/v1/pos-sessions (POST)", group: "API yêu cầu", apiEnforced: true },
  { code: "pos.close_session", description: "Đóng phiên POS — /api/v1/pos-sessions/{id}/close", group: "API yêu cầu", apiEnforced: true },
  { code: "purchase_orders.receive", description: "Nhập hàng từ phiếu mua — /api/v1/purchase-orders/{id}/receive", group: "API yêu cầu", apiEnforced: true },
  { code: "serial_numbers.bulk_create", description: "Tạo serial hàng loạt — /api/v1/serial-numbers/bulk", group: "API yêu cầu", apiEnforced: true },
  { code: "rbac.assign_permissions", description: "Gán quyền cho role — /api/v1/role-permissions(/assign)", group: "API yêu cầu", apiEnforced: true },

  // ===== Catalog =====
  { code: "products.read", description: "Xem sản phẩm — /api/v1/products", group: "Sản phẩm", apiEnforced: true },
  { code: "products.create", description: "Tạo sản phẩm — /api/v1/products (POST)", group: "Sản phẩm", apiEnforced: true },
  { code: "products.update", description: "Cập nhật sản phẩm — /api/v1/products/{id}", group: "Sản phẩm", apiEnforced: true },
  { code: "products.delete", description: "Xóa sản phẩm — /api/v1/products/{id} (DELETE)", group: "Sản phẩm", apiEnforced: true },
  { code: "product_variants.read", description: "Xem biến thể — /api/v1/product-variants", group: "Sản phẩm", apiEnforced: true },
  { code: "product_variants.create", description: "Tạo biến thể — /api/v1/product-variants (POST)", group: "Sản phẩm", apiEnforced: true },
  { code: "product_variants.update", description: "Cập nhật biến thể — /api/v1/product-variants/{id}", group: "Sản phẩm", apiEnforced: true },
  { code: "product_variants.delete", description: "Xóa biến thể — /api/v1/product-variants/{id} (DELETE)", group: "Sản phẩm", apiEnforced: true },
  { code: "brands.read", description: "Xem thương hiệu — /api/v1/brands", group: "Sản phẩm", apiEnforced: true },
  { code: "brands.create", description: "Tạo thương hiệu — /api/v1/brands (POST)", group: "Sản phẩm", apiEnforced: true },
  { code: "brands.update", description: "Cập nhật thương hiệu — /api/v1/brands/{id}", group: "Sản phẩm", apiEnforced: true },
  { code: "brands.delete", description: "Xóa thương hiệu — /api/v1/brands/{id} (DELETE)", group: "Sản phẩm", apiEnforced: true },
  { code: "categories.read", description: "Xem danh mục — /api/v1/categories", group: "Sản phẩm", apiEnforced: true },
  { code: "categories.create", description: "Tạo danh mục — /api/v1/categories (POST)", group: "Sản phẩm", apiEnforced: true },
  { code: "categories.update", description: "Cập nhật danh mục — /api/v1/categories/{id}", group: "Sản phẩm", apiEnforced: true },
  { code: "categories.delete", description: "Xóa danh mục — /api/v1/categories/{id} (DELETE)", group: "Sản phẩm", apiEnforced: true },
  { code: "spec_templates.read", description: "Xem template thông số — /api/v1/spec-templates", group: "Sản phẩm", apiEnforced: true },
  { code: "spec_templates.create", description: "Tạo template thông số — /api/v1/spec-templates (POST)", group: "Sản phẩm", apiEnforced: true },
  { code: "spec_templates.update", description: "Cập nhật template thông số — /api/v1/spec-templates/{id}", group: "Sản phẩm", apiEnforced: true },
  { code: "spec_templates.delete", description: "Xóa template thông số — /api/v1/spec-templates/{id} (DELETE)", group: "Sản phẩm", apiEnforced: true },
  { code: "product_gifts.create", description: "Thêm quà tặng kèm SP — /api/v1/product-gifts (POST) [thực tế kiểm tra products.update]", group: "Sản phẩm", apiEnforced: false },
  { code: "product_gifts.delete", description: "Xóa quà tặng kèm SP — /api/v1/product-gifts (DELETE) [thực tế kiểm tra products.update]", group: "Sản phẩm", apiEnforced: false },

  // ===== Inventory =====
  { code: "inventory.read", description: "Xem tồn kho / inventory transactions", group: "Kho" },
  { code: "stock_levels.read", description: "Xem tồn kho — /api/v1/stock-levels", group: "Kho", apiEnforced: true },
  { code: "stock_levels.update", description: "Điều chỉnh tồn kho — /api/v1/stock-levels/adjust", group: "Kho", apiEnforced: true },
  { code: "inventory_transactions.read", description: "Xem giao dịch kho — /api/v1/inventory-transactions", group: "Kho", apiEnforced: true },
  { code: "inventory_transactions.create", description: "Tạo giao dịch kho — /api/v1/inventory-transactions (POST)", group: "Kho", apiEnforced: true },
  { code: "purchase_orders.read", description: "Xem phiếu nhập — /api/v1/purchase-orders", group: "Kho", apiEnforced: true },
  { code: "purchase_orders.create", description: "Tạo phiếu nhập — /api/v1/purchase-orders (POST)", group: "Kho", apiEnforced: true },
  { code: "purchase_orders.update", description: "Cập nhật phiếu nhập — /api/v1/purchase-orders/{id}", group: "Kho", apiEnforced: true },
  { code: "purchase_orders.delete", description: "Xóa phiếu nhập — /api/v1/purchase-orders/{id} (DELETE)", group: "Kho", apiEnforced: true },
  { code: "purchase_order_items.read", description: "Xem dòng phiếu nhập — /api/v1/purchase-order-items", group: "Kho", apiEnforced: true },
  { code: "purchase_order_items.create", description: "Thêm dòng phiếu nhập — /api/v1/purchase-order-items (POST)", group: "Kho", apiEnforced: true },
  { code: "purchase_order_items.update", description: "Cập nhật dòng phiếu nhập — /api/v1/purchase-order-items/{id}", group: "Kho", apiEnforced: true },
  { code: "purchase_order_items.delete", description: "Xóa dòng phiếu nhập — /api/v1/purchase-order-items/{id} (DELETE)", group: "Kho", apiEnforced: true },
  { code: "warehouses.read", description: "Xem kho hàng — /api/v1/warehouses", group: "Kho", apiEnforced: true },
  { code: "warehouses.create", description: "Tạo kho — /api/v1/warehouses (POST)", group: "Kho", apiEnforced: true },
  { code: "warehouses.update", description: "Cập nhật kho — /api/v1/warehouses/{id}", group: "Kho", apiEnforced: true },
  { code: "warehouses.delete", description: "Xóa kho — /api/v1/warehouses/{id} (DELETE)", group: "Kho", apiEnforced: true },
  { code: "serial_numbers.read", description: "Xem serial / IMEI — /api/v1/serial-numbers", group: "Kho", apiEnforced: true },
  { code: "serial_numbers.create", description: "Tạo serial — /api/v1/serial-numbers (POST)", group: "Kho", apiEnforced: true },
  { code: "serial_numbers.update", description: "Cập nhật serial — /api/v1/serial-numbers/{id}", group: "Kho", apiEnforced: true },
  { code: "serial_numbers.delete", description: "Xóa serial — /api/v1/serial-numbers/{id} (DELETE)", group: "Kho", apiEnforced: true },

  // ===== Sales =====
  { code: "orders.read", description: "Xem đơn hàng — /api/v1/orders", group: "Bán hàng", apiEnforced: true },
  { code: "orders.update", description: "Cập nhật đơn hàng — /api/v1/orders/{id}", group: "Bán hàng", apiEnforced: true },
  { code: "orders.delete", description: "Xóa đơn hàng — /api/v1/orders/{id} (DELETE)", group: "Bán hàng", apiEnforced: true },
  { code: "order_items.read", description: "Xem dòng đơn hàng — /api/v1/order-items", group: "Bán hàng", apiEnforced: true },
  { code: "order_items.create", description: "Thêm dòng đơn hàng — /api/v1/order-items (POST)", group: "Bán hàng", apiEnforced: true },
  { code: "order_items.update", description: "Cập nhật dòng đơn hàng — /api/v1/order-items/{id}", group: "Bán hàng", apiEnforced: true },
  { code: "order_items.delete", description: "Xóa dòng đơn hàng — /api/v1/order-items/{id} (DELETE)", group: "Bán hàng", apiEnforced: true },
  { code: "payments.read", description: "Xem thanh toán — /api/v1/payments", group: "Bán hàng", apiEnforced: true },
  { code: "payments.create", description: "Tạo thanh toán — /api/v1/payments (POST)", group: "Bán hàng", apiEnforced: true },
  { code: "payments.update", description: "Cập nhật thanh toán — /api/v1/payments/{id}", group: "Bán hàng", apiEnforced: true },
  { code: "payments.delete", description: "Xóa thanh toán — /api/v1/payments/{id} (DELETE)", group: "Bán hàng", apiEnforced: true },
  { code: "pos_sessions.read", description: "Xem phiên POS — /api/v1/pos-sessions", group: "Bán hàng", apiEnforced: true },
  { code: "pos_sessions.update", description: "Cập nhật phiên POS — /api/v1/pos-sessions/{id} [chưa có route PATCH]", group: "Bán hàng", apiEnforced: false },
  { code: "loyalty_transactions.read", description: "Xem giao dịch tích/đổi điểm — /api/v1/loyalty-transactions", group: "Bán hàng", apiEnforced: true },
  { code: "loyalty_transactions.create", description: "Tạo giao dịch điểm thưởng — /api/v1/loyalty-transactions (POST)", group: "Bán hàng", apiEnforced: true },

  // ===== Returns =====
  { code: "returns.read", description: "Xem đơn trả — /api/v1/return-orders", group: "Trả hàng", apiEnforced: true },
  { code: "returns.create", description: "Tạo đơn trả — /api/v1/return-orders (POST)", group: "Trả hàng", apiEnforced: true },
  { code: "returns.update", description: "Cập nhật đơn trả — /api/v1/return-orders/{id}", group: "Trả hàng", apiEnforced: true },
  { code: "returns.delete", description: "Xóa đơn trả — /api/v1/return-orders/{id} (DELETE)", group: "Trả hàng", apiEnforced: true },
  { code: "returns.approve", description: "Duyệt đơn trả + cộng tồn — /api/v1/return-orders/{id}/approve", group: "Trả hàng", apiEnforced: true },

  // ===== Customers & Suppliers =====
  { code: "customers.read", description: "Xem khách hàng — /api/v1/customers", group: "Đối tác", apiEnforced: true },
  { code: "customers.create", description: "Tạo khách hàng — /api/v1/customers (POST)", group: "Đối tác", apiEnforced: true },
  { code: "customers.update", description: "Cập nhật khách hàng — /api/v1/customers/{id}", group: "Đối tác", apiEnforced: true },
  { code: "customers.delete", description: "Xóa khách hàng — /api/v1/customers/{id} (DELETE)", group: "Đối tác", apiEnforced: true },
  { code: "suppliers.read", description: "Xem nhà cung cấp — /api/v1/suppliers", group: "Đối tác", apiEnforced: true },
  { code: "suppliers.create", description: "Tạo nhà cung cấp — /api/v1/suppliers (POST)", group: "Đối tác", apiEnforced: true },
  { code: "suppliers.update", description: "Cập nhật nhà cung cấp — /api/v1/suppliers/{id}", group: "Đối tác", apiEnforced: true },
  { code: "suppliers.delete", description: "Xóa nhà cung cấp — /api/v1/suppliers/{id} (DELETE)", group: "Đối tác", apiEnforced: true },

  // ===== After-sale =====
  { code: "warranties.read", description: "Xem bảo hành — /api/v1/warranties", group: "Sau bán hàng", apiEnforced: true },
  { code: "warranties.create", description: "Tạo bảo hành — /api/v1/warranties (POST)", group: "Sau bán hàng", apiEnforced: true },
  { code: "warranties.update", description: "Cập nhật bảo hành — /api/v1/warranties/{id}", group: "Sau bán hàng", apiEnforced: true },
  { code: "warranties.delete", description: "Xóa bảo hành — /api/v1/warranties/{id} (DELETE)", group: "Sau bán hàng", apiEnforced: true },
  { code: "repair_tickets.read", description: "Xem phiếu sửa chữa — /api/v1/repair-tickets", group: "Sau bán hàng", apiEnforced: true },
  { code: "repair_tickets.create", description: "Tạo phiếu sửa chữa — /api/v1/repair-tickets (POST)", group: "Sau bán hàng", apiEnforced: true },
  { code: "repair_tickets.update", description: "Cập nhật phiếu sửa chữa — /api/v1/repair-tickets/{id}", group: "Sau bán hàng", apiEnforced: true },
  { code: "repair_tickets.delete", description: "Xóa phiếu sửa chữa — /api/v1/repair-tickets/{id} (DELETE)", group: "Sau bán hàng", apiEnforced: true },
  { code: "trade_in_requests.read", description: "Xem yêu cầu thu cũ — /api/v1/trade-in-requests", group: "Sau bán hàng", apiEnforced: true },
  { code: "trade_in_requests.create", description: "Tạo yêu cầu thu cũ — /api/v1/trade-in-requests (POST)", group: "Sau bán hàng", apiEnforced: true },
  { code: "trade_in_requests.update", description: "Cập nhật thu cũ đổi mới — /api/v1/trade-in-requests/{id}", group: "Sau bán hàng", apiEnforced: true },
  { code: "trade_in_requests.delete", description: "Xóa thu cũ đổi mới — /api/v1/trade-in-requests/{id} (DELETE)", group: "Sau bán hàng", apiEnforced: true },
  { code: "repair_services.read", description: "Xem dịch vụ sửa chữa — /api/v1/repair-services", group: "Sau bán hàng", apiEnforced: true },
  { code: "repair_services.create", description: "Tạo dịch vụ sửa chữa — /api/v1/repair-services (POST)", group: "Sau bán hàng", apiEnforced: true },
  { code: "repair_services.update", description: "Cập nhật dịch vụ sửa chữa — /api/v1/repair-services/{id}", group: "Sau bán hàng", apiEnforced: true },
  { code: "repair_services.delete", description: "Xóa dịch vụ sửa chữa — /api/v1/repair-services/{id} (DELETE)", group: "Sau bán hàng", apiEnforced: true },

  // ===== Nhân sự & phân quyền =====
  { code: "roles.read", description: "Xem vai trò", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "roles.create", description: "Tạo vai trò", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "roles.update", description: "Cập nhật vai trò", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "roles.delete", description: "Xóa vai trò", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "permissions.read", description: "Xem danh mục quyền", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "permissions.create", description: "Tạo mã quyền mới", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "permissions.update", description: "Cập nhật mã quyền", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "permissions.delete", description: "Xóa mã quyền", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "shop_staff.read", description: "Xem phân công nhân sự", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "shop_staff.create", description: "Tạo phân công nhân sự", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "shop_staff.update", description: "Cập nhật phân công nhân sự", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "shop_staff.delete", description: "Xóa phân công nhân sự", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "user_profiles.read", description: "Xem hồ sơ người dùng", group: "Nhân sự & phân quyền", apiEnforced: true },
  { code: "user_profiles.update", description: "Cập nhật hồ sơ người dùng", group: "Nhân sự & phân quyền", apiEnforced: true },

  // ===== Tổ chức & cửa hàng =====
  { code: "organizations.read", description: "Xem tổ chức — /api/v1/organizations", group: "Tổ chức", apiEnforced: true },
  { code: "organizations.create", description: "Tạo tổ chức — /api/v1/organizations (POST)", group: "Tổ chức", apiEnforced: true },
  { code: "organizations.update", description: "Cập nhật tổ chức — /api/v1/organizations/{id}", group: "Tổ chức", apiEnforced: true },
  { code: "organizations.delete", description: "Xóa tổ chức — /api/v1/organizations/{id} (DELETE)", group: "Tổ chức", apiEnforced: true },
  { code: "shops.read", description: "Xem cửa hàng — /api/v1/shops", group: "Tổ chức", apiEnforced: true },
  { code: "shops.create", description: "Tạo cửa hàng — /api/v1/shops (POST)", group: "Tổ chức", apiEnforced: true },
  { code: "shops.update", description: "Cập nhật cửa hàng — /api/v1/shops/{id}", group: "Tổ chức", apiEnforced: true },
  { code: "shops.delete", description: "Xóa cửa hàng — /api/v1/shops/{id} (DELETE)", group: "Tổ chức", apiEnforced: true },

  // ===== Hệ thống =====
  { code: "audit_logs.read", description: "Xem nhật ký hệ thống — /api/v1/audit-logs", group: "Hệ thống", apiEnforced: true },
  { code: "reports.read", description: "Xem báo cáo — /api/v1/reports/revenue", group: "Hệ thống", apiEnforced: true },

  // ===== Quản trị (Admin) =====
  { code: "admin.manage_users", description: "Tạo / quản lý tài khoản người dùng — /api/v1/admin/users", group: "Quản trị", apiEnforced: true },
  { code: "settings.read", description: "Xem cài đặt hệ thống — /api/v1/settings", group: "Hệ thống", apiEnforced: true },
  { code: "settings.create", description: "Tạo cài đặt — /api/v1/settings (POST)", group: "Hệ thống", apiEnforced: true },
  { code: "settings.update", description: "Cập nhật cài đặt — /api/v1/settings/{id}", group: "Hệ thống", apiEnforced: true },
  { code: "settings.delete", description: "Xóa cài đặt — /api/v1/settings/{id} (DELETE)", group: "Hệ thống", apiEnforced: true },
];

/** Chỉ những mã quyền mà API đang thực sự gọi requirePermission. */
export const API_ENFORCED_PERMISSION_CODES: string[] = PERMISSION_PRESETS
  .filter((p) => p.apiEnforced)
  .map((p) => p.code);

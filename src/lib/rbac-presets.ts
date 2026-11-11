export type RolePreset = { code: string; name: string };

export const ROLE_PRESETS: RolePreset[] = [
  { code: "admin", name: "Quáº£n trá»‹ há»‡ thá»‘ng" },
  { code: "manager", name: "Quáº£n lÃ½ cá»­a hÃ ng" },
  { code: "staff_sales", name: "NhÃ¢n viÃªn bÃ¡n hÃ ng" },
  { code: "staff_warehouse", name: "NhÃ¢n viÃªn kho" },
  { code: "staff_repair", name: "NhÃ¢n viÃªn ká»¹ thuáº­t/sá»­a chá»¯a" },
  { code: "accountant", name: "Káº¿ toÃ¡n" },
  { code: "cashier", name: "Thu ngÃ¢n" },
  { code: "marketing", name: "Marketing/CSKH" },
  { code: "viewer", name: "Chá»‰ xem (bÃ¡o cÃ¡o)" },
];

export type PermissionPreset = {
  code: string;
  description: string;
  /**
   * true = API hiá»‡n táº¡i thá»±c sá»± kiá»ƒm tra mÃ£ quyá»n nÃ y (requirePermission).
   * Nguá»“n: grep `requirePermission(...)` toÃ n bá»™ src/app/api.
   * Khi sá»­a API mÃ  thÃªm requirePermission má»›i, nhá»› cáº­p nháº­t danh sÃ¡ch nÃ y.
   */
  apiEnforced?: boolean;
  /** NhÃ³m hiá»ƒn thá»‹ trong UI bulk-add. */
  group: string;
};

export const PERMISSION_PRESETS: PermissionPreset[] = [
  // ===== API hiá»‡n Ä‘ang cháº·n (must-have) =====
  { code: "orders.create", description: "Táº¡o Ä‘Æ¡n hÃ ng / checkout â€” /api/v1/checkout", group: "API yÃªu cáº§u", apiEnforced: true },
  { code: "orders.cancel", description: "Há»§y Ä‘Æ¡n hÃ ng â€” /api/v1/orders/{id}/cancel", group: "API yÃªu cáº§u", apiEnforced: true },
  { code: "inventory.transfer", description: "Chuyá»ƒn kho ná»™i bá»™ â€” /api/v1/inventory/transfer", group: "API yÃªu cáº§u", apiEnforced: true },
  { code: "pos.open_session", description: "Má»Ÿ phiÃªn POS â€” /api/v1/pos-sessions (POST)", group: "API yÃªu cáº§u", apiEnforced: true },
  { code: "pos.close_session", description: "ÄÃ³ng phiÃªn POS â€” /api/v1/pos-sessions/{id}/close", group: "API yÃªu cáº§u", apiEnforced: true },
  { code: "purchase_orders.receive", description: "Nháº­p hÃ ng tá»« phiáº¿u mua â€” /api/v1/purchase-orders/{id}/receive", group: "API yÃªu cáº§u", apiEnforced: true },
  { code: "serial_numbers.bulk_create", description: "Táº¡o serial hÃ ng loáº¡t â€” /api/v1/serial-numbers/bulk", group: "API yÃªu cáº§u", apiEnforced: true },
  { code: "rbac.assign_permissions", description: "GÃ¡n quyá»n cho role â€” /api/v1/role-permissions(/assign)", group: "API yÃªu cáº§u", apiEnforced: true },

  // ===== Catalog =====
  { code: "products.read", description: "Xem sáº£n pháº©m â€” /api/v1/products", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "products.create", description: "Táº¡o sáº£n pháº©m â€” /api/v1/products (POST)", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "products.update", description: "Cáº­p nháº­t sáº£n pháº©m â€” /api/v1/products/{id}", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "products.delete", description: "XÃ³a sáº£n pháº©m â€” /api/v1/products/{id} (DELETE)", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "product_variants.read", description: "Xem biáº¿n thá»ƒ â€” /api/v1/product-variants", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "product_variants.create", description: "Táº¡o biáº¿n thá»ƒ â€” /api/v1/product-variants (POST)", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "product_variants.update", description: "Cáº­p nháº­t biáº¿n thá»ƒ â€” /api/v1/product-variants/{id}", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "product_variants.delete", description: "XÃ³a biáº¿n thá»ƒ â€” /api/v1/product-variants/{id} (DELETE)", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "brands.read", description: "Xem thÆ°Æ¡ng hiá»‡u â€” /api/v1/brands", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "brands.create", description: "Táº¡o thÆ°Æ¡ng hiá»‡u â€” /api/v1/brands (POST)", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "brands.update", description: "Cáº­p nháº­t thÆ°Æ¡ng hiá»‡u â€” /api/v1/brands/{id}", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "brands.delete", description: "XÃ³a thÆ°Æ¡ng hiá»‡u â€” /api/v1/brands/{id} (DELETE)", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "categories.read", description: "Xem danh má»¥c â€” /api/v1/categories", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "categories.create", description: "Táº¡o danh má»¥c â€” /api/v1/categories (POST)", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "categories.update", description: "Cáº­p nháº­t danh má»¥c â€” /api/v1/categories/{id}", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "categories.delete", description: "XÃ³a danh má»¥c â€” /api/v1/categories/{id} (DELETE)", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "spec_templates.read", description: "Xem template thÃ´ng sá»‘ â€” /api/v1/spec-templates", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "spec_templates.create", description: "Táº¡o template thÃ´ng sá»‘ â€” /api/v1/spec-templates (POST)", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "spec_templates.update", description: "Cáº­p nháº­t template thÃ´ng sá»‘ â€” /api/v1/spec-templates/{id}", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "spec_templates.delete", description: "XÃ³a template thÃ´ng sá»‘ â€” /api/v1/spec-templates/{id} (DELETE)", group: "Sáº£n pháº©m", apiEnforced: true },
  { code: "product_gifts.create", description: "ThÃªm quÃ  táº·ng kÃ¨m SP â€” /api/v1/product-gifts (POST) [thá»±c táº¿ kiá»ƒm tra products.update]", group: "Sáº£n pháº©m", apiEnforced: false },
  { code: "product_gifts.delete", description: "XÃ³a quÃ  táº·ng kÃ¨m SP â€” /api/v1/product-gifts (DELETE) [thá»±c táº¿ kiá»ƒm tra products.update]", group: "Sáº£n pháº©m", apiEnforced: false },

  // ===== Inventory =====
  { code: "inventory.read", description: "Xem tá»“n kho / inventory transactions", group: "Kho" },
  { code: "stock_levels.read", description: "Xem tá»“n kho â€” /api/v1/stock-levels", group: "Kho", apiEnforced: true },
  { code: "stock_levels.update", description: "Äiá»u chá»‰nh tá»“n kho â€” /api/v1/stock-levels/adjust", group: "Kho", apiEnforced: true },
  { code: "inventory_transactions.read", description: "Xem giao dá»‹ch kho â€” /api/v1/inventory-transactions", group: "Kho", apiEnforced: true },
  { code: "inventory_transactions.create", description: "Táº¡o giao dá»‹ch kho â€” /api/v1/inventory-transactions (POST)", group: "Kho", apiEnforced: true },
  { code: "purchase_orders.read", description: "Xem phiáº¿u nháº­p â€” /api/v1/purchase-orders", group: "Kho", apiEnforced: true },
  { code: "purchase_orders.create", description: "Táº¡o phiáº¿u nháº­p â€” /api/v1/purchase-orders (POST)", group: "Kho", apiEnforced: true },
  { code: "purchase_orders.update", description: "Cáº­p nháº­t phiáº¿u nháº­p â€” /api/v1/purchase-orders/{id}", group: "Kho", apiEnforced: true },
  { code: "purchase_orders.delete", description: "XÃ³a phiáº¿u nháº­p â€” /api/v1/purchase-orders/{id} (DELETE)", group: "Kho", apiEnforced: true },
  { code: "purchase_order_items.read", description: "Xem dÃ²ng phiáº¿u nháº­p â€” /api/v1/purchase-order-items", group: "Kho", apiEnforced: true },
  { code: "purchase_order_items.create", description: "ThÃªm dÃ²ng phiáº¿u nháº­p â€” /api/v1/purchase-order-items (POST)", group: "Kho", apiEnforced: true },
  { code: "purchase_order_items.update", description: "Cáº­p nháº­t dÃ²ng phiáº¿u nháº­p â€” /api/v1/purchase-order-items/{id}", group: "Kho", apiEnforced: true },
  { code: "purchase_order_items.delete", description: "XÃ³a dÃ²ng phiáº¿u nháº­p â€” /api/v1/purchase-order-items/{id} (DELETE)", group: "Kho", apiEnforced: true },
  { code: "warehouses.read", description: "Xem kho hÃ ng â€” /api/v1/warehouses", group: "Kho", apiEnforced: true },
  { code: "warehouses.create", description: "Táº¡o kho â€” /api/v1/warehouses (POST)", group: "Kho", apiEnforced: true },
  { code: "warehouses.update", description: "Cáº­p nháº­t kho â€” /api/v1/warehouses/{id}", group: "Kho", apiEnforced: true },
  { code: "warehouses.delete", description: "XÃ³a kho â€” /api/v1/warehouses/{id} (DELETE)", group: "Kho", apiEnforced: true },
  { code: "serial_numbers.read", description: "Xem serial / IMEI â€” /api/v1/serial-numbers", group: "Kho", apiEnforced: true },
  { code: "serial_numbers.create", description: "Táº¡o serial â€” /api/v1/serial-numbers (POST)", group: "Kho", apiEnforced: true },
  { code: "serial_numbers.update", description: "Cáº­p nháº­t serial â€” /api/v1/serial-numbers/{id}", group: "Kho", apiEnforced: true },
  { code: "serial_numbers.delete", description: "XÃ³a serial â€” /api/v1/serial-numbers/{id} (DELETE)", group: "Kho", apiEnforced: true },

  // ===== Sales =====
  { code: "orders.read", description: "Xem Ä‘Æ¡n hÃ ng â€” /api/v1/orders", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "orders.update", description: "Cáº­p nháº­t Ä‘Æ¡n hÃ ng â€” /api/v1/orders/{id}", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "orders.delete", description: "XÃ³a Ä‘Æ¡n hÃ ng â€” /api/v1/orders/{id} (DELETE)", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "order_items.read", description: "Xem dÃ²ng Ä‘Æ¡n hÃ ng â€” /api/v1/order-items", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "order_items.create", description: "ThÃªm dÃ²ng Ä‘Æ¡n hÃ ng â€” /api/v1/order-items (POST)", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "order_items.update", description: "Cáº­p nháº­t dÃ²ng Ä‘Æ¡n hÃ ng â€” /api/v1/order-items/{id}", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "order_items.delete", description: "XÃ³a dÃ²ng Ä‘Æ¡n hÃ ng â€” /api/v1/order-items/{id} (DELETE)", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "payments.read", description: "Xem thanh toÃ¡n â€” /api/v1/payments", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "payments.create", description: "Táº¡o thanh toÃ¡n â€” /api/v1/payments (POST)", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "payments.update", description: "Cáº­p nháº­t thanh toÃ¡n â€” /api/v1/payments/{id}", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "payments.delete", description: "XÃ³a thanh toÃ¡n â€” /api/v1/payments/{id} (DELETE)", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "pos_sessions.read", description: "Xem phiÃªn POS â€” /api/v1/pos-sessions", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "pos_sessions.update", description: "Cáº­p nháº­t phiÃªn POS â€” /api/v1/pos-sessions/{id} [chÆ°a cÃ³ route PATCH]", group: "BÃ¡n hÃ ng", apiEnforced: false },
  { code: "loyalty_transactions.read", description: "Xem giao dá»‹ch tÃ­ch/Ä‘á»•i Ä‘iá»ƒm â€” /api/v1/loyalty-transactions", group: "BÃ¡n hÃ ng", apiEnforced: true },
  { code: "loyalty_transactions.create", description: "Táº¡o giao dá»‹ch Ä‘iá»ƒm thÆ°á»Ÿng â€” /api/v1/loyalty-transactions (POST)", group: "BÃ¡n hÃ ng", apiEnforced: true },

  // ===== Returns =====
  { code: "returns.read", description: "Xem Ä‘Æ¡n tráº£ â€” /api/v1/return-orders", group: "Tráº£ hÃ ng", apiEnforced: true },
  { code: "returns.create", description: "Táº¡o Ä‘Æ¡n tráº£ â€” /api/v1/return-orders (POST)", group: "Tráº£ hÃ ng", apiEnforced: true },
  { code: "returns.update", description: "Cáº­p nháº­t Ä‘Æ¡n tráº£ â€” /api/v1/return-orders/{id}", group: "Tráº£ hÃ ng", apiEnforced: true },
  { code: "returns.delete", description: "XÃ³a Ä‘Æ¡n tráº£ â€” /api/v1/return-orders/{id} (DELETE)", group: "Tráº£ hÃ ng", apiEnforced: true },
  { code: "returns.approve", description: "Duyá»‡t Ä‘Æ¡n tráº£ + cá»™ng tá»“n â€” /api/v1/return-orders/{id}/approve", group: "Tráº£ hÃ ng", apiEnforced: true },

  // ===== Customers & Suppliers =====
  { code: "customers.read", description: "Xem khÃ¡ch hÃ ng â€” /api/v1/customers", group: "Äá»‘i tÃ¡c", apiEnforced: true },
  { code: "customers.create", description: "Táº¡o khÃ¡ch hÃ ng â€” /api/v1/customers (POST)", group: "Äá»‘i tÃ¡c", apiEnforced: true },
  { code: "customers.update", description: "Cáº­p nháº­t khÃ¡ch hÃ ng â€” /api/v1/customers/{id}", group: "Äá»‘i tÃ¡c", apiEnforced: true },
  { code: "customers.delete", description: "XÃ³a khÃ¡ch hÃ ng â€” /api/v1/customers/{id} (DELETE)", group: "Äá»‘i tÃ¡c", apiEnforced: true },
  { code: "suppliers.read", description: "Xem nhÃ  cung cáº¥p â€” /api/v1/suppliers", group: "Äá»‘i tÃ¡c", apiEnforced: true },
  { code: "suppliers.create", description: "Táº¡o nhÃ  cung cáº¥p â€” /api/v1/suppliers (POST)", group: "Äá»‘i tÃ¡c", apiEnforced: true },
  { code: "suppliers.update", description: "Cáº­p nháº­t nhÃ  cung cáº¥p â€” /api/v1/suppliers/{id}", group: "Äá»‘i tÃ¡c", apiEnforced: true },
  { code: "suppliers.delete", description: "XÃ³a nhÃ  cung cáº¥p â€” /api/v1/suppliers/{id} (DELETE)", group: "Äá»‘i tÃ¡c", apiEnforced: true },

  // ===== After-sale =====
  { code: "warranties.read", description: "Xem báº£o hÃ nh â€” /api/v1/warranties", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "warranties.create", description: "Táº¡o báº£o hÃ nh â€” /api/v1/warranties (POST)", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "warranties.update", description: "Cáº­p nháº­t báº£o hÃ nh â€” /api/v1/warranties/{id}", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "warranties.delete", description: "XÃ³a báº£o hÃ nh â€” /api/v1/warranties/{id} (DELETE)", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "repair_tickets.read", description: "Xem phiáº¿u sá»­a chá»¯a â€” /api/v1/repair-tickets", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "repair_tickets.create", description: "Táº¡o phiáº¿u sá»­a chá»¯a â€” /api/v1/repair-tickets (POST)", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "repair_tickets.update", description: "Cáº­p nháº­t phiáº¿u sá»­a chá»¯a â€” /api/v1/repair-tickets/{id}", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "repair_tickets.delete", description: "XÃ³a phiáº¿u sá»­a chá»¯a â€” /api/v1/repair-tickets/{id} (DELETE)", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "trade_in_requests.read", description: "Xem yÃªu cáº§u thu cÅ© â€” /api/v1/trade-in-requests", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "trade_in_requests.create", description: "Táº¡o yÃªu cáº§u thu cÅ© â€” /api/v1/trade-in-requests (POST)", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "trade_in_requests.update", description: "Cáº­p nháº­t thu cÅ© Ä‘á»•i má»›i â€” /api/v1/trade-in-requests/{id}", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "trade_in_requests.delete", description: "XÃ³a thu cÅ© Ä‘á»•i má»›i â€” /api/v1/trade-in-requests/{id} (DELETE)", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "repair_services.read", description: "Xem dá»‹ch vá»¥ sá»­a chá»¯a â€” /api/v1/repair-services", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "repair_services.create", description: "Táº¡o dá»‹ch vá»¥ sá»­a chá»¯a â€” /api/v1/repair-services (POST)", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "repair_services.update", description: "Cáº­p nháº­t dá»‹ch vá»¥ sá»­a chá»¯a â€” /api/v1/repair-services/{id}", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },
  { code: "repair_services.delete", description: "XÃ³a dá»‹ch vá»¥ sá»­a chá»¯a â€” /api/v1/repair-services/{id} (DELETE)", group: "Sau bÃ¡n hÃ ng", apiEnforced: true },

  // ===== NhÃ¢n sá»± & phÃ¢n quyá»n =====
  { code: "roles.read", description: "Xem vai trÃ²", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "roles.create", description: "Táº¡o vai trÃ²", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "roles.update", description: "Cáº­p nháº­t vai trÃ²", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "roles.delete", description: "XÃ³a vai trÃ²", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "permissions.read", description: "Xem danh má»¥c quyá»n", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "permissions.create", description: "Táº¡o mÃ£ quyá»n má»›i", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "permissions.update", description: "Cáº­p nháº­t mÃ£ quyá»n", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "permissions.delete", description: "XÃ³a mÃ£ quyá»n", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "shop_staff.read", description: "Xem phÃ¢n cÃ´ng nhÃ¢n sá»±", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "shop_staff.create", description: "Táº¡o phÃ¢n cÃ´ng nhÃ¢n sá»±", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "shop_staff.update", description: "Cáº­p nháº­t phÃ¢n cÃ´ng nhÃ¢n sá»±", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "shop_staff.delete", description: "XÃ³a phÃ¢n cÃ´ng nhÃ¢n sá»±", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "user_profiles.read", description: "Xem há»“ sÆ¡ ngÆ°á»i dÃ¹ng", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },
  { code: "user_profiles.update", description: "Cáº­p nháº­t há»“ sÆ¡ ngÆ°á»i dÃ¹ng", group: "NhÃ¢n sá»± & phÃ¢n quyá»n", apiEnforced: true },

  // ===== Tá»• chá»©c & cá»­a hÃ ng =====
  { code: "organizations.read", description: "Xem tá»• chá»©c â€” /api/v1/organizations", group: "Tá»• chá»©c", apiEnforced: true },
  { code: "organizations.create", description: "Táº¡o tá»• chá»©c â€” /api/v1/organizations (POST)", group: "Tá»• chá»©c", apiEnforced: true },
  { code: "organizations.update", description: "Cáº­p nháº­t tá»• chá»©c â€” /api/v1/organizations/{id}", group: "Tá»• chá»©c", apiEnforced: true },
  { code: "organizations.delete", description: "XÃ³a tá»• chá»©c â€” /api/v1/organizations/{id} (DELETE)", group: "Tá»• chá»©c", apiEnforced: true },

  // ===== Há»‡ thá»‘ng =====
  { code: "audit_logs.read", description: "Xem nháº­t kÃ½ há»‡ thá»‘ng â€” /api/v1/audit-logs", group: "Há»‡ thá»‘ng", apiEnforced: true },
  { code: "reports.read", description: "Xem bÃ¡o cÃ¡o â€” /api/v1/reports/revenue", group: "Há»‡ thá»‘ng", apiEnforced: true },

  // ===== Quáº£n trá»‹ (Admin) =====
  { code: "admin.manage_users", description: "Táº¡o / quáº£n lÃ½ tÃ i khoáº£n ngÆ°á»i dÃ¹ng â€” /api/v1/admin/users", group: "Quáº£n trá»‹", apiEnforced: true },
  { code: "admin.manage_tools", description: "Upload/sá»­a/xÃ³a cÃ´ng cá»¥ kiá»ƒm tra â€” /api/v1/admin/tools/*", group: "Quáº£n trá»‹", apiEnforced: true },
  { code: "settings.read", description: "Xem cÃ i Ä‘áº·t há»‡ thá»‘ng â€” /api/v1/settings", group: "Há»‡ thá»‘ng", apiEnforced: true },
  { code: "settings.create", description: "Táº¡o cÃ i Ä‘áº·t â€” /api/v1/settings (POST)", group: "Há»‡ thá»‘ng", apiEnforced: true },
  { code: "settings.update", description: "Cáº­p nháº­t cÃ i Ä‘áº·t â€” /api/v1/settings/{id}", group: "Há»‡ thá»‘ng", apiEnforced: true },
  { code: "settings.delete", description: "XÃ³a cÃ i Ä‘áº·t â€” /api/v1/settings/{id} (DELETE)", group: "Há»‡ thá»‘ng", apiEnforced: true },

  // ===== Facebook Publisher (app desktop) =====
  { code: "publisher.use", description: "DÃ¹ng app Facebook Publisher â€” /api/v1/desktop-posting/*", group: "Facebook Publisher", apiEnforced: true },
];

/** Chá»‰ nhá»¯ng mÃ£ quyá»n mÃ  API Ä‘ang thá»±c sá»± gá»i requirePermission. */
export const API_ENFORCED_PERMISSION_CODES: string[] = PERMISSION_PRESETS
  .filter((p) => p.apiEnforced)
  .map((p) => p.code);

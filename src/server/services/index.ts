/**
 * Aggregated service registry. Mỗi entity = 1 export từ factory.
 * Entity nào cần logic riêng (orders checkout, inventory transfer...) thì
 * import service viết tay từ file riêng (xem cuối file).
 */
import { createCrud, type ListQuery } from "./_crud-factory";
import { rangeOf, paginated } from "@/lib/api/response";

// ===== Organizations & people =====
export const organizationsService = createCrud({
  table: "organizations",
  searchColumns: ["name", "code"],
  allowedSortColumns: ["name", "created_at"],
  defaultOrder: { column: "created_at", ascending: false },
});

export const shopsService = createCrud({
  table: "shops",
  searchColumns: ["name", "code", "phone", "email"],
  allowedSortColumns: ["name", "code", "created_at"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

export const warehousesService = createCrud({
  table: "warehouses",
  searchColumns: ["name", "code"],
  allowedSortColumns: ["name", "created_at"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

export const userProfilesService = createCrud({
  table: "user_profiles",
  searchColumns: ["full_name", "phone"],
  allowedSortColumns: ["full_name", "created_at"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

export const rolesService = createCrud({
  table: "roles",
  searchColumns: ["name", "code"],
  allowedSortColumns: ["name", "created_at"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

export const permissionsService = createCrud({
  table: "permissions",
  searchColumns: ["code", "description"],
  allowedSortColumns: ["code"],
  defaultOrder: { column: "code", ascending: true },
});

export const shopStaffService = createCrud({
  table: "shop_staff",
  allowedSortColumns: ["created_at"],
  defaultOrder: { column: "created_at", ascending: false },
});

// ===== Catalog =====
export const brandsService = createCrud({
  table: "brands",
  searchColumns: ["name", "slug"],
  allowedSortColumns: ["name", "created_at"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

export const categoriesService = createCrud({
  table: "categories",
  searchColumns: ["name", "slug"],
  allowedSortColumns: ["name", "position", "created_at"],
  defaultOrder: { column: "position", ascending: true },
  autoStampOrg: true,
});

export const specTemplatesService = createCrud({
  table: "spec_templates",
  searchColumns: ["name"],
  allowedSortColumns: ["name", "created_at"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

export { productsService } from "./products-service";

export const productVariantsService = createCrud({
  table: "product_variants",
  searchColumns: ["sku", "barcode", "name"],
  allowedSortColumns: ["sku", "selling_price", "created_at"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: false,
});

export const serialNumbersService = createCrud({
  table: "serial_numbers",
  searchColumns: ["serial", "imei"],
  allowedSortColumns: ["imported_at", "sold_at"],
  defaultOrder: { column: "imported_at", ascending: false },
});

// ===== Customers / Suppliers =====
export const customersService = createCrud({
  table: "customers",
  searchColumns: ["full_name", "phone", "email"],
  allowedSortColumns: ["full_name", "created_at", "loyalty_points"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

export const suppliersService = createCrud({
  table: "suppliers",
  searchColumns: ["company_name", "tax_code", "phone", "email"],
  allowedSortColumns: ["company_name", "created_at"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

// ===== Inventory =====
export const purchaseOrdersService = createCrud({
  table: "purchase_orders",
  searchColumns: ["po_number"],
  allowedSortColumns: ["po_number", "ordered_at", "created_at"],
  defaultOrder: { column: "created_at", ascending: false },
});

export const purchaseOrderItemsService = createCrud({
  table: "purchase_order_items",
  allowedSortColumns: [],
  defaultOrder: { column: "id", ascending: true },
});

export const inventoryTxService = createCrud({
  table: "inventory_transactions",
  searchColumns: ["note", "reference_type"],
  allowedSortColumns: ["created_at"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stockLevelsService: any = {
  table: "stock_levels",
  async list(db: any, query: ListQuery = {}) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const { from, to } = rangeOf(page, pageSize);
    let q = db.from("stock_levels").select("*", { count: "exact" }).range(from, to);
    if (query.filters) {
      for (const [k, v] of Object.entries(query.filters)) {
        if (v === null || v === undefined || v === "") continue;
        q = q.eq(k, v);
      }
    }
    q = q.order("warehouse_id", { ascending: true });
    const { data, error, count } = await q;
    if (error) throw error;
    return paginated(data ?? [], count ?? 0, page, pageSize);
  },
  getById: async () => { throw Object.assign(new Error("stock_levels không hỗ trợ getById"), { status: 400 }); },
  create: async () => { throw Object.assign(new Error("stock_levels không hỗ trợ create, dùng /adjust"), { status: 400 }); },
  update: async () => { throw Object.assign(new Error("stock_levels không hỗ trợ update, dùng /adjust"), { status: 400 }); },
  remove: async () => { throw Object.assign(new Error("stock_levels không hỗ trợ delete"), { status: 400 }); },
};

// ===== Sales =====
export const ordersService = createCrud({
  table: "orders",
  searchColumns: ["order_number", "note"],
  allowedSortColumns: ["order_number", "created_at", "total_amount"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

export const orderItemsService = createCrud({
  table: "order_items",
  allowedSortColumns: [],
  defaultOrder: { column: "id", ascending: true },
});

export const paymentsService = createCrud({
  table: "payments",
  searchColumns: ["transaction_code"],
  allowedSortColumns: ["paid_at"],
  defaultOrder: { column: "paid_at", ascending: false },
});

export const posSessionsService = createCrud({
  table: "pos_sessions",
  allowedSortColumns: ["opened_at"],
  defaultOrder: { column: "opened_at", ascending: false },
});

export const loyaltyTxService = createCrud({
  table: "loyalty_transactions",
  allowedSortColumns: ["created_at"],
  defaultOrder: { column: "created_at", ascending: false },
});

// ===== Returns & Status Logs =====
export const orderStatusLogsService = createCrud({
  table: "order_status_logs",
  allowedSortColumns: ["created_at"],
  defaultOrder: { column: "created_at", ascending: false },
});

export const returnOrdersService = createCrud({
  table: "return_orders",
  searchColumns: ["return_number", "reason", "note"],
  allowedSortColumns: ["return_number", "created_at", "refund_amount"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

export const returnOrderItemsService = createCrud({
  table: "return_order_items",
  allowedSortColumns: ["created_at"],
  defaultOrder: { column: "created_at", ascending: false },
});

// ===== After-sale =====
export const warrantiesService = createCrud({
  table: "warranties",
  allowedSortColumns: ["start_date", "end_date"],
  defaultOrder: { column: "start_date", ascending: false },
});

export const repairTicketsService = createCrud({
  table: "repair_tickets",
  searchColumns: ["device_name", "serial_number", "issue_description"],
  allowedSortColumns: ["created_at"],
  defaultOrder: { column: "created_at", ascending: false },
});

export const tradeInService = createCrud({
  table: "trade_in_requests",
  searchColumns: ["device_name", "serial_number"],
  allowedSortColumns: ["created_at"],
  defaultOrder: { column: "created_at", ascending: false },
});

export const repairServicesService = createCrud({
  table: "repair_services",
  searchColumns: ["name", "description"],
  allowedSortColumns: ["name", "price_min", "position", "created_at"],
  defaultOrder: { column: "position", ascending: true },
  autoStampOrg: true,
});

// ===== Misc =====
export const settingsService = createCrud({
  table: "settings",
  searchColumns: ["key", "group_name"],
  allowedSortColumns: ["key"],
  defaultOrder: { column: "key", ascending: true },
  autoStampOrg: true,
});

export const auditLogsService = createCrud({
  table: "audit_logs",
  allowedSortColumns: ["created_at"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: true,
});

// ===== Logic riêng — re-export từ file đặc thù =====
export { checkoutService } from "./checkout-service";
export { repairCheckoutService } from "./repair-checkout-service";
export { inventoryActionsService } from "./inventory-actions-service";
export { returnsService, orderStatusService } from "./returns-service";
export { posSessionActionsService } from "./pos-session-actions-service";

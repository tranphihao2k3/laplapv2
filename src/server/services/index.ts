/**
 * Aggregated service registry. Mỗi entity = 1 export từ factory.
 * Entity nào cần logic riêng (orders checkout, inventory transfer...) thì
 * import service viết tay từ file riêng (xem cuối file).
 */
import { createCrud, type ListQuery } from "./_crud-factory";
import { requireOrg } from "@/lib/api/guard";
import { rangeOf, paginated } from "@/lib/api/response";

// ===== Organizations & people =====
export const organizationsService = createCrud({
  table: "organizations",
  searchColumns: ["name", "code"],
  allowedSortColumns: ["name", "created_at"],
  defaultOrder: { column: "created_at", ascending: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert "Cửa hàng Cần Thơ" → "cuahangcantho" */
function nameToSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// ── Shops (custom create with auto-code) ──────────────────────────────────────
type ShopsRow = {
  id: string;
  organization_id: string | null;
  name: string;
  code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShopsDB = any;

export const shopsService = {
  table: "shops",

  async list(db: ShopsDB, query?: ListQuery) {
    return createCrud({ table: "shops", searchColumns: ["name", "code", "phone", "email"], allowedSortColumns: ["name", "code", "created_at"], defaultOrder: { column: "created_at", ascending: false }, autoStampOrg: true }).list(db, query);
  },

  async getById(db: ShopsDB, id: string) {
    return createCrud({ table: "shops", searchColumns: ["name", "code", "phone", "email"], allowedSortColumns: ["name", "code", "created_at"], defaultOrder: { column: "created_at", ascending: false }, autoStampOrg: true }).getById(db, id);
  },

  async create(db: ShopsDB, input: Record<string, unknown>): Promise<ShopsRow> {
    let code = input.code as string | null | undefined;

    // Auto-generate code from name if not provided
    if (!code || !String(code).trim()) {
      const slug = nameToSlug(String(input.name ?? "shop"));
      // Check how many shops already have a code starting with this slug
      const { data: existing } = await db
        .from("shops")
        .select("code")
        .ilike("code", `${slug}%`)
        .not("code", "is", null);

      const taken = new Set((existing ?? []).map((r: { code: string }) => r.code.toLowerCase()));

      if (!taken.has(slug)) {
        code = slug;
      } else {
        // Append numeric suffix: slug-1, slug-2 ...
        let suffix = 1;
        while (taken.has(`${slug}-${suffix}`)) suffix++;
        code = `${slug}-${suffix}`;
      }
    }

    const payload = { ...input, code } as Record<string, unknown>;

    // Apply autoStampOrg manually (shopsService uses autoStampOrg)
    const { orgId } = await requireOrg();
    if (payload.organization_id == null) payload.organization_id = orgId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db.from("shops") as any).insert(payload).select().single();
    if (error) throw error;
    return data as ShopsRow;
  },

  async update(db: ShopsDB, id: string, input: Record<string, unknown>) {
    return createCrud({ table: "shops", searchColumns: ["name", "code", "phone", "email"], allowedSortColumns: ["name", "code", "created_at"], defaultOrder: { column: "created_at", ascending: false }, autoStampOrg: true }).update(db, id, input);
  },

  async remove(db: ShopsDB, id: string) {
    return createCrud({ table: "shops", searchColumns: ["name", "code", "phone", "email"], allowedSortColumns: ["name", "code", "created_at"], defaultOrder: { column: "created_at", ascending: false }, autoStampOrg: true }).remove(db, id);
  },

  async bulkRemove(db: ShopsDB, ids: string[]) {
    return createCrud({ table: "shops", searchColumns: ["name", "code", "phone", "email"], allowedSortColumns: ["name", "code", "created_at"], defaultOrder: { column: "created_at", ascending: false }, autoStampOrg: true }).bulkRemove(db, ids);
  },
};

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

// ===== Newsletter =====
export const newsletterSubscribersService = createCrud({
  table: "newsletter_subscribers",
  searchColumns: ["email"],
  allowedSortColumns: ["email", "created_at", "confirmed_at"],
  defaultOrder: { column: "created_at", ascending: false },
  autoStampOrg: false, // bang nay multi-tenant nhung khong can org (admin system-wide)
});

export const newsletterOutboxService = createCrud({
  table: "newsletter_outbox",
  allowedSortColumns: ["scheduled_at", "sent_at", "created_at", "attempts"],
  defaultOrder: { column: "scheduled_at", ascending: true },
  autoStampOrg: false,
});

// ===== Logic riêng — re-export từ file đặc thù =====
export { checkoutService } from "./checkout-service";
export { repairCheckoutService } from "./repair-checkout-service";
export { inventoryActionsService } from "./inventory-actions-service";
export { returnsService, orderStatusService } from "./returns-service";
export { posSessionActionsService } from "./pos-session-actions-service";

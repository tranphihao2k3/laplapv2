/**
 * Endpoint chung: POST /v1/admin/bulk-delete
 *
 * Body: { entity: string, ids: string[] }
 *
 * Mục đích: cho phép bảng quanly nào dùng được createCrud factory thì có sẵn bulk-delete.
 * Whitelist service + map permission → tránh gọi nhầm vào entity không mong muốn.
 */
import { z } from "zod";
import { requireOrg, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { createClient } from "@/lib/supabase/server";
import * as services from "@/server/services";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ServiceWithBulk = {
  bulkRemove?: (db: any, ids: string[]) => Promise<any>;
  table?: string;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const bodySchema = z.object({
  entity: z.string().min(1).max(100),
  ids: z.array(z.string().min(1)).min(1).max(500),
});

/**
 * Whitelist entity → permission key cho bulk delete.
 * Nếu entity không nằm trong danh sách này → 403.
 * Nếu entity không có `bulkRemove` (vd: stock_levels chỉ custom service) → 400.
 */
const ENTITY_PERMISSIONS: Record<string, string> = {
  organizations: "organizations.delete",
  shops: "shops.delete",
  warehouses: "warehouses.delete",
  "user-profiles": "user_profiles.delete",
  roles: "roles.delete",
  permissions: "permissions.delete",
  "shop-staff": "shop_staff.delete",
  brands: "brands.delete",
  categories: "categories.delete",
  "spec-templates": "spec_templates.delete",
  products: "products.delete",
  "product-variants": "product_variants.delete",
  "serial-numbers": "serial_numbers.delete",
  customers: "customers.delete",
  suppliers: "suppliers.delete",
  "purchase-orders": "purchase_orders.delete",
  "purchase-order-items": "purchase_order_items.delete",
  "inventory-transactions": "inventory_transactions.delete",
  orders: "orders.delete",
  "order-items": "order_items.delete",
  payments: "payments.delete",
  "pos-sessions": "pos_sessions.delete",
  "loyalty-transactions": "loyalty_transactions.delete",
  "order-status-logs": "order_status_logs.delete",
  "return-orders": "return_orders.delete",
  "return-order-items": "return_order_items.delete",
  warranties: "warranties.delete",
  "repair-tickets": "repair_tickets.delete",
  "trade-in-requests": "trade_in_requests.delete",
  "repair-services": "repair_services.delete",
  settings: "settings.delete",
  "audit-logs": "audit_logs.delete",
  "newsletter-subscribers": "newsletter_subscribers.delete",
  "newsletter-outbox": "newsletter_outbox.delete",
};

/** Map từ URL entity sang key trong services. */
const ENTITY_TO_SERVICE: Record<string, keyof typeof services> = {
  organizations: "organizationsService",
  shops: "shopsService",
  warehouses: "warehousesService",
  "user-profiles": "userProfilesService",
  roles: "rolesService",
  permissions: "permissionsService",
  "shop-staff": "shopStaffService",
  brands: "brandsService",
  categories: "categoriesService",
  "spec-templates": "specTemplatesService",
  products: "productsService",
  "product-variants": "productVariantsService",
  "serial-numbers": "serialNumbersService",
  customers: "customersService",
  suppliers: "suppliersService",
  "purchase-orders": "purchaseOrdersService",
  "purchase-order-items": "purchaseOrderItemsService",
  "inventory-transactions": "inventoryTxService",
  orders: "ordersService",
  "order-items": "orderItemsService",
  payments: "paymentsService",
  "pos-sessions": "posSessionsService",
  "loyalty-transactions": "loyaltyTxService",
  "order-status-logs": "orderStatusLogsService",
  "return-orders": "returnOrdersService",
  "return-order-items": "returnOrderItemsService",
  warranties: "warrantiesService",
  "repair-tickets": "repairTicketsService",
  "trade-in-requests": "tradeInService",
  "repair-services": "repairServicesService",
  settings: "settingsService",
  "audit-logs": "auditLogsService",
  "newsletter-subscribers": "newsletterSubscribersService",
  "newsletter-outbox": "newsletterOutboxService",
};

export async function POST(req: Request) {
  try {
    const { user, orgId } = await requireOrg();
    const { entity, ids } = bodySchema.parse(await req.json());

    const permKey = ENTITY_PERMISSIONS[entity];
    if (!permKey) {
      return new Response(
        JSON.stringify({ ok: false, error: { message: `Bulk delete không hỗ trợ cho entity '${entity}'` } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    await requirePermission(permKey);

    const serviceKey = ENTITY_TO_SERVICE[entity];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = services[serviceKey] as ServiceWithBulk | undefined;
    if (!svc || typeof svc.bulkRemove !== "function") {
      return new Response(
        JSON.stringify({ ok: false, error: { message: `Service '${entity}' không hỗ trợ bulk delete` } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = await createClient();
    const result = await svc.bulkRemove(supabase, ids);

    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: String(svc.table ?? entity),
      entityId: "",
      action: "bulk_delete",
      beforeData: {
        ids,
        deleted: (result as any)?.deleted ?? [],
        missing: (result as any)?.missing ?? [],
      },
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}

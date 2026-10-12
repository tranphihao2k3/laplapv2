/**
 * Endpoint chung: POST /v1/admin/bulk-delete
 *
 * Body: { entity: string, ids: string[] }
 *
 * Hành vi mới (best-effort + archive fallback):
 *   - Với từng id, thử gọi svc.remove(db, id) RIÊNG LẺ (không atomic).
 *   - Nếu xoá thành công → thêm vào `deleted`.
 *   - Nếu xoá fail (FK constraint, không tồn tại, v.v.) VÀ entity thuộc
 *     ARCHIVABLE_ENTITIES (vd: products) → set status='archived' thay thế.
 *   - Cả hai fail → thêm vào `failed` với reason.
 *
 * Trước đây route này gọi bulkRemove() 1 lần, nên chỉ 1 id fail là cả
 * batch fail (vd: products không có bulkRemove, hoặc 1 sản phẩm đang
 * được tham chiếu bởi order_items khiến FK 23503). Giờ mỗi id xử lý
 * riêng nên chỉ item lỗi bị archive/fail, phần còn lại xoá thành công.
 *
 * Whitelist entity → permission vẫn giữ nguyên để chống gọi nhầm.
 */
import { z } from "zod";
import { requireOrg, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { createClient } from "@/lib/supabase/server";
import * as services from "@/server/services";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ServiceLike = {
  remove?: (db: any, id: string) => Promise<unknown>;
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

/**
 * Entity nào có thể "archive" thay vì xoá cứng khi xoá fail.
 * Mỗi entry định nghĩa: table DB, cột status, giá trị archive.
 * Chỉ áp dụng khi hard-delete fail (vd: FK constraint với order_items).
 */
const ARCHIVABLE_ENTITIES: Record<
  string,
  { table: string; statusColumn: string; archiveValue: string }
> = {
  products: { table: "products", statusColumn: "status", archiveValue: "archived" },
};

const CONCURRENCY = 10;

type FailedItem = { id: string; reason: string };

async function tryArchive(
  db: Awaited<ReturnType<typeof createClient>>,
  table: string,
  statusColumn: string,
  archiveValue: string,
  id: string,
): Promise<{ ok: boolean; reason?: string }> {
  const update: Record<string, unknown> = {
    [statusColumn]: archiveValue,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from(table)
    .update(update)
    .eq("id", id)
    // Chỉ archive nếu đang ở trạng thái "active" — tránh ghi đè các status
    // đặc biệt (vd: "draft", "out_of_stock") hoặc đã archived từ trước.
    .eq(statusColumn, "active")
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, reason: extractPgMessage(error) ?? "archive_failed" };
  }
  if (!data) {
    // Không match "active" → có thể đã archived, hoặc status khác.
    // Thử update không điều kiện để xem row còn tồn tại không.
    const { data: anyRow, error: anyErr } = await db
      .from(table)
      .update(update)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (anyErr) {
      return { ok: false, reason: extractPgMessage(anyErr) ?? "archive_failed" };
    }
    if (!anyRow) {
      return { ok: false, reason: "not_found" };
    }
  }
  return { ok: true };
}

function extractPgMessage(err: unknown): string | null {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return null;
}

async function runBatched<T, R>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  // Chạy song song với concurrency cap để không overwhelm DB.
  // Dùng worker pool size = batchSize; mỗi worker kéo job kế tiếp
  // cho đến khi hết.
  const workers = Array.from({ length: Math.min(batchSize, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(req: Request) {
  try {
    return await handlePost(req);
  } catch (e) {
    return handleError(e);
  }
}

async function handlePost(req: Request) {
  const { user, orgId } = await requireOrg();
  const { entity, ids } = bodySchema.parse(await req.json());

  const permKey = ENTITY_PERMISSIONS[entity];
  if (!permKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { message: `Bulk delete không hỗ trợ cho entity '${entity}'` },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  await requirePermission(permKey);

  const serviceKey = ENTITY_TO_SERVICE[entity];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = services[serviceKey] as ServiceLike | undefined;
  if (!svc || typeof svc.remove !== "function") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { message: `Service '${entity}' không hỗ trợ delete` },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = await createClient();
  const archiveConfig = ARCHIVABLE_ENTITIES[entity];

  const result = await runBatched(ids, CONCURRENCY, async (id) => {
    try {
      await svc.remove!(supabase, id);
      return { id, outcome: "deleted" as const };
    } catch (err) {
      // Xoá fail. Nếu entity có thể archive thì thử archive.
      if (archiveConfig) {
        const archiveResult = await tryArchive(
          supabase,
          archiveConfig.table,
          archiveConfig.statusColumn,
          archiveConfig.archiveValue,
          id,
        );
        if (archiveResult.ok) {
          return { id, outcome: "archived" as const };
        }
        return {
          id,
          outcome: "failed" as const,
          reason: `delete_failed: ${extractPgMessage(err) ?? "unknown"}; archive_failed: ${archiveResult.reason ?? "unknown"}`,
        };
      }
      return {
        id,
        outcome: "failed" as const,
        reason: extractPgMessage(err) ?? "delete_failed",
      };
    }
  });

  const deleted: string[] = [];
  const archived: string[] = [];
  const failed: FailedItem[] = [];
  for (const r of result) {
    if (r.outcome === "deleted") deleted.push(r.id);
    else if (r.outcome === "archived") archived.push(r.id);
    else failed.push({ id: r.id, reason: r.reason });
  }

  await writeAuditLog({
    supabase,
    userId: user.id,
    organizationId: orgId,
    entityType: String(svc.table ?? entity),
    entityId: "",
    action: "bulk_delete",
    beforeData: {
      total: ids.length,
      deleted,
      archived,
      failed,
    },
    afterData: null,
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return ok({
    total: ids.length,
    deleted,
    archived,
    failed,
    // Backward-compat alias: route cũ trả `missing` (chỉ id), nhiều
    // page admin UI vẫn đọc `result.missing?.length`. Giữ thêm để không
    // phải sửa 15 trang cùng lúc — sau này migrate dần sang `failed`.
    missing: failed.map((f) => f.id),
  });
}

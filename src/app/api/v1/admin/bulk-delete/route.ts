/**
 * Endpoint chung: POST /v1/admin/bulk-delete
 *
 * Body: { entity: string, ids: string[] }
 *
 * HÃ nh vi má»›i (best-effort + archive fallback):
 *   - Vá»›i tá»«ng id, thá»­ gá»i svc.remove(db, id) RIÃŠNG Láºº (khÃ´ng atomic).
 *   - Náº¿u xoÃ¡ thÃ nh cÃ´ng â†’ thÃªm vÃ o `deleted`.
 *   - Náº¿u xoÃ¡ fail (FK constraint, khÃ´ng tá»“n táº¡i, v.v.) VÃ€ entity thuá»™c
 *     ARCHIVABLE_ENTITIES (vd: products) â†’ set status='archived' thay tháº¿.
 *   - Cáº£ hai fail â†’ thÃªm vÃ o `failed` vá»›i reason.
 *
 * TrÆ°á»›c Ä‘Ã¢y route nÃ y gá»i bulkRemove() 1 láº§n, nÃªn chá»‰ 1 id fail lÃ  cáº£
 * batch fail (vd: products khÃ´ng cÃ³ bulkRemove, hoáº·c 1 sáº£n pháº©m Ä‘ang
 * Ä‘Æ°á»£c tham chiáº¿u bá»Ÿi order_items khiáº¿n FK 23503). Giá» má»—i id xá»­ lÃ½
 * riÃªng nÃªn chá»‰ item lá»—i bá»‹ archive/fail, pháº§n cÃ²n láº¡i xoÃ¡ thÃ nh cÃ´ng.
 *
 * Whitelist entity â†’ permission váº«n giá»¯ nguyÃªn Ä‘á»ƒ chá»‘ng gá»i nháº§m.
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
 * Whitelist entity â†’ permission key cho bulk delete.
 * Náº¿u entity khÃ´ng náº±m trong danh sÃ¡ch nÃ y â†’ 403.
 */
const ENTITY_PERMISSIONS: Record<string, string> = {
  organizations: "organizations.delete",
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
};

/** Map tá»« URL entity sang key trong services. */
const ENTITY_TO_SERVICE: Record<string, keyof typeof services> = {
  organizations: "organizationsService",
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
};

/**
 * Entity nÃ o cÃ³ thá»ƒ "archive" thay vÃ¬ xoÃ¡ cá»©ng khi xoÃ¡ fail.
 * Má»—i entry Ä‘á»‹nh nghÄ©a: table DB, cá»™t status, giÃ¡ trá»‹ archive.
 * Chá»‰ Ã¡p dá»¥ng khi hard-delete fail (vd: FK constraint vá»›i order_items).
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
    // Chá»‰ archive náº¿u Ä‘ang á»Ÿ tráº¡ng thÃ¡i "active" â€” trÃ¡nh ghi Ä‘Ã¨ cÃ¡c status
    // Ä‘áº·c biá»‡t (vd: "draft", "out_of_stock") hoáº·c Ä‘Ã£ archived tá»« trÆ°á»›c.
    .eq(statusColumn, "active")
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, reason: extractPgMessage(error) ?? "archive_failed" };
  }
  if (!data) {
    // KhÃ´ng match "active" â†’ cÃ³ thá»ƒ Ä‘Ã£ archived, hoáº·c status khÃ¡c.
    // Thá»­ update khÃ´ng Ä‘iá»u kiá»‡n Ä‘á»ƒ xem row cÃ²n tá»“n táº¡i khÃ´ng.
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
  // Cháº¡y song song vá»›i concurrency cap Ä‘á»ƒ khÃ´ng overwhelm DB.
  // DÃ¹ng worker pool size = batchSize; má»—i worker kÃ©o job káº¿ tiáº¿p
  // cho Ä‘áº¿n khi háº¿t.
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
        error: { message: `Bulk delete khÃ´ng há»— trá»£ cho entity '${entity}'` },
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
        error: { message: `Service '${entity}' khÃ´ng há»— trá»£ delete` },
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
      // XoÃ¡ fail. Náº¿u entity cÃ³ thá»ƒ archive thÃ¬ thá»­ archive.
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
    // Backward-compat alias: route cÅ© tráº£ `missing` (chá»‰ id), nhiá»u
    // page admin UI váº«n Ä‘á»c `result.missing?.length`. Giá»¯ thÃªm Ä‘á»ƒ khÃ´ng
    // pháº£i sá»­a 15 trang cÃ¹ng lÃºc â€” sau nÃ y migrate dáº§n sang `failed`.
    missing: failed.map((f) => f.id),
  });
}

/**
 * Generic REST route handler factory.
 * Gắn vào src/app/api/v1/<entity>/route.ts và /[id]/route.ts để chỉ cần 5 dòng.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requirePermission, requireOrg } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import type { ListQuery } from "@/server/services/_crud-factory";
import type { DB } from "@/lib/api/guard";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Crud = {
  table?: string;
  list: (db: DB, q?: ListQuery) => Promise<any>;
  getById: (db: DB, id: string) => Promise<any>;
  create: (db: DB, input: any) => Promise<any>;
  update: (db: DB, id: string, input: any) => Promise<any>;
  remove: (db: DB, id: string) => Promise<any>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export function makeCollectionHandlers<TCreate>(opts: {
  crud: Crud;
  createSchema: z.ZodType<TCreate>;
  permissions?: {
    read?: string;
    create?: string;
  };
}) {
  return {
    async GET(req: NextRequest) {
      try {
        await requireUser();
        if (opts.permissions?.read) await requirePermission(opts.permissions.read);
        const supabase = await createClient();
        const sp = req.nextUrl.searchParams;
        const query: ListQuery = {
          search: sp.get("search") ?? undefined,
          page: sp.get("page") ? Number(sp.get("page")) : undefined,
          pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
          sort: sp.get("sort") ?? undefined,
          filters: Object.fromEntries(
            [...sp.entries()].filter(([k]) => !["search", "page", "pageSize", "sort"].includes(k)),
          ),
        };
        const data = await opts.crud.list(supabase, query);
        return ok(data);
      } catch (e) {
        return handleError(e);
      }
    },
    async POST(req: NextRequest) {
      try {
        const { user, orgId } = await requireOrg();
        if (opts.permissions?.create) await requirePermission(opts.permissions.create);
        const supabase = await createClient();
        const body = opts.createSchema.parse(await req.json());
        const data = await opts.crud.create(supabase, body);
        await writeAuditLog({
          supabase,
          userId: user.id,
          organizationId: orgId,
          entityType: String(opts.crud.table ?? "unknown"),
          entityId: String(data?.id ?? ""),
          action: "create",
          afterData: data,
          ipAddress: req.headers.get("x-forwarded-for"),
        });
        return ok(data, { status: 201 });
      } catch (e) {
        return handleError(e);
      }
    },
  };
}

export function makeItemHandlers<TUpdate>(opts: {
  crud: Crud;
  updateSchema: z.ZodType<TUpdate>;
  permissions?: {
    read?: string;
    update?: string;
    remove?: string;
  };
}) {
  return {
    async GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      try {
        await requireUser();
        if (opts.permissions?.read) await requirePermission(opts.permissions.read);
        const supabase = await createClient();
        const { id } = await ctx.params;
        const data = await opts.crud.getById(supabase, id);
        return ok(data);
      } catch (e) {
        return handleError(e);
      }
    },
    async PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      try {
        const { user, orgId } = await requireOrg();
        if (opts.permissions?.update) await requirePermission(opts.permissions.update);
        const supabase = await createClient();
        const { id } = await ctx.params;
        const before = await opts.crud.getById(supabase, id);
        const body = opts.updateSchema.parse(await req.json());
        const data = await opts.crud.update(supabase, id, body);
        await writeAuditLog({
          supabase,
          userId: user.id,
          organizationId: orgId,
          entityType: String(opts.crud.table ?? "unknown"),
          entityId: id,
          action: "update",
          beforeData: before,
          afterData: data,
          ipAddress: req.headers.get("x-forwarded-for"),
        });
        return ok(data);
      } catch (e) {
        return handleError(e);
      }
    },
    async DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      try {
        const { user, orgId } = await requireOrg();
        if (opts.permissions?.remove) await requirePermission(opts.permissions.remove);
        const supabase = await createClient();
        const { id } = await ctx.params;
        const before = await opts.crud.getById(supabase, id);
        const data = await opts.crud.remove(supabase, id);
        await writeAuditLog({
          supabase,
          userId: user.id,
          organizationId: orgId,
          entityType: String(opts.crud.table ?? "unknown"),
          entityId: id,
          action: "delete",
          beforeData: before,
          ipAddress: req.headers.get("x-forwarded-for"),
        });
        return ok(data);
      } catch (e) {
        return handleError(e);
      }
    },
  };
}

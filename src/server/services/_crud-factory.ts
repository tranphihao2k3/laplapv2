/**
 * Generic CRUD factory cho Supabase. Dùng cho 80% bảng có pattern giống nhau:
 *   list (filter + paginate)  |  getById  |  create  |  update  |  remove
 *
 * Mỗi entity gọi `createCrud<TableName>({ table, defaultOrder, searchColumns, allowedSortColumns, autoStampOrg })`
 * và nhận về object service đã typed sẵn theo Database types.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { Errors, rangeOf, paginated, type Paginated } from "@/lib/api/response";
import { requireOrg } from "@/lib/api/guard";

type TableName = keyof Database["public"]["Tables"];
type RowOf<T extends TableName> = Database["public"]["Tables"][T]["Row"];
type InsertOf<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
type UpdateOf<T extends TableName> = Database["public"]["Tables"][T]["Update"];
type DB = SupabaseClient<Database>;

export type ListQuery = {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: string; // "column:asc" | "column:desc"
  filters?: Record<string, string | number | boolean | null>;
};

export type CrudConfig<T extends TableName> = {
  table: T;
  /** Cột mặc định để search ilike */
  searchColumns?: (keyof RowOf<T>)[];
  /** Whitelist cột được phép sort, tránh SQL injection */
  allowedSortColumns?: (keyof RowOf<T>)[];
  /** Sort mặc định khi không truyền sort */
  defaultOrder?: { column: keyof RowOf<T>; ascending?: boolean };
  /** Tự gắn organization_id từ user vào Insert/Update (cho bảng multi-tenant). */
  autoStampOrg?: boolean;
};

export function createCrud<T extends TableName>(cfg: CrudConfig<T>) {
  type Row = RowOf<T>;
  type Insert = InsertOf<T>;
  type Update = UpdateOf<T>;
  const table = cfg.table;

  async function list(db: DB, query: ListQuery = {}): Promise<Paginated<Row>> {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const { from, to } = rangeOf(page, pageSize);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (db.from(table) as any).select("*", { count: "exact" }).range(from, to);

    if (query.search && cfg.searchColumns?.length) {
      const term = query.search.replace(/[%_]/g, "");
      // build OR ilike: col1.ilike.%term%,col2.ilike.%term%
      const filter = cfg.searchColumns.map((c) => `${String(c)}.ilike.%${term}%`).join(",");
      q = q.or(filter);
    }

    if (query.filters) {
      for (const [k, v] of Object.entries(query.filters)) {
        if (v === null || v === undefined || v === "") continue;
        q = q.eq(k, v as string | number | boolean);
      }
    }

    let sortCol: string = String(cfg.defaultOrder?.column ?? "created_at");
    let asc = cfg.defaultOrder?.ascending ?? false;
    if (query.sort) {
      const [col, dir] = query.sort.split(":");
      const allowed = (cfg.allowedSortColumns ?? []).map(String);
      if (col && (allowed.length === 0 || allowed.includes(col))) {
        sortCol = col;
        asc = dir !== "desc";
      }
    }
    q = q.order(sortCol, { ascending: asc });

    const { data, error, count } = await q;
    if (error) throw error;
    return paginated((data ?? []) as Row[], count ?? 0, page, pageSize);
  }

  async function getById(db: DB, id: string): Promise<Row> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db.from(table) as any).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw Errors.notFound(String(table));
    return data as Row;
  }

  async function create(db: DB, input: Insert): Promise<Row> {
    const payload = { ...input } as Record<string, unknown>;
    if (cfg.autoStampOrg) {
      const { orgId } = await requireOrg();
      if (payload.organization_id == null) payload.organization_id = orgId;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db.from(table) as any).insert(payload).select().single();
    if (error) throw error;
    return data as Row;
  }

  async function update(db: DB, id: string, input: Update): Promise<Row> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db.from(table) as any).update(input).eq("id", id).select().single();
    if (error) throw error;
    return data as Row;
  }

  async function remove(db: DB, id: string): Promise<{ id: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (db.from(table) as any).delete().eq("id", id);
    if (error) throw error;
    return { id };
  }

  return { list, getById, create, update, remove, table };
}

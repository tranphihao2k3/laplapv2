/**
 * Vouchers Service - CRUD operations for voucher management
 */
import { Errors, paginated, rangeOf, type Paginated } from "@/lib/api/response";
import type { DB } from "@/lib/api/guard";
import type { ListQuery } from "./_crud-factory";
import type { Voucher, VoucherUsage, CreateVoucherInput, UpdateVoucherInput } from "@/types/voucher";

export const vouchersService = {
  table: "vouchers",

  async list(db: DB, query: ListQuery = {}): Promise<Paginated<Voucher>> {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const { from, to } = rangeOf(page, pageSize);

    let q = db.from("vouchers").select("*", { count: "exact" }).range(from, to);

    if (query.search) {
      const term = query.search.replace(/[%_]/g, "");
      q = q.or(`code.ilike.%${term}%,name.ilike.%${term}%,description.ilike.%${term}%`);
    }

    if (query.filters) {
      for (const [k, v] of Object.entries(query.filters)) {
        if (v === null || v === undefined || v === "") continue;
        // Handle special filters
        if (k === "is_active") {
          q = q.eq("is_active", v === "true" || v === true);
        } else if (k === "type") {
          q = q.eq("type", v);
        } else {
          q = q.eq(k, v as string | number | boolean);
        }
      }
    }

    let sortCol = "created_at";
    let asc = false;
    if (query.sort) {
      const [col, dir] = query.sort.split(":");
      if (["code", "name", "created_at", "start_date", "end_date", "is_active"].includes(col)) {
        sortCol = col;
        asc = dir !== "desc";
      }
    }

    const { data, error, count } = await q.order(sortCol, { ascending: asc });
    if (error) throw error;

    return paginated((data ?? []) as Voucher[], count ?? 0, page, pageSize);
  },

  async getById(db: DB, id: string): Promise<Voucher> {
    const { data, error } = await db.from("vouchers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw Errors.notFound("voucher");
    return data as Voucher;
  },

  async create(db: DB, input: CreateVoucherInput): Promise<Voucher> {
    // Normalize code to uppercase
    const normalizedInput = {
      ...input,
      code: input.code.toUpperCase().trim(),
      quantity_used: 0,
    };

    const { data, error } = await db.from("vouchers").insert(normalizedInput).select().single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("Mã voucher đã tồn tại");
      }
      throw error;
    }
    return data as Voucher;
  },

  async update(db: DB, id: string, input: UpdateVoucherInput): Promise<Voucher> {
    // Normalize code if provided
    const payload = { ...input };
    if (payload.code) {
      payload.code = payload.code.toUpperCase().trim();
    }

    const { data, error } = await db.from("vouchers").update(payload).eq("id", id).select().single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("Mã voucher đã tồn tại");
      }
      throw error;
    }
    if (!data) throw Errors.notFound("voucher");
    return data as Voucher;
  },

  async remove(db: DB, id: string): Promise<{ id: string }> {
    const { error } = await db.from("vouchers").delete().eq("id", id);
    if (error) throw error;
    return { id };
  },

  async bulkRemove(db: DB, ids: string[]): Promise<{ deleted: string[]; missing: string[] }> {
    const deleted: string[] = [];
    const missing: string[] = [];

    for (const id of ids) {
      try {
        await this.remove(db, id);
        deleted.push(id);
      } catch {
        missing.push(id);
      }
    }

    return { deleted, missing };
  },
};

export const voucherUsagesService = {
  table: "voucher_usages",

  async listByVoucher(db: DB, voucherId: string): Promise<VoucherUsage[]> {
    const { data, error } = await db
      .from("voucher_usages")
      .select("*")
      .eq("voucher_id", voucherId)
      .order("used_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as VoucherUsage[];
  },

  async create(db: DB, input: {
    voucher_id: string;
    user_id?: string | null;
    user_identifier?: string | null;
    order_id?: string | null;
    discount_amount: number;
  }): Promise<VoucherUsage> {
    const { data, error } = await db.from("voucher_usages").insert(input).select().single();
    if (error) throw error;
    return data as VoucherUsage;
  },
};

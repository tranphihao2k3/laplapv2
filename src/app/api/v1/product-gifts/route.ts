import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requirePermission, requireOrg } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { productGiftCreateSchema } from "@/lib/validators/catalog";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("products.read");
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;
    const productId = sp.get("product_id");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (supabase as any)
      .from("product_gifts")
      .select(
        "product_id, gift_product_id, created_at, product:products!product_gifts_product_id_fkey(id,name), gift:products!product_gifts_gift_product_id_fkey(id,name)",
      );
    if (productId) q = q.eq("product_id", productId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return ok({ items: data ?? [], total: (data ?? []).length, page: 1, pageSize: 200, totalPages: 1 });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("products.update");
    const supabase = await createClient();
    const body = productGiftCreateSchema.parse(await req.json());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("product_gifts")
      .insert(body)
      .select()
      .single();
    if (error) throw error;
    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "product_gifts",
      entityId: `${body.product_id}_${body.gift_product_id}`,
      action: "create",
      afterData: data,
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    return ok(data, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("products.update");
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;
    const productId = sp.get("product_id");
    const giftId = sp.get("gift_product_id");
    if (!productId || !giftId) {
      return handleError(new Error("Thiếu product_id hoặc gift_product_id"));
    }
    const before = { product_id: productId, gift_product_id: giftId };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("product_gifts")
      .delete()
      .eq("product_id", productId)
      .eq("gift_product_id", giftId);
    if (error) throw error;
    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "product_gifts",
      entityId: `${productId}_${giftId}`,
      action: "delete",
      beforeData: before,
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    return ok(before);
  } catch (e) {
    return handleError(e);
  }
}

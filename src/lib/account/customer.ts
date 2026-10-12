/**
 * Account/customer helpers (server-side).
 *
 * - getCurrentCustomer(): merged auth.users + customers + user_profiles
 *                        của user đang đăng nhập (or null nếu chưa login).
 * - requireCustomer(): throw redirect("/account/login") nếu chưa login.
 * - upsertCustomerProfile(): update profile của customer.
 * - linkGuestOrdersOnLogin(): khi mới tạo tài khoản → gộp các đơn guest
 *                             (cùng email/sđt) vào customer_id.
 *
 * Lưu ý:
 *   - Middleware đã verify session, getUser() ở đây đảm bảo cookies mới.
 *   - KHÔNG đặt trong client component — Supabase server client yêu cầu cookies.
 *   - Database tự có auth_user_id (migration 20261011000000).
 */
import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AccountUser = {
  /** auth.users.id */
  id: string;
  email: string;
  /** raw_user_meta_data.full_name hoặc customers.full_name */
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  /** customers.id, or null nếu user bị orphan (chưa có customers row). */
  customerId: string | null;
  /** customers.* */
  customer: {
    id: string;
    tier: string | null;
    loyaltyPoints: number | null;
    birthday: string | null;
    gender: string | null;
    preferences: Record<string, unknown>;
    organizationId: string | null;
  } | null;
};

/**
 * Lấy customer hiện tại. Cache theo request (React.cache) để tránh
 * gọi Supabase nhiều lần trong cùng 1 server render.
 */
export const getCurrentCustomer = cache(async (): Promise<AccountUser | null> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const [customerRes, profileRes] = await Promise.all([
      db
        .from("customers")
        .select(
          "id, full_name, email, phone, tier, loyalty_points, birthday, gender, preferences, avatar_url, organization_id, deleted_at",
        )
        .eq("auth_user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle(),
      db
        .from("user_profiles")
        .select("full_name, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const customer = customerRes.data ?? null;
    const profile = profileRes.data ?? null;

    return {
      id: user.id,
      email: user.email ?? customer?.email ?? "",
      fullName:
        customer?.full_name ??
        profile?.full_name ??
        (user.user_metadata?.full_name as string | undefined) ??
        null,
      phone: customer?.phone ?? profile?.phone ?? null,
      avatarUrl: customer?.avatar_url ?? profile?.avatar_url ?? null,
      customerId: customer?.id ?? null,
      customer: customer
        ? {
            id: customer.id,
            tier: customer.tier ?? "bronze",
            loyaltyPoints: customer.loyalty_points ?? 0,
            birthday: customer.birthday ?? null,
            gender: customer.gender ?? null,
            preferences: (customer.preferences as Record<string, unknown>) ?? {},
            organizationId: customer.organization_id ?? null,
          }
        : null,
    };
  } catch {
    return null;
  }
});

/**
 * Throw redirect nếu user chưa login.
 * Dùng trong server component của /account/* hoặc server actions.
 *
 * Idempotent: tự động đảm bảo customer row tồn tại (gọi RPC
 * `ensure_customer_for_auth_user`). Fix bug "admin đăng nhập nhưng vẫn
 * thấy meCustomerId = null" vì customer row bị thiếu.
 */
export async function requireCustomer(redirectTo?: string): Promise<AccountUser> {
  const user = await getCurrentCustomer();
  if (!user) {
    const target = redirectTo
      ? `/account/login?redirectTo=${encodeURIComponent(redirectTo)}`
      : "/account/login";
    redirect(target);
  }

  // Nếu user đã login (auth) nhưng chưa có customer row → tạo/link ngay.
  // Migration 20261011000000 đã có function này (idempotent).
  if (!user.customerId && user.id && user.email) {
    let rpcError: unknown = null;
    try {
      const supabase = await createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: ensuredId } = await db.rpc("ensure_customer_for_auth_user", {
        p_auth_user_id: user.id,
        p_email: user.email,
        p_full_name: user.fullName,
        p_phone: user.phone,
        p_avatar_url: user.avatarUrl,
      });
      if (ensuredId) {
        // Reload để lấy customerId mới (dùng cache bust: gọi trực tiếp bypass cache)
        const { data: customer } = await db
          .from("customers")
          .select(
            "id, full_name, email, phone, tier, loyalty_points, birthday, gender, preferences, avatar_url, organization_id, deleted_at",
          )
          .eq("auth_user_id", user.id)
          .is("deleted_at", null)
          .maybeSingle();

        if (customer) {
          return {
            ...user,
            customerId: customer.id,
            customer: {
              id: customer.id,
              tier: customer.tier ?? "bronze",
              loyaltyPoints: customer.loyalty_points ?? 0,
              birthday: customer.birthday ?? null,
              gender: customer.gender ?? null,
              preferences: (customer.preferences as Record<string, unknown>) ?? {},
              organizationId: customer.organization_id ?? null,
            },
          };
        }
      }
      // RPC trả về null/undefined → không tạo được (có thể do conflict unique)
      console.warn(
        "[requireCustomer] ensure_customer_for_auth_user returned no id for",
        user.email,
      );
    } catch (err) {
      rpcError = err;
      console.error("[requireCustomer] ensure_customer_for_auth_user failed:", err);
    }

    // Fallback: dùng service-role client để upsert customer row trực tiếp.
    // Trigger khi:
    //   - RPC function không tồn tại (migration chưa chạy) → rpcError != null
    //   - RPC chạy nhưng trả về null (vd conflict, hoặc bug trong function)
    //   - RPC thành công nhưng reload không thấy row
    // Service-role bypass RLS nên có thể upsert an toàn. Đã authenticated = OK.
    try {
      const { createSupabaseServiceClient } = await import("@/lib/supabase/service");
      const svc = createSupabaseServiceClient();
      const { data: svcCustomer } = await svc
        .from("customers")
        .upsert(
          {
            auth_user_id: user.id,
            email: user.email,
            full_name: user.fullName,
            phone: user.phone,
            avatar_url: user.avatarUrl,
            tier: "bronze",
            loyalty_points: 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "auth_user_id", ignoreDuplicates: false },
        )
        .select(
          "id, full_name, email, phone, tier, loyalty_points, birthday, gender, preferences, avatar_url, organization_id, deleted_at",
        )
        .maybeSingle();

      if (svcCustomer) {
        console.info(
          "[requireCustomer] service-role fallback created/linked customer for",
          user.email,
        );
        return {
          ...user,
          customerId: svcCustomer.id,
          customer: {
            id: svcCustomer.id,
            tier: svcCustomer.tier ?? "bronze",
            loyaltyPoints: svcCustomer.loyalty_points ?? 0,
            birthday: svcCustomer.birthday ?? null,
            gender: svcCustomer.gender ?? null,
            preferences: (svcCustomer.preferences as Record<string, unknown>) ?? {},
            organizationId: svcCustomer.organization_id ?? null,
          },
        };
      }

      // Final fallback: thử SELECT by auth_user_id (có thể do conflict mà upsert bị skip)
      const { data: byAuth } = await svc
        .from("customers")
        .select(
          "id, full_name, email, phone, tier, loyalty_points, birthday, gender, preferences, avatar_url, organization_id, deleted_at",
        )
        .eq("auth_user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (byAuth) {
        return {
          ...user,
          customerId: byAuth.id,
          customer: {
            id: byAuth.id,
            tier: byAuth.tier ?? "bronze",
            loyaltyPoints: byAuth.loyalty_points ?? 0,
            birthday: byAuth.birthday ?? null,
            gender: byAuth.gender ?? null,
            preferences: (byAuth.preferences as Record<string, unknown>) ?? {},
            organizationId: byAuth.organization_id ?? null,
          },
        };
      }

      // Nếu upsert fail vì email bị unique conflict (đã có customer cũ với email
      // nhưng auth_user_id khác), link auth_user_id vào customer đó.
      if (rpcError == null) {
        const { data: byEmail } = await svc
          .from("customers")
          .select(
            "id, full_name, email, phone, tier, loyalty_points, birthday, gender, preferences, avatar_url, organization_id, deleted_at",
          )
          .eq("email", user.email)
          .is("deleted_at", null)
          .is("auth_user_id", null)
          .maybeSingle();
        if (byEmail) {
          await svc
            .from("customers")
            .update({ auth_user_id: user.id, updated_at: new Date().toISOString() })
            .eq("id", byEmail.id);
          return {
            ...user,
            customerId: byEmail.id,
            customer: {
              id: byEmail.id,
              tier: byEmail.tier ?? "bronze",
              loyaltyPoints: byEmail.loyalty_points ?? 0,
              birthday: byEmail.birthday ?? null,
              gender: byEmail.gender ?? null,
              preferences: (byEmail.preferences as Record<string, unknown>) ?? {},
              organizationId: byEmail.organization_id ?? null,
            },
          };
        }
      }
    } catch (svcErr) {
      console.error("[requireCustomer] service-role fallback failed:", svcErr);
    }
  }

  return user;
}

/**
 * Check xem user hiện tại có phải staff/admin không.
 * Hiện tại dựa trên email domain (internal company) hoặc match env ADMIN_EMAILS.
 * Sau này nên thay bằng cột `role` trong user_profiles (cần migration).
 */
export function isStaffUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (lower.endsWith("@laplap.vn")) return true;
  // Có thể thêm các email admin cứng khác ở đây
  return false;
}

/**
 * Update profile của customer + user_profiles.
 * Bỏ qua nếu chưa login hoặc không tìm thấy customer row.
 */
export async function upsertCustomerProfile(input: {
  fullName?: string;
  phone?: string | null;
  birthday?: string | null;
  gender?: "male" | "female" | "other" | null;
  avatarUrl?: string | null;
  preferences?: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.fullName !== undefined) updatePayload.full_name = input.fullName;
  if (input.phone !== undefined) updatePayload.phone = input.phone;
  if (input.birthday !== undefined) updatePayload.birthday = input.birthday;
  if (input.gender !== undefined) updatePayload.gender = input.gender;
  if (input.avatarUrl !== undefined) updatePayload.avatar_url = input.avatarUrl;
  if (input.preferences !== undefined) updatePayload.preferences = input.preferences;

  const { error: custErr } = await db
    .from("customers")
    .update(updatePayload)
    .eq("auth_user_id", user.id);

  if (custErr) return { ok: false, error: custErr.message ?? "Lỗi cập nhật" };

  // Sync sang user_profiles
  const profilePayload: Record<string, unknown> = {};
  if (input.fullName !== undefined) profilePayload.full_name = input.fullName;
  if (input.phone !== undefined) profilePayload.phone = input.phone;
  if (input.avatarUrl !== undefined) profilePayload.avatar_url = input.avatarUrl;

  if (Object.keys(profilePayload).length > 0) {
    await db.from("user_profiles").update(profilePayload).eq("id", user.id);
  }

  return { ok: true };
}

/**
 * Khi mới đăng nhập/đăng ký, gộp các đơn cũ của guest (cùng email hoặc phone)
 * vào customer_id hiện tại.
 *
 * NOTE: hiện tại KHÔNG thể khớp guest orders theo email/phone vì orders.customer_snapshot
 * column không tồn tại trong schema. Cần migration mới thêm column (vd:
 * `ALTER TABLE orders ADD COLUMN customer_email text` từ order creation flow)
 * thì mới có thể link an toàn.
 *
 * Idempotent — gọi nhiều lần cũng OK. Hiện trả về 0 (no-op) cho đến khi có cột email/phone.
 */
export async function linkGuestOrdersOnLogin(): Promise<number> {
  console.warn(
    "[linkGuestOrdersOnLogin] skipped: orders.customer_snapshot column does not exist. " +
      "Cần migration thêm orders.customer_email + customer_phone từ order-creation flow, " +
      "sau đó mới khớp guest orders ở đây.",
  );
  return 0;
}

/**
 * Soft-delete tài khoản:
 *   - set customers.deleted_at = now()
 *   - set auth.users.banned_until = '2099-...' (vô hiệu hoá login từ phía Supabase Auth)
 *
 * KHÔNG xoá customers row để giữ lịch sử đơn/quan hệ với warranties, repair_tickets...
 */
export async function softDeleteAccount(
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const now = new Date().toISOString();

  // 1) Đóng băng customers + lưu preferences.reason để audit
  const { error: cErr } = await db
    .from("customers")
    .update({
      deleted_at: now,
      preferences: { deleted_reason: reason, deleted_via: "self_service" },
      updated_at: now,
    })
    .eq("auth_user_id", user.id);

  if (cErr) return { ok: false, error: cErr.message ?? "Lỗi khi xoá tài khoản" };

  // 2) Best-effort: signOut session hiện tại.
  await supabase.auth.signOut();

  return { ok: true };
}

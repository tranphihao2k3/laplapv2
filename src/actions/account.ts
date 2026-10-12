"use server";

import { createClient } from "@/lib/supabase/server";
import { linkGuestOrdersOnLogin } from "@/lib/account/customer";

/**
 * Đảm bảo customer + user_profile row tồn tại cho user vừa signup.
 * Gọi public.ensure_customer_for_auth_user() (SECURITY DEFINER) qua RPC.
 *
 * Idempotent — gọi nhiều lần OK. Nếu customer đã có thì không tạo mới.
 * Trả về customer_id (uuid) hoặc null nếu fail.
 */
export async function ensureCustomerExists(
  authUserId: string,
  email: string,
  fullName?: string | null,
  phone?: string | null,
  avatarUrl?: string | null,
): Promise<string | null> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data, error } = await db.rpc("ensure_customer_for_auth_user", {
      p_auth_user_id: authUserId,
      p_email: email,
      p_full_name: fullName ?? null,
      p_phone: phone ?? null,
      p_avatar_url: avatarUrl ?? null,
    });
    if (error) {
      // Không throw — để signin vẫn pass, customer sẽ được backfill sau
      // eslint-disable-next-line no-console
      console.warn("[ensureCustomerExists] rpc error:", error.message);
      return null;
    }
    return data as string | null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[ensureCustomerExists] exception:", err);
    return null;
  }
}

/**
 * Server action — gộp đơn cũ của guest vào customer khi vừa login.
 * An toàn gọi từ client component.
 */
export async function linkGuestOrdersAction(): Promise<{ linked: number }> {
  try {
    const linked = await linkGuestOrdersOnLogin();
    return { linked };
  } catch {
    return { linked: 0 };
  }
}

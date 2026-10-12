/**
 * Helper chuẩn hoá & resolve domain cho multi-shop routing.
 *
 * Tại sao cần file riêng:
 *  - Middleware (Edge runtime) cần logic resolve nhanh, không gọi được Supabase
 *    client thường. Phải dùng `createAdminClient` từ `@/lib/supabase/admin` (Node
 *    runtime). Tách helper ra đây để:
 *      + UI (server components) cùng dùng được
 *      + Validator import được (Edge runtime safe — không có Node-only deps)
 *
 * Quy tắc normalize:
 *  1. Lowercase
 *  2. Bỏ protocol (http://, https://)
 *  3. Bỏ path/query
 *  4. Bỏ port (:3000)
 *  5. Bỏ trailing dot (FQDN canonical form)
 *
 * Không strip "www." ở đây — để middleware tự quyết vì "www." có thể là alias
 * thật hay domain phụ tuỳ ngữ cảnh.
 */

/** Domain hợp lệ sau khi normalize: chỉ gồm a-z, 0-9, dot, dash. */
export const DOMAIN_REGEX = /^[a-z0-9.-]+$/;

/**
 * Chuẩn hoá domain nhập từ user (input validation) hoặc từ Host header.
 * Trả về chuỗi rỗng nếu input không hợp lệ.
 */
export function normalizeDomain(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input).trim().toLowerCase();
  // Bỏ protocol
  s = s.replace(/^https?:\/\//, "");
  // Bỏ path sau dấu "/"
  s = s.split("/")[0] ?? "";
  // Bỏ port (chỉ xét nếu còn lại ít nhất 1 char phía trước)
  s = s.replace(/:(\d+)$/, "");
  // Bỏ trailing dot
  s = s.replace(/\.+$/, "");
  return DOMAIN_REGEX.test(s) ? s : "";
}

/**
 * Tính "host key" — phiên bản host đã strip www. + port + lowercase.
 * Dùng để so khớp với primary_domain trong DB (nơi cũng không chứa www.).
 */
export function hostKeyFromHeader(host: string | null | undefined): string {
  const normalized = normalizeDomain(host);
  return normalized.replace(/^www\./, "");
}

/**
 * Server-side: query Supabase tìm shop theo host key.
 *
 * @param supabase  Admin client (service role) — cần bypass RLS.
 * @param hostKey   Output của `hostKeyFromHeader`.
 * @returns         shopId (uuid string) hoặc null nếu không match.
 *
 * Match rule: primary_domain = hostKey, HOẶC allowed_domains contains hostKey.
 * `allowed_domains.cs.{x}` là toán tử PostgREST "contains element" cho text[].
 */
export async function resolveShopByHostKey(
  supabase: { from: (t: string) => unknown },
  hostKey: string,
): Promise<string | null> {
  if (!hostKey) return null;
  // Cast về any để tránh phụ thuộc kiểu supabase cụ thể — admin client đã
  // typed đầy đủ nhưng helper này được dùng cả ở Edge runtime nên giữ loose.
  const sb = supabase as {
    from: (t: string) => {
      select: (cols: string) => {
        or: (filter: string) => {
          maybeSingle: () => Promise<{ data: { id: string } | null }>;
        };
      };
    };
  };
  // Escape các ký tự đặc biệt trong hostKey (dù đã pass regex ở trên, vẫn
  // phòng trường hợp domain lạ). PostgREST .or() dùng comma làm separator nên
  // cũng cần thay thế nếu có.
  const safeKey = hostKey.replace(/[,"\\]/g, "");
  const { data } = await sb
    .from("shops")
    .select("id")
    .or(`primary_domain.eq.${safeKey},allowed_domains.cs.{${safeKey}}`)
    .maybeSingle();
  return data?.id ?? null;
}

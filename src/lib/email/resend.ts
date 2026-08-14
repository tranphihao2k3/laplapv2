/**
 * Resend client wrapper — dùng HTTP API thẳng, KHÔNG qua `resend` SDK.
 *
 * Tại sao không dùng SDK:
 *   Cloudflare Workers Free plan có giới hạn 3 MiB gzip cho Worker bundle.
 *   `@resend/node` SDK (~500 KB) kéo theo `standardwebhooks` + `postal-mime`
 *   + native polyfills của unenv → tổng ~17 MB uncompressed → vượt 3 MiB gzip.
 *   Dùng fetch() thẳng tới api.resend.com/emails cắt được hết các transitive deps.
 *   Xem commit 7b149ca trong git history.
 *
 * Resend HTTP API rất đơn giản — chỉ một endpoint:
 *   POST https://api.resend.com/emails
 *   Authorization: Bearer <RESEND_API_KEY>
 *   Content-Type: application/json
 *   {
 *     from: "LapLap <noreply@laplapcantho.store>",
 *     to: ["user@example.com"],
 *     subject: "...",
 *     html: "...",
 *     text: "...",         // optional
 *     reply_to: ["..."]    // optional
 *   }
 *   -> 200 { "id": "abc-123" }     // success
 *   -> 4xx/5xx { "message": "..." } // error
 *
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 *
 * Sử dụng:
 *   import { sendEmail } from "@/lib/email/resend";
 *   await sendEmail({ to, subject, html });
 *
 * Cấu hình:
 *   RESEND_API_KEY=re_xxxx        (https://resend.com/api-keys)
 *   RESEND_FROM_EMAIL=LapLap <noreply@laplapcantho.store>
 *
 * Nếu thiếu env -> sendEmail throw với message rõ ràng. Caller (newsletter dispatch)
 * sẽ catch và log + retry sau. KHÔNG silent fail.
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string; // Plain-text fallback (Resend tự sinh nếu thiếu)
  replyTo?: string;
};

export type SendEmailResult = {
  messageId: string; // Resend message ID để track (delivery, bounce)
};

/**
 * Gửi email qua Resend. Throw nếu lỗi (network, 4xx, 5xx).
 * Caller phải catch + retry với backoff.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY chưa cấu hình. Thêm vào .env.local (lấy từ https://resend.com/api-keys).",
    );
  }
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL chưa cấu hình. VD: 'LapLap <noreply@laplapcantho.store>'.",
    );
  }

  const body: Record<string, unknown> = {
    from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
  };
  if (input.text) body.text = input.text;
  if (input.replyTo) body.reply_to = [input.replyTo];

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // Resend trả JSON trong cả success và error.
  const data = (await resp.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!resp.ok) {
    const msg = data?.message ?? `HTTP ${resp.status}`;
    throw new Error(`Resend error: ${msg}`);
  }
  if (!data?.id) {
    throw new Error("Resend: response thiếu message ID");
  }
  return { messageId: data.id };
}

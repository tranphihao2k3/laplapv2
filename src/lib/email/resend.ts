/**
 * Resend client wrapper â€” dÃ¹ng HTTP API tháº³ng, KHÃ”NG qua `resend` SDK.
 *
 * Táº¡i sao khÃ´ng dÃ¹ng SDK:
 *   Cloudflare Workers Free plan cÃ³ giá»›i háº¡n 3 MiB gzip cho Worker bundle.
 *   `@resend/node` SDK (~500 KB) kÃ©o theo `standardwebhooks` + `postal-mime`
 *   + native polyfills cá»§a unenv â†’ tá»•ng ~17 MB uncompressed â†’ vÆ°á»£t 3 MiB gzip.
 *   DÃ¹ng fetch() tháº³ng tá»›i api.resend.com/emails cáº¯t Ä‘Æ°á»£c háº¿t cÃ¡c transitive deps.
 *   Xem commit 7b149ca trong git history.
 *
 * Resend HTTP API ráº¥t Ä‘Æ¡n giáº£n â€” chá»‰ má»™t endpoint:
 *   POST https://api.resend.com/emails
 *   Authorization: Bearer <RESEND_API_KEY>
 *   Content-Type: application/json
 *   {
 *     from: "Laptop ThÃ nh VÃµ <noreply@laplapcantho.store>",
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
 * Sá»­ dá»¥ng:
 *   import { sendEmail } from "@/lib/email/resend";
 *   await sendEmail({ to, subject, html });
 *
 * Cáº¥u hÃ¬nh:
 *   RESEND_API_KEY=re_xxxx        (https://resend.com/api-keys)
 *   RESEND_FROM_EMAIL=Laptop ThÃ nh VÃµ <noreply@laplapcantho.store>
 *
 * Náº¿u thiáº¿u env -> sendEmail throw vá»›i message rÃµ rÃ ng. Caller
 * sáº½ catch vÃ  log + retry sau. KHÃ”NG silent fail.
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string; // Plain-text fallback (Resend tá»± sinh náº¿u thiáº¿u)
  replyTo?: string;
};

export type SendEmailResult = {
  messageId: string; // Resend message ID Ä‘á»ƒ track (delivery, bounce)
};

/**
 * Gá»­i email qua Resend. Throw náº¿u lá»—i (network, 4xx, 5xx).
 * Caller pháº£i catch + retry vá»›i backoff.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY chÆ°a cáº¥u hÃ¬nh. ThÃªm vÃ o .env.local (láº¥y tá»« https://resend.com/api-keys).",
    );
  }
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL chÆ°a cáº¥u hÃ¬nh. VD: 'Laptop ThÃ nh VÃµ <noreply@laplapcantho.store>'.",
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

  // Resend tráº£ JSON trong cáº£ success vÃ  error.
  const data = (await resp.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!resp.ok) {
    const msg = data?.message ?? `HTTP ${resp.status}`;
    throw new Error(`Resend error: ${msg}`);
  }
  if (!data?.id) {
    throw new Error("Resend: response thiáº¿u message ID");
  }
  return { messageId: data.id };
}

/**
 * Resend client wrapper.
 *
 * Resend la email service hien dai, co free tier 100 email/ngay + 3000/thang
 * (https://resend.com/pricing). API don gian: POST /v1/emails voi From/To/Subject/HTML.
 *
 * Su dung:
 *   import { sendEmail } from "@/lib/email/resend";
 *   await sendEmail({ to, subject, html });
 *
 * Cau hinh:
 *   RESEND_API_KEY=re_xxxx        (https://resend.com/api-keys)
 *   RESEND_FROM_EMAIL=LapLap <noreply@laplapcantho.store>
 *
 * Neu thieu env -> sendEmail throw voi message ro rang. Caller (newsletter dispatch)
 * se catch va log + retry sau. KHONG silent fail.
 */
import { Resend } from "resend";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string; // Plain-text fallback (Resend tu sinh neu thieu)
  replyTo?: string;
};

export type SendEmailResult = {
  messageId: string; // Resend message ID de track (delivery, bounce)
};

let _client: Resend | null = null;

function getClient(): Resend {
  if (!_client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        "RESEND_API_KEY chưa cấu hình. Thêm vào .env.local (lấy từ https://resend.com/api-keys).",
      );
    }
    _client = new Resend(key);
  }
  return _client;
}

function getFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL chưa cấu hình. VD: 'LapLap <noreply@laplapcantho.store>'.",
    );
  }
  return from;
}

/**
 * Gui email qua Resend. Throw neu loi (network, 4xx, 5xx).
 * Caller phai catch + retry voi backoff.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getClient();
  const from = getFromAddress();

  const resp = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });

  if (resp.error) {
    throw new Error(`Resend error: ${resp.error.message ?? "unknown"}`);
  }
  if (!resp.data?.id) {
    throw new Error("Resend: response thiếu message ID");
  }
  return { messageId: resp.data.id };
}

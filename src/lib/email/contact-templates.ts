/**
 * Email template cho form Liên hệ (thông báo nội bộ cho CSKH).
 * Gửi tới email shop + email người quản lý nội dung.
 */
const BRAND_NAME = "LapLap - Laptop Cần Thơ";
const BRAND_COLOR = "#0f172a";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderContactNotification(opts: {
  full_name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  ip_address: string | null;
  received_at: string; // ISO
}): { subject: string; html: string; text: string } {
  const subject = `[Liên hệ] ${opts.subject || "Tin nhắn mới"} - ${opts.full_name}`;

  const rows = [
    ["Họ tên", escapeHtml(opts.full_name)],
    ["Email", `<a href="mailto:${escapeHtml(opts.email)}">${escapeHtml(opts.email)}</a>`],
    [
      "Số điện thoại",
      opts.phone
        ? `<a href="tel:${escapeHtml(opts.phone.replace(/[^\d+]/g, ""))}">${escapeHtml(opts.phone)}</a>`
        : "<em>—</em>",
    ],
    ["Tiêu đề", escapeHtml(opts.subject || "—")],
    ["IP", escapeHtml(opts.ip_address || "—")],
    ["Thời gian", escapeHtml(opts.received_at)],
  ];

  const infoTable = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;background-color:#f8fafc;font-weight:600;width:140px;color:#475569;border-bottom:1px solid #e2e8f0;">
            ${label}
          </td>
          <td style="padding:8px 12px;color:#0f172a;border-bottom:1px solid #e2e8f0;">
            ${value}
          </td>
        </tr>`,
    )
    .join("");

  const body = `
    <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:${BRAND_COLOR};">
      📩 Có liên hệ mới từ website
    </h2>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#334155;">
      Một khách hàng vừa gửi tin nhắn qua form Liên hệ. Vui lòng phản hồi trong vòng 24 giờ làm việc.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;border-collapse:separate;border-spacing:0;">
      ${infoTable}
    </table>
    <h3 style="margin:20px 0 8px 0;font-size:14px;font-weight:600;color:${BRAND_COLOR};">
      Nội dung
    </h3>
    <div style="padding:16px;background-color:#f8fafc;border-left:4px solid #2563eb;border-radius:4px;font-size:15px;line-height:1.6;color:#0f172a;white-space:pre-wrap;">${escapeHtml(opts.message)}</div>
    <p style="margin:20px 0 0 0;font-size:13px;color:#64748b;">
      Trả lời trực tiếp email này để gửi phản hồi cho khách.
    </p>
  `;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f8fafc;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <tr>
        <td style="background-color:${BRAND_COLOR};padding:20px 32px;text-align:center;">
          <h1 style="margin:0;font-size:18px;font-weight:600;color:#ffffff;">${escapeHtml(BRAND_NAME)}</h1>
        </td>
      </tr>
      <tr><td style="padding:32px;">${body}</td></tr>
      <tr>
        <td style="background-color:#f1f5f9;padding:16px 32px;text-align:center;font-size:12px;color:#64748b;">
          Email nội bộ — gửi tự động từ form Liên hệ trên website.
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text =
    `[Liên hệ mới] ${opts.full_name}\n\n` +
    `Email: ${opts.email}\n` +
    `SĐT: ${opts.phone ?? "—"}\n` +
    `Tiêu đề: ${opts.subject ?? "—"}\n` +
    `IP: ${opts.ip_address ?? "—"}\n` +
    `Thời gian: ${opts.received_at}\n\n` +
    `Nội dung:\n${opts.message}\n\n` +
    `--\nEmail nội bộ — ${BRAND_NAME}`;

  return { subject, html, text };
}
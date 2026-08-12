/**
 * Email templates cho Newsletter.
 *
 * 3 loai email:
 *   1. confirm   - gui khi moi dang ky (double opt-in)
 *   2. productAlert - thong bao san pham moi (trigger tu DB)
 *   3. unsubscribeConfirmation - xac nhan da huy dang ky
 *
 * Tat ca deu la HTML inline (khong dung MUI/CSS framework) vi Resend render
 * HTML truc tiep vao Gmail/Outlook. Inline styles + table layout cho
 * compatibility tot nhat.
 *
 * Branding: dung ten thuong hieu "LapLap - Laptop Can Tho".
 */

const BRAND_NAME = "LapLap - Laptop Cần Thơ";
const BRAND_COLOR = "#0f172a"; // slate-900 (match website)

// Helper: escape HTML entity de tranh XSS khi chen data dong (vd: product name).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Helper: format gia VND.
const fmtVnd = (n: number | null | undefined) =>
  n == null ? "Liên hệ" : `${new Intl.NumberFormat("vi-VN").format(n)} đ`;

/**
 * Layout chung cho moi email. Wrap content trong 1 table 600px (chuẩn email).
 */
function emailLayout(opts: { title: string; body: string; preheader?: string }): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
<span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader ?? "")}</span>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f8fafc;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <!-- Header -->
        <tr>
          <td style="background-color:${BRAND_COLOR};padding:24px 32px;text-align:center;">
            <h1 style="margin:0;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:-0.01em;">
              ${escapeHtml(BRAND_NAME)}
            </h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${opts.body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#f1f5f9;padding:20px 32px;text-align:center;font-size:12px;color:#64748b;">
            <p style="margin:0 0 8px 0;">Bạn nhận email này vì đã đăng ký nhận thông báo từ ${escapeHtml(BRAND_NAME)}.</p>
            {{UNSUBSCRIBE_LINK}}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * Thay {{UNSUBSCRIBE_LINK}} placeholder thanh link unsubscribe that (hoac an link).
 * Tra ve HTML string.
 */
function injectUnsubscribeLink(html: string, unsubscribeUrl: string | null): string {
  if (unsubscribeUrl) {
    const linkHtml = `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">Hủy đăng ký</a>`;
    return html.replace("{{UNSUBSCRIBE_LINK}}", linkHtml);
  }
  return html.replace("{{UNSUBSCRIBE_LINK}}", "");
}

/**
 * (1) Email xac nhan dang ky (double opt-in).
 * User bam link trong email nay -> confirmed=true -> bat dau nhan thong bao.
 */
export function renderConfirmEmail(opts: {
  email: string;
  confirmUrl: string;
  brandNames: string[]; // ten cac brand user da chon (empty = all)
}): { subject: string; html: string; text: string } {
  const subject = `Xác nhận đăng ký nhận thông báo - ${BRAND_NAME}`;
  const scope =
    opts.brandNames.length === 0
      ? `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#334155;">
           Bạn sẽ nhận thông báo mỗi khi có <strong>sản phẩm mới</strong> trên cửa hàng.
         </p>`
      : `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#334155;">
           Bạn sẽ nhận thông báo khi có sản phẩm mới thuộc các hãng:
           <strong>${escapeHtml(opts.brandNames.join(", "))}</strong>.
         </p>`;
  const body = `
    <h2 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:${BRAND_COLOR};">
      Xác nhận đăng ký
    </h2>
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#334155;">
      Xin chào, bạn (hoặc ai đó dùng email <strong>${escapeHtml(opts.email)}</strong>) vừa đăng ký nhận thông báo sản phẩm mới từ ${escapeHtml(BRAND_NAME)}.
    </p>
    ${scope}
    <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;color:#334155;">
      Vui lòng bấm nút bên dưới để <strong>xác nhận đăng ký</strong>:
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
      <tr>
        <td style="border-radius:8px;background-color:${BRAND_COLOR};">
          <a href="${escapeHtml(opts.confirmUrl)}" target="_blank"
             style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
            Xác nhận đăng ký
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0 0;font-size:13px;line-height:1.5;color:#64748b;">
      Nếu không phải bạn đăng ký, vui lòng bỏ qua email này — địa chỉ của bạn sẽ không được dùng để gửi thông báo.
    </p>
  `;
  const html = emailLayout({ title: subject, body });
  const text = `${BRAND_NAME} - Xác nhận đăng ký\n\nBấm link sau để xác nhận:\n${opts.confirmUrl}`;
  return { subject, html, text };
}

/**
 * (2) Email thong bao san pham moi.
 * Day la email chinh - user nhan khi admin dang san pham moi.
 */
export function renderProductAlertEmail(opts: {
  productName: string;
  productUrl: string;
  brandName: string | null;
  price: number | null;
  thumbnailUrl: string | null;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `Mới: ${opts.productName}${opts.brandName ? ` (${opts.brandName})` : ""} - ${BRAND_NAME}`;
  const priceHtml =
    opts.price != null
      ? `<p style="margin:0;font-size:24px;font-weight:700;color:${BRAND_COLOR};">
           ${escapeHtml(fmtVnd(opts.price))}
         </p>`
      : `<p style="margin:0;font-size:14px;color:#64748b;">Liên hệ để biết giá</p>`;
  const imgHtml = opts.thumbnailUrl
    ? `<img src="${escapeHtml(opts.thumbnailUrl)}" alt="${escapeHtml(opts.productName)}"
         width="240" style="display:block;width:100%;max-width:240px;height:auto;border-radius:8px;margin:0 auto 20px auto;">`
    : "";
  const body = `
    <h2 style="margin:0 0 8px 0;font-size:14px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">
      Sản phẩm mới vừa về
    </h2>
    ${opts.brandName ? `<p style="margin:0 0 4px 0;font-size:13px;font-weight:500;color:#64748b;">${escapeHtml(opts.brandName)}</p>` : ""}
    <h3 style="margin:0 0 20px 0;font-size:22px;font-weight:600;color:${BRAND_COLOR};line-height:1.3;">
      ${escapeHtml(opts.productName)}
    </h3>
    ${imgHtml}
    ${priceHtml}
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto 0 auto;">
      <tr>
        <td style="border-radius:8px;background-color:${BRAND_COLOR};">
          <a href="${escapeHtml(opts.productUrl)}" target="_blank"
             style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
            Xem chi tiết
          </a>
        </td>
      </tr>
    </table>
  `;
  const html = injectUnsubscribeLink(
    emailLayout({ title: subject, body }),
    opts.unsubscribeUrl,
  );
  const text =
    `${BRAND_NAME}\n\n` +
    `${opts.brandName ? opts.brandName + "\n" : ""}` +
    `${opts.productName}\n` +
    `${fmtVnd(opts.price)}\n\n` +
    `Xem chi tiết: ${opts.productUrl}\n\n` +
    `Hủy đăng ký: ${opts.unsubscribeUrl}`;
  return { subject, html, text };
}

/**
 * (3) Email xac nhan da unsubscribe (optional nhung tot UX).
 */
export function renderUnsubscribeConfirmEmail(): { subject: string; html: string; text: string } {
  const subject = `Đã hủy đăng ký nhận thông báo - ${BRAND_NAME}`;
  const body = `
    <h2 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:${BRAND_COLOR};">
      Đã hủy đăng ký
    </h2>
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#334155;">
      Bạn đã hủy đăng ký nhận thông báo sản phẩm mới từ ${escapeHtml(BRAND_NAME)}.
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#64748b;">
      Nếu đây là nhầm lẫn, bạn có thể đăng ký lại bất kỳ lúc nào tại trang chủ.
    </p>
  `;
  const html = emailLayout({ title: subject, body }); // unsubscribe link khong can o day
  const text = `Đã hủy đăng ký nhận thông báo từ ${BRAND_NAME}.`;
  return { subject, html, text };
}

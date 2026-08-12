// Smoke test gui email that voi Resend API key.
// Chay: npx tsx scripts/test-resend-send.ts
import { sendEmail } from "../src/lib/email/resend";
import { renderConfirmEmail, renderProductAlertEmail } from "../src/lib/email/templates";

const TEST_EMAIL = process.argv[2] ?? "test@example.com";

async function main() {
  console.log(`Sending test email to: ${TEST_EMAIL}\n`);

  // Test 1: confirm email
  console.log("[1] Sending confirm email...");
  try {
    const { subject, html, text } = renderConfirmEmail({
      email: TEST_EMAIL,
      confirmUrl: "https://laplapcantho.store/api/v1/newsletter/confirm?token=test123",
      brandNames: ["Dell", "HP", "Lenovo"],
    });
    const r = await sendEmail({ to: TEST_EMAIL, subject, html, text });
    console.log(`  OK messageId: ${r.messageId}\n`);
  } catch (e) {
    console.error(`  FAIL: ${e instanceof Error ? e.message : e}\n`);
  }

  // Test 2: product alert email
  console.log("[2] Sending product alert email...");
  try {
    const { subject, html, text } = renderProductAlertEmail({
      productName: "Dell XPS 13 Plus (TEST - sẽ tự xoá)",
      productUrl: "https://laplapcantho.store/products/dell-xps-13",
      brandName: "Dell",
      price: 25000000,
      thumbnailUrl: null,
      unsubscribeUrl: "https://laplapcantho.store/api/v1/newsletter/unsubscribe?token=fake",
    });
    const r = await sendEmail({ to: TEST_EMAIL, subject, html, text });
    console.log(`  OK messageId: ${r.messageId}\n`);
  } catch (e) {
    console.error(`  FAIL: ${e instanceof Error ? e.message : e}\n`);
  }

  console.log("Done. Check inbox của:", TEST_EMAIL);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
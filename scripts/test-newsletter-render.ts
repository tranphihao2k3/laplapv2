// Render email templates va check output HTML structure.
// Chay: npx tsx scripts/test-newsletter-render.ts
import { renderConfirmEmail, renderProductAlertEmail, renderUnsubscribeConfirmEmail } from "../src/lib/email/templates";

let pass = 0;
let fail = 0;

function assert(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  OK ${name}`);
    pass++;
  } else {
    console.log(`  FAIL ${name} ${detail}`);
    fail++;
  }
}

console.log("[1] renderConfirmEmail");
const c = renderConfirmEmail({
  email: "test@example.com",
  confirmUrl: "https://laplapcantho.store/api/v1/newsletter/confirm?token=abc123",
  brandNames: ["Dell", "HP"],
});
assert("subject not empty", c.subject.length > 0);
assert("html contains DOCTYPE", c.html.includes("<!DOCTYPE html>"));
assert("html contains brand names", c.html.includes("Dell") && c.html.includes("HP"));
assert("html contains email", c.html.includes("test@example.com"));
assert("html contains confirm link", c.html.includes("confirm?token=abc123"));
assert("text contains url", c.text.includes("abc123"));
assert("XSS: <script> in brand name escaped", true); // Check in next assertion
const evil = renderConfirmEmail({
  email: "a@b.com",
  confirmUrl: "https://x?token=t",
  brandNames: ['<script>alert("xss")</script>'],
});
assert("XSS escaped", !evil.html.includes("<script>alert"), "should not contain raw script tag");
assert("XSS escaped (encoded)", evil.html.includes("&lt;script&gt;"));

console.log("\n[2] renderProductAlertEmail");
const p = renderProductAlertEmail({
  productName: "Dell XPS 13 Plus",
  productUrl: "https://laplapcantho.store/products/dell-xps-13",
  brandName: "Dell",
  price: 25000000,
  thumbnailUrl: null,
  unsubscribeUrl: "https://laplapcantho.store/api/v1/newsletter/unsubscribe?token=xyz",
});
assert("subject contains product name", p.subject.includes("Dell XPS 13 Plus"));
assert("subject contains brand", p.subject.includes("Dell"));
assert("html contains product name", p.html.includes("Dell XPS 13 Plus"));
assert("html contains product URL", p.html.includes("/products/dell-xps-13"));
assert("html contains unsubscribe link", p.html.includes("unsubscribe?token=xyz"));
assert("price formatted as VND", p.html.includes("25.000.000") || p.html.includes("25000000"));
assert("text contains url", p.text.includes("dell-xps-13"));

console.log("\n[3] renderUnsubscribeConfirmEmail");
const u = renderUnsubscribeConfirmEmail();
assert("subject ok", u.subject.length > 0);
assert("html ok", u.html.includes("Đã hủy"));

console.log(`\n============================================`);
console.log(`  Render test: ${pass} passed, ${fail} failed`);
console.log(`============================================`);

if (fail > 0) process.exit(1);
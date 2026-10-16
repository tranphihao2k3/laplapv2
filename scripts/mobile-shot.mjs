import { chromium, devices } from 'playwright';

const url = 'http://localhost:3000/quanly';
const out = 'C:/Users/admin/AppData/Local/Temp/cursor/screenshots/admin-sidebar.png';
const email = process.argv[4] ?? 'admin@laplap.vn';
const password = process.argv[5] ?? 'admin123456';

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone X'],
  deviceScaleFactor: 2,
  viewport: { width: 375, height: 812 },
});
const page = await context.newPage();
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.fill('input[type="email"], input[name="email"]', email);
await page.fill('input[type="password"], input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

const finalUrl = page.url();
console.log('After login, URL:', finalUrl);

if (!finalUrl.includes('/quanly')) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
}

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const trigger = page.locator('[data-sidebar="trigger"]').first();
const triggerCount = await trigger.count();
console.log('Sidebar trigger count:', triggerCount);
if (triggerCount > 0) {
  await trigger.click();
  await page.waitForTimeout(600);
}

await page.screenshot({ path: out });
console.log('Saved', out);
await browser.close();

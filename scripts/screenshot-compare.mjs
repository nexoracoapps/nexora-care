import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

await page.goto('http://localhost:6001/login');
await page.waitForTimeout(1000);
await page.fill('input[type="text"]', 'admin');
await page.fill('input[type="password"]', 'admin123');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

await page.goto('http://localhost:6001/users');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'scripts/screenshot-users.png', fullPage: false });

await page.goto('http://localhost:6001/roles');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'scripts/screenshot-roles.png', fullPage: false });

console.log('Done');
await browser.close();

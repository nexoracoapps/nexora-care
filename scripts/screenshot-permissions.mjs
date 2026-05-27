import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// Login
await page.goto('http://localhost:6001/login');
await page.waitForTimeout(1000);
await page.fill('input[type="text"]', 'admin');
await page.fill('input[type="password"]', 'admin123');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

// Go to permissions
await page.goto('http://localhost:6001/permissions');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'scripts/screenshot-permissions.png', fullPage: true });

console.log('Screenshot saved to scripts/screenshot-permissions.png');
await browser.close();

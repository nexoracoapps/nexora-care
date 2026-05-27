import { chromium } from 'playwright';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNtcGp2NWZjbTAwMDFjeHpnazNodDV5dDAiLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6IkFETUlOIiwiYnJhbmNoSWQiOiJicmFuY2gtMSIsImlhdCI6MTc3OTY5ODY5NiwiZXhwIjoxNzc5Nzg1MDk2fQ.56acNbAICmtq9jUffZ28QKyalFM7NJxry4PiHkctQWE';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setViewportSize({ width: 1280, height: 900 });

// Inject auth into localStorage
await page.goto('http://localhost:6001/login');
await page.waitForTimeout(1000);
await page.evaluate((token) => {
  const userData = JSON.stringify({
    token,
    id: 'cmpjv5fcm0001cxzgk3ht5yt0',
    username: 'admin',
    role: 'ADMIN',
    branchId: 'branch-1',
    branchName: 'Downtown Wellness Center',
    email: 'admin@nexoracare.com',
  });
  localStorage.setItem('nexora-user', userData);
}, TOKEN);

// Roles page — wait for actual role cards to appear (up to 20s for Neon cold start)
await page.goto('http://localhost:6001/roles');
try {
  await page.waitForSelector('.page-title', { timeout: 20000 });
  await page.waitForTimeout(1500);
} catch { await page.waitForTimeout(3000); }
await page.screenshot({ path: 'scripts/ss-roles.png' });
console.log('roles done');

// Permissions page — wait for .pm-role-card confirming new gradient card design loaded
await page.goto('http://localhost:6001/permissions');
try {
  await page.waitForSelector('.pm-role-card', { timeout: 20000 });
  await page.waitForTimeout(1200);
} catch { await page.waitForTimeout(8000); }
await page.screenshot({ path: 'scripts/ss-perms.png' });
console.log('perms done');

// Welcome
await page.goto('http://localhost:6001/welcome');
try {
  await page.waitForSelector('img', { timeout: 15000 });
  await page.waitForTimeout(1500);
} catch { await page.waitForTimeout(5000); }
await page.screenshot({ path: 'scripts/ss-welcome.png', fullPage: true });
console.log('welcome done');

await browser.close();

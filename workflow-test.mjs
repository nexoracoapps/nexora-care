import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';

// Override with: BASE_URL=https://nexora-care-nu.vercel.app node workflow-test.mjs
const BASE   = process.env.BASE_URL ?? 'http://localhost:6001';
const SS_DIR = 'workflow-screenshots';
mkdirSync(SS_DIR, { recursive: true });

let step = 0;
async function ss(page, name) {
  step++;
  const file = `${SS_DIR}/${String(step).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${file}`);
}

// Navigate and wait for the page to settle
async function go(page, path, wait = 1500) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(wait);
}

// Wait for a toast message (react-hot-toast renders in a portal)
async function waitForToast(page, timeout = 4000) {
  try {
    await page.waitForSelector(
      '[class*="go2"], [class*="toast"], [class*="Toaster"]',
      { timeout, state: 'visible' }
    );
    return true;
  } catch { return false; }
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', () => {});
  const results = [];

  try {
    // ── 1. Login ─────────────────────────────────────────────────
    console.log('\n[1] Login...');
    await go(page, '/login', 500);
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    // Wait up to 25 s; cold dev server can be slow on first compile
    await page.waitForURL('**/dashboard', { timeout: 25000 }).catch(() => {});
    // If still on login, navigate directly — auth token is already saved
    if (page.url().includes('/login')) await go(page, '/dashboard', 2000);
    else                                await page.waitForTimeout(1500);
    await ss(page, 'login');
    const loginOk = !page.url().includes('/login');
    results.push({ step: 'Login → /dashboard', ok: loginOk, detail: page.url() });

    // ── 2. Dashboard ─────────────────────────────────────────────
    console.log('\n[2] Dashboard...');
    await ss(page, 'dashboard');
    results.push({ step: 'Dashboard loads', ok: !page.url().includes('login'), detail: page.url() });

    // ── 3. Sidebar nav links ──────────────────────────────────────
    console.log('\n[3] Sidebar nav...');
    const medNav  = await page.locator('a[href="/medicines"]').first().isVisible().catch(() => false);
    const rxNav   = await page.locator('a[href="/prescriptions"]').first().isVisible().catch(() => false);
    const calNav  = await page.locator('a[href="/calendar"]').first().isVisible().catch(() => false);
    results.push({ step: 'Medicines nav link',     ok: medNav,  detail: medNav  ? 'visible' : 'NOT found' });
    results.push({ step: 'Prescriptions nav link', ok: rxNav,   detail: rxNav   ? 'visible' : 'NOT found' });
    results.push({ step: 'Calendar nav link',      ok: calNav,  detail: calNav  ? 'visible' : 'NOT found' });

    // ── 4. Medicines page ─────────────────────────────────────────
    console.log('\n[4] Medicines page...');
    await go(page, '/medicines', 1500);
    await ss(page, 'medicines-page');
    results.push({ step: 'Medicines page loads', ok: !page.url().includes('login'), detail: page.url() });

    // ── 5. Add medicine ───────────────────────────────────────────
    console.log('\n[5] Add medicine...');
    await page.locator('button', { hasText: /add medicine/i }).first().click();
    await page.waitForTimeout(700);
    // Name field — placeholder "e.g. Amoxicillin"
    await page.locator('input[placeholder*="Amoxicillin"]').fill('Workflow Test Med');
    // Category chip
    await page.locator('button', { hasText: 'Pain Relief' }).first().click().catch(() => {});
    // Dosage — placeholder "e.g. 250mg, 500mg..."
    await page.locator('input[placeholder*="250mg"]').fill('500mg');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await ss(page, 'add-medicine-modal');
    // Save — the primary button in the modal footer
    await page.locator('.modal-footer .btn-primary').last().click();
    await page.waitForTimeout(2000);
    await ss(page, 'add-medicine-saved');
    const medSaved = await page.locator('text=Workflow Test Med').first().isVisible().catch(() => false);
    const medToast = await waitForToast(page, 2000);
    results.push({ step: 'Add medicine', ok: medSaved || medToast, detail: medSaved ? 'card visible' : medToast ? 'toast shown' : 'not found' });

    // ── 6. Prescriptions page ─────────────────────────────────────
    console.log('\n[6] Prescriptions page...');
    await go(page, '/prescriptions', 1500);
    await ss(page, 'prescriptions-page');
    results.push({ step: 'Prescriptions page loads', ok: !page.url().includes('login'), detail: page.url() });

    // ── 7. Create prescription ────────────────────────────────────
    console.log('\n[7] Create prescription...');
    await page.locator('button', { hasText: /new prescription|\+ new|\+/i }).first().click();
    await page.waitForTimeout(1000);
    // Customer select
    const custOpts = await page.locator('select').first().locator('option').count().catch(() => 0);
    if (custOpts > 1) {
      await page.locator('select').first().selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }
    // Pick any medicine chip
    await page.locator('text=Workflow Test Med').first().click().catch(async () => {
      await page.locator('input[type="checkbox"]').first().click().catch(() => {});
    });
    await page.waitForTimeout(400);
    await ss(page, 'create-prescription-modal');
    await page.locator('button', { hasText: /save|إنشاء|create/i }).last().click();
    await page.waitForTimeout(500);
    const rxToast = await waitForToast(page, 3000);
    await page.waitForTimeout(1000);
    await ss(page, 'prescription-saved');
    results.push({ step: 'Create prescription', ok: rxToast, detail: rxToast ? 'toast shown' : 'no toast (may need a customer in DB)' });

    // ── 8. Appointments page ──────────────────────────────────────
    console.log('\n[8] Appointments...');
    await go(page, '/appointments', 1500);
    await ss(page, 'appointments-page');
    results.push({ step: 'Appointments page loads', ok: !page.url().includes('login'), detail: page.url() });

    // ── 9. Customers — ••• menu → History popup ───────────────────
    console.log('\n[9] Customer history...');
    await go(page, '/customers', 1500);
    await ss(page, 'customers-page');
    // Open the first customer's ••• dropdown
    const dotsBtn = page.locator('button.btn-ghost.btn-sm', { hasText: '•••' }).first();
    await dotsBtn.click({ timeout: 10000 });
    await page.waitForTimeout(600);
    // Click History inside the dropdown
    await page.locator('text=/history/i').first().click({ timeout: 8000 });
    await page.waitForTimeout(1200);
    await ss(page, 'customer-history-popup');
    const historyOpen = await page.locator('text=/appointments|prescriptions/i').first().isVisible().catch(() => false);
    // Switch to Prescriptions tab
    await page.locator('button', { hasText: /prescriptions/i }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await ss(page, 'customer-history-prescriptions-tab');
    results.push({ step: 'Customer history popup', ok: historyOpen, detail: historyOpen ? 'popup opened' : 'popup not found' });

    // ── 10. Calendar ──────────────────────────────────────────────
    console.log('\n[10] Calendar...');
    await go(page, '/calendar', 2500);
    await ss(page, 'calendar-page');
    const calOk = !page.url().includes('login');
    // Refresh button: try title attr first, then emoji text, then any button in the page header area
    let hasRefresh = await page.locator('[title="Refresh calendar"]').first().isVisible().catch(() => false);
    if (!hasRefresh) hasRefresh = await page.locator('[title="تحديث البيانات"]').first().isVisible().catch(() => false);
    if (!hasRefresh) {
      // Count all buttons and log for debug
      const btns = await page.locator('button').count();
      console.log(`    debug: ${btns} buttons on calendar page`);
      hasRefresh = await page.locator('button').filter({ hasText: '🔄' }).first().isVisible().catch(() => false);
    }
    results.push({ step: 'Calendar page loads',     ok: calOk,      detail: page.url() });
    results.push({ step: 'Calendar refresh button', ok: hasRefresh, detail: hasRefresh ? 'visible' : 'NOT found — check if deploy has latest changes' });

    // ── 11. Permissions ───────────────────────────────────────────
    console.log('\n[11] Permissions...');
    await go(page, '/permissions', 500);
    // Wait for permission groups to load (they require API calls)
    await page.waitForSelector('.glass-card, [class*="perm"], table, .page-title', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await ss(page, 'permissions-page');
    const hasMed    = await page.locator('text=/medicines/i').first().isVisible().catch(() => false);
    const hasRx     = await page.locator('text=/prescriptions/i').first().isVisible().catch(() => false);
    const hasAlways = await page.locator('text=/always/i').first().isVisible().catch(() => false);
    if (!hasMed) {
      const bodyText = (await page.textContent('body').catch(() => '')).slice(0, 200);
      console.log('    debug perms body:', bodyText);
    }
    results.push({ step: 'Permissions — Medicines group',      ok: hasMed,    detail: hasMed    ? 'visible' : 'NOT found' });
    results.push({ step: 'Permissions — Prescriptions group',  ok: hasRx,     detail: hasRx     ? 'visible' : 'NOT found' });
    results.push({ step: 'Permissions — Always badge (ADMIN)', ok: hasAlways, detail: hasAlways ? 'visible' : 'NOT found' });

  } catch (e) {
    console.error('\nUnhandled error:', e.message);
    await ss(page, 'error-state').catch(() => {});
    results.push({ step: 'EXCEPTION', ok: false, detail: e.message });
  }

  await browser.close();

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(62));
  console.log('WORKFLOW TEST RESULTS  —  ' + BASE);
  console.log('═'.repeat(62));
  let passed = 0, failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.step} — ${r.detail}`);
    r.ok ? passed++ : failed++;
  }
  console.log('─'.repeat(62));
  console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${results.length}`);
  console.log('═'.repeat(62));
  writeFileSync(`${SS_DIR}/results.json`, JSON.stringify(results, null, 2));
}

run().catch(console.error);

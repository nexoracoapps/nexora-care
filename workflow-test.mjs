import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'https://nexora-care-nu.vercel.app';
const SS_DIR = 'workflow-screenshots';
mkdirSync(SS_DIR, { recursive: true });

let step = 0;
async function ss(page, name) {
  step++;
  const file = `${SS_DIR}/${String(step).padStart(2,'0')}-${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸 ${file}`);
  return file;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const results = [];

  try {
    // ── 1. Login ──
    console.log('\n[1] Login...');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="text"], input[name="username"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
    const loginUrl = page.url();
    await ss(page, 'login-success');
    results.push({ step: 'Login', ok: loginUrl.includes('dashboard'), detail: loginUrl });

    // ── 2. Dashboard ──
    console.log('\n[2] Dashboard...');
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    const dashTitle = await page.title();
    await ss(page, 'dashboard');
    results.push({ step: 'Dashboard', ok: !page.url().includes('login'), detail: dashTitle });

    // ── 3. Navbar — Medicines link ──
    console.log('\n[3] Navbar medicines link...');
    const medNavLink = await page.locator('a[href="/medicines"]').first().isVisible().catch(() => false);
    results.push({ step: 'Navbar medicines link', ok: medNavLink, detail: medNavLink ? 'visible' : 'NOT found' });

    // ── 4. Medicines page ──
    console.log('\n[4] Medicines page...');
    await page.goto(`${BASE}/medicines`, { waitUntil: 'networkidle' });
    await ss(page, 'medicines-page');
    const medPageOk = !page.url().includes('login');
    results.push({ step: 'Medicines page loads', ok: medPageOk, detail: page.url() });

    // ── 5. Add medicine ──
    console.log('\n[5] Add medicine...');
    const addBtn = page.locator('button', { hasText: /add medicine|new medicine|\+/i }).first();
    await addBtn.click();
    await page.waitForTimeout(600);
    await page.fill('input[placeholder*="Paracetamol"], input[placeholder*="name"], input[placeholder*="Name"]', 'Paracetamol Test').catch(async () => {
      // try first text input in modal
      const inputs = page.locator('.modal input[type="text"], .modal-body input[type="text"]');
      await inputs.first().fill('Paracetamol Test');
    });
    // category — look for Analgesic chip or type in custom field
    await page.locator('button', { hasText: /analgesic/i }).first().click().catch(async () => {
      await page.locator('input[placeholder*="category"], input[placeholder*="Category"]').first().fill('Analgesic').catch(() => {});
    });
    // dosage input
    await page.locator('input[placeholder*="dosage"], input[placeholder*="Dosage"], input[placeholder*="500"]').first().fill('500mg').catch(() => {});
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await ss(page, 'add-medicine-modal');
    // save
    await page.locator('button', { hasText: /save|add medicine/i }).first().click();
    await page.waitForTimeout(1500);
    await ss(page, 'add-medicine-saved');
    const medSaved = await page.locator('text=Paracetamol Test').first().isVisible().catch(() => false);
    const toastOk = await page.locator('text=/saved|added|success/i').first().isVisible().catch(() => false);
    results.push({ step: 'Add medicine', ok: medSaved || toastOk, detail: medSaved ? 'card visible' : toastOk ? 'toast shown' : 'not found' });

    // ── 6. Prescriptions page ──
    console.log('\n[6] Prescriptions page...');
    await page.goto(`${BASE}/prescriptions`, { waitUntil: 'networkidle' });
    await ss(page, 'prescriptions-page');
    results.push({ step: 'Prescriptions page loads', ok: !page.url().includes('login'), detail: page.url() });

    // ── 7. Create prescription ──
    console.log('\n[7] Create prescription...');
    const createBtn = page.locator('button', { hasText: /new prescription|create|\+/i }).first();
    await createBtn.click();
    await page.waitForTimeout(800);
    // pick customer
    const custSelect = page.locator('select, [role="combobox"]').first();
    await custSelect.selectOption({ index: 1 }).catch(async () => {
      await page.locator('select').first().selectOption({ index: 1 });
    });
    await page.waitForTimeout(400);
    // pick medicine — click Paracetamol Test checkbox
    await page.locator('text=Paracetamol Test').first().click().catch(async () => {
      // try any checkbox in medicine list
      await page.locator('input[type="checkbox"]').first().click().catch(() => {});
    });
    await page.waitForTimeout(300);
    await ss(page, 'create-prescription-modal');
    await page.locator('button', { hasText: /save prescription|save/i }).first().click();
    await page.waitForTimeout(1500);
    await ss(page, 'prescription-saved');
    const rxSaved = await page.locator('text=/prescription saved|saved/i').first().isVisible().catch(() => false);
    results.push({ step: 'Create prescription', ok: rxSaved, detail: rxSaved ? 'toast shown' : 'no toast visible' });

    // ── 8. Appointments page ──
    console.log('\n[8] Appointments...');
    await page.goto(`${BASE}/appointments`, { waitUntil: 'networkidle' });
    await ss(page, 'appointments-page');
    const apptCount = await page.locator('.appointment-card, tr[data-id], [class*="card"]').count();
    results.push({ step: 'Appointments page loads', ok: !page.url().includes('login'), detail: `${apptCount} items visible` });

    // ── 9. Customers — history popup ──
    console.log('\n[9] Customer history...');
    await page.goto(`${BASE}/customers`, { waitUntil: 'networkidle' });
    await ss(page, 'customers-page');
    // click first History button
    await page.locator('button', { hasText: /history/i }).first().click();
    await page.waitForTimeout(1000);
    await ss(page, 'customer-history-popup');
    const historyOpen = await page.locator('text=/appointments|prescriptions/i').first().isVisible().catch(() => false);
    // click Prescriptions tab
    await page.locator('button, [role="tab"]', { hasText: /prescriptions/i }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    await ss(page, 'customer-history-prescriptions-tab');
    results.push({ step: 'Customer history popup', ok: historyOpen, detail: historyOpen ? 'popup opened' : 'popup not found' });

    // ── 10. Permissions page ──
    console.log('\n[10] Permissions...');
    await page.goto(`${BASE}/permissions`, { waitUntil: 'networkidle' });
    await ss(page, 'permissions-page');
    const hasMedicines = await page.locator('text=/medicines/i').first().isVisible().catch(() => false);
    const hasPrescriptions = await page.locator('text=/prescriptions/i').first().isVisible().catch(() => false);
    const hasAlways = await page.locator('text=/always/i').first().isVisible().catch(() => false);
    results.push({ step: 'Permissions — Medicines group', ok: hasMedicines, detail: hasMedicines ? 'visible' : 'NOT found' });
    results.push({ step: 'Permissions — Prescriptions group', ok: hasPrescriptions, detail: hasPrescriptions ? 'visible' : 'NOT found' });
    results.push({ step: 'Permissions — Always badge (ADMIN)', ok: hasAlways, detail: hasAlways ? 'visible' : 'NOT found' });

  } catch (e) {
    console.error('Error:', e.message);
    await ss(page, 'error-state');
    results.push({ step: 'EXCEPTION', ok: false, detail: e.message });
  }

  await browser.close();

  // ── Summary ──
  console.log('\n' + '═'.repeat(60));
  console.log('WORKFLOW TEST RESULTS');
  console.log('═'.repeat(60));
  let passed = 0, failed = 0;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.step} — ${r.detail}`);
    r.ok ? passed++ : failed++;
  }
  console.log('─'.repeat(60));
  console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${results.length}`);
  console.log('═'.repeat(60));
  writeFileSync(`${SS_DIR}/results.json`, JSON.stringify(results, null, 2));
}

run().catch(console.error);

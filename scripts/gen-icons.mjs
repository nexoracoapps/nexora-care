import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const svg = readFileSync('public/icon.svg', 'utf8');

const sizes = [
  { size: 16,  file: 'public/favicon-16.png' },
  { size: 32,  file: 'public/favicon-32.png' },
  { size: 180, file: 'public/apple-icon.png' },
  { size: 192, file: 'public/icon-192.png' },
  { size: 512, file: 'public/icon-512.png' },
];

const browser = await chromium.launch({ headless: true });

for (const { size, file } of sizes) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: size, height: size });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${size}px; height:${size}px; background:#12092A; }
  svg { width:${size}px; height:${size}px; display:block; }
</style>
</head>
<body>${svg}</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false });
  writeFileSync(file, buf);
  console.log(`${size}x${size} → ${file}`);
  await page.close();
}

await browser.close();
console.log('All icons generated.');

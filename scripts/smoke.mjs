// Full-career smoke test: create player, play to retirement, open cabinet.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const errors = [];
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('button[data-action]', { timeout: 8000 });
console.log('home loaded');

await page.click('button[data-action="new-career"]');
await page.fill('#pname', 'Smoke Tester');
await page.click('button[data-action="pick-pos"][data-pos="FWD"]');
await page.fill('#natsearch', 'Argentina');
await page.waitForTimeout(150);
await page.click('button[data-action="pick-nat"][data-code="ARG"]');
await page.click('button[data-action="begin-career"]');
await page.waitForSelector('button[data-action="accept-offer"]', { timeout: 10000 });
console.log('offers shown');
await page.click('button[data-action="accept-offer"]');

let steps = 0, seasons = 0;
while (steps++ < 900) {
  await page.waitForTimeout(60);
  const done = await page.$('button[data-action="cabinet"]');
  if (done) break;
  const actions = ['choose', 'after-outcome', 'advance', 'start-season', 'stay-put', 'accept-offer'];
  let clicked = false;
  for (const a of actions) {
    const btn = await page.$(`button[data-action="${a}"]`);
    if (btn) {
      if (a === 'advance') seasons++;
      if (a === 'stay-put' && Math.random() < 0.5) {
        const alt = await page.$('button[data-action="accept-offer"]');
        if (alt) { await alt.click(); clicked = true; break; }
      }
      await btn.click().catch(() => {});
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    console.log('STUCK. body:', (await page.textContent('#app')).slice(0, 400));
    break;
  }
}
console.log(`seasons advanced: ${seasons}, steps: ${steps}`);

const retiredVisible = await page.$('button[data-action="cabinet"]');
if (!retiredVisible) { console.log('FAIL: never reached retirement'); process.exit(1); }
console.log('retirement reached');
await page.click('button[data-action="cabinet"]');
await page.waitForTimeout(300);
const tiles = await page.$$eval('.trophy', (t) => t.length).catch(() => 0);
const empty = await page.$('.card.center');
console.log(`cabinet: ${tiles} trophy tiles${empty && !tiles ? ' (empty cabinet message shown)' : ''}`);
await page.screenshot({ path: process.env.SCRATCH + '/cabinet.png' });
await page.click('button[data-action="back-retired"]');
await page.waitForTimeout(200);
await page.click('button[data-action="history"]');
await page.waitForTimeout(200);
const histRows = await page.$$eval('table.league tr', (r) => r.length);
console.log(`history rows: ${histRows}`);
await page.screenshot({ path: process.env.SCRATCH + '/history.png' });

if (errors.length) {
  console.log('CONSOLE ERRORS (excluding network fails):');
  const real = errors.filter((e) => !/Failed to load resource|net::|thesportsdb/i.test(e));
  real.forEach((e) => console.log('  ' + e));
  if (real.length) process.exit(1);
}
console.log('SMOKE PASS');
await browser.close();

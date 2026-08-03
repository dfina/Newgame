// Captures screenshots of key screens at phone and desktop widths.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5173';
const OUT = process.env.SCRATCH || '.';
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });
const errors = [];

async function run(label, viewport) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push(`${label} PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|net::|thesportsdb/i.test(m.text())) errors.push(`${label} CONSOLE: ${m.text()}`); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('button[data-action="new-career"]');
  await page.fill('#pname', 'Kevin De Bruyne');
  await page.click('button[data-action="pick-pos"][data-pos="MID"]');
  await page.fill('#natsearch', 'Belgium');
  await page.waitForTimeout(150);
  await page.click('button[data-action="pick-nat"][data-code="BEL"]');
  await page.click('button[data-action="begin-career"]');
  await page.waitForSelector('button[data-action="accept-offer"]', { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${label}-offers.png`, fullPage: true });

  await page.click('button[data-action="accept-offer"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${label}-decision.png`, fullPage: true });

  // Play a dozen seasons, then capture a mid-career transfer window.
  for (let i = 0; i < 90; i++) {
    if (await page.$('button[data-action="cabinet"]')) break;
    const seasonsDone = await page.$$eval('.timeline tbody tr:not(.empty):not(.intl)', (r) => r.length).catch(() => 0);
    if (seasonsDone >= 13 && await page.$('button[data-action="accept-offer"]')) break;
    let clicked = false;
    for (const a of ['choose', 'after-outcome', 'advance', 'start-season', 'stay-put', 'accept-offer']) {
      const b = await page.$(`button[data-action="${a}"]`);
      if (b) { await b.click().catch(() => {}); clicked = true; break; }
    }
    if (!clicked) break;
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${label}-midcareer.png`, fullPage: true });
  await page.close();
}

await run('phone', { width: 390, height: 844 });
await run('desktop', { width: 1280, height: 900 });
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');

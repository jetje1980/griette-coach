// Leest de sessie van vandaag van de schermen af, zoals zij hem leest.
//
// Zij zag op de startpagina "5x5" en op Progressie "6x5 met 3 min wandelen".
// Geen enkele test keek ooit of die twee teksten hetzelfde zeiden. Deze wel,
// en niet via de functies maar via wat er op het scherm staat.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173/griette-coach/';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 400) : ''}`); }
};

const NL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam',
  year: 'numeric', month: '2-digit', day: '2-digit' });
// Dezelfde kalenderdag als de app: die rekent alles in Europe/Amsterdam.
// toISOString() geeft de UTC-datum en dat is 's avonds al de vorige dag —
// precies de fout waarvoor datetime.js bestaat, en die ik hier zelf maakte.
const TODAY = NL.format(new Date());
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

function runWalk(date, p, hr) {
  const laps = [];
  for (let i = 0; i < 4; i++) {
    laps.push({ distance: (5 / p) * 1000, moving_time: 300, average_heartrate: hr,
      average_cadence: 80 });
    if (i < 3) laps.push({ distance: (2 / 11.5) * 1000, moving_time: 120,
      average_heartrate: hr - 18, average_cadence: 55 });
  }
  const km = laps.reduce((s, l) => s + l.distance, 0) / 1000;
  return { id: `w_${date}`, date, activityType: 'run', source: 'strava',
    distance: +km.toFixed(2), duration: 26, averageHR: hr, laps, confirmedByUser: true };
}

function seed() {
  const runs = [];
  for (let i = 0; i < 8; i++) runs.push(runWalk(addDays(TODAY, -40 + i * 5), 8.4, 130));
  const s = {
    gc_onboarding_done: '1',
    gc_workouts: JSON.stringify([...runs].reverse()),
    gc_hr_settings: JSON.stringify({ easyLow: 129, easyHigh: 132, released: 154,
      vt1: 132, vt2: 156 }),
    gc_auth_session: JSON.stringify({
      access_token: 't', refresh_token: 't', token_type: 'bearer', expires_in: 999999,
      expires_at: Math.floor(Date.now() / 1000) + 999999,
      user: { id: '00000000-0000-0000-0000-000000000001', email: 't@t.nl',
        aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
    }),
  };
  for (let i = 0; i < 70; i++) {
    const d = addDays(TODAY, -i);
    const log = { date: d, energy: 2, sleep_quality: 2, sleep_hours: 7.4, steps: 7800,
      headache_severity: 0, recovery_check: 'good', training_recovery: 0,
      battery_start: 70, hr_rest: 46 };
    if (runs.some(r => r.date === d)) log.run_done = true;
    if ([58, 30, 2].includes(i)) log.menstruation_start = true;
    s[`gc_log_${d}`] = JSON.stringify(log);
  }
  return s;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*supabase.co/**', r => r.abort());
await page.addInitScript(([d]) => {
  for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
}, [seed()]);

console.log('\n████ Eén sessie, van de schermen afgelezen ████\n');

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);

async function klik(t) {
  return page.evaluate((x) => {
    const re = new RegExp(`^${x}$`, 'i');
    const el = [...document.querySelectorAll('button, a, div, span')]
      .find(e => re.test(e.textContent.trim()) && e.offsetHeight > 0);
    el?.click();
    return !!el;
  }, t);
}

// De vorm staat er als "N min lopen / M min wandelen × K" of "N min doorlopend".
const VORM = /\d+(?:,\d+)? min lopen \/ \d+(?:,\d+)? min wandelen × \d+|\d+(?:,\d+)? min doorlopend/g;
const vormenOp = async () => page.evaluate(() => document.body.innerText)
  .then(t => [...new Set(t.match(
    /\d+(?:,\d+)? min lopen \/ \d+(?:,\d+)? min wandelen × \d+|\d+(?:,\d+)? min doorlopend/g) || [])]);

// 1 · De startpagina
const startVormen = await vormenOp();
console.log(`  startpagina : ${startVormen.join('  ·  ') || '(geen)'}`);
ok('op de startpagina staat precies één loopvorm', startVormen.length === 1,
  startVormen.join(' | '));

// 2 · Progressie → Run. De sessie staat bovenaan, zonder dat je iets hoeft
// open te klappen — dat was de hele reden om hem te verplaatsen.
await klik('Progressie'); await page.waitForTimeout(800);
await klik('Run'); await page.waitForTimeout(900);
const bovenaan = await page.evaluate(() => {
  const el = document.querySelector('[data-volgende-loop]');
  if (!el) return null;
  // Zichtbaar zonder scrollen op een telefoonhoogte van 844.
  const r = el.getBoundingClientRect();
  return { tekst: el.textContent.trim(), top: Math.round(r.top) };
});
ok('de sessie staat bovenaan, zonder accordeon', bovenaan != null, 'geen [data-volgende-loop]');
ok('en in het eerste schermbeeld', bovenaan != null && bovenaan.top < 500,
  JSON.stringify(bovenaan));
const runVormen = await vormenOp();
console.log(`  Progressie  : ${runVormen.join('  ·  ') || '(geen)'}`);

// 3 · Lichaam → Training
await klik('Lichaam'); await page.waitForTimeout(800);
await klik('Training'); await page.waitForTimeout(900);
const lichaamVormen = await vormenOp();
console.log(`  Lichaam     : ${lichaamVormen.join('  ·  ') || '(geen)'}\n`);

ok('Progressie noemt dezelfde vorm als de startpagina',
  runVormen.some(v => startVormen.includes(v)),
  `${runVormen.join('|')} vs ${startVormen.join('|')}`);
ok('Lichaam → Training ook',
  lichaamVormen.length === 0 || lichaamVormen.some(v => startVormen.includes(v)),
  `${lichaamVormen.join('|')} vs ${startVormen.join('|')}`);
ok('en nergens staan twee verschillende loopvormen door elkaar',
  runVormen.length <= 1 && lichaamVormen.length <= 1,
  `Progressie: ${runVormen.join('|')} · Lichaam: ${lichaamVormen.join('|')}`);

// 4 · De duur staat erbij — die was er niet omdat het veld anders heette.
await klik('Progressie'); await page.waitForTimeout(700);
await klik('Run'); await page.waitForTimeout(800);
const heeftDuur = await page.evaluate(() => {
  const el = document.querySelector('[data-volgende-loop]');
  if (!el) return null;
  return el.parentElement.innerText;
});
ok('de sessie op Progressie is te vinden', heeftDuur != null, 'geen [data-volgende-loop]');
ok('en er staat een duur in minuten bij',
  heeftDuur != null && /\d+ min/.test(heeftDuur), String(heeftDuur).slice(0, 150));

ok('geen JS-fout', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(`\n${'█'.repeat(56)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(56)}`);
process.exit(fail ? 1 : 0);

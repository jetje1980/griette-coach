// Loopt élk scherm langs met gevulde opslag, en kijkt of de app overleeft.
//
// Deze suite bestaat om één reden: een weggehaalde import sloopte eerder de
// hele app, navigatiebalk incluis, en geen enkele test zag het — omdat alle
// browsertests op lege opslag liepen en de kapotte regel alleen werd geraakt
// met echte data. Leeg testen is niet testen.
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
  for (let i = 0; i < 4; i++) runs.push(runWalk(addDays(TODAY, -56 + i * 4), 8.0, 130));
  for (let i = 0; i < 4; i++) runs.push(runWalk(addDays(TODAY, -16 + i * 4), 8.7, 130));

  const s = {
    gc_onboarding_done: '1',
    gc_workouts: JSON.stringify([...runs].reverse()),
    gc_hr_settings: JSON.stringify({ easyLow: 129, easyHigh: 132, released: 154, vt1: 132, vt2: 156 }),
    gc_auth_session: JSON.stringify({
      access_token: 't', refresh_token: 't', token_type: 'bearer', expires_in: 999999,
      expires_at: Math.floor(Date.now() / 1000) + 999999,
      user: { id: '00000000-0000-0000-0000-000000000001', email: 't@t.nl',
        aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
    }),
    // Krachtsessies, maten en sessiecontext: de stores die bij lege opslag
    // nooit worden aangeraakt.
    gc_strength_sessions: JSON.stringify([
      { id: 's1', date: addDays(TODAY, -3), mode: 'KORT_15A', durationMin: 15,
        exercises: [{ id: 'c_squat', sets: 3, reps: 10, weight: 12 }] },
      { id: 's2', date: addDays(TODAY, -7), mode: 'MIDDEL_30A', durationMin: 30,
        exercises: [{ id: 'c_dead', sets: 3, reps: 8, weight: 20 }] },
    ]),
    gc_session_context: JSON.stringify({
      [addDays(TODAY, -4)]: { date: addDays(TODAY, -4), ondergrond: 'zand',
        note: 'tegenwind heen en terug' },
    }),
  };
  for (let i = 0; i < 90; i++) {
    const d = addDays(TODAY, -i);
    const log = { date: d, energy: 2, sleep_quality: 2, sleep_hours: 7.3, steps: 7800,
      headache_severity: i % 11 === 0 ? 1 : 0, recovery_check: 'good',
      weight: +(71.5 - i * 0.01).toFixed(1), battery_start: 70, hr_rest: 46,
      waist: 84, navel: 92, hip: 101, protein_g: 95, water_l: 1.8 };
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
// Alleen echte JS-fouten tellen. Supabase is hier met opzet onbereikbaar,
// dus "Failed to load resource" is het verwachte gedrag van de test, niet
// een fout van de app. Een netwerkfout als JS-fout rekenen maakt de suite
// onbetrouwbaar — en een onbetrouwbare suite kijk je niet meer naar.
page.on('console', m => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/Failed to load resource|net::ERR_|status of 40|status of 50/.test(t)) return;
  errors.push('console: ' + t);
});
await page.route('**/*supabase.co/**', r => r.abort());
await page.addInitScript(([d]) => {
  for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
}, [seed()]);

console.log('\n████ Elk scherm, met gevulde opslag ████\n');

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout
await page.waitForTimeout(1500);

async function klik(tekst) {
  return page.evaluate((t) => {
    const re = new RegExp(`^${t}$`, 'i');
    const el = [...document.querySelectorAll('button, a, div, span')]
      .find(e => re.test(e.textContent.trim()) && e.offsetHeight > 0);
    el?.click();
    return !!el;
  }, tekst);
}

// Hoofdschermen uit de navigatiebalk, en per scherm de subtabs.
const ROUTES = [
  ['Vandaag', []],
  ['Lichaam', ['Training', 'Herstel', 'Body', 'Cyclus', 'Voeding', 'Medicatie']],
  ['Progressie', ['Overzicht', 'Body', 'Run', 'Strength', 'Fresh', 'Money', 'Freedom',
    'Routines', 'Tijdlijn']],
  ['Week', []],
  ['Coach', []],
  ['Leven', []],
];

for (const [hoofd, subs] of ROUTES) {
  const gevonden = await klik(hoofd);
  await page.waitForTimeout(900);
  if (!gevonden) { ok(`${hoofd}: tab bestaat`, false, 'niet gevonden in de navigatie'); continue; }

  const voor = errors.length;
  const tekst = await page.evaluate(() => document.body.innerText);
  const navWeg = !/vandaag/i.test(tekst) || tekst.trim().length < 40;
  ok(`${hoofd}: komt op zonder de app te slopen`, !navWeg && errors.length === voor,
    errors.slice(voor).join(' | ') || tekst.slice(0, 120));

  for (const sub of subs) {
    const v = await klik(sub);
    await page.waitForTimeout(700);
    const n = errors.length;
    const t2 = await page.evaluate(() => document.body.innerText);
    ok(`${hoofd} → ${sub}`, v && t2.trim().length > 40 && n === errors.length,
      errors.slice(n).join(' | ') || (v ? t2.slice(0, 120) : 'subtab niet gevonden'));
  }
}

console.log('');
ok('nergens een JS-fout in de hele doorloop', errors.length === 0,
  [...new Set(errors)].slice(0, 6).join(' | '));

await browser.close();
console.log(`\n${'█'.repeat(56)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(56)}`);
process.exit(fail ? 1 : 0);

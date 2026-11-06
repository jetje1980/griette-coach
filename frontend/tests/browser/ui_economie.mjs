// Komt de loopeconomie op het scherm, en klopt hij met haar eigen laps?
//
// Het oude blok rekende met sessiegemiddelden en liet daardoor wandelingen
// binnen als "loopeconomie". Deze test zet een wandeling én loopblokken in
// de opslag en kijkt wat het scherm ervan maakt.
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:4173/griette-coach/';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 250) : ''}`); }
};
const NL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam',
  year: 'numeric', month: '2-digit', day: '2-digit' });
const TODAY = NL.format(new Date());
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// Zes loopsessies met zakkende hartslag bij gelijk tempo — wat zij wil
// zien gebeuren — plus één pure wandeling die er niet in hoort.
const loop = (datum, hr, meters) => ({
  id: `w_${datum}`, date: datum, activityType: 'run',
  distance: +(meters / 1000).toFixed(2), duration: 8, averageHR: hr,
  laps: [{ avgHr: hr, distance: meters, movingTime: 480, cadence: 78 }],
});
const wandeling = (datum) => ({
  id: `h_${datum}`, date: datum, activityType: 'run',
  distance: 6.27, duration: 66, averageHR: 122,
  laps: [{ avgHr: 122, distance: 2911, movingTime: 1998, derivedKind: 'walk', cadence: 59 }],
});

const seed = {
  gc_onboarding_done: '1',
  gc_hr_settings: JSON.stringify({ easyLow: 106, easyHigh: 145, walkTrigger: 150,
    resumeBelow: 105, recoveryHR: null, rpeEasy: 4, rpeThreshold: 6 }),
  gc_workouts: JSON.stringify([
    loop(addDays(TODAY, -40), 152, 830), loop(addDays(TODAY, -36), 150, 835),
    loop(addDays(TODAY, -32), 151, 828),
    wandeling(addDays(TODAY, -20)),
    loop(addDays(TODAY, -10), 142, 850), loop(addDays(TODAY, -6), 140, 858),
    loop(addDays(TODAY, -2), 139, 862),
  ]),
  gc_auth_session: JSON.stringify({ access_token: 't', refresh_token: 't',
    token_type: 'bearer', expires_in: 999999,
    expires_at: Math.floor(Date.now() / 1000) + 999999,
    user: { id: '00000000-0000-0000-0000-000000000001', email: 't@t.nl',
      aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }),
};

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await b.newPage({ viewport: { width: 390, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*supabase.co/**', r => r.abort());
await page.addInitScript(([d]) => {
  for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
}, [seed]);

console.log('\n████ Loopeconomie op het scherm ████\n');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);

const klik = async t => page.evaluate(x => {
  const re = new RegExp(`^${x}$`, 'i');
  const el = [...document.querySelectorAll('button, a, div, span')]
    .find(e => re.test(e.textContent.trim()) && e.offsetHeight > 0);
  el?.click(); return !!el;
}, t);

await klik('Progressie'); await page.waitForTimeout(900);
ok('het hardlooptabblad bestaat', await klik('Run'), 'tab niet gevonden');
await page.waitForTimeout(1500);

await page.waitForSelector('[data-economie]', { timeout: 8000 }).catch(() => {});
ok('het economieblok staat er', await page.locator('[data-economie]').count() === 1);

const aantal = await page.getAttribute('[data-economie]', 'data-economie');
ok('de wandeling telt niet mee als loopsessie', aantal === '6',
  `${aantal} — zeven sessies in de opslag, zes ervan met loopblokken`);

const tekst = await page.textContent('[data-economie]');
console.log(`  ${tekst.replace(/\s+/g, ' ').slice(0, 220)}`);
ok('er staat een tempo bij een hartslag', /bij hartslag 132/i.test(tekst), tekst.slice(0, 120));
ok('en de richting wordt benoemd', /efficiëntie/i.test(tekst), tekst.slice(0, 160));
ok('met het percentage erbij', /%/.test(tekst));
ok('en de waarschuwing over omstandigheden',
  /zand|hitte|cyclus/i.test(tekst), tekst.slice(-200));

// Het overzichtstabblad hoort hetzelfde getal te gebruiken, niet een eigen variant.
await klik('Overzicht'); await page.waitForTimeout(1200);
const overzicht = await page.evaluate(() => document.body.innerText);
ok('het overzicht noemt hetzelfde tempo-bij-hartslag',
  /Tempo bij HR 132/i.test(overzicht),
  overzicht.split('\n').filter(l => /HR/i.test(l)).join(' | ').slice(0, 200));

ok('geen JS-fout', errors.length === 0, errors.join(' | '));
await b.close();
console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

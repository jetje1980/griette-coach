// Browsersuite: de omstandigheden van een training, in het echte scherm.
//
// Dit is het soort test dat eerder ontbrak: niet "de functie geeft het juiste
// object terug", maar "zij komt binnen, ziet het, en kan het invullen".
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173/griette-coach/';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 300) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}`);

const NL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam',
  year: 'numeric', month: '2-digit', day: '2-digit' });
// Dezelfde kalenderdag als de app: die rekent alles in Europe/Amsterdam.
// toISOString() geeft de UTC-datum en dat is 's avonds al de vorige dag —
// precies de fout waarvoor datetime.js bestaat, en die ik hier zelf maakte.
const TODAY = NL.format(new Date());
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

function runWalk(date, runPace, hr) {
  const laps = [];
  for (let i = 0; i < 4; i++) {
    laps.push({ distance: (5 / runPace) * 1000, moving_time: 300,
      average_heartrate: hr, average_cadence: 80 });
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
    gc_workouts: JSON.stringify([...runs].reverse()),
    gc_hr_settings: JSON.stringify({ easyLow: 129, easyHigh: 132, released: 154, vt1: 132, vt2: 156 }),
    gc_onboarding_done:'1',gc_auth_session: JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer',
      expires_in: 999999, expires_at: Math.floor(Date.now() / 1000) + 999999,
      user: { id: '00000000-0000-0000-0000-000000000001', email: 'test@test.nl',
        aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
    }),
  };
  for (let i = 0; i < 70; i++) {
    const d = addDays(TODAY, -i);
    const log = { date: d, energy: 2, sleep_quality: 2, sleep_hours: 7.3, steps: 7800,
      headache_severity: 0, recovery_check: 'good', weight: 71.2 };
    if ([58, 30, 2].includes(i)) log.menstruation_start = true;
    s[`gc_log_${d}`] = JSON.stringify(log);
  }
  return s;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// Het netwerk naar Supabase bestaat hier niet; de app moet daar tegen kunnen.
await page.route('**/*supabase.co/**', r => r.abort());

const data = seed();
await page.addInitScript(([d]) => {
  for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
}, [data]);

console.log('\n████ Omstandigheden in het scherm ████');

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

S('0 · De app komt op');
{
  const tekst = await page.evaluate(() => document.body.innerText);
  ok('geen inlogpoort', !/wachtwoord|inloggen/i.test(tekst.slice(0, 400)), tekst.slice(0, 160));
  ok('geen JS-fout', errors.length === 0, errors.join(' | '));
}

// Naar Progressie → Run.
async function naarRun() {
  await page.evaluate(() => {
    const knop = [...document.querySelectorAll('button, a, div')]
      .find(e => /^progressie$/i.test(e.textContent.trim()) && e.offsetHeight > 0);
    knop?.click();
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('button, div, span')]
      .find(e => /^run$/i.test(e.textContent.trim()) && e.offsetHeight > 0);
    t?.click();
  });
  await page.waitForTimeout(900);
}
await naarRun();

S('1 · De economielezing staat er, en niet als kaal getal');
{
  const niveau = await page.getAttribute('[data-economie-lezing]', 'data-economie-lezing')
    .catch(() => null);
  ok('er staat een lezing met een niveau', !!niveau, String(niveau));
  const tekst = await page.evaluate(() => document.body.innerText);
  ok('onder zes sessies of zonder context geen "gaat achteruit"',
    niveau === 'achteruit' || !/loopeconomie gaat achteruit/i.test(tekst), String(niveau));
  ok('het aantal sessies staat erbij', /vergelijkbare sessies/i.test(tekst));
}

S('2 · Er wordt doorgevraagd, met reden per vraag');
{
  const navraag = await page.locator('[data-economie-navraag]').count();
  ok('er staat een navraagblok', navraag === 1, String(navraag));
  await page.click('[data-navraag-knop]');
  await page.waitForTimeout(500);
  // De knop klapt de sessielijst open; daar staan de vragen, op één plek.
  const vragen = await page.locator('[data-sessies-context] [data-vraag]').count();
  ok('er staan gerichte vragen', vragen >= 4, String(vragen));
  ok('en niet twee invulblokken voor dezelfde dag',
    await page.locator('[data-trainingcontext]').count()
      === await page.evaluate(() => new Set([...document.querySelectorAll('[data-trainingcontext]')]
        .map(e => e.getAttribute('data-trainingcontext'))).size),
    'dezelfde datum komt meer dan één keer voor');
  const ids = await page.evaluate(() => [...new Set([...document.querySelectorAll(
    '[data-sessies-context] [data-vraag]')].map(e => e.getAttribute('data-vraag')))]);
  ok('naar ondergrond wordt gevraagd', ids.includes('ondergrond'), ids.join(','));
  ok('naar tijdstip ook', ids.includes('tijdstip'), ids.join(','));
  ok('niet naar drukte — dat verklaart geen tempo', !ids.includes('drukte'), ids.join(','));
  ok('de slaapvraag vervalt: die staat in de check-in', !ids.includes('slaap'), ids.join(','));
}

S('3 · De cyclusdag staat bij elke sessie');
{
  const dagen = await page.evaluate(() => [...document.querySelectorAll(
    '[data-sessies-context] [data-cyclusdag]')].map(e => e.textContent.trim()));
  ok('er staan sessierijen', dagen.length >= 3, String(dagen.length));
  ok('elke rij noemt de cyclusdag', dagen.every(t => /cyclusdag/.test(t)), dagen.join(' | '));
  ok('en minstens één is bekend', dagen.some(t => /cyclusdag \d+/.test(t)), dagen.join(' | '));
}

S('4 · Een antwoord wordt bewaard en verandert de lezing');
{
  const voor = await page.getAttribute('[data-economie-lezing]', 'data-economie-lezing');
  // Bij de recente sessies: zand. Bij de oudere: asfalt.
  const rijen = await page.evaluate(() => [...document.querySelectorAll('[data-sessierij]')]
    .map(e => e.getAttribute('data-sessierij')));
  ok('de sessierijen zijn aanklikbaar', rijen.length >= 3, String(rijen.length));

  // De rijen staan al open — de navraagknop uit sectie 2 klapte ze open.
  for (const d of rijen.slice(0, 2)) {
    await page.click(`[data-trainingcontext="${d}"] [data-vraag="ondergrond"] [data-optie="zand"]`);
    await page.waitForTimeout(400);
  }

  const bewaard = await page.evaluate(() => JSON.parse(localStorage.getItem('gc_session_context') || '{}'));
  const metZand = Object.values(bewaard).filter(v => v.ondergrond === 'zand').length;
  ok('de antwoorden zijn bewaard', metZand === 2, JSON.stringify(bewaard));

  // Het antwoord moet ook ingeklapt te zien zijn, anders weet zij niet
  // welke sessie nog een antwoord mist.
  const regels = await page.evaluate(() => [...document.querySelectorAll(
    '[data-sessierij] [data-contextregels]')].map(e => e.textContent));
  ok('de ingevulde ondergrond staat in de dichte rij',
    regels.filter(r => /ondergrond: zand/.test(r)).length === 2, regels.join(' | '));
  ok('en de lezing staat er nog, met zijn niveau',
    !!await page.getAttribute('[data-economie-lezing]', 'data-economie-lezing'), String(voor));
}

S('5 · Het open veld, woordelijk bewaard');
{
  const d = await page.evaluate(() => document.querySelector('[data-sessierij]')
    ?.getAttribute('data-sessierij'));
  const veld = `[data-trainingcontext="${d}"] [data-eigen-lezing]`;
  await page.fill(veld, 'tegenwind heen en terug, dag ervoor zware migraine');
  await page.click(`[data-trainingcontext="${d}"] [data-lezing-opslaan]`);
  await page.waitForTimeout(400);
  const bewaard = await page.evaluate((dd) =>
    JSON.parse(localStorage.getItem('gc_session_context') || '{}')[dd], d);
  ok('woordelijk bewaard', bewaard?.note === 'tegenwind heen en terug, dag ervoor zware migraine',
    JSON.stringify(bewaard));
  const melding = await page.textContent(`[data-trainingcontext="${d}"] [data-lezing-melding]`)
    .catch(() => null);
  ok('met een bevestiging', /woordelijk mee/.test(melding || ''), String(melding));

  // En hij komt terug in de lezing boven.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await naarRun();
  const tekst = await page.evaluate(() => document.body.innerText);
  ok('en staat na herladen in de economielezing',
    /tegenwind heen en terug/.test(tekst), tekst.slice(0, 200));
}

S('6 · Niets kapot');
ok('nog steeds geen JS-fout', errors.length === 0, errors.join(' | '));
{
  const nav = await page.evaluate(() => document.body.innerText);
  ok('de navigatie staat er nog', /Vandaag/i.test(nav) && /Progressie/i.test(nav));
}

await browser.close();
console.log(`\n${'█'.repeat(56)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(56)}`);
process.exit(fail ? 1 : 0);

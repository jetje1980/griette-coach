// Kun je een voorbije dag nog corrigeren, en zie je wat je er toen invulde?
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DEZE TEST BESTAAT
//
// Zij vroeg: "kan ik het nog aanpassen voor 17 nov? Want die hoofdpijn had
// niet met hardlopen te maken." Het antwoord bleek ja — en bovendien had
// ze het al gedaan: op die dag stonden "cyclus" en "migraine" gewoon
// aangevinkt. Alleen las het PEM-oordeel dat veld niet, dus telde haar
// hoofdpijn toch als reactie op de training.
//
// De rekenkant daarvan ligt vast in tests/node/verdragen.js. Deze test
// bewaakt de andere helft: dat de weg naar die correctie bestaat en dat
// je er ziet staan wat je hebt ingevuld. Een oordeel dat je niet kunt
// terugvinden kun je ook niet weerleggen, en dat was precies haar vraag.
//
// De route loopt via Vandaag, want alleen daar staan de datumpijlen; de
// gekozen dag geldt daarna voor het hele scherm. Dat is niet voor de hand
// liggend, en daarom moet het in elk geval blijven werken.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:4173/griette-coach/';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 300) : ''}`); }
};
const NL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam',
  year: 'numeric', month: '2-digit', day: '2-digit' });
const TODAY = NL.format(new Date());
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// Twee dagen terug: een loopdag met hoofdpijn die zij aan migraine en
// cyclus toeschreef. Precies haar 17 november.
const LOOP = addDays(TODAY, -2);
const NA = addDays(TODAY, -1);

const seed = {
  gc_onboarding_done: '1',
  gc_hr_settings: JSON.stringify({ easyLow: 106, easyHigh: 150, walkTrigger: 150,
    resumeBelow: 105, rpeEasy: 4, rpeThreshold: 6 }),
  gc_workouts: JSON.stringify([{ id: LOOP, date: LOOP, activityType: 'run', duration: 30,
    distance: 3, laps: [{ movingTime: 600, distance: 1050, avgHr: 140 }] }]),
  gc_auth_session: JSON.stringify({ access_token: 't', refresh_token: 't',
    token_type: 'bearer', expires_in: 999999,
    expires_at: Math.floor(Date.now() / 1000) + 999999,
    user: { id: '00000000-0000-0000-0000-000000000001', email: 't@t.nl',
      aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }),
};
seed[`gc_log_${LOOP}`] = JSON.stringify({ date: LOOP, run_done: true, energy: 2,
  training_recovery: 0, training_legs: 'fris', symptom_headache: true,
  feeling_causes: ['cyclus', 'migraine'] });
seed[`gc_log_${NA}`] = JSON.stringify({ date: NA, energy: 2, recovery_check: 'good',
  headache_severity: 0, training_recovery: 0 });
seed[`gc_log_${TODAY}`] = JSON.stringify({ date: TODAY, hr_rest: 62 });

const res = await fetch(BASE).catch(() => null);
if (!res || !res.ok) {
  console.log(`  ⊘ overgeslagen — geen app op ${BASE}`);
  process.exit(0);
}

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await b.newPage({ viewport: { width: 430, height: 950 } });
const errors = [];
p.on('pageerror', e => errors.push(e.message));

console.log('\n████ Een voorbije dag terugvinden en corrigeren ████\n');
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.evaluate(d => { for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); }, seed);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(1200);

// ── De weg terug ─────────────────────────────────────────────
ok('er staan datumpijlen op Vandaag', await p.locator('.os-nav-arrow').count() >= 1,
  String(await p.locator('.os-nav-arrow').count()));
for (let i = 0; i < 2; i++) {
  await p.locator('.os-nav-arrow').first().click();
  await p.waitForTimeout(400);
}

await p.locator('text=Lichaam').first().click();
await p.waitForTimeout(800);
// De subtab op zijn eigen attribuut, niet op zijn tekst: "Herstel" staat
// op meer plekken op dit scherm, en dan klikt een test net naast de knop.
const herstel = p.locator('[data-subtab="herstel"]');
ok('de subtab Herstel is te vinden', await herstel.count() === 1,
  String(await herstel.count()));
await herstel.click();
await p.waitForTimeout(800);

// ── Wat zij toen invulde, staat er ───────────────────────────
const chips = await p.locator('[data-oorzaak]').evaluateAll(els =>
  els.map(e => ({ id: e.getAttribute('data-oorzaak'),
    actief: e.className.includes('active') })));
const actief = chips.filter(c => c.actief).map(c => c.id);
console.log(`      actieve oorzaken: ${actief.join(', ') || '(geen)'}`);
ok('de oorzakenkiezer staat er', chips.length >= 6, String(chips.length));
ok('en toont wat zij die dag koos', actief.includes('migraine') && actief.includes('cyclus'),
  JSON.stringify(actief));
ok('zonder er iets bij te verzinnen', actief.length === 2, JSON.stringify(actief));

// ── En je kunt hem nog veranderen ────────────────────────────
await p.locator('[data-oorzaak="migraine"]').click();
await p.waitForTimeout(700);
const na = await p.evaluate((d) => {
  try { return JSON.parse(localStorage.getItem(`gc_log_${d}`) || '{}').feeling_causes || []; }
  catch { return null; }
}, LOOP);
console.log(`      na uitvinken: ${JSON.stringify(na)}`);
ok('uitvinken wordt bewaard op die dag, niet op vandaag',
  Array.isArray(na) && !na.includes('migraine') && na.includes('cyclus'),
  JSON.stringify(na));
const vandaagLog = await p.evaluate((d) => {
  try { return JSON.parse(localStorage.getItem(`gc_log_${d}`) || '{}'); } catch { return null; }
}, TODAY);
ok('en het dagboek van vandaag blijft ongemoeid',
  !vandaagLog?.feeling_causes, JSON.stringify(vandaagLog?.feeling_causes));

// Weer aanzetten, zodat de test geen spoor achterlaat in zijn eigen opzet.
await p.locator('[data-oorzaak="migraine"]').click();
await p.waitForTimeout(600);
const terug = await p.evaluate((d) => {
  try { return JSON.parse(localStorage.getItem(`gc_log_${d}`) || '{}').feeling_causes || []; }
  catch { return null; }
}, LOOP);
ok('en aanvinken ook weer', (terug || []).includes('migraine'), JSON.stringify(terug));

ok('geen JS-fout', errors.length === 0, errors.join(' | '));
await b.close();
console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

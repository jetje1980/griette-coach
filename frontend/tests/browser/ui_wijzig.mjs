// Kun je de gegevens van een gelopen training achteraf nog wijzigen?
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DEZE TEST BESTAAT
//
// Zij vroeg: "ik wil graag ook bij alle trainingen achteraf de gegevens
// nog kunnen wijzigen."
//
// Dat kon al. Elke activiteit heeft een wijzigknop die het volledige
// formulier opent, vooringevuld. Alleen zat die lijst onderaan het
// trainingsscherm, dichtgeklapt, achter de kop "Activiteiten corrigeren
// of verwijderen" — wat klinkt als opruimen van een verkeerde import, en
// niet als "hier pas je je trainingsgegevens aan".
//
// Een functie die niemand vindt, bestaat voor de gebruiker niet. Deze
// test bewaakt daarom allebei: dát je elke training kunt wijzigen, en dat
// de weg ernaartoe begint waar zij kijkt — de tabel met al haar
// trainingen op de Ameland-tab.
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

// Een handvol gelopen trainingen, en één met een hartslag die er duidelijk
// naast zit — dat is het geval waarvoor wijzigen bestaat.
const DAGEN = [2, 4, 6, 8, 10, 12].map(n => addDays(TODAY, -n));
const FOUT = DAGEN[1];
const workouts = DAGEN.map((d, i) => ({
  id: `w_${d}`, date: d, activityType: 'run', source: 'manual', confirmedByUser: true,
  duration: 30, distance: 3.2, averageHR: d === FOUT ? 188 : 142,
  laps: [{ movingTime: 600, distance: 1050, avgHr: d === FOUT ? 188 : 142 }],
}));

const seed = {
  gc_onboarding_done: '1',
  gc_workouts: JSON.stringify(workouts),
  gc_hr_settings: JSON.stringify({ easyLow: 106, easyHigh: 150, walkTrigger: 150,
    resumeBelow: 105, rpeEasy: 4, rpeThreshold: 6 }),
  gc_race_goals: JSON.stringify([{ id: 'ameland', name: 'Ameland Adventure Run 5 km',
    distanceKm: 5, targetTimeSec: 2100, date: addDays(TODAY, 30), type: 'TARGET',
    priority: 1, enabled: true, terrain: 'trail' }]),
  gc_auth_session: JSON.stringify({ access_token: 't', refresh_token: 't',
    token_type: 'bearer', expires_in: 999999,
    expires_at: Math.floor(Date.now() / 1000) + 999999,
    user: { id: '00000000-0000-0000-0000-000000000001', email: 't@t.nl',
      aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }),
};
for (const d of DAGEN) {
  seed[`gc_log_${d}`] = JSON.stringify({ date: d, run_done: true, energy: 2,
    training_recovery: 0 });
}

const res = await fetch(BASE).catch(() => null);
if (!res || !res.ok) {
  console.log(`  ⊘ overgeslagen — geen app op ${BASE}`);
  process.exit(0);
}

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const p = await b.newPage({ viewport: { width: 430, height: 950 } });
const errors = [];
p.on('pageerror', e => errors.push(e.message));

console.log('\n████ Een gelopen training achteraf wijzigen ████\n');
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.evaluate(d => { for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); }, seed);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(1500);

// ── Elke training is te wijzigen, niet alleen die van vandaag ──
await p.locator('text=Lichaam').first().click();
await p.waitForTimeout(800);
await p.locator('[data-subtab="training"]').click();
await p.waitForTimeout(900);

const kop = p.locator('text=/Gegevens van een training wijzigen/');
ok('de lijst heet naar wat hij doet', await kop.count() === 1,
  String(await kop.count()));
await kop.first().click();
await p.waitForTimeout(700);
const knoppen = p.locator('button', { hasText: /^wijzig$/ });
console.log(`      ${await knoppen.count()} wijzigknoppen`);
ok('elke training heeft er een, niet alleen die van vandaag',
  await knoppen.count() === workouts.length, String(await knoppen.count()));

// ── En het formulier komt vooringevuld terug ────────────────
await p.locator(`[data-activiteit="${FOUT}"] button:has-text("wijzig")`).click();
await p.waitForTimeout(1200);
const velden = await p.locator('input').evaluateAll(els =>
  els.map(e => ({ type: e.type, value: e.value })).filter(v => v.value));
console.log(`      ${JSON.stringify(velden.slice(0, 5))}`);
ok('met de datum van díe training', velden.some(v => v.value === FOUT),
  JSON.stringify(velden));
ok('en de hartslag die erin stond', velden.some(v => v.value === '188'),
  JSON.stringify(velden));
// Zonder dit zou je een lege invoer krijgen en per ongeluk je gegevens
// overschrijven in plaats van ze te corrigeren.
ok('en de afstand', velden.some(v => v.value === '3.2'), JSON.stringify(velden));

// ── De weg begint waar zij kijkt ─────────────────────────────
// Het formulier staat nog open en vangt kliks af; opnieuw laden is hier
// eerlijker dan een sluitknop zoeken, want we testen de route en niet de
// modal.
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.locator('text=Ameland').first().click();
await p.waitForTimeout(1500);
const datumknop = p.locator(`[data-wijzig-training="${FOUT}"]`);
ok('in de tabel is de datum van een gelopen training aanklikbaar',
  await datumknop.count() === 1, String(await datumknop.count()));
// Een toekomstige training valt niets aan te passen: die is nog niet
// gelopen. Een knop daar zou alleen maar verwarren.
const toekomst = await p.locator('[data-rijstatus="gepland"] [data-wijzig-training]').count();
ok('een geplande training heeft die knop niet', toekomst === 0, String(toekomst));

await datumknop.click();
await p.waitForTimeout(1500);
const lijstOpen = await p.locator('[data-activiteit]').count();
console.log(`      na doorklikken: ${lijstOpen} activiteiten zichtbaar`);
ok('je landt op het trainingsscherm met de lijst open', lijstOpen > 0,
  String(lijstOpen));
ok('en die training staat ertussen',
  await p.locator(`[data-activiteit="${FOUT}"]`).count() === 1, '');

ok('geen JS-fout', errors.length === 0, errors.join(' | '));
await b.close();
console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

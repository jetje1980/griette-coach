// Telt HRV overal mee, of alleen in het invulblad?
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG
//
// "Wordt de HRV ook meegenomen in coach en progressie en oordeel? En dat
// in combi ook met cyclus etc?"
//
// Toen ze het vroeg was het antwoord nee. Ik had een kolom toegevoegd om
// HRV in te vullen en hem aangesloten op één analyse — de
// patroonvergelijking op Progressie — en verder nergens. De tijdlijn
// kende het veld niet, en daarmee ook de cyclusanalyse niet, de
// driftmeting niet, de coachcontext niet en het dagoordeel niet. Een
// invulveld dat nergens doorwerkt is een invulveld dat haar tijd kost en
// niets teruggeeft; dat is erger dan het veld niet hebben.
//
// Deze suite bewaakt de hele keten, want dat is wat ze vroeg: niet "zit
// het erin" maar "telt het mee".
import './_storage-stub.js';
import { series, rollingMean } from '../../src/timeline.js';
import { CYCLE_METRICS, RANGE_METRICS } from '../../src/cyclePatterns.js';
import { restingDrift } from '../../src/restingDrift.js';
import { buildCoachContext, contextAsText } from '../../src/coachContext.js';
import { voortgang } from '../../src/voortgang.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-11';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// Een reeks waarin de rusthartslag oploopt en HRV zakt — twee metingen
// van hetzelfde systeem die dezelfde kant op wijzen.
function wereld({ hrvVan = 42, hrvTot = 32, hrVan = 58, hrTot = 65, dagen = 84 } = {}) {
  globalThis.__testStorage.reset();
  const logs = {};
  for (let i = dagen - 1; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    const f = (dagen - 1 - i) / (dagen - 1);
    const rec = { date: d,
      hr_rest: Math.round(hrVan + (hrTot - hrVan) * f),
      hrv: Math.round(hrvVan + (hrvTot - hrvVan) * f),
      sleep_hours: 7.5, weight: 61 };
    logs[d] = rec;
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(rec));
  }
  localStorage.setItem('gc_workouts', JSON.stringify([
    { id: 'w1', date: addDays(TODAY, -2), duration: 30, distance: 3.2,
      activityType: 'run', laps: [{ movingTime: 600, distance: 1100, avgHr: 140 }] },
  ]));
  return logs;
}

S('1 · De tijdlijn kent het veld');
{
  wereld();
  const s = series('hrv', { asOf: TODAY });
  console.log(`      ${s.length} HRV-waarnemingen · 7-daags gemiddelde ${rollingMean('hrv', 7, { asOf: TODAY })}`);
  ok('HRV komt als waarneming uit het dagboek', s.length > 50, String(s.length));
  ok('met een eenheid erbij', s[0]?.unit === 'ms', String(s[0]?.unit));
  ok('en een 7-daags gemiddelde laat zich berekenen',
    rollingMean('hrv', 7, { asOf: TODAY }) != null, '');
  // Dit is de schakel die ontbrak: zonder deze projectie zag geen enkele
  // andere analyse het veld, hoe vaak zij het ook invulde.
  ok('de waarneming draagt een datum die de rest kan lezen',
    !!s[0]?.observedAt, JSON.stringify(s[0]));
}

S('2 · En dus ook de cyclusanalyse');
{
  ok('HRV staat tussen de cyclusmetrieken',
    CYCLE_METRICS.some(m => m.id === 'hrv'),
    JSON.stringify(CYCLE_METRICS.map(m => m.id)));
  ok('en telt mee in de bandbreedtes per fase',
    RANGE_METRICS.includes('hrv'), JSON.stringify(RANGE_METRICS));
  const meta = CYCLE_METRICS.find(m => m.id === 'hrv');
  ok('met de juiste eenheid', meta.unit === 'ms', meta.unit);
}

S('3 · De drift leest hem naast de rusthartslag');
{
  const logs = wereld();
  const d = restingDrift({ currentDate: TODAY });
  console.log(`      ${d.line}`);
  console.log(`      ${d.hrv?.line}`);
  ok('de drift kent HRV', d.hrv?.known === true, JSON.stringify(d.hrv));
  ok('en ziet dat hij zakt', d.hrv.direction === 'omlaag', d.hrv.direction);
  // Dit is waar het om gaat: twee metingen van hetzelfde systeem die
  // dezelfde kant op wijzen zijn samen een eenduidig signaal.
  ok('en dat dit samenvalt met een oplopende rusthartslag',
    d.hrv.agreesWithRestingHr === true, JSON.stringify([d.delta, d.hrv.deltaPct]));
  ok('de uitleg zegt dat dit een echt hersteltekort is',
    /echt hersteltekort/.test(d.hrv.why), d.hrv.why);
}

S('4 · Spreken ze elkaar tegen, dan is dat ook een uitkomst');
{
  // HRV zakt terwijl de rusthartslag gelijk blijft: dan is er iets
  // anders aan de hand, en dat hoort niet als trainingsschuld te lezen.
  wereld({ hrVan: 60, hrTot: 60 });
  const d = restingDrift({ currentDate: TODAY });
  console.log(`      ${d.hrv.why.slice(0, 90)}`);
  ok('zonder meebewegende rusthartslag geen eenduidig signaal',
    d.hrv.agreesWithRestingHr === false, String(d.hrv.agreesWithRestingHr));
  ok('en de uitleg wijst eerst naar slaap, stress en cyclus',
    /cyclusfase/.test(d.hrv.why), d.hrv.why);
}

S('5 · Zonder metingen geen uitspraak');
{
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_workouts', JSON.stringify([]));
  for (let i = 0; i < 40; i++) {
    const d = addDays(TODAY, -i);
    localStorage.setItem(`gc_log_${d}`, JSON.stringify({ date: d, hr_rest: 60 }));
  }
  const d = restingDrift({ currentDate: TODAY });
  ok('geen HRV ingevuld geeft geen oordeel', d.hrv?.known === false,
    JSON.stringify(d.hrv));
  ok('maar wel een zin die zegt vanaf wanneer het wél kan',
    /vanaf \d+/.test(d.hrv?.why || ''), d.hrv?.why);
}

S('6 · De coach ziet hem, en Progressie weegt hem');
{
  const logs = wereld();
  const ctx = buildCoachContext({ asOf: TODAY });
  ok('de coachcontext bevat HRV', ctx.recovery?.hrv?.mean7 != null,
    JSON.stringify(ctx.recovery?.hrv));
  const tekst = contextAsText(ctx);
  ok('en hij staat ook in de tekst die de coach leest',
    /HRV/.test(tekst), tekst.split('\n').find(l => /HRV/.test(l)) || 'niet gevonden');
  ok('met de waarschuwing dat alleen haar eigen verloop telt',
    /absolute waarde/.test(tekst), '');

  const v = voortgang({ currentDate: TODAY, logs });
  const dim = v.known ? v.byId.hrv : null;
  console.log(`      ${dim?.regel}`);
  ok('Progressie heeft HRV als eigen dimensie', !!dim, JSON.stringify(v.forward));
  ok('en ziet dat hij achteruitgaat', dim.verdict === 'achteruit', dim.verdict);
  ok('met de uitleg waarom dat bij haar extra telt',
    /long COVID/.test(dim.toelichting), dim.toelichting);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

// Taperen is iets wat je voor een doel inlevert — niet iets wat de kalender
// afdwingt. En haar eigen keuze wint.
import { currentStrategy, taperDaysFor, TAPER_DAYS_BY_TYPE,
  loadBuildThrough, saveBuildThrough } from '../../src/strategy.js';
import { coachPlan } from '../../src/coachPlan.js';
import { computeNextSession } from '../../src/components/CoachAdvice.jsx';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 300) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 50 - t.length))}`);

const NL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam',
  year: 'numeric', month: '2-digit', day: '2-digit' });
const TODAY = NL.format(new Date());
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

let mem = {};
function store(seed = {}) {
  mem = { ...seed };
  globalThis.localStorage = {
    get length() { return Object.keys(mem).length; },
    key: i => Object.keys(mem)[i] ?? null,
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; },
  };
  globalThis.sessionStorage = globalThis.localStorage;
}

const BLOK5 = { provenBlockMin: 5, longestToleratedKm: 2.4, sessions: 10, easyPaceMin: 8.2 };
const SCHOON = { green: true, pemFreeWeeks: 8, warnings: 0 };
const doel = (type, dagen) => ({ name: `Race ${type}`, date: addDays(TODAY, dagen),
  distanceKm: 10, targetTimeSec: 65 * 60, type });

S('1 · De taperlengte hangt aan het soort doel');
{
  store({});
  ok('een echt doel krijgt een week', TAPER_DAYS_BY_TYPE.TARGET === 7,
    String(TAPER_DAYS_BY_TYPE.TARGET));
  ok('een stretchdoel een paar dagen', TAPER_DAYS_BY_TYPE.STRETCH === 3,
    String(TAPER_DAYS_BY_TYPE.STRETCH));
  ok('een checkpoint bijna niets', TAPER_DAYS_BY_TYPE.CHECKPOINT === 2,
    String(TAPER_DAYS_BY_TYPE.CHECKPOINT));
  ok('en een langetermijndoel niets', TAPER_DAYS_BY_TYPE.LONG_TERM === 0,
    String(TAPER_DAYS_BY_TYPE.LONG_TERM));
  ok('onbekend soort valt terug op een doel', taperDaysFor({ name: 'x' }) === 7,
    String(taperDaysFor({ name: 'x' })));
}

S('2 · Tien dagen voor een stretchdoel: doorbouwen');
{
  store({});
  const st = currentStrategy({ capability: BLOK5, goal: doel('STRETCH', 10),
    recovery: SCHOON, currentDate: TODAY });
  ok('de fase is niet taper', st.phase !== 'TAPER', st.phase);
  ok('de as is bloklengte', st.axis === 'BLOCK', st.axis);
  // Dit is precies de situatie waarin zij zei: ik wil niet taperen.
  const st3 = currentStrategy({ capability: BLOK5, goal: doel('STRETCH', 3),
    recovery: SCHOON, currentDate: TODAY });
  ok('drie dagen ervoor wél taper', st3.phase === 'TAPER', st3.phase);
  ok('en de uitleg noemt het soort doel', /stretch-doel/.test(st3.why), st3.why);
}

S('3 · Een checkpoint kost geen opbouw');
{
  store({});
  const st = currentStrategy({ capability: BLOK5, goal: doel('CHECKPOINT', 5),
    recovery: SCHOON, currentDate: TODAY });
  ok('vijf dagen voor een checkpoint nog opbouwen', st.phase !== 'TAPER', st.phase);
  const st1 = currentStrategy({ capability: BLOK5, goal: doel('CHECKPOINT', 1),
    recovery: SCHOON, currentDate: TODAY });
  ok('de dag ervoor wel rustig aan', st1.phase === 'TAPER', st1.phase);
}

S('4 · Een echt doel krijgt zijn taperweek');
{
  store({});
  const st = currentStrategy({ capability: BLOK5, goal: doel('TARGET', 6),
    recovery: SCHOON, currentDate: TODAY });
  ok('zes dagen voor een doel: taper', st.phase === 'TAPER', st.phase);
  const st8 = currentStrategy({ capability: BLOK5, goal: doel('TARGET', 8),
    recovery: SCHOON, currentDate: TODAY });
  ok('acht dagen ervoor nog niet', st8.phase !== 'TAPER', st8.phase);
}

S('5 · Haar eigen keuze wint, en wordt genoemd');
{
  store({});
  const zondag = addDays(TODAY, 4);
  const st = currentStrategy({ capability: BLOK5, goal: doel('TARGET', 3),
    recovery: SCHOON, currentDate: TODAY, buildThrough: zondag });
  ok('geen taper zolang zij doorbouwt', st.phase !== 'TAPER', st.phase);
  ok('de as staat weer op bloklengte', st.axis === 'BLOCK', st.axis);
  ok('en de reden staat erbij, niet stilzwijgend',
    new RegExp(`doorbouwen tot en met ${zondag}`).test(st.why), st.why);
  ok('de keuze gaat mee naar het scherm', st.buildThrough === zondag,
    String(st.buildThrough));

  // Een datum in het verleden is geen override meer.
  const oud = currentStrategy({ capability: BLOK5, goal: doel('TARGET', 3),
    recovery: SCHOON, currentDate: TODAY, buildThrough: addDays(TODAY, -1) });
  ok('een verlopen keuze telt niet meer', oud.phase === 'TAPER', oud.phase);
}

S('6 · De keuze wordt bewaard en gelezen');
{
  store({});
  ok('standaard geen keuze', loadBuildThrough() === null, String(loadBuildThrough()));
  saveBuildThrough(addDays(TODAY, 4));
  ok('bewaard', loadBuildThrough() === addDays(TODAY, 4), String(loadBuildThrough()));
  saveBuildThrough(null);
  ok('en weer te wissen', loadBuildThrough() === null, String(loadBuildThrough()));
  saveBuildThrough('geen datum');
  ok('rommel wordt geweigerd', loadBuildThrough() === null, String(loadBuildThrough()));
}

S('7 · Door de hele keten: haar situatie van vandaag');
{
  // Tien sessies van 5×2×4, en een stretchrace over tien dagen.
  function sessie(date) {
    const laps = []; const hr = 130, p = 8.2;
    for (let i = 0; i < 4; i++) {
      laps.push({ distance: (5 / p) * 1000, moving_time: 300,
        average_heartrate: hr, average_cadence: 80 });
      if (i < 3) laps.push({ distance: (2 / 11.5) * 1000, moving_time: 120,
        average_heartrate: hr - 20, average_cadence: 54 });
    }
    const km = laps.reduce((s, l) => s + l.distance, 0) / 1000;
    return { id: `w_${date}`, date, activityType: 'run', source: 'strava',
      distance: +km.toFixed(2), duration: 26, averageHR: hr, laps, confirmedByUser: true };
  }
  const runs = [];
  for (let i = 9; i >= 0; i--) runs.push(sessie(addDays(TODAY, -(i * 3 + 2))));
  const seed = {
    gc_workouts: JSON.stringify([...runs].reverse()),
    gc_hr_settings: JSON.stringify({ easyLow: 129, easyHigh: 132, released: 154,
      vt1: 132, vt2: 156 }),
    gc_race_goals: JSON.stringify([{ id: 'ter', name: 'Bereloop Terschelling 10 km',
      distanceKm: 10, targetTimeSec: 65 * 60, date: addDays(TODAY, 10), type: 'STRETCH',
      priority: 1, enabled: true, terrain: 'beach' }]),
  };
  const logs = {};
  for (let i = 0; i < 70; i++) {
    const d = addDays(TODAY, -i);
    const log = { date: d, energy: 2, sleep_quality: 2, sleep_hours: 7.5, steps: 8000,
      headache_severity: 0, recovery_check: 'good', training_recovery: 0, muscle_type: 'none' };
    if (runs.some(r => r.date === d)) log.run_done = true;
    seed[`gc_log_${d}`] = JSON.stringify(log);
    logs[d] = log;
  }
  store(seed);
  const plan = coachPlan({ log: logs[TODAY], logs, currentDate: TODAY });
  const b = computeNextSession(logs[TODAY], logs, TODAY);
  const vorm = b.run || b.previewRun;
  console.log(`      fase ${plan.strategy.phase} · as ${plan.strategy.axis} · ${vorm?.description}`);
  ok('de fase is opbouw, niet taper', plan.strategy.phase === 'BASE', plan.strategy.phase);
  ok('de as is bloklengte', plan.strategy.axis === 'BLOCK', plan.strategy.axis);
  ok('en de sessie bouwt afstand op',
    /8 min lopen/.test(vorm?.description || ''), String(vorm?.description));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

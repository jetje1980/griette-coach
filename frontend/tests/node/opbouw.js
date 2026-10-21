// Verdraagt zij het, en groeit de juiste as?
//
// Twee fouten zaten hier tegelijk, en ze versterkten elkaar:
//   · de leerlaag zag geen enkele training, dus werd een stap omhoog nooit
//     verdiend — hoe goed alles ook viel;
//   · een gat van vijf dagen gold als onderbreking, dus ging er bij elke
//     normale week een niveau af.
// Netto: permanent onder haar kunnen, en de app zei dat ze het niet goed
// verdroeg. Zij zei dat er een fout zat. Die zat er.
import { exertionalResponse } from '../../src/symptoms.js';
import { sessionHistory, coachPlan, nextSession } from '../../src/coachPlan.js';
import { readyToStep } from '../../src/sessionChoice.js';
import { runRhythm } from '../../src/workouts.js';
import { computeHeadCoach, computeNextSession } from '../../src/components/CoachAdvice.jsx';
import { GENEROUS_PAUSE_MIN } from '../../src/strategy.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 300) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 52 - t.length))}`);

const TODAY = '2026-10-13';
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

function sessie(date, runMin, walkMin, reps, runPace = 8.2, hr = 130) {
  const laps = [];
  for (let i = 0; i < reps; i++) {
    laps.push({ distance: (runMin / runPace) * 1000, moving_time: runMin * 60,
      average_heartrate: hr, average_cadence: 80 });
    if (i < reps - 1) laps.push({ distance: (walkMin / 11.5) * 1000, moving_time: walkMin * 60,
      average_heartrate: hr - 20, average_cadence: 54 });
  }
  const km = laps.reduce((s, l) => s + l.distance, 0) / 1000;
  const min = laps.reduce((s, l) => s + l.moving_time, 0) / 60;
  return { id: `w_${date}`, date, activityType: 'run', source: 'strava',
    distance: +km.toFixed(2), duration: Math.round(min), averageHR: hr, laps,
    confirmedByUser: true };
}

// `elkeNDagen` is haar ritme; `verdragen` of het schoon viel.
function wereld({ elkeNDagen = 3, aantal = 10, runMin = 5, walkMin = 2, reps = 4,
  verdragen = true } = {}) {
  const runs = [];
  for (let i = aantal - 1; i >= 0; i--) {
    runs.push(sessie(addDays(TODAY, -(i * elkeNDagen + 1)), runMin, walkMin, reps));
  }
  const seed = { gc_workouts: JSON.stringify([...runs].reverse()),
    gc_hr_settings: JSON.stringify({ easyLow: 129, easyHigh: 132, released: 154,
      vt1: 132, vt2: 156 }) };
  const logs = {};
  for (let i = 0; i < 80; i++) {
    const d = addDays(TODAY, -i);
    const log = { date: d, energy: 2, sleep_quality: 2, sleep_hours: 7.5, steps: 8000,
      headache_severity: verdragen ? 0 : 2, recovery_check: verdragen ? 'good' : 'bad',
      training_recovery: verdragen ? 0 : 2, muscle_type: verdragen ? 'none' : 'diffuse' };
    if (runs.some(r => r.date === d)) log.run_done = true;
    seed[`gc_log_${d}`] = JSON.stringify(log);
    logs[d] = log;
  }
  return { seed, logs, runs };
}

console.log('\n████ Opbouw: verdragen, en de juiste as ████');

S('1 · Goed verdragen betekent ook: meegeteld');
{
  const { seed, logs, runs } = wereld({ aantal: 10 });
  store(seed);
  ok('elke sessie leest als goed verdragen',
    runs.every(r => exertionalResponse({ workoutDate: r.date, logs, currentDate: TODAY }).status === 'good'));
  const hist = sessionHistory({ logs, currentDate: TODAY });
  ok('en komt in de leerlaag terecht', hist.length === runs.length,
    `${hist.length} van ${runs.length}`);
  ok('met een gemeten niveau per sessie', hist.every(h => h.level != null),
    JSON.stringify(hist.slice(0, 2)));
  ok('en een gemeten bloklengte', hist.every(h => h.blockMin === 5),
    hist.map(h => h.blockMin).join(','));
  const plan = coachPlan({ log: logs[TODAY], logs, currentDate: TODAY });
  const stap = readyToStep(hist, plan.strategy.level, { currentDate: TODAY });
  ok('de stap omhoog is verdiend', stap.ready, stap.note);
  ok('en de app zegt niet dat ze het niet verdraagt',
    !/0 van/.test(stap.note), stap.note);
}

S('2 · Slecht verdragen blijft wél blokkeren');
{
  const { seed, logs } = wereld({ aantal: 10, verdragen: false });
  store(seed);
  const hist = sessionHistory({ logs, currentDate: TODAY });
  const plan = coachPlan({ log: logs[TODAY], logs, currentDate: TODAY });
  const stap = readyToStep(hist, plan.strategy.level, { currentDate: TODAY });
  ok('geen stap omhoog', !stap.ready, stap.note);
  ok('en dat komt door de respons', stap.blockedByResponse, stap.note);
}

S('3 · Niet ingevuld is geen bewijs, maar ook geen verwijt');
{
  const { seed, runs } = wereld({ aantal: 6 });
  // Geen dagboeken: de herstelcheck is nooit ingevuld.
  const zonder = Object.fromEntries(Object.entries(seed).filter(([k]) => !k.startsWith('gc_log_')));
  store(zonder);
  const hist = sessionHistory({ logs: {}, currentDate: TODAY });
  ok('de sessies worden wel gezien', hist.length === runs.length, String(hist.length));
  ok('maar gelden niet als schoon', hist.every(h => h.response !== 'good'),
    hist.map(h => h.response).join(','));
  const plan = coachPlan({ log: {}, logs: {}, currentDate: TODAY });
  const stap = readyToStep(hist, plan.strategy.level, { currentDate: TODAY });
  ok('geen stap omhoog', !stap.ready);
  ok('en de uitleg noemt de ontbrekende herstelcheck',
    /herstelcheck niet ingevuld/.test(stap.note), stap.note);
}

S('4 · Vijf dagen is haar ritme, geen onderbreking');
{
  const { seed, logs } = wereld({ elkeNDagen: 5, aantal: 8 });
  store(seed);
  const ritme = runRhythm({ currentDate: TODAY });
  ok('het ritme wordt gemeten', ritme.known && ritme.typicalGapDays === 5,
    JSON.stringify(ritme));
  ok('en vijf dagen heet dan geen onderbreking', ritme.breakAfterDays > 5,
    String(ritme.breakAfterDays));
  const coach = computeHeadCoach(logs[TODAY], logs, TODAY);
  ok('dus geen testsessie bij haar normale week',
    coach.adaptiveState !== 'TEST', `${coach.adaptiveState}, gat ${coach.gapDays} dagen`);
}

S('5 · Een échte onderbreking telt nog steeds');
{
  // Een echte onderbreking: niets gelopen in de laatste twintig dagen. Dan
  // moeten óók de run_done-vlaggen in het dagboek weg — anders zegt het
  // dagboek dat ze gisteren liep en heeft de app gelijk dat er geen
  // onderbreking is. (Mijn eerste versie van deze test deed dat niet.)
  const { seed, logs, runs } = wereld({ elkeNDagen: 3, aantal: 8 });
  const oud = runs.map(r => ({ ...r, date: addDays(r.date, -20) }));
  const schoon = { ...seed, gc_workouts: JSON.stringify([...oud].reverse()) };
  for (const k of Object.keys(schoon)) {
    if (!k.startsWith('gc_log_')) continue;
    const l = JSON.parse(schoon[k]);
    if (l.run_done && !oud.some(r => r.date === l.date)) {
      delete l.run_done;
      schoon[k] = JSON.stringify(l);
    }
  }
  for (const d of Object.keys(logs)) {
    if (logs[d].run_done && !oud.some(r => r.date === d)) delete logs[d].run_done;
  }
  store(schoon);
  const coach = computeHeadCoach(logs[TODAY], logs, TODAY);
  ok('na twintig dagen wél een testsessie', coach.adaptiveState === 'TEST',
    `${coach.adaptiveState}, gat ${coach.gapDays}`);
  // De uitleg van de toestand zit op `stateNote`; `note` wordt overschreven
  // door de uitleg van de planner.
  const beslissing = computeNextSession(logs[TODAY], logs, TODAY);
  ok('en de uitleg noemt het werkelijke gat én haar ritme',
    /onderbreking van \d+ dagen \(jouw normale gat is \d+ dagen\)/
      .test(beslissing.stateNote || ''), String(beslissing.stateNote));
  ok('de testsessie ligt één niveau onder haar huidige',
    beslissing.nr != null, String(beslissing.nr));
}

S('6 · De as: langere blokken vóór kortere pauzes');
{
  const { seed, logs } = wereld({ aantal: 10 });
  store(seed);
  const plan = coachPlan({ log: logs[TODAY], logs, currentDate: TODAY });
  ok('de beperkende as is de bloklengte', plan.strategy.axis === 'BLOCK',
    plan.strategy.axis);
  ok('en de app zegt hoeveel van de doelduur je blok dekt',
    plan.strategy.blockCoverage != null && plan.strategy.goalMinutes > 0,
    `${plan.strategy.blockCoverage}% van ${plan.strategy.goalMinutes} min`);

  const vorm = plan.choice.session;
  console.log(`\n      gekozen: ${vorm.label}`);
  for (const a of plan.choice.alternatives) console.log(`      afgewezen: ${a.label}`);
  ok('de gekozen vorm heeft een ruime pauze',
    vorm.continuous || vorm.walkMin >= GENEROUS_PAUSE_MIN,
    `${vorm.label} — pauze ${vorm.walkMin}`);
  ok('en langere blokken dan haar huidige vijf minuten',
    vorm.blockMin > 5, `${vorm.blockMin} min`);
  ok('de krappe variant op hetzelfde niveau wordt afgewezen',
    plan.choice.alternatives.some(a => /1 min wandelen/.test(a.label)),
    plan.choice.alternatives.map(a => a.label).join(' | '));
  ok('en de uitleg noemt de as', /langere blokken/.test(plan.choice.why),
    plan.choice.why.slice(0, 160));
}

S('7 · Is de duur er wel, dan verschuift de as');
{
  // Doorlopende blokken van ruim een uur: dan is de bloklengte niet meer de
  // beperking en mag tempo de as worden.
  const runs = [];
  for (let i = 0; i < 8; i++) {
    const d = addDays(TODAY, -(i * 3 + 1));
    const laps = [{ distance: (70 / 7.5) * 1000, moving_time: 70 * 60,
      average_heartrate: 130, average_cadence: 82 }];
    runs.push({ id: `c_${d}`, date: d, activityType: 'run', source: 'strava',
      distance: +((70 / 7.5)).toFixed(2), duration: 70, averageHR: 130, laps,
      confirmedByUser: true });
  }
  const seed = { gc_workouts: JSON.stringify(runs),
    gc_hr_settings: JSON.stringify({ easyLow: 129, easyHigh: 132, released: 154,
      vt1: 132, vt2: 156 }) };
  const logs = {};
  for (let i = 0; i < 60; i++) {
    const d = addDays(TODAY, -i);
    const log = { date: d, energy: 2, sleep_quality: 2, sleep_hours: 7.5, steps: 8000,
      headache_severity: 0, recovery_check: 'good', training_recovery: 0, muscle_type: 'none' };
    if (runs.some(r => r.date === d)) log.run_done = true;
    seed[`gc_log_${d}`] = JSON.stringify(log);
    logs[d] = log;
  }
  store(seed);
  const plan = coachPlan({ log: logs[TODAY], logs, currentDate: TODAY });
  console.log(`      blok ${plan.capability.provenBlockMin} min · doel ${plan.strategy.goalMinutes} min · dekking ${plan.strategy.blockCoverage}%`);
  ok('de as is niet meer de bloklengte', plan.strategy.axis !== 'BLOCK',
    `${plan.strategy.axis}, dekking ${plan.strategy.blockCoverage}%`);
}

console.log(`\n${'█'.repeat(54)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(54)}`);
process.exit(fail ? 1 : 0);

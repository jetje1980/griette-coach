// De week begint waar zij hem begint — en een rustdag is geen niveauverlies.
//
// Twee fouten die samen "ineens weer terug bij af" opleverden:
//   · het weekplafond telde een rollend venster van zeven dagen, dus de
//     eerste run van haar nieuwe week werd geblokkeerd door de vorige week;
//   · drie belaste dagen op rij gaf DELOAD, en DELOAD is twee niveaus
//     lichter — van 8 minuten blokken naar 3, terwijl alles goed viel.
import { trainingLoad, frequencyVerdict, restDayDecision, runDayCeiling }
  from '../../src/restday.js';
import { startOfWeek, loadWeekStart, saveWeekStart, WEEK_START_LABELS }
  from '../../src/datetime.js';
import { computeHeadCoach, computeNextSession }
  from '../../src/components/CoachAdvice.jsx';
import { coachPlan } from '../../src/coachPlan.js';
import { saveGoal } from '../../src/goals.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 300) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 50 - t.length))}`);

const ZONDAG = '2026-10-18';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };
const dow = (d) => new Date(d + 'T12:00:00').getDay();

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

function sessie(date, runMin = 5, walkMin = 2, reps = 4) {
  const laps = []; const hr = 130, p = 8.2;
  for (let i = 0; i < reps; i++) {
    laps.push({ distance: (runMin / p) * 1000, moving_time: runMin * 60,
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

// `runDagen` zijn dagen-terug vanaf vandaag. `verdragen` of het schoon viel.
function wereld({ today = ZONDAG, runDagen = [], basis = 12, verdragen = true,
  krachtDagen = [] } = {}) {
  // De basis: vier weken van drie runs per week, vóór deze week. Zonder
  // zo'n basis slaat de volumepoort terecht aan, en dan meet je die poort
  // in plaats van de weekgrens. (Mijn eerste versie van deze test had een
  // te dunne basis en de app had gelijk.)
  const runs = [];
  const weekBegin = startOfWeek(today);
  // De basis staat twee tot vijf weken terug, zodat hij niet in het
  // rollende venster van zeven dagen valt. Wat in de afgelopen week ligt
  // komt uitsluitend uit `runDagen` — anders meet de test twee dingen
  // tegelijk en weet je niet welke poort aansloeg.
  for (let w = 2; w <= 5; w++) {
    for (const d of [0, 2, 4]) {
      const datum = addDays(weekBegin, -(w * 7) + d);
      if (datum < addDays(today, -7)) runs.push(sessie(datum));
    }
  }
  for (const n of runDagen) runs.push(sessie(addDays(today, -n)));
  const seed = {
    gc_workouts: JSON.stringify([...runs].sort((a, b) => b.date.localeCompare(a.date))),
    gc_hr_settings: JSON.stringify({ easyLow: 129, easyHigh: 132, released: 154,
      vt1: 132, vt2: 156 }),
  };
  const logs = {};
  for (let i = 0; i < 80; i++) {
    const d = addDays(today, -i);
    const log = { date: d, energy: 2, sleep_quality: 2, sleep_hours: 7.5, steps: 8000,
      headache_severity: verdragen ? 0 : 2, recovery_check: verdragen ? 'good' : 'bad',
      training_recovery: verdragen ? 0 : 2, muscle_type: verdragen ? 'none' : 'diffuse' };
    if (runs.some(r => r.date === d)) log.run_done = true;
    if (krachtDagen.includes(i)) log.core_done = true;
    seed[`gc_log_${d}`] = JSON.stringify(log);
    logs[d] = log;
  }
  return { seed, logs, runs };
}

console.log('\n████ De week, en wat een rustdag betekent ████');

S('1 · De weekstart is instelbaar');
{
  store({});
  ok('standaard begint de week op zondag', loadWeekStart() === 0, String(loadWeekStart()));
  ok('en startOfWeek volgt dat', dow(startOfWeek(ZONDAG)) === 0,
    `${startOfWeek(ZONDAG)} is dag ${dow(startOfWeek(ZONDAG))}`);
  ok('op haar zondag begint de week vandaag', startOfWeek(ZONDAG) === ZONDAG,
    startOfWeek(ZONDAG));
  saveWeekStart(1);
  ok('op maandag gezet verschuift de grens', startOfWeek(ZONDAG) === addDays(ZONDAG, -6),
    startOfWeek(ZONDAG));
  ok('en het label klopt', WEEK_START_LABELS[1] === 'maandag');
  saveWeekStart(0);
}

S('2 · Drie runs in de vorige week blokkeren haar zondag niet');
{
  // Dinsdag, donderdag, zaterdag gelopen — alle drie in de vorige week.
  const { seed, logs } = wereld({ runDagen: [6, 4, 2] });
  store(seed);
  const L = trainingLoad(logs, ZONDAG);
  ok('het rollende venster telt er drie', L.runDays7 === 3,
    `${L.runDays7} — runs: ${JSON.parse(mem.gc_workouts).map(w => w.date).slice(0, 6).join(', ')}`);
  ok('maar deze week nog geen enkele', L.runDaysThisWeek === 0, String(L.runDaysThisWeek));
  ok('en de teller noemt haar weekstart', L.weekStartLabel === 'zondag', L.weekStartLabel);
  const freq = frequencyVerdict(L, logs, ZONDAG);
  ok('geen weekplafond-blokkade', !freq.blockers.some(b => /weekplafond/.test(b)),
    freq.blockers.join(' | '));
  const poort = restDayDecision({ log: logs[ZONDAG], logs, currentDate: ZONDAG,
    coach: { decision: 'GREEN' } });
  ok('en de poort geeft lopen vrij', poort.action === 'RUN_TODAY',
    `${poort.action}: ${(poort.blockers || []).join(' / ')}`);
}

S('3 · Binnen haar eigen week geldt het plafond wél');
{
  // Zondag, maandag, woensdag gelopen; vandaag is donderdag.
  const DO = addDays(ZONDAG, 4);
  const { seed, logs } = wereld({ today: DO, runDagen: [4, 3, 1] });
  store(seed);
  const L = trainingLoad(logs, DO);
  ok('drie loopdagen in deze week', L.runDaysThisWeek === 3, String(L.runDaysThisWeek));
  const freq = frequencyVerdict(L, logs, DO);
  ok('het plafond blokkeert', freq.blockers.some(b => /weekplafond/.test(b)),
    freq.blockers.join(' | '));
  ok('en de melding noemt de weekstart', /vanaf zondag/.test(freq.blockers.join(' ')),
    freq.blockers.join(' | '));
  const poort = restDayDecision({ log: logs[DO], logs, currentDate: DO,
    coach: { decision: 'GREEN' } });
  ok('de poort laat vandaag niet lopen', poort.action !== 'RUN_TODAY', poort.action);
  ok('en zegt wanneer het weer vrijkomt: begin van haar volgende week',
    poort.earliestRunDate === addDays(startOfWeek(DO), 7),
    `${poort.earliestRunDate} tegenover ${addDays(startOfWeek(DO), 7)}`);
}

S('4 · Drie belaste dagen op rij: rustdag, geen niveauverlies');
{
  // Vrijdag en zaterdag gelopen, donderdag kracht. Vandaag zondag.
  const { seed, logs } = wereld({ runDagen: [2, 1], krachtDagen: [3] });
  store(seed);
  const coach = computeHeadCoach(logs[ZONDAG], logs, ZONDAG);
  ok('de toestand is vasthouden, niet terugnemen', coach.adaptiveState === 'HOLD',
    coach.adaptiveState);
  ok('en de reden is frequentie', coach.adaptiveCause === 'frequentie',
    String(coach.adaptiveCause));
  const plan = coachPlan({ log: logs[ZONDAG], logs, currentDate: ZONDAG });
  const b = computeNextSession(logs[ZONDAG], logs, ZONDAG);
  const vorm = b.run || b.previewRun;
  console.log(`      niveau ${plan.strategy.level} · keuze ${plan.choice.level} · app geeft ${vorm?.description}`);
  ok('er gaan geen twee niveaus af',
    (b.nr ?? b.previewNr) >= plan.strategy.level,
    `niveau ${b.nr ?? b.previewNr} tegenover ${plan.strategy.level}`);
  ok('en dus geen 3-minutenblokken', !/^3 min lopen/.test(vorm?.description || ''),
    String(vorm?.description));
  ok('de poort regelt de rustdag',
    coach.gate?.action !== 'RUN_TODAY', String(coach.gate?.action));
}

S('5 · Een slechte respons neemt nog steeds twee niveaus terug');
{
  const { seed, logs } = wereld({ runDagen: [2], verdragen: false });
  store(seed);
  const coach = computeHeadCoach(logs[ZONDAG], logs, ZONDAG);
  const plan = coachPlan({ log: logs[ZONDAG], logs, currentDate: ZONDAG });
  const b = computeNextSession(logs[ZONDAG], logs, ZONDAG);
  console.log(`      beslissing ${coach.decision} · toestand ${coach.adaptiveState} · niveau ${b.nr ?? b.previewNr} van ${plan.strategy.level}`);
  ok('de app neemt terug', ['DELOAD', 'REPEAT', 'SWAP', 'HOLD'].includes(coach.adaptiveState),
    coach.adaptiveState);
  ok('en dat is hier niet op grond van frequentie',
    coach.adaptiveCause !== 'frequentie', String(coach.adaptiveCause));
  ok('het niveau ligt onder haar strategie',
    (b.nr ?? b.previewNr) == null || (b.nr ?? b.previewNr) <= plan.strategy.level,
    `${b.nr ?? b.previewNr} tegenover ${plan.strategy.level}`);
}

S('6 · Het plafond is instelbaar en wordt gerespecteerd');
{
  const { seed, logs } = wereld({ runDagen: [6, 4, 2] });
  store(seed);
  ok('standaard drie loopdagen per week', runDayCeiling() === 3, String(runDayCeiling()));
  // Via dezelfde functie die het instellingenscherm gebruikt — zo toetst
  // deze regel ook of dat scherm het goed wegschrijft.
  saveGoal({ domain: 'RUN', metric: 'run_days_week', target_value: '4',
    direction: 'at_most' });
  ok('een eigen plafond wordt gelezen en gebruikt', runDayCeiling() === 4,
    `${runDayCeiling()} — opgeslagen doelen: ${mem.gc_goals || '(niets)'}`);
}

S('7 · De reden hoort bij de datum die hij zet');
{
  // Op haar scherm stond: "Gisteren gelopen — minstens één volle rustdag
  // tussen twee runs. Weer vrij vanaf maandag 9 november." Die twee horen
  // niet bij elkaar: één volle rustdag na zaterdag is zondag. De maandag
  // kwam van een heel andere blokkade — het weekvolume — en die stond
  // nergens. Ze las dus een reden die de datum niet verklaarde, en kon er
  // niets mee: op "gisteren gelopen" kun je wachten, op "134 minuten tegen
  // een basis van 63" kun je je week anders inrichten.
  //
  // Haar eigen cijfers van 7 november staan hier als ijkpunt.
  const VANDAAG = '2026-11-07';
  const runs = [
    { id: 'w1', date: '2026-11-06', duration: 34.1, distance: 3.31, activityType: 'run' },
    { id: 'w2', date: '2026-11-01', duration: 33.4, distance: 3.01, activityType: 'run' },
    { id: 'w3', date: '2026-11-01', duration: 66.3, distance: 6.27, activityType: 'run' },
    { id: 'w4', date: '2026-10-28', duration: 22.4, distance: 2.0, activityType: 'run' },
    { id: 'w5', date: '2026-10-24', duration: 45, distance: 4.48, activityType: 'run' },
    { id: 'w6', date: '2026-10-22', duration: 33.1, distance: 3.41, activityType: 'run' },
    { id: 'w7', date: '2026-10-18', duration: 36.6, distance: 3.88, activityType: 'run' },
    { id: 'w8', date: '2026-10-11', duration: 37.2, distance: 3.88, activityType: 'run' },
    { id: 'w9', date: '2026-10-07', duration: 38.3, distance: 3.73, activityType: 'run' },
    { id: 'w10', date: '2026-10-04', duration: 40, distance: 4.45, activityType: 'run' },
  ];
  const logs = {
    '2026-11-07': { date: VANDAAG, headache_severity: 0, recovery_check: 'good',
      hr_rest: 66, sleep_quality: 1, energy: 2, sleep_hours: 6.5 },
    '2026-11-06': { date: '2026-11-06', run_done: true, hr_rest: 66, energy: 2,
      training_recovery: 0, sleep_hours: 6.5 },
    '2026-11-01': { date: '2026-11-01', run_done: true, hr_rest: 61, sleep_hours: 8.5 },
  };
  const seed = { gc_workouts: JSON.stringify(runs) };
  for (const [d, v] of Object.entries(logs)) seed[`gc_log_${d}`] = JSON.stringify(v);
  store(seed);

  const g = restDayDecision({ log: logs[VANDAAG], logs, currentDate: VANDAAG });
  console.log(`      ${g.action} · vrij vanaf ${g.earliestRunDate}`);
  console.log(`      bindend: ${g.binding?.reason}`);
  ok('lopen staat op slot', g.action !== 'RUN_TODAY', g.action);
  ok('de genoemde reden staat ook in de lijst met blokkades',
    g.blockers.some(b => b.includes(g.binding.reason)),
    g.blockers.join(' | '));
  ok('en dat is ook wat de samenvatting zegt',
    g.summary === g.binding.reason, g.summary);

  // ── En hoe laat is "weer vrij" nu werkelijk? ──────────────────
  //
  // Hier stond eerst dat het maandag moest zijn, omdat de volumeblokkade
  // "over twee dagen" rekende. Dat was geen berekening maar een gok, en
  // hij kostte haar een loopdag: zij vroeg om de dag te lopen, en op
  // zondag staat de poort allang open — dan valt de zware dag van 1
  // november uit het rollende venster van zeven dagen. Een vooruitblik
  // die te laat belooft is net zo fout als een die te vroeg belooft.
  ok('weer vrij op zondag, de dag die om-de-dag oplevert',
    g.earliestRunDate === '2026-11-08', g.earliestRunDate);
  ok('en op die dag staat lopen er ook echt op',
    restDayDecision({ log: {}, logs, currentDate: '2026-11-08' }).action === 'RUN_TODAY',
    restDayDecision({ log: {}, logs, currentDate: '2026-11-08' }).action);
  // De bindende reden hoort nu bij die zondag: dat is de rustdagregel.
  ok('en de reden die erbij staat hoort bij die datum',
    /rustdag/.test(g.binding?.reason || ''), String(g.binding?.reason));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

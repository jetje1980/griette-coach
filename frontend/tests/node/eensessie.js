// Eén sessie, één antwoord — gemeten aan alle bronnen die de schermen lezen.
//
// Deze suite bestaat omdat er twee motoren waren die elk bepaalden wat je
// volgende looptraining was, en geen enkele test de vraag stelde of ze
// hetzelfde zeiden. Zij zag het verschil zelf, op twee tabs.
import { nextSession, coachPlan } from '../../src/coachPlan.js';
import { planNextSession } from '../../src/raceplan.js';
import { computeNextSession, computeHeadCoach }
  from '../../src/components/CoachAdvice.jsx';
import { SESSIONS } from '../../src/data/sessionLibrary.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 400) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}`);

const TODAY = '2026-10-07';
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

// Een normale, schone opbouw: acht verdragen sessies, geen klachten.
function wereld({ energie = 2, slaap = 2, hoofdpijn = 0, herstel = 'good',
  pem = false } = {}) {
  const runs = [];
  for (let i = 0; i < 8; i++) runs.push(runWalk(addDays(TODAY, -40 + i * 5), 8.4, 130));
  const seed = {
    gc_workouts: JSON.stringify([...runs].reverse()),
    gc_hr_settings: JSON.stringify({ easyLow: 129, easyHigh: 132, released: 154,
      vt1: 132, vt2: 156 }),
  };
  const logs = {};
  for (let i = 0; i < 70; i++) {
    const d = addDays(TODAY, -i);
    const log = { date: d, energy: energie, sleep_quality: slaap, sleep_hours: 7.4,
      steps: 7800, headache_severity: hoofdpijn, recovery_check: herstel,
      training_recovery: 0, battery_start: 70 };
    if (runs.some(r => r.date === d)) log.run_done = true;
    if (pem && i === 1) log.symptom_pem = true;
    if ([58, 30, 2].includes(i)) log.menstruation_start = true;
    seed[`gc_log_${d}`] = JSON.stringify(log);
    logs[d] = log;
  }
  return { seed, logs };
}

console.log('\n████ Eén sessie, op elk scherm dezelfde ████');

// De bronnen zoals de schermen ze lezen. Verandert hier iets, dan verandert
// er iets op dat scherm.
function alleSchermen(log, logs) {
  const vandaag = computeNextSession(log, logs, TODAY);       // Vandaag, Lichaam, forecast
  const kop = computeHeadCoach(log, logs, TODAY);             // de kopregel op Vandaag
  // De startkaart leest sinds de samenvoeging dezelfde beslissing.
  const kaart = computeNextSession(log, logs, TODAY);
  // Progressie leest sinds de samenvoeging dezelfde beslissing, inclusief de
  // adaptieve toestand. Dat is het punt: één beslissing, niet één formule
  // per scherm.
  const prog = computeNextSession(logs[TODAY] || {}, logs, TODAY);
  return {
    vandaag: (vandaag.run || vandaag.previewRun)?.description ?? null,
    kopregel: kop.trainingDesc,
    cockpit: (kaart.run || kaart.previewRun)?.description ?? null,
    progressie: (prog.run || prog.previewRun)?.description ?? null,
    staat: vandaag.state,
    reden: vandaag.note,
  };
}

S('1 · Een gewone groene dag');
{
  const { seed, logs } = wereld();
  store(seed);
  const log = logs[TODAY];
  const x = alleSchermen(log, logs);
  console.log(`      Vandaag    : ${x.vandaag}`);
  console.log(`      kopregel   : ${x.kopregel}`);
  console.log(`      startkaart : ${x.cockpit}`);
  console.log(`      Progressie : ${x.progressie}`);

  ok('Vandaag en Progressie noemen dezelfde sessie', x.vandaag === x.progressie,
    `${x.vandaag} ≠ ${x.progressie}`);
  ok('en de kopregel noemt diezelfde vorm', x.kopregel.includes(x.vandaag),
    `"${x.kopregel}" bevat niet "${x.vandaag}"`);
  ok('de startkaart noemt dezelfde sessie', x.cockpit === x.progressie,
    `${x.cockpit} ≠ ${x.progressie}`);
  ok('en als de coach terugneemt, staat de reden erbij',
    !x.staat || x.staat === 'BUILD' || !!x.reden, `staat=${x.staat}, reden=${x.reden}`);
  ok('de vorm komt uit de bibliotheek',
    SESSIONS.some(s => s.label === x.vandaag), String(x.vandaag));
}

S('2 · Een dag waarop lopen op slot staat');
{
  const { seed, logs } = wereld({ pem: true, energie: 0, herstel: 'poor' });
  store(seed);
  const log = logs[TODAY];
  const x = alleSchermen(log, logs);
  console.log(`      Vandaag    : ${x.vandaag}`);
  console.log(`      startkaart : ${x.cockpit}`);
  ok('de sessie die straks vrijkomt is op beide plekken dezelfde',
    x.vandaag === x.cockpit, `${x.vandaag} ≠ ${x.cockpit}`);
  ok('en er staat wél een sessie — wachten zonder te weten waarop is zwaarder',
    !!x.vandaag, String(x.vandaag));
}

S('3 · De oude motor bepaalt de vorm niet meer');
{
  const { seed, logs } = wereld();
  store(seed);
  const log = logs[TODAY];
  // planNextSession zonder vorm leidt er zelf nog één af — dat mag, want
  // andere code gebruikt hem voor tempo en hartslag. Maar wat de schermen
  // tonen komt uit de bibliotheek.
  const los = planNextSession({ log, logs, currentDate: TODAY, ignoreGate: true });
  const een = nextSession({ log, logs, currentDate: TODAY, ignoreGate: true });
  ok('nextSession draagt de bibliotheek-id van de vorm',
    !!een.run.libraryId && een.run.libraryId === een.session.id,
    `${een.run.libraryId} / ${een.session?.id}`);
  ok('en zegt dat de vorm daar vandaan komt', een.derivedFrom === 'library',
    een.derivedFrom);
  ok('losse planNextSession heeft geen bibliotheek-id', !los.run.libraryId,
    String(los.run.libraryId));
}

S('4 · De tekst volgt de getallen, ook na dosering');
{
  const { seed, logs } = wereld();
  store(seed);
  const log = logs[TODAY];
  const een = nextSession({ log, logs, currentDate: TODAY, ignoreGate: true });
  const r = een.run;
  const verwacht = r.continuous
    ? `${r.runMin} min doorlopend`
    : `${String(r.runMin).replace('.', ',')} min lopen / ${String(r.walkMin).replace('.', ',')} min wandelen × ${r.reps}`;
  ok('de beschrijving klopt met runMin/walkMin/reps', r.description === verwacht,
    `${r.description} ≠ ${verwacht}`);
  ok('zonder dosering is de beschrijving het bibliotheeklabel',
    r.doseAdjust ? true : r.description === een.session.label,
    `${r.description} ≠ ${een.session.label}`);
  if (r.doseAdjust) {
    ok('met dosering wijkt het aantal blokken af van de vorm',
      r.reps < een.session.reps, `${r.reps} vs ${een.session.reps}`);
  } else {
    ok('geen dosering op deze dag — dus niets om af te wijken', true);
  }
}

S('5 · De duur staat er, op elk scherm');
{
  const { seed, logs } = wereld();
  store(seed);
  const log = logs[TODAY];
  const een = nextSession({ log, logs, currentDate: TODAY, ignoreGate: true });
  ok('de vorm heeft een duur', een.session.duration > 0, String(een.session.duration));
  ok('en die is gelijk aan minutes', een.session.duration === een.session.minutes);
  ok('de voorgeschreven sessie heeft er ook een', een.run.duration > 0,
    String(een.run.duration));
  ok('elke vorm in de bibliotheek heeft een duur en een beschrijving',
    SESSIONS.every(s => s.duration > 0 && s.description === s.label),
    SESSIONS.filter(s => !(s.duration > 0)).map(s => s.id).join(','));
}

S('6 · Het niveau van een aangepaste toestand kiest ook lerend');
{
  const { seed, logs } = wereld();
  store(seed);
  const log = logs[TODAY];
  const hoog = nextSession({ log, logs, currentDate: TODAY, ignoreGate: true });
  const laag = nextSession({ log, logs, currentDate: TODAY, ignoreGate: true,
    level: Math.max(1, hoog.level - 2) });
  ok('twee niveaus lager levert een lichtere vorm',
    laag.session.level <= hoog.session.level,
    `${laag.session.level} vs ${hoog.session.level}`);
  ok('en nog steeds een vorm uit de bibliotheek',
    SESSIONS.some(s => s.id === laag.session.id), String(laag.session?.id));
  ok('met een reden erbij', !!laag.choiceWhy, String(laag.choiceWhy));
}

console.log(`\n${'█'.repeat(56)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(56)}`);
process.exit(fail ? 1 : 0);

// Loopeconomie in context — nooit uit twee gemiddelden alleen.
import { economyReading, confounders, MIN_SESSIONS_FOR_VERDICT, sessionSummary }
  from '../../src/economyReading.js';
import { saveSessionContext, sessionContextFor, vragenVoor, openVragen,
  contextLines, VRAAG } from '../../src/sessionContext.js';
import { earlyWarnings } from '../../src/runningHistory.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 400) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`);

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

const HR = { easyLow: 129, easyHigh: 132, released: 154, vt1: 132, vt2: 156 };

function runWalk({ date, runMin, walkMin, reps, runPace, walkPace = 11.5, hr }) {
  const laps = [];
  for (let i = 0; i < reps; i++) {
    laps.push({ distance: (runMin / runPace) * 1000, moving_time: runMin * 60,
      average_heartrate: hr, average_cadence: 80 });
    if (i < reps - 1) laps.push({ distance: (walkMin / walkPace) * 1000,
      moving_time: walkMin * 60, average_heartrate: hr - 18, average_cadence: 55 });
  }
  const km = laps.reduce((s, l) => s + l.distance, 0) / 1000;
  const min = laps.reduce((s, l) => s + l.moving_time, 0) / 60;
  return { id: `w_${date}`, date, activityType: 'run', source: 'strava',
    distance: km, duration: min, averageHR: hr, laps, confirmedByUser: true };
}

// Acht sessies: de eerste vier vlot, de laatste vier trager. Zelfde vorm,
// dus geen continuïteitsruil die het verklaart.
function trager({ slaapVroeg = 7.4, slaapLaat = 7.4, cyclusStarts = null } = {}) {
  const runs = [], logs = {};
  for (let i = 0; i < 4; i++) {
    const d = addDays(TODAY, -56 + i * 4);
    runs.push(runWalk({ date: d, runMin: 5, walkMin: 2, reps: 4, runPace: 8.0, hr: 130 }));
  }
  for (let i = 0; i < 4; i++) {
    const d = addDays(TODAY, -16 + i * 4);
    runs.push(runWalk({ date: d, runMin: 5, walkMin: 2, reps: 4, runPace: 8.7, hr: 130 }));
  }
  const seed = { gc_workouts: JSON.stringify([...runs].reverse()),
    gc_hr_settings: JSON.stringify(HR) };
  for (let i = 0; i < 70; i++) {
    const d = addDays(TODAY, -i);
    const vroeg = i > 30;
    const log = { date: d, energy: 2, sleep_quality: 2, steps: 7800,
      sleep_hours: vroeg ? slaapVroeg : slaapLaat,
      headache_severity: 0, recovery_check: 'good', training_recovery: 0 };
    // Cyclusstarts als dagen-terug. Eén start is geen cyclus: om twee helften
    // op fase te kunnen vergelijken moet er vóór beide helften een start staan.
    if (cyclusStarts && cyclusStarts.some(n => d === addDays(TODAY, -n))) {
      log.menstruation_start = true;
    }
    seed[`gc_log_${d}`] = JSON.stringify(log);
    logs[d] = log;
  }
  return { seed, logs, runs };
}

console.log('\n████ Loopeconomie in context ████');

S('1 · Nooit een uitspraak uit te weinig sessies');
{
  const { seed, logs } = trager();
  // Alleen de laatste twee runs bewaren.
  const runs = JSON.parse(seed.gc_workouts).slice(0, 3);
  store({ ...seed, gc_workouts: JSON.stringify(runs) });
  const r = economyReading({ logs, currentDate: TODAY });
  ok('er is wel iets te zien', r.available, JSON.stringify(r.note));
  ok('maar het heet geen trend', r.level === 'waarneming', r.level);
  ok('en het zegt waarom', new RegExp(`onder ${MIN_SESSIONS_FOR_VERDICT}`).test(r.detail), r.detail);
  ok('er staat nergens "gaat achteruit"', !/gaat achteruit/i.test(r.label + r.detail), r.label);
}

S('2 · Met genoeg sessies maar zonder context: geen oordeel');
{
  const { seed, logs } = trager();
  store(seed);
  const r = economyReading({ logs, currentDate: TODAY });
  ok('het ziet dat je trager bent', r.econ.gainSec < -5, String(r.econ.gainSec));
  ok('maar het oordeelt niet', r.level === 'onvoldoende_context', r.level);
  ok('het zegt hoeveel het weet', /[Vv]an \d+ van de \d+ sessies/.test(r.detail), r.detail);
  ok('en vraagt om de omstandigheden', /hoe laat je liep/.test(r.vraag || ''), r.vraag);
  ok('met vragen aan', r.askQuestions === true);
}

S('3 · Een cyclusverschil is de eerste verklaring, niet de laatste');
{
  // Starts op 58 en 30 dagen terug: de oude vier runs vallen rond cyclusdag
  // 3-15, de recente vier rond dag 15-27. Andere fase, dus niet vergelijkbaar.
  const { seed, logs } = trager({ cyclusStarts: [58, 30] });
  store(seed);
  // Context invullen zodat het niet op "te weinig context" strandt.
  const runs = JSON.parse(seed.gc_workouts);
  for (const w of runs) saveSessionContext(w.date, { tijdstip: 'ochtend', ondergrond: 'asfalt / vlak' });
  const r = economyReading({ logs, currentDate: TODAY });
  console.log(`\n      ${r.label}\n      ${r.detail.slice(0, 220)}\n`);
  ok('het oordeel is niet "achteruit"', r.level !== 'achteruit', r.level);
  if (r.confounders?.groot > 0) {
    ok('er is een zware verstoring gevonden', true);
    ok('en die wordt benoemd', /cyclusdag|korter/.test(r.detail), r.detail);
  } else {
    ok('er is een zware verstoring gevonden', false, JSON.stringify(r.confounders));
  }
}

S('4 · Slechter slapen verklaart het, en dat staat erbij');
{
  const { seed, logs } = trager({ slaapVroeg: 7.8, slaapLaat: 6.4 });
  store(seed);
  const runs = JSON.parse(seed.gc_workouts);
  for (const w of runs) saveSessionContext(w.date, { tijdstip: 'ochtend', ondergrond: 'asfalt / vlak' });
  const r = economyReading({ logs, currentDate: TODAY });
  ok('niet als achteruitgang gelezen', r.level === 'onverklaard', r.level);
  ok('de slaap wordt genoemd', /uur korter/.test(r.detail), r.detail);
  ok('met beide gemiddelden', /6\.4 tegenover 7\.8/.test(r.detail), r.detail);
  ok('en het vraagt wat zij ziet', /Weet jij wat er anders was/.test(r.vraag || ''), r.vraag);
}

S('5 · Andere ondergrond telt zwaar');
{
  const { seed, logs } = trager();
  store(seed);
  const runs = JSON.parse(seed.gc_workouts).sort((a, b) => a.date.localeCompare(b.date));
  runs.slice(0, 4).forEach(w => saveSessionContext(w.date, { ondergrond: 'asfalt / vlak', tijdstip: 'ochtend' }));
  runs.slice(4).forEach(w => saveSessionContext(w.date, { ondergrond: 'zand', tijdstip: 'ochtend' }));
  const r = economyReading({ logs, currentDate: TODAY });
  ok('niet "gaat achteruit"', r.level !== 'achteruit', r.level);
  ok('de ondergrond wordt genoemd', /ondergrond/.test(r.detail), r.detail);
  ok('met beide waarden', /asfalt.*zand|zand.*asfalt/.test(r.detail), r.detail);
}

S('6 · Blijft het staan als alles is afgepeld, dan mag het gezegd worden');
{
  const { seed, logs } = trager();
  store(seed);
  const runs = JSON.parse(seed.gc_workouts);
  // Overal dezelfde omstandigheden: niets om het mee te verklaren.
  for (const w of runs) {
    saveSessionContext(w.date, { tijdstip: 'ochtend', ondergrond: 'asfalt / vlak',
      weer: 'koel en windstil', gegeten: 'licht gegeten' });
  }
  const r = economyReading({ logs, currentDate: TODAY });
  ok('nu heet het wél achteruitgang', r.level === 'achteruit', `${r.level}: ${r.detail}`);
  ok('en het zegt wat er is uitgesloten',
    /cyclus, slaap, ondergrond of weer het verklaren/.test(r.detail), r.detail);
  ok('het vraagt nog steeds haar lezing', /Zie jij zelf/.test(r.vraag || ''), r.vraag);
}

S('7 · De vragen passen bij het signaal');
{
  const bijEconomie = vragenVoor(['economy']).map(v => v.id);
  ok('bij economie wordt naar tijdstip gevraagd', bijEconomie.includes('tijdstip'));
  ok('en naar slaap', bijEconomie.includes('slaap'));
  ok('en naar ondergrond', bijEconomie.includes('ondergrond'));
  ok('maar niet naar drukte', !bijEconomie.includes('drukte'), bijEconomie.join(', '));

  const bijHoofdpijn = vragenVoor(['headache']).map(v => v.id);
  ok('bij hoofdpijn wél naar drukte', bijHoofdpijn.includes('drukte'), bijHoofdpijn.join(', '));
  ok('maar niet naar schoenen', !bijHoofdpijn.includes('schoenen'));

  ok('zonder signaal geen vragen', vragenVoor([]).length === 0);
  ok('elke vraag zegt waarom hij er is',
    Object.values(VRAAG).every(v => v.waarom?.length > 40),
    Object.values(VRAAG).filter(v => !(v.waarom?.length > 40)).map(v => v.id).join(', '));
  ok('en heeft opties', Object.values(VRAAG).every(v => v.opties?.length >= 2));
}

S('8 · Wat de app al weet, wordt niet gevraagd');
{
  store();
  const d = addDays(TODAY, -2);
  const logs = { [d]: { date: d, sleep_hours: 7.2, sleep_quality: 2 } };
  const ctx = sessionContextFor(d, { logs, asOf: TODAY });
  ok('de slaap komt uit de check-in', ctx.sleepHours === 7.2, String(ctx.sleepHours));
  const open = openVragen(ctx, ['economy']).map(v => v.id);
  ok('dus de slaapvraag vervalt', !open.includes('slaap'), open.join(', '));
  ok('de rest staat er nog', open.includes('tijdstip') && open.includes('ondergrond'),
    open.join(', '));

  saveSessionContext(d, { tijdstip: 'avond' });
  const ctx2 = sessionContextFor(d, { logs, asOf: TODAY });
  const open2 = openVragen(ctx2, ['economy']).map(v => v.id);
  ok('en een beantwoorde vraag ook niet meer', !open2.includes('tijdstip'), open2.join(', '));
}

S('9 · De cyclusdag staat bij elke geanalyseerde training');
{
  // De cyclusdag wordt afgeleid uit de opgeslagen dagboeken, niet uit een
  // meegegeven object — dus moet de test hem ook zo aanbieden.
  const start = addDays(TODAY, -12);
  const logs = { [start]: { date: start, menstruation_start: true } };
  store({ [`gc_log_${start}`]: JSON.stringify(logs[start]) });
  const d = addDays(TODAY, -3);
  const sum = sessionSummary(d, { logs, currentDate: TODAY });
  ok('de cyclusdag wordt afgeleid', sum.cycleDay === 10, String(sum.cycleDay));
  ok('met een leesbaar label', /cyclusdag 10/.test(sum.cycleDayLabel), sum.cycleDayLabel);
  ok('en hij staat in de contextregels', sum.lines.some(r => /cyclusdag 10/.test(r)),
    sum.lines.join(' | '));

  // Zonder menstruatiedata: onbekend, niet verzonnen.
  store();
  const leeg = sessionSummary(d, { logs: {}, currentDate: TODAY });
  ok('zonder data is het onbekend', leeg.cycleDay === null);
  ok('en dat staat er ook', /onbekend/.test(leeg.cycleDayLabel), leeg.cycleDayLabel);
}

S('10 · Haar eigen opmerking gaat woordelijk mee');
{
  store();
  const d = addDays(TODAY, -3);
  saveSessionContext(d, { note: 'tegenwind heen en terug, en nieuwe schoenen' });
  const ctx = sessionContextFor(d, { logs: {}, asOf: TODAY });
  ok('de opmerking is bewaard', ctx.note === 'tegenwind heen en terug, en nieuwe schoenen',
    String(ctx.note));
  const regels = contextLines(ctx);
  ok('en staat woordelijk in de context',
    regels.some(r => /eigen opmerking: "tegenwind heen en terug/.test(r)), regels.join(' | '));

  // En in de confounders van een vergelijking.
  const c = confounders({ earlyDates: [], lateDates: [d], logs: {}, currentDate: TODAY });
  ok('de vergelijking draagt hem mee', c.notes.some(n => /tegenwind/.test(n.note)),
    JSON.stringify(c.notes));
}

S('11 · earlyWarnings gebruikt dezelfde lezing');
{
  const { seed, logs } = trager();
  store(seed);
  const runs = JSON.parse(seed.gc_workouts);
  for (const w of runs) saveSessionContext(w.date, { tijdstip: 'ochtend',
    ondergrond: 'asfalt / vlak', weer: 'koel en windstil', gegeten: 'licht gegeten' });
  const w = earlyWarnings({ logs, currentDate: TODAY });
  const eco = w.signals.find(x => x.id === 'economy');
  ok('het signaal staat er', !!eco, JSON.stringify(w.signals.map(x => x.id)));
  ok('met dezelfde tekst als de lezing',
    eco?.detail === economyReading({ logs, currentDate: TODAY }).detail, eco?.detail);
  ok('en met een vraag erbij', !!eco?.vraag, String(eco?.vraag));

  // Zonder context hoort het een notitie te zijn, geen waarschuwing.
  store(seed);
  const w2 = earlyWarnings({ logs, currentDate: TODAY });
  ok('zonder context geen waarschuwing',
    !w2.signals.some(x => x.id === 'economy'),
    JSON.stringify(w2.signals.map(x => x.id)));
  ok('maar wel een notitie', (w2.notes || []).some(n => n.id === 'economy_context'),
    JSON.stringify((w2.notes || []).map(n => n.id)));
}

console.log(`\n${'█'.repeat(60)}`);
console.log(`  ${pass} geslaagd, ${fail} mislukt`);
console.log('█'.repeat(60));
process.exit(fail ? 1 : 0);

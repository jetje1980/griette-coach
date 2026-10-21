// Haar werkelijke vier runs uit Strava, en wat de app daarmee doet.
//
// Drie fouten kwamen hier samen, en alle drie gaven haar een kórtere sessie
// dan ze net had gelopen:
//
//   1. provenStructure() las alleen sessies met een ingevulde herstelcheck.
//      Ontbrak die, dan was er "geen bewezen structuur" en viel de hele app
//      terug op niveau 1: 1 minuut lopen × 4. Voor iemand die drie dagen
//      eerder 3 × 8 minuten liep, met rondes en hartslag in Strava.
//   2. de afwisselingsstraf (−25) was groter dan de niveaustraf (−6), dus
//      koos de app een niveau lager omdat ze die vorm net had gedaan —
//      terwijl ze juist een tweede sessie op dat niveau nodig had.
//   3. de gemeten pauze deelde alle wandelminuten door alle wandelblokken,
//      inclusief inwandelen en uitlopen: 3,3 minuten pauze in plaats van 2.
import { coachPlan, sessionHistory } from '../../src/coachPlan.js';
import { readyToStep } from '../../src/sessionChoice.js';
import { provenStructure } from '../../src/raceplan.js';
import { computeNextSession, computeHeadCoach } from '../../src/components/CoachAdvice.jsx';
import { densityOf } from '../../src/sessionDensity.js';
import { intensityRelease, loadHrModel } from '../../src/hrModel.js';
import { exertionalResponse } from '../../src/symptoms.js';
import { trainingLoad } from '../../src/restday.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`    ✓ ${n}`); }
  else { fail++; console.log(`    ✗ ${n}${e ? ' — ' + String(e).slice(0, 220) : ''}`); }
};

const TODAY = '2026-10-21';
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
let mem={};
globalThis.localStorage={get length(){return Object.keys(mem).length;},key:i=>Object.keys(mem)[i]??null,
getItem:k=>(k in mem?mem[k]:null),setItem:(k,v)=>{mem[k]=String(v);},removeItem:k=>{delete mem[k];}};
globalThis.sessionStorage=globalThis.localStorage;

// Exact de rondes zoals Strava ze teruggaf. [sec, meters, gem.HR, cadans]
const RONDES = {
  '2026-10-18': [[300,404.75,119,61],[480,988.46,142,79],[120,175.98,144,58],[480,838.94,152,75],
                 [120,165.46,141,61],[480,965.26,152,80],[256,338.74,143,59]],
  '2026-10-11': [[300,419.51,124,59],[300,573.90,145,75],[60,84.23,141,58],[300,560.70,149,74],
                 [60,82.34,160,59],[300,579.64,150,76],[60,92.91,153,64],[300,566.78,151,73],
                 [60,80.79,149,58],[300,586.94,160,75],[196,255.63,148,56]],
  '2026-10-07': [[300,427.85,111,58],[300,587.54,141,76],[60,86.49,139,60],[300,544.74,146,72],
                 [60,84.03,135,57],[300,526.74,135,72],[60,87.64,118,56],[300,519.25,150,68],
                 [60,89.43,141,58],[300,525.91,155,69],[259,249.25,162,56]],
};
const workouts = Object.entries(RONDES).map(([date, rondes]) => {
  const laps = rondes.map(([sec, m, hr, cad]) => ({ distance: m, moving_time: sec,
    average_heartrate: hr, average_cadence: cad }));
  const km = laps.reduce((s,l)=>s+l.distance,0)/1000;
  const min = laps.reduce((s,l)=>s+l.moving_time,0)/60;
  const hrGem = Math.round(laps.reduce((s,l)=>s+l.average_heartrate*l.moving_time,0)
    / laps.reduce((s,l)=>s+l.moving_time,0));
  return { id:`s_${date}`, date, activityType:'run', source:'strava',
    distance:+km.toFixed(2), duration:Math.round(min), averageHR:hrGem, laps, confirmedByUser:true };
});
// 4 oktober alleen als samenvatting: Strava gaf daar geen rondes voor op.
workouts.push({ id:'s_2026-10-04', date:'2026-10-04', activityType:'run', source:'strava',
  distance:4.45, duration:40, averageHR:140, confirmedByUser:true });

mem.gc_workouts = JSON.stringify(workouts.sort((a,b)=>b.date.localeCompare(a.date)));
mem.gc_hr_settings = JSON.stringify({ easyLow:106, easyHigh:132, released:154, vt1:132, vt2:156 });

// Twee varianten: met en zonder ingevulde herstelcheck.
function logsMet(ingevuld) {
  const logs = {};
  for (let i=0;i<60;i++) {
    const d = addDays(TODAY,-i);
    const log = { date:d, energy:2, sleep_quality:2, sleep_hours:7.5, steps:8000 };
    if (ingevuld) Object.assign(log, { headache_severity:0, recovery_check:'good',
      training_recovery:0, muscle_type:'none' });
    if (workouts.some(w=>w.date===d)) log.run_done = true;
    mem[`gc_log_${d}`] = JSON.stringify(log);
    logs[d] = log;
  }
  return logs;
}

for (const ingevuld of [true, false]) {
  const logs = logsMet(ingevuld);
  console.log(`\n${'═'.repeat(68)}`);
  console.log(`  HERSTELCHECKS ${ingevuld ? 'INGEVULD' : 'NIET INGEVULD'}`);
  console.log('═'.repeat(68));

  console.log('\n  wat de app in je rondes ziet:');
  for (const w of workouts.filter(w=>w.laps)) {
    const d = densityOf(w);
    const resp = exertionalResponse({ workoutDate: w.date, logs, currentDate: TODAY });
    console.log(`    ${w.date}: ${d.available ? `${d.runBlocks}× ${d.blockMin} min, pauze ${d.pausePerBlockMin} min, loop-HR ${d.runHr}` : d.reason} · respons ${resp.status}`);
  }

  const proven = provenStructure({ logs, currentDate: TODAY });
  console.log(`\n  bewezen vorm: ${proven ? `${proven.reps}× ${proven.runMin} min / ${proven.walkMin} min · langste blok ${proven.provenBlockMin} min (uit ${proven.sessions} sessies)` : '(geen)'}`);

  const plan = coachPlan({ log: logs[TODAY], logs, currentDate: TODAY });
  const hist = sessionHistory({ logs, currentDate: TODAY });
  const stap = readyToStep(hist, plan.strategy.level, { currentDate: TODAY });
  console.log(`  niveau ${plan.strategy.level} · fase ${plan.strategy.phase} · as ${plan.strategy.axis}`);
  console.log(`  historie: ${hist.map(h=>`${h.date.slice(5)} n${h.level} ${h.response}`).join(' · ')}`);
  console.log(`  stap omhoog: ${stap.ready} — ${stap.note}`);

  const rel = intensityRelease({ logs, currentDate: TODAY, model: loadHrModel() });
  console.log(`  hartslag vrijgegeven tot: ${rel.ceiling} (${rel.label})`);

  const L = trainingLoad(logs, TODAY);
  console.log(`  deze week: ${L.runDaysThisWeek} loopdagen vanaf ${L.weekStartLabel} · rollend 7d: ${L.runDays7}`);

  const coach = computeHeadCoach(logs[TODAY], logs, TODAY);
  const b = computeNextSession(logs[TODAY], logs, TODAY);
  console.log(`  poort: ${coach.gate?.action}${(coach.gate?.blockers||[]).length ? ' — ' + coach.gate.blockers.join(' / ') : ''}`);
  const vorm = b.run || b.previewRun;
  console.log(`  >>> de app geeft: ${vorm?.description} (${vorm?.duration} min)`);

  console.log('\n  controles:');
  ok('de pauze tussen de blokken is 2 min, niet 3,3',
    densityOf(workouts.find(w => w.date === '2026-10-18')).pausePerBlockMin === 2,
    String(densityOf(workouts.find(w => w.date === '2026-10-18')).pausePerBlockMin));
  ok('haar langste blok van 8 minuten staat vast', proven?.provenBlockMin === 8,
    String(proven?.provenBlockMin));
  ok('het niveau is 6', plan.strategy.level === 6, String(plan.strategy.level));
  ok('de sessie heeft blokken van 8 minuten',
    /^8 min lopen/.test(vorm?.description || ''), String(vorm?.description));
  ok('met een ruime pauze', !/\/ 1 min wandelen/.test(vorm?.description || ''),
    String(vorm?.description));
  ok('de sessie is niet korter dan wat ze net liep',
    (vorm?.duration ?? 0) >= 24, String(vorm?.duration));
  if (ingevuld) {
    ok('met ingevulde checks telt de structuur als verdragen', proven?.tolerated === true,
      String(proven?.basis));
    ok('en de fase is opbouw', plan.strategy.phase === 'BASE', plan.strategy.phase);
  } else {
    ok('zonder checks heet de structuur voltooid, niet verdragen',
      proven?.basis === 'voltooid', String(proven?.basis));
    ok('de fase is nog steeds opbouw, niet herstellen',
      plan.strategy.phase === 'BASE', plan.strategy.phase);
    ok('maar er wordt niet opgebouwd', plan.strategy.builds === false,
      String(plan.strategy.builds));
    ok('en de uitleg zegt dat de herstelcheck ontbreekt',
      /herstelcheck is .*niet ingevuld/.test(plan.strategy.why), plan.strategy.why);
    ok('onbekend wordt niet als slechte respons gepresenteerd',
      !/niet schoon/.test(plan.strategy.why), plan.strategy.why);
  }
}

console.log(`\n${'█'.repeat(68)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(68)}`);
process.exit(fail ? 1 : 0);

// Loopt zij in de juiste zone — en biedt het schema die zone eigenlijk aan?
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG, EN WAT ERONDER LAG
//
// "Deze snap ik niet. Ik hou me gewoon aan hartslag en loop alles onder
// 145 toch?" En daarna: "Pas mn schema aan zodat ik in de juiste zone
// loop."
//
// De intensiteitskaart hield haar voor dat 80% van haar loopminuten
// rustig hoort te zijn en dat ze op 31% zat. Die meting klopt; ik heb
// hem losgerekend uit haar ruwe laps en kwam op 32%.
//
// Maar toen ik narekende wát het schema per dag vóórschrijft, bleek er
// helemaal geen kwaliteitssessie in te zitten: élke dag, ook de dagen
// die "sleutel" heten, kreeg "mik op 106–132 bpm". Geen 80/20 maar
// 100/0. Zij werd dus gemeten langs een verdeling die haar schema nooit
// heeft aangeboden.
//
// Twee oorzaken, allebei hier vastgelegd:
//
//   1. De sessiebibliotheek heeft op haar niveaus geen racespecifieke
//      vorm. vormVoor vroeg erom, vond niets, en viel stil terug op de
//      zwaarste easy-sessie. Een terugval die niet zegt dat hij
//      terugvalt ziet er precies zo uit als een keuze.
//
//   2. En erger: haar beachloop van 1 november bestond uit blokken van
//      rond 87 meter per minuut — wandeltempo op zacht zand — maar met
//      een hartslag van 121 tot 136. De hartslagclassificatie noemde dat
//      lopen, provenStructure nam er een blok van 33 minuten uit over
//      als bewezen loopblok, en het schema schreef daarna "45 min
//      doorlopend" voor aan iemand wier langste werkelijke loopblok tien
//      minuten is. Dat is geen onnauwkeurigheid meer maar een sessie die
//      ze niet aankan.
import './_storage-stub.js';
import { racePlan } from '../../src/racePlanDays.js';
import { provenStructure } from '../../src/raceplan.js';
import { paceBreakdown, SEGMENT } from '../../src/pace.js';
import { MIN_METER_PER_MIN } from '../../src/efficiency.js';
import { hrPrescription } from '../../src/hrModel.js';
import { saveGoal } from '../../src/goals.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-09';
const RACE = '2026-12-12';
const mk = (date, laps) => ({ id: date, date, activityType: 'run',
  duration: laps.reduce((a, l) => a + l[0], 0) / 60,
  distance: laps.reduce((a, l) => a + l[1], 0) / 1000,
  laps: laps.map(([movingTime, distance, avgHr]) => ({ movingTime, distance, avgHr })) });

// Haar werkelijke reeks, inclusief de beachloop van 1 november.
const HAAR = [
  mk('2026-11-08', [[600, 900, 140], [300, 380, 118]]),
  mk('2026-11-06', [[525, 1000, 136.7], [228, 266.79, 137], [96, 193.46, 148.9],
    [624, 1000, 142.6], [120, 148.43, 135.9], [195, 329.96, 145.7], [300, 371.37, 111.6]]),
  mk('2026-11-01', [[1998, 2911.3, 121], [318, 475.4, 133], [526, 811.5, 136],
    [1086, 1560.7, 130], [1532, 2270.1, 121]]),
  mk('2026-10-28', [[480, 751.87, 153.8], [453, 659.39, 164.4], [120, 162.95, 138.4],
    [300, 430.77, 127.6]]),
  mk('2026-10-24', [[172, 288.36, 149.8], [300, 419.97, 123.8], [548, 1000, 144.2],
    [595, 1000, 147.3], [579, 1000, 146.4]]),
  mk('2026-10-22', [[480, 835.65, 152.2], [480, 832.19, 148.9], [480, 935.71, 147.2],
    [300, 437.76, 117.3]]),
  mk('2026-10-18', [[300, 404.75, 118.6], [480, 965.26, 152.4], [480, 838.94, 152.1],
    [480, 988.46, 141.9]]),
];

function wereld() {
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_workouts', JSON.stringify(HAAR));
  localStorage.setItem('gc_hr_settings', JSON.stringify(
    { easyLow: 106, easyHigh: 145, resumeBelow: 105, walkTrigger: 150 }));
  localStorage.setItem('gc_race_goals', JSON.stringify([{ id: 'ameland', date: RACE,
    name: 'Ameland Adventure Run 5 km', type: 'TARGET', enabled: true,
    terrain: 'trail', distanceKm: 5, targetTimeSec: 2100 }]));
  saveGoal({ domain: 'RUN', metric: 'run_days_week', target_value: '4',
    direction: 'at_most' });
  const logs = {};
  for (const w of HAAR) {
    logs[w.date] = { date: w.date, hr_rest: 62, recovery_check: 'good',
      headache_severity: 0, energy: 2 };
    localStorage.setItem(`gc_log_${w.date}`, JSON.stringify(logs[w.date]));
  }
  return logs;
}

S('1 · Wandeltempo telt niet als lopen, hoe hoog de hartslag ook is');
{
  const logs = wereld();
  const beach = HAAR.find(w => w.date === '2026-11-01');
  const b = paceBreakdown(beach);
  const loop = b.segments.filter(s => s.kind === SEGMENT.RUN);
  const traagsteLoop = loop.length
    ? Math.min(...loop.map(s => 1000 / s.pace)) : null;
  console.log(`      ${loop.length} van ${b.segments.length} blokken gelden als lopen`);
  ok('geen enkel blok van die sessie telt als lopen', loop.length === 0,
    JSON.stringify(b.segments.map(s => [Math.round(1000 / s.pace), s.kind])));
  ok('en als er wel een loopblok was, lag het boven de ondergrens',
    traagsteLoop == null || traagsteLoop >= MIN_METER_PER_MIN, String(traagsteLoop));
  ok('de reden staat erbij en noemt de ondergrens',
    b.segments.some(s => /trager dan/.test(s.reason || '')),
    JSON.stringify(b.segments.map(s => s.reason).slice(0, 2)));

  // Haar snelle sessies blijven gewoon lopen — de bodem mag geen echte
  // loopblokken wegsnijden.
  const okt18 = paceBreakdown(HAAR.find(w => w.date === '2026-10-18'));
  ok('een echte loopsessie houdt zijn loopblokken',
    okt18.segments.filter(s => s.kind === SEGMENT.RUN).length >= 3,
    JSON.stringify(okt18.segments.map(s => s.kind)));
}

S('2 · En dus klopt het bewezen loopblok weer');
{
  const logs = wereld();
  const ps = provenStructure({ logs, currentDate: TODAY });
  console.log(`      langste bewezen loopblok: ${ps.provenBlockMin} min`);
  ok('het langste bewezen blok is haar echte tien minuten, niet 33',
    ps.provenBlockMin > 9 && ps.provenBlockMin < 13, String(ps.provenBlockMin));
  // Dit is waar het om ging: geen sessie voorschrijven die ze niet aankan.
  const pl = racePlan({ currentDate: TODAY, logs, raceDate: RACE,
    raceKm: 5, raceSec: 2100 });
  // Wat haar belast is het loopblok, niet de sessieduur: "33 min" is
  // inclusief wandelpauzes en bestaat uit blokken van tien. Dat
  // onderscheid was precies wat hier getoetst moest worden.
  const blokken = pl.days.filter(d => d.run).map(d => d.run.blockMin || 0);
  const langsteBlok = Math.max(...blokken);
  const langsteSessie = Math.max(...pl.days.filter(d => d.run)
    .map(d => d.run.minutes || 0));
  console.log(`      langste loopblok ${langsteBlok} min · langste sessie `
    + `${langsteSessie} min (incl. wandelen)`);
  ok('het langste geplande loopblok is hooguit twee keer haar bewezen blok',
    langsteBlok <= ps.provenBlockMin * 2, `${langsteBlok} tegen ${ps.provenBlockMin}`);
  // Een eerste blok mag een stap zijn, geen sprong. Een kwart erbij is
  // de gangbare bovengrens voor één stap in duur; daarboven loop je de
  // sessie uit in tempo in plaats van in hartslag, en dat is precies hoe
  // haar blokken op 150 terechtkwamen.
  const eerste = pl.days.filter(d => d.run)[0]?.run.blockMin || 0;
  ok('en het eerste loopblok is een stap, geen sprong',
    eerste <= ps.provenBlockMin * 1.25,
    `${eerste} tegen ${ps.provenBlockMin} bewezen`);
}

S('3 · Het schema biedt de verdeling aan waarop zij wordt afgerekend');
{
  const logs = wereld();
  const pl = racePlan({ currentDate: TODAY, logs, raceDate: RACE,
    raceKm: 5, raceSec: 2100 });
  const loopdagen = pl.days.filter(d => d.run);
  const kwaliteit = loopdagen.filter(d => /werkhartslag/.test(d.run.description));
  const rustigMin = loopdagen.filter(d => !/werkhartslag/.test(d.run.description))
    .reduce((a, d) => a + (d.run.minutes || 0), 0);
  const hardMin = kwaliteit.reduce((a, d) => a + (d.run.minutes || 0), 0);
  const deel = Math.round(rustigMin / (rustigMin + hardMin) * 100);
  console.log(`      ${kwaliteit.length} kwaliteitssessies · ${deel}% rustig gepland`);
  ok('er staan kwaliteitssessies in het schema', kwaliteit.length >= 2,
    String(kwaliteit.length));
  ok('en ze staan niet elke week dubbel', kwaliteit.length <= 5,
    String(kwaliteit.length));
  ok('het geplande aandeel rustig ligt rond de richtlijn van 80%',
    deel >= 78 && deel <= 95, `${deel}%`);
  ok('de kwaliteitssessie krijgt ook een ander hartslagvoorschrift',
    kwaliteit.every(d => /werkblokken/.test(d.run.hr || '')),
    JSON.stringify(kwaliteit.map(d => d.run.hr).slice(0, 1)));
  ok('en de rustige dagen mikken onder VT1, niet op het plafond',
    loopdagen.filter(d => !/werkhartslag/.test(d.run.description))
      .every(d => /onder VT1/.test(d.run.hr || '')),
    JSON.stringify(loopdagen[0]?.run.hr));
}

S('4 · Rustig is het doel, het plafond is de grens');
{
  const logs = wereld();
  for (const p of ['EASY_ECONOMY', 'DURABILITY', 'TAPER']) {
    const r = hrPrescription({ purpose: p, logs, currentDate: TODAY });
    ok(`${p} mikt onder VT1`, /106–132/.test(r.line), r.line);
  }
  const q = hrPrescription({ purpose: 'QUALITY_LITE', logs, currentDate: TODAY });
  console.log(`      kwaliteit: ${q.line}`);
  ok('een kwaliteitssessie krijgt wél ruimte boven VT1',
    /werkblokken/.test(q.line), q.line);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

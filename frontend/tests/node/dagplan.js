// Het dagplan naar Ameland: staat er voor elke dag iets, klopt de opbouw,
// en past het zich aan aan wat er werkelijk gebeurt?
//
// ─────────────────────────────────────────────────────────────────
// WAAR DE VALKUIL ZIT
//
// Een schema van zevenendertig dagen is precies wat deze app eerder de das
// omdeed: runningSchema.js hield vijfendertig genummerde sessies vast, en
// sessie 14 kwam na 13 ook als 13 slecht viel. Deze suite bewaakt daarom
// niet alleen dát er een plan staat, maar vooral dat het meebeweegt:
//
//   · de dag van vandaag blijft van de dagkaart, niet van dit plan;
//   · de laatluteale week wordt uit háár cyclus berekend en krijgt geen
//     sleutelsessie;
//   · de taper telt terug vanaf de racedatum, niet vanaf een weeknummer;
//   · het niveau stijgt één stap per opbouwweek en niet in de luteale week;
//   · wat er al gelopen is, staat als gelopen en niet als schuld.
import './_storage-stub.js';
import { racePlan, luteaalVenster, DAG, FASE, INVOER } from '../../src/racePlanDays.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-06';          // vrijdag
const RACE = '2026-12-12';           // zaterdag
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// Haar werkelijke uitgangspositie: blokken van acht à tien minuten,
// menstruatiestarts op 29 september en 27 oktober (cyclus van 28 dagen),
// een rusthartslag die oploopt en gewicht dat zakt.
function haarData({ cyclus = true, drift = true } = {}) {
  globalThis.__testStorage.reset();
  const workouts = [
    { id: 'w1', date: '2026-10-18', activityType: 'run', distance: 3.88, duration: 36.6,
      laps: [{ movingTime: 480, distance: 988, avgHr: 142 }] },
    { id: 'w2', date: '2026-10-22', activityType: 'run', distance: 3.41, duration: 33.1,
      laps: [{ movingTime: 480, distance: 935, avgHr: 147 }] },
    { id: 'w3', date: '2026-10-24', activityType: 'run', distance: 4.48, duration: 45,
      laps: [{ movingTime: 548, distance: 1000, avgHr: 144 }] },
    { id: 'w4', date: TODAY, activityType: 'run', distance: 3.31, duration: 34.1,
      laps: [{ movingTime: 525, distance: 1000, avgHr: 137 }] },
  ];
  localStorage.setItem('gc_workouts', JSON.stringify(workouts));

  const logs = {};
  const zet = (d, v) => { logs[d] = { date: d, ...v };
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(logs[d])); };
  if (cyclus) { zet('2026-09-29', { cycle_day_one: true }); zet('2026-10-27', { cycle_day_one: true }); }
  if (drift) {
    [['2026-09-15', 53], ['2026-09-16', 54], ['2026-09-18', 57],
      ['2026-10-21', 62], ['2026-10-22', 63], ['2026-10-24', 63],
      ['2026-11-04', 62], ['2026-11-05', 62], [TODAY, 66]]
      .forEach(([d, hr]) => zet(d, { hr_rest: hr, weight: d < '2026-10-01' ? 63.5 : 61.5 }));
  }
  // De verdragen sessies waar het niveau uit volgt.
  zet('2026-10-19', { recovery_check: 'good', headache_severity: 0 });
  zet('2026-10-23', { recovery_check: 'good', headache_severity: 0 });
  return logs;
}

console.log('\n████ Dagplan naar Ameland ████');

S('1 · Er staat een dag voor elke dag tot de race');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  ok('het plan bestaat', p.known === true, JSON.stringify(p).slice(0, 140));
  ok('van vandaag tot en met de racedag', p.days.length === 37,
    `${p.days.length} dagen`);
  ok('de eerste dag is vandaag', p.days[0].date === TODAY, p.days[0].date);
  ok('de laatste is de race', p.days[p.days.length - 1].date === RACE
    && p.days[p.days.length - 1].kind === DAG.RACE,
    `${p.days[p.days.length - 1].date} ${p.days[p.days.length - 1].kind}`);
  ok('elke dag heeft een soort', p.days.every(d => !!d.kind));
  ok('en elke dag heeft doelen voor slaap en eten',
    p.days.every(d => d.targets.some(t => t.id === 'slaap')
      && d.targets.some(t => t.id === 'eten')));
  ok('en invulvelden', p.days.every(d => d.inputs.length >= 6),
    JSON.stringify(p.days.map(d => d.inputs.length).slice(0, 5)));
  ok('alle invulvelden bestaan ook echt',
    p.days.every(d => d.inputs.every(i => !!INVOER[i])),
    JSON.stringify([...new Set(p.days.flatMap(d => d.inputs))]));
}

S('2 · Vier loopdagen en twee krachtdagen per week');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  // Volle weken, dus niet de eerste (die begint op vrijdag) en niet de
  // raceweek.
  const vol = p.weeks.filter(w => w.index > 0 && w.to < p.taperFrom);
  console.log(`      ${vol.map(w => `${w.from.slice(5)}: ${w.runs}× lopen, ${w.strength}× kracht`).join(' | ')}`);
  ok('vier loopdagen in een volle week', vol.every(w => w.runs === 4),
    JSON.stringify(vol.map(w => w.runs)));
  ok('twee krachtdagen', vol.every(w => w.strength === 2),
    JSON.stringify(vol.map(w => w.strength)));
  ok('er is minstens één echte rustdag per week',
    p.days.filter(d => d.kind === DAG.RUST).length >= 4,
    String(p.days.filter(d => d.kind === DAG.RUST).length));
}

S('3 · De taper telt terug vanaf de racedatum');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE, taperDays: 6 });
  ok('de taper begint zes dagen voor de race', p.taperFrom === addDays(RACE, -6),
    p.taperFrom);
  const taper = p.days.filter(d => d.phase === FASE.TAPER.id);
  ok('en er staan taperdagen', taper.length >= 5, String(taper.length));
  ok('zonder sleutelsessie', taper.every(d => d.role !== 'sleutel'),
    JSON.stringify(taper.map(d => d.role)));
  const dagVoor = p.days.find(d => d.daysToRace === 1);
  ok('de dag vóór de race is rust', dagVoor.kind === DAG.RUST,
    `${dagVoor.date} ${dagVoor.kind}`);

  // Een race een week later schuift alles mee: geen vaste weeknummers.
  const later = racePlan({ currentDate: TODAY, logs, raceDate: addDays(RACE, 7) });
  ok('een andere racedatum verschuift de taper',
    later.taperFrom === addDays(addDays(RACE, 7), -6), later.taperFrom);
  ok('en maakt het plan langer', later.days.length === 44, String(later.days.length));
}

S('4 · De laatluteale week komt uit haar eigen cyclus');
{
  const logs = haarData();
  const v = luteaalVenster({ currentDate: TODAY, tot: RACE });
  console.log(`      cycluslengte ${v.cycleLength}, vensters: ${v.windows.map(w => `${w.van}→${w.tot}`).join(', ')}`);
  ok('de cycluslengte is gemeten', v.known && v.cycleLength === 28, JSON.stringify(v));
  ok('en er is een venster vóór de race', v.windows.length >= 1,
    JSON.stringify(v.windows));

  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const luteaal = p.days.filter(d => d.lateLuteal);
  ok('die dagen staan in het plan gemarkeerd', luteaal.length >= 5, String(luteaal.length));
  ok('zonder sleutelsessie', luteaal.every(d => d.role !== 'sleutel'),
    JSON.stringify(luteaal.map(d => `${d.date}:${d.role}`)));
  ok('met uitleg waarom', luteaal.every(d => d.targets.some(t => t.id === 'cyclus')));
  ok('en het niveau stijgt er niet',
    luteaal.every(d => !d.run || d.run.level <= p.baseLevel + 1),
    JSON.stringify(luteaal.filter(d => d.run).map(d => d.run.level)));

  // Zonder cyclusdata geen venster en geen verzonnen 28 dagen.
  globalThis.__testStorage.reset();
  const leeg = luteaalVenster({ currentDate: TODAY, tot: RACE });
  ok('zonder menstruatiedata geen venster', leeg.known === false, JSON.stringify(leeg));
  ok('met uitleg', /Geen menstruatiestarts/.test(leeg.why), leeg.why);
}

S('5 · Het niveau bouwt op, één stap per opbouwweek');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const niveaus = p.days.filter(d => d.run).map(d => d.run.level);
  console.log(`      basis ${p.baseLevel}, niveaus ${Math.min(...niveaus)}–${Math.max(...niveaus)}`);
  ok('het basisniveau komt uit wat ze verdraagt', p.baseLevel >= 5,
    String(p.baseLevel));
  ok('het loopt op', Math.max(...niveaus) > Math.min(...niveaus),
    JSON.stringify([...new Set(niveaus)]));
  ok('maar niet meer dan één stap per week',
    Math.max(...niveaus) - p.baseLevel <= p.weeks.length,
    `${p.baseLevel} → ${Math.max(...niveaus)} over ${p.weeks.length} weken`);
  // De race duurt bij haar tempo drie kwartier; die duur moet een keer
  // gedaan zijn, maar niet als loopminuten.
  const lange = p.days.filter(d => d.role === 'lang' && d.run?.timeOnFeet);
  console.log(`      tijd op de benen: ${[...new Set(lange.map(d => d.run.timeOnFeet))].join(', ')} min`);
  ok('de lange dag bouwt tijd op de benen op',
    lange.length >= 3 && Math.max(...lange.map(d => d.run.timeOnFeet)) >= 55,
    JSON.stringify(lange.map(d => d.run.timeOnFeet)));
  ok('en legt uit waarom dat wandelen is',
    lange.every(d => /wandelen/.test(d.run.timeOnFeetWhy)), lange[0]?.run.timeOnFeetWhy);
  ok('in de taper staat dat er niet',
    p.days.filter(d => d.phase === 'TAPER' && d.run).every(d => !d.run.timeOnFeet));

  ok('elke loopdag heeft een beschrijving',
    p.days.filter(d => d.run).every(d => !!d.run.description),
    JSON.stringify(p.days.filter(d => d.run).slice(0, 3).map(d => d.run.description)));
}

S('6 · Het plan past zich aan wat er echt gebeurde');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const vandaag = p.days[0];
  ok('vandaag staat als gelopen', vandaag.done?.run === true, JSON.stringify(vandaag.done));
  ok('en is gemarkeerd als vandaag', vandaag.isToday === true);
  ok('een toekomstige dag heeft geen status, maar een voornemen',
    p.days[5].done === null, JSON.stringify(p.days[5].done));

  // De oplopende rusthartslag verandert wat er over eten staat.
  const etenDoel = p.days.find(d => d.kind === DAG.RUN && !d.isToday)
    ?.targets.find(t => t.id === 'eten');
  console.log(`      eten: ${etenDoel.waarom.slice(0, 90)}`);
  ok('de rusthartslagdrift staat in het eetadvies',
    /rusthartslag loopt op|tekort/.test(etenDoel.waarom), etenDoel.waarom);

  // Zonder drift geen alarmerende tekst.
  const zonder = racePlan({ currentDate: TODAY, logs: haarData({ drift: false }),
    raceDate: RACE });
  const rustig = zonder.days.find(d => d.kind === DAG.RUST)?.targets.find(t => t.id === 'eten');
  ok('zonder drift staat er geen tekortwaarschuwing',
    !/tekort/.test(rustig.waarom), rustig.waarom);
}

S('7 · De knoppen staan met hun werkelijke stand erbij');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const ids = p.levers.map(k => k.id);
  console.log(`      knoppen: ${ids.join(', ')}`);
  ok('frequentie staat erbij', ids.includes('frequentie'));
  ok('eten ook', ids.includes('eten'));
  ok('kracht, cadans en cyclus ook',
    ids.includes('kracht') && ids.includes('cadans') && ids.includes('cyclus'),
    JSON.stringify(ids));
  ok('elke knop heeft een gemeten stand',
    p.levers.every(k => !!k.stand && !!k.doel && !!k.waarom));
  const freq = p.levers.find(k => k.id === 'frequentie');
  ok('de frequentie telt haar echte loopdagen', /loopdag(en)? per week/.test(freq.stand),
    freq.stand);
  const eten = p.levers.find(k => k.id === 'eten');
  ok('de eetknop noemt de rusthartslag', /Rusthartslag/.test(eten.stand), eten.stand);
  ok('en staat op open zolang hij oploopt', eten.status === 'open', eten.status);
}

S('8 · Zonder race geen plan');
{
  const logs = haarData();
  const geen = racePlan({ currentDate: TODAY, logs, raceDate: null });
  ok('geen racedatum geeft geen plan', geen.known === false, JSON.stringify(geen));
  const voorbij = racePlan({ currentDate: TODAY, logs, raceDate: '2026-10-01' });
  ok('een race in het verleden ook niet', voorbij.known === false, JSON.stringify(voorbij));
  ok('met uitleg', /racedatum/.test(voorbij.why), voorbij.why);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

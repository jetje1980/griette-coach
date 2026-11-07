// Wat mag zij aan vooruitgang verwachten?
//
// ─────────────────────────────────────────────────────────────────
// WAAR DIT VANDAAN KOMT
//
// Zij zei: er zit nergens een voorspelling in dat ik sneller word, terwijl
// mensen normaal toch best snel progressie maken. Ze had gelijk, en er
// zaten twee fouten onder.
//
// De racevoorspelling trok haar gemeten trend door, en die was over de
// laatste zes sessies licht negatief — dus voorspelde de app dat ze
// langzamer werd. En het doel per sessie rekende met één vast percentage
// per week, alsof alle winst nieuwe aanpassing is. Het grootste deel van
// wat zij nu kan winnen is geen nieuwe aanpassing maar terugpakken wat ze
// in oktober al liep.
import './_storage-stub.js';
import { expectedEfficiency, raceExpectation, HERSTEL_WEKEN,
  NIEUW_PER_WEEK_PCT, TERREIN } from '../../src/progressExpectation.js';
import { sessionTarget } from '../../src/sessionTarget.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);
const TODAY = '2026-11-07';
const RACE = '2026-12-12';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// Haar vorm: een beste sessie op 18 oktober en een dip daarna, precies de
// situatie waarin de oude berekening achteruitgang voorspelde.
function haarVorm() {
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_hr_settings', JSON.stringify({ easyLow: 106, easyHigh: 145,
    walkTrigger: 150, resumeBelow: 105, rpeEasy: 4, rpeThreshold: 6 }));
  const loop = (datum, meters, sec, hr) => ({ id: datum, date: datum,
    laps: [{ movingTime: sec, distance: meters, avgHr: hr }] });
  localStorage.setItem('gc_workouts', JSON.stringify([
    loop('2026-10-07', 1150, 480, 146),
    loop('2026-10-11', 1180, 480, 151),
    loop('2026-10-18', 988, 480, 141.9),   // de beste
    loop('2026-10-22', 935, 480, 147.2),
    loop('2026-10-24', 1000, 548, 144.2),
    loop('2026-11-06', 1000, 525, 136.7),
  ]));
}

console.log('\n████ Verwachte progressie ████');

S('1 · Twee fasen: eerst terugpakken, dan opbouwen');
{
  haarVorm();
  const nu = expectedEfficiency({ currentDate: TODAY, date: TODAY });
  ok('het vertrekpunt is gemeten', nu.known && nu.current > 0, JSON.stringify(nu).slice(0, 120));
  ok('het beste punt wordt onthouden', nu.best >= nu.current,
    `${nu.best} vs ${nu.current}`);
  ok('vandaag is er nog niets gewonnen', nu.mid === nu.current,
    `${nu.mid} vs ${nu.current}`);

  const overTwee = expectedEfficiency({ currentDate: TODAY, date: addDays(TODAY, 14) });
  ok('na twee weken zit je in de terugpakfase', overTwee.phase === 'terugpakken',
    overTwee.phase);
  ok('en ben je een deel van het oude niveau terug',
    overTwee.mid > nu.current && overTwee.mid <= nu.best,
    `${nu.current} → ${overTwee.mid} (beste ${nu.best})`);

  const overVijf = expectedEfficiency({ currentDate: TODAY, date: addDays(TODAY, 35) });
  ok('na vijf weken zit je in de opbouwfase', overVijf.phase === 'opbouwen',
    overVijf.phase);
  ok('en sta je bóven je oude beste punt', overVijf.mid > nu.best,
    `${overVijf.mid} vs beste ${nu.best}`);
  ok(`de terugpakfase duurt ${HERSTEL_WEKEN} weken`,
    expectedEfficiency({ currentDate: TODAY, date: addDays(TODAY, HERSTEL_WEKEN * 7) })
      .recovered === nu.best,
    'na de hersteltermijn hoort het oude niveau terug te zijn');
}

S('2 · De race: op racetempo, niet op easy-tempo');
{
  haarVorm();
  const e = raceExpectation({ currentDate: TODAY, raceDate: RACE, distanceKm: 5,
    terrain: 'trail' });
  console.log(`      ${e.line}`);
  ok('er is een verwachting', e.known === true, JSON.stringify(e).slice(0, 120));
  ok('de racehartslag ligt onder VT2 maar boven haar easy-plafond',
    e.raceHr > 145 && e.raceHr < 156, String(e.raceHr));
  ok('en dat staat uitgelegd', /raceinspanning/.test(e.method), e.method.slice(0, 100));
  ok('de verwachting is sneller dan vandaag', e.mid.time < e.now.time,
    `${e.mid.time} vs ${e.now.time}`);
  ok('de voorzichtige uitkomst is trager dan de verwachte',
    e.low.time > e.mid.time, `${e.low.time} vs ${e.mid.time}`);
  ok('en de gunstige sneller', e.high.time < e.mid.time,
    `${e.high.time} vs ${e.mid.time}`);
  ok('de bandbreedte is geen schijnprecisie',
    (e.low.time - e.high.time) > 1.5,
    `${e.low.time - e.high.time} minuten tussen de uitersten`);
}

S('3 · Het terrein staat apart, niet verstopt');
{
  haarVorm();
  const duin = raceExpectation({ currentDate: TODAY, raceDate: RACE, terrain: 'trail' });
  const weg = raceExpectation({ currentDate: TODAY, raceDate: RACE, terrain: 'road' });
  const zand = raceExpectation({ currentDate: TODAY, raceDate: RACE, terrain: 'beach' });
  console.log(`      weg ${weg.fmt.time(weg.mid.time)} · duin ${duin.fmt.time(duin.mid.time)} · zand ${zand.fmt.time(zand.mid.time)}`);
  ok('zand is trager dan duin, duin trager dan weg',
    zand.mid.time > duin.mid.time && duin.mid.time > weg.mid.time,
    `${zand.mid.time} > ${duin.mid.time} > ${weg.mid.time}`);
  ok('het vlakke tempo staat er los bij', duin.mid.flatTime < duin.mid.time,
    `${duin.mid.flatTime} vs ${duin.mid.time}`);
  ok('de toeslag is benoemd in de methode',
    new RegExp(String(TERREIN.trail.extraMinPerKm).replace('.', ',')).test(duin.method),
    duin.method);
}

S('4 · De voorwaarden staan erbij');
{
  haarVorm();
  const e = raceExpectation({ currentDate: TODAY, raceDate: RACE, terrain: 'trail' });
  ok('vier loopdagen per week wordt genoemd', /vier loopdagen/.test(e.conditions),
    e.conditions);
  ok('en dat het anders een wens is', /wens/.test(e.conditions), e.conditions);
  ok('de twee fasen staan erbij', /terugpakken/.test(e.phases), e.phases);
  ok('met de datum van haar beste sessie', /oktober/.test(e.phases), e.phases);
}

S('5 · Het doel per sessie volgt dezelfde twee fasen');
{
  haarVorm();
  const vroeg = sessionTarget({ date: addDays(TODAY, 7), hr: 132, currentDate: TODAY });
  const laat = sessionTarget({ date: addDays(TODAY, 30), hr: 132, currentDate: TODAY });
  console.log(`      over een week: ${vroeg.line} (${vroeg.phase})`);
  console.log(`      over een maand: ${laat.line} (${laat.phase})`);
  ok('een sessie over een week zit in de terugpakfase', vroeg.phase === 'terugpakken',
    vroeg.phase);
  ok('en die over een maand in de opbouwfase', laat.phase === 'opbouwen', laat.phase);
  ok('het doel wordt sneller naarmate het later is',
    laat.targetPace < vroeg.targetPace, `${laat.targetPace} vs ${vroeg.targetPace}`);
  ok('de uitleg noemt het terugpakken',
    /al \\d|terugpakken/.test(vroeg.why), vroeg.why.slice(0, 140));
  ok('en er staat bij wat ze vorige keer liep', !!vroeg.lastLine, String(vroeg.lastLine));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

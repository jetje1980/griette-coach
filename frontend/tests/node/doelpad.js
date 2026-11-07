// Wat vraagt haar wenstijd, en wanneer is die er?
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DEZE SUITE BESTAAT
//
// Zij vroeg: "ik wil echt getraind worden naar 35 min en hartslag max
// 145. Pas het zo aan dat het haalbaar wordt." Het schema aanpassen maakt
// dat niet haalbaar, en de gevaarlijkste fout die deze app kan maken is
// doen alsof — dan loopt ze vijf weken naar een getal dat niet bestaat en
// concludeert ze op 12 december dat zíj gefaald heeft.
//
// Dus bewaakt deze suite drie dingen:
//
//   · de omkering klopt — welke efficiëntie hoort bij een tijd, een
//     ondergrond en een hartslag;
//   · het antwoord is een datum en geen nee;
//   · en als het doel wél binnen bereik ligt, zegt hij dat ook. Een
//     rekenmachine die altijd "nog niet" zegt is net zo nutteloos als
//     een die altijd ja zegt.
import './_storage-stub.js';
import { doelPad, benodigdeEfficientie } from '../../src/doelPad.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-07';
const RACE = '2026-12-12';

// Eén loopblok per sessie, zodat de efficiëntie exact te sturen is.
const mk = (date, dur, km, hr) => ({ id: `${date}_${dur}`, date, duration: dur,
  distance: km, activityType: 'run',
  laps: [{ movingTime: dur * 60, distance: km * 1000, avgHr: hr }] });

const HAAR = [
  mk('2026-10-18', 36.6, 3.88, 135), mk('2026-10-22', 33.1, 3.41, 138),
  mk('2026-10-24', 45, 4.48, 140), mk('2026-10-28', 22.4, 2.0, 141),
  mk('2026-11-01', 66.3, 6.27, 142), mk('2026-11-06', 34.1, 3.31, 139),
];

S('1 · De omkering: welke efficiëntie hoort bij 35:00');
{
  // 35:00 op 5 km is 7:00/km = 143 meter per minuut. Bij hartslag 145 is
  // de benodigde efficiëntie dus 143/145. Pad en duin kosten 0,75 min/km,
  // dus daar moet het vlakke tempo 6:15/km zijn — en dat vraagt fors meer.
  const weg = benodigdeEfficientie({ targetSec: 2100, distanceKm: 5, hrCap: 145,
    terrain: 'road' });
  const duin = benodigdeEfficientie({ targetSec: 2100, distanceKm: 5, hrCap: 145,
    terrain: 'trail' });
  const strand = benodigdeEfficientie({ targetSec: 2100, distanceKm: 5, hrCap: 145,
    terrain: 'beach' });
  console.log(`      weg ${weg.ef} · duin ${duin.ef} · strand ${strand.ef}`);
  ok('op de weg vraagt 35:00 efficiëntie 0,985', weg.ef === 0.985, String(weg.ef));
  ok('in de duinen is dat fors meer', duin.ef === 1.103, String(duin.ef));
  ok('en op strand nog meer', strand.ef > duin.ef, `${strand.ef} vs ${duin.ef}`);
  ok('een hogere hartslag vraagt minder efficiëntie voor dezelfde tijd',
    benodigdeEfficientie({ targetSec: 2100, distanceKm: 5, hrCap: 150, terrain: 'road' }).ef
      < weg.ef, 'HR150 vs HR145');

  // De grens van de som: als de ondergrondtoeslag alleen al groter is dan
  // het doeltempo, bestaat er geen efficiëntie die het haalt. Dan hoort er
  // geen enorm getal te staan maar "dit kan niet".
  const onmogelijk = benodigdeEfficientie({ targetSec: 300, distanceKm: 5, hrCap: 145,
    terrain: 'beach' });
  ok('een doel onder de ondergrondtoeslag heet onmogelijk en krijgt geen getal',
    onmogelijk.onmogelijk === true && onmogelijk.ef === null,
    JSON.stringify(onmogelijk));
}

S('2 · Haar eigen vraag: 35:00 op Ameland bij hartslag 145');
{
  const p = doelPad({ currentDate: TODAY, raceDate: RACE, targetSec: 2100,
    distanceKm: 5, hrCap: 145, terrain: 'trail', raceHr: 150,
    weight: 60.5, weightTarget: 57, workouts: HAAR });
  console.log(`      ${p.line}`);
  ok('de som is bekend', p.known === true, p.why);
  ok('het doel haalt de racedatum niet', p.race.reachable === false,
    JSON.stringify(p.race));
  ok('en dat wordt met een getal onderbouwd, niet met een mening',
    p.required > p.race.ef, `nodig ${p.required} vs ${p.race.ef} op de dag`);
  ok('er staat wél een datum waarop het wel kan', !!p.dates.mid, JSON.stringify(p.dates));
  ok('die datum ligt na de race', p.dates.mid > RACE, p.dates.mid);
  ok('een optimistischer tempo geeft een eerdere datum',
    p.dates.high < p.dates.mid && p.dates.mid < p.dates.low, JSON.stringify(p.dates));
  ok('de zin noemt de benodigde efficiëntie en de maand',
    p.line.includes(String(p.required)) && /\d{4}/.test(p.line), p.line);
}

S('3 · De drie knoppen die de datum verzetten');
{
  const p = doelPad({ currentDate: TODAY, raceDate: RACE, targetSec: 2100,
    distanceKm: 5, hrCap: 145, terrain: 'trail', raceHr: 150,
    weight: 60.5, weightTarget: 57, workouts: HAAR });
  const ids = p.levers.map(k => k.id);
  console.log(`      ${p.levers.map(k => `${k.id}: ${k.weken} wk`).join(' · ')}`);
  ok('ondergrond, racehartslag en gewicht staan er alle drie',
    ['ondergrond', 'racehartslag', 'gewicht'].every(i => ids.includes(i)),
    JSON.stringify(ids));
  ok('elke knop verzet de datum naar voren',
    p.levers.every(k => k.weken < p.weeks.mid),
    JSON.stringify(p.levers.map(k => [k.id, k.weken, p.weeks.mid])));
  ok('de ondergrond scheelt het meest',
    p.levers.find(k => k.id === 'ondergrond').weken
      === Math.min(...p.levers.map(k => k.weken)),
    JSON.stringify(p.levers.map(k => [k.id, k.weken])));
  ok('de gewichtsknop zegt erbij dat hij pas ná de race aan de beurt is',
    /ná 12 december/.test(p.levers.find(k => k.id === 'gewicht').waarom),
    p.levers.find(k => k.id === 'gewicht').waarom);
  // Zonder gewichtsdoel geen gewichtsknop: geen meting, geen advies.
  const zonder = doelPad({ currentDate: TODAY, raceDate: RACE, targetSec: 2100,
    distanceKm: 5, hrCap: 145, terrain: 'trail', workouts: HAAR });
  ok('zonder gewichtsdoel staat die knop er niet',
    !zonder.levers.some(k => k.id === 'gewicht'),
    JSON.stringify(zonder.levers.map(k => k.id)));
  ok('en zonder racehartslag ook die niet',
    !zonder.levers.some(k => k.id === 'racehartslag'),
    JSON.stringify(zonder.levers.map(k => k.id)));
}

S('4 · Een doel dat wél gehaald wordt, heet gehaald');
{
  // Een rekenmachine die altijd "nog niet" zegt, is net zo nutteloos als
  // een die altijd ja zegt. Bij een ruime doeltijd hoort hier gewoon ja.
  const p = doelPad({ currentDate: TODAY, raceDate: RACE, targetSec: 3900,
    distanceKm: 5, hrCap: 145, terrain: 'trail', workouts: HAAR });
  console.log(`      doel 65:00 → nodig ${p.required}, op de dag ${p.race.ef}`);
  ok('65:00 op de duinen zit er wel in', p.race.reachable === true,
    JSON.stringify(p.race));
  ok('en de zin zegt dat ook', /binnen bereik/.test(p.line), p.line);
  ok('het aantal weken is nul, want ze is er al', p.weeks.mid === 0,
    String(p.weeks.mid));
}

S('5 · Zonder metingen geen uitspraak');
{
  const p = doelPad({ currentDate: TODAY, raceDate: RACE, targetSec: 2100,
    workouts: [HAAR[0]] });
  ok('één sessie is te weinig', p.known === false, JSON.stringify(p));
  ok('en er staat waarom', !!p.why, String(p.why));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

// Sneller bij een lagere hartslag: is dat te meten, en klopt het met haar
// eigen sessies?
//
// Haar vraag was: ik wil hartslag omlaag én tempo omhoog. Dat zijn geen
// twee doelen maar één verhouding — meters per minuut gedeeld door
// hartslag. Deze suite toetst die berekening tegen de echte laps uit haar
// Strava-sessies van oktober, inclusief de valkuilen: wandellaps die als
// loopblok binnenkomen, korte blokken waarin de hartslag nog aan het
// oplopen is, en één slechte dag die als trend zou worden gelezen.
import './_storage-stub.js';
import { efficiencyOf, efficiencyTrend, paceAtHr } from '../../src/efficiency.js';
import { pemFreeWeeks } from '../../src/symptoms.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);
const TODAY = '2026-11-06';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// Letterlijk haar sessie van 22 oktober: eerst vijf minuten inwandelen,
// dan drie loopblokken van acht minuten met wandelpauzes ertussen.
const SESSIE_22_OKT = {
  id: 'strava_20688627737', date: '2026-10-22', distance: 3.41, duration: 33.1,
  laps: [
    { pace: '11:25', avgHr: 117.3, distance: 437.76, movingTime: 300 },
    { pace: '8:33', avgHr: 147.2, distance: 935.71, movingTime: 480 },
    { pace: '11:24', avgHr: 146.3, distance: 175.54, movingTime: 120 },
    { pace: '9:37', avgHr: 148.9, distance: 832.19, movingTime: 480 },
    { pace: '11:08', avgHr: 141.6, distance: 179.75, movingTime: 120 },
    { pace: '9:34', avgHr: 152.2, distance: 835.65, movingTime: 480 },
  ],
};

// 24 oktober: drie kilometers met twee minuten wandelen ertussen.
const SESSIE_24_OKT = {
  id: 'strava_20713648799', date: '2026-10-24', distance: 4.48, duration: 45,
  laps: [
    { pace: '11:54', avgHr: 123.8, distance: 419.97, movingTime: 300 },
    { pace: '9:08', avgHr: 144.2, distance: 1000, movingTime: 548 },
    { pace: '11:25', avgHr: 139.4, distance: 175.06, movingTime: 120 },
    { pace: '9:39', avgHr: 146.4, distance: 1000, movingTime: 579 },
    { pace: '11:32', avgHr: 145.6, distance: 173.38, movingTime: 120 },
    { pace: '9:55', avgHr: 147.3, distance: 1000, movingTime: 595 },
  ],
};

console.log('\n████ Sneller bij een lagere hartslag ████');

S('1 · Eén sessie: meters per hartslag');
{
  const e = efficiencyOf(SESSIE_22_OKT);
  console.log(`      22 okt: ef ${e.ef} bij hartslag ${e.avgHr}, tempo ${e.paceMin}`);
  ok('de sessie levert een getal op', e != null && e.ef > 0, JSON.stringify(e));
  ok('alleen de drie loopblokken tellen mee', e.blocks === 3, String(e.blocks));
  ok('de wandellap van 11:25 valt eruit', e.paceMin < 10,
    `${e.paceMin} — anders zit het inwandelen in het gemiddelde`);
  ok('de korte wandelpauzes van 2 min ook', e.runSeconds === 1440,
    String(e.runSeconds));
  ok('de hartslag is die van het lopen, niet van de hele sessie',
    e.avgHr >= 145 && e.avgHr <= 152, String(e.avgHr));
}

S('2 · Twee sessies vergelijken zegt meer dan twee tempo\'s');
{
  const a = efficiencyOf(SESSIE_22_OKT);
  const b = efficiencyOf(SESSIE_24_OKT);
  console.log(`      22 okt ${a.paceMin} bij ${a.avgHr} → ef ${a.ef}`);
  console.log(`      24 okt ${b.paceMin} bij ${b.avgHr} → ef ${b.ef}`);
  // 22 oktober was sneller én op een hogere hartslag. Het tempo alleen zou
  // "beter" zeggen; de verhouding zegt waar het werkelijk op neerkomt.
  ok('22 oktober was sneller', a.paceMin < b.paceMin, `${a.paceMin} vs ${b.paceMin}`);
  ok('maar ook op een hogere hartslag', a.avgHr > b.avgHr, `${a.avgHr} vs ${b.avgHr}`);
  ok('en dat verschil is precies wat de verhouding laat zien',
    Math.abs(a.ef - b.ef) < 0.06,
    `ef ${a.ef} vs ${b.ef} — twee heel verschillende sessies, vergelijkbare efficiëntie`);
}

S('3 · Wat betekent dat bij hartslag 132?');
{
  const e = efficiencyOf(SESSIE_24_OKT);
  const tempo = paceAtHr(e.ef, 132);
  console.log(`      bij 132: ${Math.floor(tempo)}:${String(Math.round(tempo % 1 * 60)).padStart(2, '0')}/km`);
  ok('de omrekening geeft een trager tempo dan bij 146',
    tempo > e.paceMin, `${tempo} vs ${e.paceMin}`);
  ok('en komt uit in een geloofwaardig gebied', tempo > 9.5 && tempo < 12,
    String(tempo));
  ok('zonder getallen komt er niets uit', paceAtHr(null, 132) === null);
}

S('4 · Een trend vraagt meer dan één sessie');
{
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_workouts', JSON.stringify([SESSIE_22_OKT, SESSIE_24_OKT]));
  const t = efficiencyTrend({ currentDate: TODAY });
  ok('er is een getal', t.known === true);
  ok('maar nog geen trend', t.enough === false, String(t.count));
  ok('en dat staat er met zoveel woorden', /nog geen trend/.test(t.verdict), t.verdict);
}

S('5 · Zes sessies met echte verbetering');
{
  globalThis.__testStorage.reset();
  // Zelfde tempo, zakkende hartslag: precies wat zij wil zien gebeuren.
  const maak = (datum, hr, meters) => ({
    id: datum, date: datum,
    laps: [{ avgHr: hr, distance: meters, movingTime: 480 }],
  });
  localStorage.setItem('gc_workouts', JSON.stringify([
    maak(addDays(TODAY, -40), 152, 830), maak(addDays(TODAY, -36), 150, 835),
    maak(addDays(TODAY, -32), 151, 828),
    maak(addDays(TODAY, -10), 142, 850), maak(addDays(TODAY, -6), 140, 858),
    maak(addDays(TODAY, -2), 139, 862),
  ]));
  const t = efficiencyTrend({ currentDate: TODAY });
  console.log(`      ${t.verdict}`);
  ok('zes sessies is genoeg voor een richting', t.enough === true, String(t.count));
  ok('de richting is beter', t.direction === 'beter', `${t.direction} ${t.deltaPct}%`);
  ok('en het verschil wordt in tempo bij 132 uitgedrukt',
    t.paceAtTarget < t.paceAtTargetBefore,
    `${t.paceAtTargetBefore} → ${t.paceAtTarget}`);
  ok('de uitleg zegt dat het gemeten is en niet gevoeld',
    /gemeten, niet gevoeld/.test(t.verdict), t.verdict);
}

S('6 · Eén slechte dag is geen achteruitgang');
{
  globalThis.__testStorage.reset();
  const maak = (datum, hr, meters) => ({ id: datum, date: datum,
    laps: [{ avgHr: hr, distance: meters, movingTime: 480 }] });
  localStorage.setItem('gc_workouts', JSON.stringify([
    maak(addDays(TODAY, -30), 145, 840), maak(addDays(TODAY, -26), 144, 845),
    maak(addDays(TODAY, -22), 145, 842),
    maak(addDays(TODAY, -12), 144, 844), maak(addDays(TODAY, -8), 145, 841),
    // De sessie van 28 oktober op het strand: hartslag 154 bij een veel
    // trager tempo. Met een gemiddelde zou dit de trend omlaag trekken.
    maak(addDays(TODAY, -4), 154, 750),
  ]));
  const t = efficiencyTrend({ currentDate: TODAY });
  console.log(`      ${t.direction} (${t.deltaPct}%)`);
  ok('de mediaan laat zich niet meeslepen door één strandsessie',
    t.direction === 'gelijk', `${t.direction} ${t.deltaPct}%`);
  ok('en de uitleg wijst eerst naar de omstandigheden',
    /zand|hitte|cyclus/i.test(t.note), t.note.slice(0, 120));
}

S('7 · PEM telt wanneer er een reactie is, niet als diagnose');
{
  // Haar punt, en het is terecht: de geschiedenis hoort mee te tellen
  // wanneer er een PEM-reactie ís. Een migraine op een rustdag is geen
  // post-exertionele reactie, en een week zonder invoer is geen bewijs van
  // iets.
  globalThis.__testStorage.reset();
  const logs = {};
  for (let i = 0; i < 28; i++) {
    const d = addDays(TODAY, -i);
    logs[d] = { date: d, recovery_check: 'good', headache_severity: 0 };
  }
  // Migraine op een dag zonder enige training ervoor.
  logs[addDays(TODAY, -9)] = { date: addDays(TODAY, -9), headache_severity: 3,
    recovery_check: 'good' };
  localStorage.setItem('gc_workouts', JSON.stringify([]));
  const zonder = pemFreeWeeks({ logs, currentDate: TODAY });
  console.log(`      ${zonder.weeks} weken · ${zonder.note}`);
  ok('een migraine zonder inspanning ervoor breekt de reeks niet',
    zonder.weeks >= 4, `${zonder.weeks} — ${zonder.note}`);

  // Dezelfde klacht, nu twee dagen ná een training: dát is wél een signaal.
  localStorage.setItem('gc_workouts', JSON.stringify([
    { id: 'r', date: addDays(TODAY, -11), distance: 4 },
  ]));
  const met = pemFreeWeeks({ logs, currentDate: TODAY });
  ok('dezelfde klacht ná een training telt wél',
    met.weeks < zonder.weeks, `${met.weeks} vs ${zonder.weeks}`);
  ok('en de datum van het signaal staat erbij', !!met.lastSignal, met.note);

  // Haar eigen vinkje wint altijd, ook zonder training in de buurt.
  const eigen = { ...logs };
  eigen[addDays(TODAY, -3)] = { date: addDays(TODAY, -3), symptom_pem: true };
  localStorage.setItem('gc_workouts', JSON.stringify([]));
  ok('het eigen PEM-vinkje telt altijd',
    pemFreeWeeks({ logs: eigen, currentDate: TODAY }).weeks === 0,
    String(pemFreeWeeks({ logs: eigen, currentDate: TODAY }).weeks));
}

S('8 · Niet loggen is geen PEM');
{
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_workouts', JSON.stringify([]));
  // Vier schone weken, dan twee weken niets ingevuld, dan weer schoon.
  const logs = {};
  const schoon = (d) => { logs[d] = { date: d, recovery_check: 'good', headache_severity: 0 }; };
  for (let i = 0; i < 14; i++) schoon(addDays(TODAY, -i));
  for (let i = 29; i < 56; i++) schoon(addDays(TODAY, -i));
  const r = pemFreeWeeks({ logs, currentDate: TODAY });
  console.log(`      ${r.weeks} schone weken, ${r.unloggedWeeks} zonder invoer`);
  ok('de lege weken breken de reeks niet',
    r.weeks >= 5, `${r.weeks} — vroeger stopte de telling hier op 2`);
  ok('maar ze tellen ook niet mee als bewijs', r.unloggedWeeks >= 1,
    String(r.unloggedWeeks));
  ok('en dat staat er eerlijk bij', /zonder invoer/.test(r.note), r.note);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

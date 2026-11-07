// Hoe snel gaat zíj vooruit — en wanneer mag de app dat zeggen?
//
// ─────────────────────────────────────────────────────────────────
// DE TEGENWERPING
//
// "Maar ik ben een geoefende loper. Denk je niet dat mn hartslag sneller
// gaat zakken bij gelijkblijvend tempo?"
//
// Daar stond één getal tegenover: 1,25% per week, het midden van wat in
// de literatuur haalbaar heet — een gemiddelde over andere mensen. Zij
// vroeg naar zichzelf, en dat hoort uit haar eigen reeks te komen.
//
// Deze suite bewaakt drie dingen die daarbij makkelijk misgaan:
//
//   · Korte loopblokken tellen niet mee. In de eerste minuten loopt de
//     hartslag achter op de inspanning, dus meters per minuut gedeeld
//     door hartslag valt te hoog uit. Precies dat maakte twee sessies
//     kunstmatig goed.
//   · Een sessie waarin de hartslag dáált terwijl het tempo gelijk
//     blijft, is een meetfout en geen topdag. Hartslag drift tijdens
//     inspanning omhoog. Dit is wat 4 oktober onderscheidt.
//   · En het belangrijkste: liever geen getal dan een verzonnen getal.
//     Zonder aaneengesloten reeks blijft het literatuurgetal staan.
import './_storage-stub.js';
import { gemetenProgressie, steadyEfficiency, STEADY_SECONDEN, MIN_PUNTEN,
  PLAUSIBEL_MAX } from '../../src/gemetenTempo.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-07';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };
const w = (date, laps) => ({ id: date, date, activityType: 'run',
  laps: laps.map(([movingTime, distance, avgHr]) => ({ movingTime, distance, avgHr })) });
const zet = (ws) => localStorage.setItem('gc_workouts', JSON.stringify(ws));

S('1 · Korte blokken tellen niet mee');
{
  // Twee sessies met exact hetzelfde tempo en dezelfde hartslag, maar de
  // ene in blokken van twee minuten en de andere in blokken van zes. Als
  // de korte meetelt, lijkt een reeks beter dan hij is.
  const kort = w('2026-11-01', [[120, 240, 140], [120, 240, 140], [120, 240, 140]]);
  const lang = w('2026-11-02', [[360, 720, 140], [360, 720, 140]]);
  ok('een sessie met alleen korte blokken levert niets op',
    steadyEfficiency(kort) === null, JSON.stringify(steadyEfficiency(kort)));
  ok('dezelfde sessie in lange blokken wel', steadyEfficiency(lang)?.ef > 0,
    JSON.stringify(steadyEfficiency(lang)));
  ok('de grens staat op vijf minuten', STEADY_SECONDEN === 300, String(STEADY_SECONDEN));
}

S('2 · Een dalende hartslag bij gelijk tempo is een meetfout');
{
  // Dit is 4 oktober: vier blokken van zes minuten, tempo vrijwel gelijk,
  // hartslag van 133 naar 113. Tijdens inspanning loopt hartslag op.
  const vierOkt = w('2026-10-04', [[360, 749.63, 133.5], [360, 757.96, 131.9],
    [360, 768.82, 121.7], [360, 767.06, 113.3]]);
  const s = steadyEfficiency(vierOkt);
  console.log(`      EF ${s.ef} bij hartslag ${s.avgHr} — verdacht: ${s.hrSuspect}`);
  ok('de sessie wordt als verdacht gemarkeerd', s.hrSuspect === true, JSON.stringify(s));
  ok('en er staat bij waarom, in gewone woorden',
    /loslaat|wegvalt/.test(s.hrSuspectWhy || ''), s.hrSuspectWhy);
  ok('de efficiëntie wordt niet stilzwijgend weggegooid maar wel apart gezet',
    s.ef > 1, String(s.ef));

  // Een sessie waarin de hartslag juist oploopt is normaal en blijft staan.
  const normaal = w('2026-10-18', [[480, 965.26, 141.9], [480, 838.94, 152.1],
    [480, 988.46, 152.4]]);
  ok('een oplopende hartslag is geen fout', steadyEfficiency(normaal).hrSuspect === false,
    JSON.stringify(steadyEfficiency(normaal)));
}

S('3 · Haar werkelijke reeks levert nog geen eigen tempo op');
{
  // En dát is het eerlijke antwoord op haar vraag. Niet "je hebt
  // ongelijk", maar: er staan nog niet genoeg sessies kort genoeg op
  // elkaar om jouw tempo te kunnen meten. Om de dag lopen levert die
  // reeks binnen twee à drie weken op; dan rekent dit met haar getal.
  const haar = [
    w('2026-08-17', [[615, 1000, 124.9], [538, 970.03, 141.9]]),
    w('2026-09-11', [[360, 767.16, 139.5], [401, 570.61, 128.9], [360, 772.09, 152.8],
      [300, 454.3, 134.1], [360, 731.03, 146.1], [300, 455.72, 129.5]]),
    w('2026-09-17', [[360, 748.22, 148.3], [300, 389.96, 128.2], [360, 805.34, 131.4],
      [300, 448.11, 118.8], [360, 797.39, 138.7]]),
    w('2026-09-20', [[360, 674.73, 144.7], [360, 637.24, 144], [360, 579.22, 140.3],
      [360, 654.7, 137.9], [360, 667.49, 149.8], [360, 659.19, 144]]),
    w('2026-10-04', [[360, 749.63, 133.5], [360, 757.96, 131.9], [360, 768.82, 121.7],
      [360, 767.06, 113.3]]),
    w('2026-10-07', [[300, 427.85, 110.6], [300, 587.54, 140.8], [300, 525.91, 155.5],
      [300, 519.25, 150.4], [300, 526.74, 135.3], [300, 544.74, 146.2]]),
    w('2026-10-18', [[300, 404.75, 118.6], [480, 965.26, 152.4], [480, 838.94, 152.1],
      [480, 988.46, 141.9]]),
    w('2026-11-06', [[525, 1000, 136.7], [624, 1000, 142.6], [300, 371.37, 111.6]]),
  ];
  zet(haar);
  const g = gemetenProgressie({ currentDate: TODAY, workouts: haar });
  console.log(`      ${g.why}`);
  ok('er komt geen eigen tempo uit', g.known === false, JSON.stringify(g.pctPerWeek));
  ok('en de reden is navolgbaar: te weinig sessies op een rij',
    /aaneengesloten reeks/.test(g.why), g.why);
  ok('4 oktober staat apart als onbetrouwbare meting',
    g.ignored.some(s => s.date === '2026-10-04'),
    JSON.stringify(g.ignored.map(s => s.date)));
  ok('de overige sessies zijn wel gewoon gemeten',
    g.sessions.length >= 7, String(g.sessions.length));
}

S('4 · Met een consequente reeks rekent hij wél met haar eigen tempo');
{
  // Om de dag, acht sessies, efficiëntie die met 1,6% per week stijgt —
  // het tempo dat in haar beste periode gemeten werd. Dan hoort daar
  // haar getal uit te komen en niet het boekgetal.
  const reeks = [];
  for (let i = 7; i >= 0; i--) {
    const datum = addDays(TODAY, -i * 2);
    const ef = 0.75 * Math.pow(1.016, (7 - i) * 2 / 7);
    const hr = 145;
    const mpm = ef * hr;
    reeks.push(w(datum, [[360, mpm * 6, hr], [360, mpm * 6, hr]]));
  }
  zet(reeks);
  const g = gemetenProgressie({ currentDate: TODAY, workouts: reeks });
  console.log(`      ${g.why}`);
  ok('nu is er wel een eigen tempo', g.known === true, JSON.stringify(g));
  ok('en het komt uit op wat erin zat', Math.abs(g.pctPerWeek - 1.6) < 0.15,
    String(g.pctPerWeek));
  ok('met het aantal sessies erbij', g.count >= MIN_PUNTEN, String(g.count));
  ok('en de periode waarover gemeten is', !!g.from && !!g.to, `${g.from}–${g.to}`);
}

S('5 · Een onmogelijke helling wordt niet overgenomen');
{
  // De gevaarlijkste fout van een zelflerend model: een meetfout die
  // zichzelf tot supervermogen promoveert. Zes procent per week zou over
  // vijf weken dertig procent zijn; dat bestaat niet.
  const reeks = [];
  for (let i = 7; i >= 0; i--) {
    const datum = addDays(TODAY, -i * 2);
    const ef = 0.75 * Math.pow(1.06, (7 - i) * 2 / 7);
    reeks.push(w(datum, [[360, ef * 145 * 6, 145], [360, ef * 145 * 6, 145]]));
  }
  zet(reeks);
  const g = gemetenProgressie({ currentDate: TODAY, workouts: reeks });
  console.log(`      gemeten ${g.pctPerWeek}%/week → bruikbaar: ${g.known}`);
  ok('de helling wordt wel gemeten', g.pctPerWeek > PLAUSIBEL_MAX, String(g.pctPerWeek));
  ok('maar niet gebruikt', g.known === false, String(g.known));
  ok('en er staat bij dat hij buiten het mogelijke ligt',
    /buiten wat fysiologisch kan/.test(g.why), g.why);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

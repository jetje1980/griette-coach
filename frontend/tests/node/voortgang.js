// Ga ik vooruit, en waarop niet?
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG
//
// "Ik vind het raar dat ik sinds een half jaar nauwelijks progressie lijk
// te hebben geboekt. Kan Progressie dat überhaupt zien, en eventueel een
// ander voorstel geven voor de komende drie maanden?"
//
// Allebei was het antwoord nee. Deze suite bewaakt dat het ja blijft, en
// vooral dat het een eerlijk ja is. Drie valkuilen zitten erin:
//
//   · Eén gevoel over een stapel losse dingen. Haar volume groeide wel
//     degelijk terwijl haar economie stilstond; op één hoop is dat "het
//     werkt niet", terwijl de helft wel werkt. Dus per dimensie.
//   · Het venster bepaalt de uitkomst. Kracht die in september wél werd
//     gedaan en sindsdien niet meer, telde als vooruitgang zolang je het
//     halve jaar in twee helften knipt. Dat hoort "gestopt" te zijn.
//   · En toeval. Welke sessie een bruikbare meting oplevert hangt af van
//     hoe die dag gelopen is; twee goede sessies vroeg in de lijst maakten
//     van een vlakke reeks "17% achteruit".
import './_storage-stub.js';
import { voortgang, driemaandenplan, DREMPEL_PCT } from '../../src/voortgang.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-08';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };
const mk = (date, laps, dur, km) => ({ id: date + dur, date, activityType: 'run',
  duration: dur, distance: km,
  laps: laps.map(([movingTime, distance, avgHr]) => ({ movingTime, distance, avgHr })) });

// Een reeks waarin de efficiëntie met een gegeven percentage per week
// verandert, om de dag gelopen.
function reeks({ weken = 10, pctPerWeek = 0, start = 0.80, elke = 2, duur = 30 } = {}) {
  const out = [];
  const n = Math.floor((weken * 7) / elke);
  for (let i = n; i >= 0; i--) {
    const datum = addDays(TODAY, -i * elke);
    const wkTerug = (i * elke) / 7;
    const ef = start * Math.pow(1 + pctPerWeek / 100, weken - wkTerug);
    const hr = 145, mpm = ef * hr;
    out.push(mk(datum, [[360, mpm * 6, hr], [360, mpm * 6, hr]], duur, mpm * 12 / 1000));
  }
  return out;
}

S('1 · Haar eigen beeld: volume omhoog, economie stil');
{
  globalThis.__testStorage.reset();
  const W = [
    mk('2026-08-17', [[615, 1000, 124.9], [538, 970, 141.9]], 19.2, 1.97),
    mk('2026-08-22', [[328, 466, 129]], 29.4, 2.98),
    mk('2026-09-09', [[432, 551.04, 118.3], [300, 416.8, 119.4]], 29.8, 2.79),
    mk('2026-09-11', [[360, 767.16, 139.5], [360, 772.09, 152.8]], 38.8, 4.09),
    mk('2026-09-17', [[360, 748.22, 148.3], [360, 805.34, 131.4]], 31.1, 3.47),
    mk('2026-09-20', [[360, 674.73, 144.7], [360, 637.24, 144]], 59.2, 5.71),
    mk('2026-10-07', [[300, 587.54, 140.8], [300, 525.91, 155.5]], 38.3, 3.73),
    mk('2026-10-11', [[300, 573.9, 145.3], [300, 566.78, 150.6]], 37.2, 3.88),
    mk('2026-10-18', [[480, 965.26, 152.4], [480, 838.94, 152.1]], 36.6, 3.88),
    mk('2026-10-22', [[480, 835.65, 152.2], [480, 935.71, 147.2]], 33.1, 3.41),
    mk('2026-10-24', [[548, 1000, 144.2], [595, 1000, 147.3]], 45, 4.48),
    mk('2026-11-01', [[1998, 2911.3, 121], [1532, 2270.1, 121]], 99.7, 9.28),
    mk('2026-11-06', [[525, 1000, 136.7], [624, 1000, 142.6]], 34.1, 3.31),
  ];
  localStorage.setItem('gc_workouts', JSON.stringify(W));
  localStorage.setItem('gc_strength_sessions', JSON.stringify(
    ['2026-09-21', '2026-09-15', '2026-09-13', '2026-09-07'].map((d, i) =>
      ({ id: `s${i}`, date: d, rpe: 3 }))));
  const logs = {};
  for (const [d, v] of Object.entries({ '2026-09-20': 59, '2026-10-11': 61,
    '2026-10-25': 64, '2026-11-06': 66, '2026-11-08': 64 })) {
    logs[d] = { date: d, hr_rest: v };
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(logs[d]));
  }
  const v = voortgang({ currentDate: TODAY, logs, workouts: W });
  console.log(`      ${v.line}`);
  for (const d of v.dimensions) console.log(`      ${d.verdict.padEnd(9)} ${d.regel}`);
  ok('er komt een oordeel uit', v.known === true, v.why);
  ok('duur per sessie staat op vooruit', v.byId.duur.verdict === 'vooruit',
    v.byId.duur.regel);
  ok('economie staat niet op vooruit', v.byId.economie.verdict !== 'vooruit',
    v.byId.economie.regel);
  ok('en dat verschil staat in één zin',
    /vooruit op/i.test(v.line) && /(gelijk|terug) op/i.test(v.line), v.line);
  ok('de diagnose wijst de frequentie aan', v.diagnosis.id === 'frequentie',
    v.diagnosis.kop);
  ok('en zegt erbij dat het de kalender is, niet haar lichaam',
    /niet je lichaam/.test(v.diagnosis.tekst), v.diagnosis.tekst);
}

S('2 · Gestopt met kracht is geen vooruitgang');
{
  // Dit ging mis zolang het halve jaar in twee helften werd geknipt: alle
  // krachtsessies vielen in de tweede helft, dus "0 → 0,78 per week" en
  // dat heette vooruitgang. Terwijl zij zeven weken geleden gestopt is.
  globalThis.__testStorage.reset();
  const W = reeks({ weken: 12 });
  localStorage.setItem('gc_workouts', JSON.stringify(W));
  localStorage.setItem('gc_strength_sessions', JSON.stringify(
    [-50, -54, -58, -62, -66].map((n, i) =>
      ({ id: `s${i}`, date: addDays(TODAY, n), rpe: 4 }))));
  const v = voortgang({ currentDate: TODAY, logs: {}, workouts: W });
  console.log(`      ${v.byId.kracht.regel}`);
  ok('kracht die stilviel heet achteruit', v.byId.kracht.verdict === 'achteruit',
    v.byId.kracht.regel);
  ok('en de regel zegt "gestopt" in plaats van een percentage',
    /gestopt/.test(v.byId.kracht.regel), v.byId.kracht.regel);

  // Andersom net zo goed: net begonnen is vooruit, niet "onbekend".
  localStorage.setItem('gc_strength_sessions', JSON.stringify(
    [-3, -7, -10, -14].map((n, i) => ({ id: `t${i}`, date: addDays(TODAY, n), rpe: 4 }))));
  const v2 = voortgang({ currentDate: TODAY, logs: {}, workouts: W });
  ok('net begonnen met kracht heet vooruit', v2.byId.kracht.verdict === 'vooruit',
    v2.byId.kracht.regel);
  ok('met "begonnen" erbij', /begonnen/.test(v2.byId.kracht.regel), v2.byId.kracht.regel);
}

S('3 · Het oordeel over economie laat zich niet door twee sessies kantelen');
{
  // Een vlakke reeks hoort "gelijk" te zijn, ook als er toevallig twee
  // goede sessies vooraan staan.
  globalThis.__testStorage.reset();
  const vlak = reeks({ weken: 12, pctPerWeek: 0 });
  // Twee uitschieters vooraan, zoals in haar eigen reeks.
  vlak[1] = mk(vlak[1].date, [[360, 0.95 * 145 * 6, 145], [360, 0.95 * 145 * 6, 145]], 30, 3);
  vlak[2] = mk(vlak[2].date, [[360, 0.94 * 145 * 6, 145], [360, 0.94 * 145 * 6, 145]], 30, 3);
  localStorage.setItem('gc_workouts', JSON.stringify(vlak));
  const v = voortgang({ currentDate: TODAY, logs: {}, workouts: vlak });
  console.log(`      ${v.byId.economie.regel} · ${v.economyWindow.pctPerWeek}%/week`);
  ok('een vlakke reeks met twee uitschieters blijft gelijk',
    v.byId.economie.verdict === 'gelijk', v.byId.economie.regel);

  // En een reeks die écht stijgt, heet vooruit.
  const op = reeks({ weken: 12, pctPerWeek: 1.5 });
  localStorage.setItem('gc_workouts', JSON.stringify(op));
  const v2 = voortgang({ currentDate: TODAY, logs: {}, workouts: op });
  console.log(`      stijgend: ${v2.byId.economie.regel}`);
  ok('een stijgende reeks heet vooruit', v2.byId.economie.verdict === 'vooruit',
    v2.byId.economie.regel);
  ok('de diagnose zegt dan dat het werkt', v2.diagnosis.id === 'werkt', v2.diagnosis.kop);
  ok('de drempel staat op vier procent', DREMPEL_PCT === 4, String(DREMPEL_PCT));
}

S('4 · Het voorstel volgt uit de diagnose, niet uit een sjabloon');
{
  globalThis.__testStorage.reset();
  // Te weinig loopdagen → ritme eerst.
  const weinig = reeks({ weken: 12, elke: 5 });
  localStorage.setItem('gc_workouts', JSON.stringify(weinig));
  const a = voortgang({ currentDate: TODAY, logs: {}, workouts: weinig });
  const pa = driemaandenplan({ voortgang: a, currentDate: TODAY });
  console.log(`      ${a.diagnosis.id} → ${pa.kop}`);
  ok('bij te weinig loopdagen gaat blok 1 over ritme',
    a.diagnosis.id === 'frequentie' && /[Rr]itme/.test(pa.blokken[0].titel),
    pa.blokken[0].titel);
  ok('en kort houden staat er expliciet bij',
    /kort/i.test(pa.blokken[0].doel), pa.blokken[0].doel);

  // Genoeg loopdagen, geen kracht → kracht eerst.
  globalThis.__testStorage.reset();
  const vaak = reeks({ weken: 12, elke: 2 });
  localStorage.setItem('gc_workouts', JSON.stringify(vaak));
  localStorage.setItem('gc_strength_sessions', JSON.stringify([]));
  const b = voortgang({ currentDate: TODAY, logs: {}, workouts: vaak });
  const pb = driemaandenplan({ voortgang: b, currentDate: TODAY });
  console.log(`      ${b.diagnosis.id} → ${pb.kop}`);
  ok('bij genoeg loopdagen zonder kracht gaat blok 1 over kracht',
    b.diagnosis.id === 'kracht' && /[Kk]racht|[Gg]ewicht/.test(pb.blokken[0].titel),
    pb.blokken[0].titel);
  // Zij vroeg: als je gewichten bedoelt, zeg dat dan — met de reden.
  ok('het blok noemt gewichten, niet alleen "kracht"',
    /GEWICHTEN|gewichten|dumbbell|kettlebell/i.test(pb.blokken[0].doel),
    pb.blokken[0].doel);
  ok('en zegt waarom gewichten en niet een band',
    /veer|pezen/.test(pb.blokken[0].waarom), pb.blokken[0].waarom);
  ok('de twee voorstellen verschillen werkelijk van elkaar',
    pa.kop !== pb.kop && pa.blokken[0].doel !== pb.blokken[0].doel, `${pa.kop} / ${pb.kop}`);

  ok('elk voorstel heeft drie blokken van vier weken',
    pa.blokken.length === 3 && pb.blokken.length === 3,
    `${pa.blokken.length} / ${pb.blokken.length}`);
  ok('elk blok zegt wat eraan gemeten wordt',
    pa.blokken.every(x => !!x.meet) && pb.blokken.every(x => !!x.meet), '');
  ok('en elk plan zegt waar het op stukloopt',
    !!pa.let_op && !!pb.let_op, '');
  ok('de blokken sluiten op elkaar aan',
    pa.blokken[1].van === addDays(pa.blokken[0].tot, 1)
    && pa.blokken[2].van === addDays(pa.blokken[1].tot, 1),
    pa.blokken.map(x => `${x.van}–${x.tot}`).join(' | '));
}

S('5 · Zonder sessies geen oordeel');
{
  globalThis.__testStorage.reset();
  const v = voortgang({ currentDate: TODAY, logs: {}, workouts: [] });
  ok('geen loopsessies geeft geen oordeel', v.known === false, JSON.stringify(v));
  ok('en het plan ook niet',
    driemaandenplan({ voortgang: v, currentDate: TODAY }).known === false, '');
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

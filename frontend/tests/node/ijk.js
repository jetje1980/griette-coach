// De ijksessie: één schone meting in plaats van zes weken schatten.
//
// ─────────────────────────────────────────────────────────────────
// WAT HIER MIS KAN GAAN
//
// Een test die zichzelf altijd geslaagd verklaart meet niets, en een test
// op een slechte dag ijkt niets — dan staat er voortaan een te lage
// waarde waar al het andere aan wordt opgehangen. Deze suite bewaakt dus
// vooral de weigeringen:
//
//   · geen doorlopend blok van de afgesproken lengte → niet gelukt, met
//     de reden erbij;
//   · een verhoogde rusthartslag of de laatluteale week → geen ijkdag;
//   · en het subtielste: een dag in de toekomst heeft nog geen
//     rusthartslag, dus de toets slaagt omdat er niets te toetsen viel.
//     Dat is iets anders dan slagen, en dat verschil hoort zichtbaar te
//     blijven.
//
// De duur past zich aan wat ze aankan: twee minuten boven haar langste
// doorlopende blok. Twintig minuten voorschrijven aan iemand met blokken
// van tien maakt de meting zelf tot training, en dan meet je vermoeidheid
// in plaats van economie.
import './_storage-stub.js';
import { ijksessie, ijkDuur, ijkUitslag, geschiktOp, ijkTegenDoel,
  saveIjk, clearIjk, IJK_MIN_MIN, IJK_MAX_MIN, IJK_MAX_RHR_BOVEN }
  from '../../src/ijksessie.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-07';
const w = (date, laps) => ({ id: date, date, activityType: 'run',
  laps: laps.map(([movingTime, distance, avgHr]) => ({ movingTime, distance, avgHr })) });
const DRIFT = { lowest: { median: 62 } };

S('1 · De duur past bij wat ze aankan');
{
  // Haar langste doorlopende blok is 624 seconden (10,4 min) op 6 november.
  const haar = [w('2026-11-06', [[525, 1000, 136.7], [624, 1000, 142.6]])];
  localStorage.setItem('gc_workouts', JSON.stringify(haar));
  const d = ijkDuur({ currentDate: TODAY, workouts: haar });
  console.log(`      langste blok 10,4 min → ijksessie ${d} min`);
  ok('twee minuten boven haar langste blok', d === 12, String(d));

  // Iemand die al een halfuur doorloopt krijgt niet meer dan twintig: langer
  // voegt niets toe aan de meting.
  const ver = [w('2026-11-06', [[1800, 5000, 145]])];
  ok('maar nooit meer dan twintig minuten',
    ijkDuur({ currentDate: TODAY, workouts: ver }) === IJK_MAX_MIN,
    String(ijkDuur({ currentDate: TODAY, workouts: ver })));
  // En nooit minder dan tien: daaronder blijft er na de hartslagklim te
  // weinig steady state over om iets te meten.
  const kort = [w('2026-11-06', [[180, 400, 145]])];
  ok('en nooit minder dan tien', ijkDuur({ currentDate: TODAY, workouts: kort }) === IJK_MIN_MIN,
    String(ijkDuur({ currentDate: TODAY, workouts: kort })));
}

S('2 · Welke dag wel en welke niet');
{
  ok('een dag zonder loopsessie is geen ijkdag',
    geschiktOp({ datum: '2026-11-07', logs: {}, drift: DRIFT, isRunDag: false })
      .redenen.some(r => /geen loopdag/.test(r)), '');
  ok('de laatluteale week ook niet, want je hartslag ligt dan hoger',
    geschiktOp({ datum: '2026-11-20', logs: {}, drift: DRIFT, lateLuteal: true })
      .redenen.some(r => /laatluteale/.test(r)), '');

  const verhoogd = { '2026-11-08': { date: '2026-11-08', hr_rest: 66 } };
  const o = geschiktOp({ datum: '2026-11-08', logs: verhoogd, drift: DRIFT });
  console.log(`      rusthartslag 66 tegen basis 62 → ${o.geschikt ? 'wel' : 'geen'} ijkdag`);
  ok('een verhoogde rusthartslag ook niet', o.geschikt === false,
    JSON.stringify(o.redenen));
  ok('en de reden noemt beide getallen',
    /66/.test(o.redenen[0]) && /62/.test(o.redenen[0]), o.redenen[0]);

  const net = { '2026-11-08': { date: '2026-11-08', hr_rest: 62 + IJK_MAX_RHR_BOVEN } };
  ok('precies op de grens mag nog wel',
    geschiktOp({ datum: '2026-11-08', logs: net, drift: DRIFT }).geschikt === true, '');
}

S('3 · Goedgekeurd op afwezigheid van gegevens is geen goedkeuring');
{
  // Dit is het subtiele geval. Voor morgen is er nog geen rusthartslag,
  // dus de toets slaagt omdat er niets te toetsen viel. Zij staat vandaag
  // op 66 tegen een basis van 62; als dat morgen nog zo is, ijkt de
  // sessie haar herstelschuld en staat er voortaan een te laag getal.
  const o = geschiktOp({ datum: '2026-11-08', logs: {}, drift: DRIFT });
  console.log(`      ${o.voorwaarde}`);
  ok('de dag is geschikt', o.geschikt === true, JSON.stringify(o));
  ok('maar wel voorwaardelijk', o.voorwaardelijk === true, JSON.stringify(o));
  ok('en de voorwaarde noemt de grens', /64/.test(o.voorwaarde || ''), o.voorwaarde);
  ok('met wat ze moet doen als hij er niet is',
    /sla de ijksessie dan over/.test(o.voorwaarde || ''), o.voorwaarde);

  // Is de rusthartslag er wel en is hij goed, dan is er geen voorbehoud.
  const goed = { '2026-11-08': { date: '2026-11-08', hr_rest: 61 } };
  ok('met een gemeten, goede rusthartslag vervalt het voorbehoud',
    geschiktOp({ datum: '2026-11-08', logs: goed, drift: DRIFT }).voorwaardelijk === false,
    '');
}

S('4 · De uitslag lezen — en weigeren als het geen meting was');
{
  clearIjk();
  // Gelopen, maar in blokjes: geen steady state, dus geen ijkpunt.
  const blokjes = [w('2026-11-08', [[240, 480, 145], [240, 480, 145], [240, 480, 145]])];
  const u1 = ijkUitslag({ datum: '2026-11-08', hr: 145, minuten: 12, workouts: blokjes });
  console.log(`      blokjes → ${u1.gedaan ? 'geteld' : 'geweigerd'}`);
  ok('loop-wandel telt niet als ijksessie', u1.gedaan === false, JSON.stringify(u1));
  ok('en er staat bij waarom', /doorlopend blok/.test(u1.why), u1.why);

  // Wel een doorlopend blok, netjes op hartslag.
  const goed = [w('2026-11-08', [[600, 145 * 0.9 * 10, 145], [300, 400, 120]])];
  const u2 = ijkUitslag({ datum: '2026-11-08', hr: 145, minuten: 12, workouts: goed });
  console.log(`      10 min op 145 → EF ${u2.ef}`);
  ok('een doorlopend blok telt wel', u2.gedaan === true, JSON.stringify(u2));
  ok('de efficiëntie komt uit op wat erin zat', Math.abs(u2.ef - 0.9) < 0.01, String(u2.ef));
  ok('en hij ligt binnen de hartslagband', u2.binnenBand === true, String(u2.hr));

  // Gelopen op een heel andere hartslag: telt mee, maar omgerekend en met
  // het voorbehoud erbij. Weggooien zou de meting verspillen; stilzwijgend
  // meetellen zou doen alsof er op 145 gelopen is.
  const anders = [w('2026-11-08', [[600, 130 * 0.9 * 10, 130]])];
  const u3 = ijkUitslag({ datum: '2026-11-08', hr: 145, minuten: 12, workouts: anders });
  ok('een blok op een andere hartslag telt mee met voorbehoud',
    u3.gedaan === true && u3.binnenBand === false, JSON.stringify(u3));
  ok('en dat voorbehoud staat er in woorden',
    /minder nauwkeurig/.test(u3.why), u3.why);
}

S('5 · Wat de uitslag betekent voor het doel');
{
  const t = ijkTegenDoel({ ef: 0.94, hrCap: 145, benodigdeEf: 0.985 });
  console.log(`      ${t.line}`);
  ok('het tempo bij haar doelhartslag staat erbij', /\d+:\d\d\/km/.test(t.line), t.line);
  ok('en het gat naar het doel in procenten', t.gapPct === 5, String(t.gapPct));
  ok('zonder doel staat er geen gat',
    ijkTegenDoel({ ef: 0.94, hrCap: 145 }).gapPct === null, '');
}

S('6 · De hele keten: voorstel, gepland, gedaan');
{
  clearIjk();
  const haar = [w('2026-11-06', [[624, 1000, 142.6]])];
  localStorage.setItem('gc_workouts', JSON.stringify(haar));
  const dagen = [
    { date: '2026-11-07', run: null, gated: true },
    { date: '2026-11-08', run: { minutes: 20 }, gated: false },
    { date: '2026-11-10', run: { minutes: 22 }, gated: false },
  ];
  const v = ijksessie({ currentDate: TODAY, dagen, logs: {}, drift: DRIFT,
    hrCap: 145, workouts: haar, benodigdeEf: 0.985 });
  console.log(`      voorstel: ${v.date} · ${v.minuten} min`);
  ok('de eerste loopdag die mag, wordt voorgesteld', v.date === '2026-11-08', v.date);
  ok('de dag op slot wordt overgeslagen',
    v.afgewezen.some(a => a.date === '2026-11-07'), JSON.stringify(v.afgewezen));
  ok('met de duur die bij haar past', v.minuten === 12, String(v.minuten));

  saveIjk({ date: '2026-11-08', hr: 145, minuten: 12 });
  const g = ijksessie({ currentDate: TODAY, dagen, logs: {}, drift: DRIFT,
    hrCap: 145, workouts: haar });
  ok('eenmaal vastgelegd heet hij gepland', g.status === 'gepland', g.status);

  const metUitslag = [...haar, w('2026-11-08', [[660, 145 * 0.94 * 11, 145]])];
  const d = ijksessie({ currentDate: '2026-11-09', dagen, logs: {}, drift: DRIFT,
    hrCap: 145, workouts: metUitslag, benodigdeEf: 0.985 });
  console.log(`      na het lopen: ${d.status} · EF ${d.uitslag?.ef}`);
  ok('en na het lopen heet hij gedaan', d.status === 'gedaan', d.status);
  ok('met de uitslag erbij', Math.abs(d.uitslag.ef - 0.94) < 0.01, String(d.uitslag?.ef));
  ok('en wat dat voor het doel betekent', d.tegenDoel?.gapPct === 5,
    JSON.stringify(d.tegenDoel));
  clearIjk();
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

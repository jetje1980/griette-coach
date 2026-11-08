// Alle krachttraining, uit alle plekken waar zij hem vastlegt.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DEZE SUITE BESTAAT
//
// Ik schreef dat zij zeven weken geleden met kracht gestopt was. Zij
// corrigeerde dat meteen: "ik ben niet gestopt met kracht, ik heb Les
// Mills gedaan en die 8 min kracht." Ze had gelijk. Ik had één bron
// gelezen; haar circuit van acht minuten staat in de
// 75-dagen-challenge, acht afgevinkte dagen in vier weken.
//
// Een stellige verkeerde conclusie is erger dan "ik weet het niet", want
// daar handel je naar — en dit ging over de dimensie waar ik haar op
// aansprak. Deze suite bewaakt dus twee dingen tegelijk, en de tweede is
// net zo belangrijk als de eerste:
//
//   · elke bron telt mee;
//   · en meetellen is niet gelijkstellen. Acht minuten circuit en dertig
//     minuten zwaar zijn allebei kracht en doen niet hetzelfde. Zou de
//     app na deze correctie "je doet genoeg kracht" zeggen, dan had ik
//     dezelfde fout nog eens gemaakt, de andere kant op.
import './_storage-stub.js';
import { alleKracht, krachtBeeld, SOORT, VOLWAARDIG_MIN, ZWAAR_RPE }
  from '../../src/krachtBronnen.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-08';
const challenge = (datums) => {
  const days = {};
  datums.forEach((d, i) => { days[d] = { day: i + 1, kind: 'circuit',
    doneAt: `${d}T08:00:00.000Z` }; });
  localStorage.setItem('gc_challenge75',
    JSON.stringify({ id: 'vs75', startDate: datums[0], days }));
};

S('1 · Het circuit uit de challenge telt mee');
{
  globalThis.__testStorage.reset();
  // Precies haar situatie: krachtmodule stil sinds september, challenge
  // loopt sinds 23 oktober.
  localStorage.setItem('gc_strength_sessions', JSON.stringify([
    { id: 's1', date: '2026-09-21', program: 'A', exercises: [{ id: 'a' }] },
    { id: 's2', date: '2026-09-15', type: 'coach_class', duration: 15, rpe: 2 },
  ]));
  challenge(['2026-10-23', '2026-10-24', '2026-10-26', '2026-10-28', '2026-10-30',
    '2026-11-06', '2026-11-07', '2026-11-08']);

  const b = krachtBeeld({ currentDate: TODAY, logs: {}, dagen: 28 });
  console.log(`      ${b.regel}`);
  ok('de laatste krachtdag is vandaag, niet zeven weken geleden',
    b.laatste === TODAY && b.sinds === 0, `${b.laatste} / ${b.sinds}`);
  ok('acht dagen met kracht in vier weken', b.dagenMetKracht === 8,
    String(b.dagenMetKracht));
  ok('en de bron staat erbij, zodat zichtbaar is wat geteld is',
    b.bronnen.some(x => /circuit/.test(x)), JSON.stringify(b.bronnen));
}

S('2 · Maar meetellen is niet gelijkstellen');
{
  const b = krachtBeeld({ currentDate: TODAY, logs: {}, dagen: 28 });
  ok('geen van die dagen telt als zwaar', b.zwaar === 0, String(b.zwaar));
  ok('ze tellen wel als kort', b.kort >= 8, String(b.kort));
  ok('en de regel zegt dat met zoveel woorden',
    /waarvan geen enkele zwaar/.test(b.regel), b.regel);
  ok('de grens voor een volwaardige sessie staat op een kwartier',
    VOLWAARDIG_MIN === 15, String(VOLWAARDIG_MIN));
}

S('3 · Een zware sessie wordt wél als zwaar herkend');
{
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_strength_sessions', JSON.stringify([
    { id: 'z1', date: '2026-11-04', type: 'coach_class', duration: 25, rpe: 5 },
    { id: 'z2', date: '2026-11-01', type: 'coach_class', duration: 30,
      rpe: 3, couldDoMore: 'nee' },
    { id: 'm1', date: '2026-10-29', type: 'coach_class', duration: 30,
      rpe: 2, couldDoMore: 'ja' },
  ]));
  challenge(['2026-11-07', '2026-11-08']);
  const b = krachtBeeld({ currentDate: TODAY, logs: {}, dagen: 28 });
  console.log(`      ${b.regel}`);
  ok('RPE 5 telt als zwaar', b.zwaar >= 1, String(b.zwaar));
  ok('"kon niet meer" telt ook als zwaar, ongeacht de RPE', b.zwaar === 2,
    String(b.zwaar));
  ok('een lange maar lichte sessie telt als matig, niet als zwaar',
    b.matig === 1, String(b.matig));
  ok('de drempel ligt op RPE 4', ZWAAR_RPE === 4, String(ZWAAR_RPE));
  ok('en het circuit blijft apart staan', b.kort === 2, String(b.kort));
}

S('4 · Een vinkje in het dagboek telt ook');
{
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_strength_sessions', JSON.stringify([]));
  localStorage.setItem('gc_challenge75', JSON.stringify({ days: {} }));
  const logs = {
    '2026-11-05': { date: '2026-11-05', strength_done: true },
    '2026-11-02': { date: '2026-11-02', core_done: true },
  };
  const a = alleKracht({ currentDate: TODAY, logs, venster: 28 });
  console.log(`      ${a.sessies.map(s => `${s.date} ${s.soort}`).join(' · ')}`);
  ok('een afgevinkte krachtdag telt mee', a.dagen.includes('2026-11-05'),
    JSON.stringify(a.dagen));
  ok('een afgevinkte core-dag ook', a.dagen.includes('2026-11-02'),
    JSON.stringify(a.dagen));
  ok('core geldt als kort, niet als volwaardig',
    a.sessies.find(s => s.date === '2026-11-02').soort === SOORT.KORT, '');
}

S('5 · Twee bronnen op één dag is één krachtdag');
{
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_strength_sessions', JSON.stringify([
    { id: 'x', date: '2026-11-07', type: 'coach_class', duration: 30, rpe: 5 },
  ]));
  challenge(['2026-11-07']);
  const a = alleKracht({ currentDate: TODAY, logs: {}, venster: 28 });
  ok('twee sessies', a.sessies.length === 2, String(a.sessies.length));
  ok('maar één dag', a.dagen.length === 1, JSON.stringify(a.dagen));
  ok('en de zware telt apart', a.zwaar.length === 1, String(a.zwaar.length));
}

S('6 · Niets gedaan blijft niets gedaan');
{
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_strength_sessions', JSON.stringify([]));
  localStorage.setItem('gc_challenge75', JSON.stringify({ days: {} }));
  const b = krachtBeeld({ currentDate: TODAY, logs: {}, dagen: 28 });
  ok('geen kracht gevonden', b.dagenMetKracht === 0, String(b.dagenMetKracht));
  ok('en dat wordt ook zo gezegd', /Geen krachttraining/.test(b.regel), b.regel);
  ok('zonder laatste datum', b.laatste === null, String(b.laatste));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

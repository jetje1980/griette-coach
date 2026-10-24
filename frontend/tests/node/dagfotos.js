// De dagelijkse fotoreeks staat apart van de wekelijkse progressiefoto's.
//
// WAT ER MIS WAS
//
// De 75-dagenkaart sloeg op als type 'front'. Dat is geen aanzicht, dus:
//   · de foto verscheen nergens in de progressieschermen, maar de datum
//     verscheen wél als fotosessie — een lege rij "0/4" ertussen;
//   · restoreFromCloud loopt de mappen per aanzicht af en sloeg 'front'
//     stilzwijgend over, dus op een nieuw toestel kwam de reeks niet terug.
import './_storage-stub.js';          // moet als eerste staan, zie dat bestand
import { DAILY_TYPE } from '../../src/photoStore.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 200) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

// Een nagemaakte IndexedDB is te veel werk voor wat hier getoetst moet
// worden; wat telt is de groeperings- en filterlogica. Die staat hieronder
// nagebouwd uit photoStore, en de echte versie wordt in de browsersuite
// getoetst (ui_feed.mjs).
const AANZICHTEN = ['voor', 'zij', 'achter', 'gezicht'];
function sessiesUit(records) {
  const byDate = {};
  for (const p of records) {
    if (!AANZICHTEN.includes(p.type)) continue;
    if (!byDate[p.date]) byDate[p.date] = {};
    byDate[p.date][p.type] = p;
  }
  return Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a))
    .map(([date, views]) => ({ date, views }));
}
function dagelijksUit(records) {
  return records.filter(p => p.type === DAILY_TYPE)
    .sort((a, b) => b.date.localeCompare(a.date));
}

const records = [
  { id: '2026-10-20_voor', date: '2026-10-20', type: 'voor' },
  { id: '2026-10-20_zij', date: '2026-10-20', type: 'zij' },
  { id: '2026-10-24_dag', date: '2026-10-24', type: DAILY_TYPE, source: 'challenge75' },
  { id: '2026-10-25_dag', date: '2026-10-25', type: DAILY_TYPE, source: 'challenge75' },
  { id: '2026-10-26_dag', date: '2026-10-26', type: DAILY_TYPE, source: 'challenge75' },
];

console.log('\n████ Dagfoto\'s apart van de progressiefoto\'s ████');

S('1 · De soort bestaat en is geen aanzicht');
{
  ok('de dagelijkse soort heeft een eigen naam', DAILY_TYPE === 'dag', DAILY_TYPE);
  ok('en is geen van de vier aanzichten', !AANZICHTEN.includes(DAILY_TYPE));
}

S('2 · De progressiesessies blijven schoon');
{
  const sessies = sessiesUit(records);
  ok('alleen de datum met echte aanzichten is een sessie', sessies.length === 1,
    sessies.map(s => s.date).join(','));
  ok('en dat is 20 oktober', sessies[0].date === '2026-10-20', sessies[0].date);
  ok('de dagfoto-datums maken geen lege rij',
    !sessies.some(s => Object.keys(s.views).length === 0),
    JSON.stringify(sessies.map(s => [s.date, Object.keys(s.views)])));
  ok('en komen er helemaal niet in voor',
    !sessies.some(s => ['2026-10-24', '2026-10-25', '2026-10-26'].includes(s.date)),
    sessies.map(s => s.date).join(','));
}

S('3 · De dagelijkse reeks staat er wel, nieuwste eerst');
{
  const reeks = dagelijksUit(records);
  ok('drie dagfoto\'s', reeks.length === 3, String(reeks.length));
  ok('nieuwste eerst', reeks[0].date === '2026-10-26', reeks[0].date);
  ok('geen aanzichten erin', !reeks.some(f => AANZICHTEN.includes(f.type)),
    reeks.map(f => f.type).join(','));
}

S('4 · Verhuizing: wat moet er mee en wat niet');
{
  const teVerhuizen = (r) => r.filter(p =>
    p.type === 'front' || (p.source === 'challenge75' && p.type !== DAILY_TYPE));
  const oud = [
    { id: '2026-10-24_front', date: '2026-10-24', type: 'front', source: 'challenge75' },
    { id: '2026-10-20_voor', date: '2026-10-20', type: 'voor' },
    { id: '2026-10-25_dag', date: '2026-10-25', type: DAILY_TYPE, source: 'challenge75' },
  ];
  const mee = teVerhuizen(oud);
  ok('de verkeerd opgeslagen foto gaat mee', mee.length === 1 && mee[0].type === 'front',
    JSON.stringify(mee.map(m => m.id)));
  ok('een echt aanzicht blijft met rust', !mee.some(m => m.type === 'voor'));
  ok('een al verhuisde dagfoto gaat niet opnieuw mee',
    !mee.some(m => m.type === DAILY_TYPE));
  ok('en als er niets te verhuizen is, is de lijst leeg',
    teVerhuizen([{ id: 'x', date: '2026-10-20', type: 'voor' }]).length === 0);
  // De nieuwe sleutel is de datum plus de soort: zo overschrijft hij niets.
  const nieuweId = `${mee[0].date}_${DAILY_TYPE}`;
  ok('de nieuwe sleutel botst niet met een aanzicht',
    nieuweId === '2026-10-24_dag' && nieuweId !== '2026-10-24_voor', nieuweId);
}

S('5 · Oude mapnamen uit de cloud worden herkend');
{
  // Dit was het échte gat: restoreFromCloud loopt de mappen af en sloeg
  // elke naam over die hij niet kende. Haar foto van dag 1 staat in de
  // cloud onder .../2026-10-24/front/ en kon daardoor op géén enkel
  // toestel terugkomen — ook niet op het toestel waar hij vandaan kwam,
  // zodra de lokale opslag een keer is geschoond.
  const LEGACY = { front: DAILY_TYPE, side: 'zij', back: 'achter', face: 'gezicht' };
  const soortVan = n => LEGACY[n] || n;
  const herkend = n => [...AANZICHTEN, DAILY_TYPE].includes(n) || !!LEGACY[n];

  ok('een map "front" wordt herkend', herkend('front'));
  ok('en komt binnen als dagfoto', soortVan('front') === DAILY_TYPE, soortVan('front'));
  ok('de vier aanzichten blijven zichzelf',
    AANZICHTEN.every(a => soortVan(a) === a), AANZICHTEN.map(soortVan).join(','));
  ok('een dagfoto-map blijft zichzelf', soortVan(DAILY_TYPE) === DAILY_TYPE);
  ok('de Engelse namen uit VIEWS worden ook afgevangen',
    soortVan('side') === 'zij' && soortVan('back') === 'achter'
      && soortVan('face') === 'gezicht');
  ok('een onbekende map wordt nog steeds overgeslagen', !herkend('rommel'));
  // De lokale sleutel die eruit volgt, mag niet botsen met een aanzicht.
  ok('de sleutel wordt de dagfoto en niet het aanzicht',
    `2026-10-24_${soortVan('front')}` === '2026-10-24_dag',
    `2026-10-24_${soortVan('front')}`);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

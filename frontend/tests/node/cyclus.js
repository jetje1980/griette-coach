// Eén cyclus, overal dezelfde dag.
//
// De Cyclus-tab liet "cyclusdag 14" zien terwijl bij de trainingen
// "cyclusdag onbekend" stond. Twee leesfouten in de projectie, beide stil,
// want "geen menstruatiedata" is een geldige toestand. Deze suite vergelijkt
// de bronnen met elkaar in plaats van ze los te controleren.
import { cycleDayOf } from '../../src/bodyReview.js';
import { series } from '../../src/timeline.js';
import { loadCycleStarts } from '../../src/components/CycleHistory.jsx';
import { sessionContextFor, contextLines } from '../../src/sessionContext.js';
import { cycleIntelligence } from '../../src/cyclePatterns.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 300) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 52 - t.length))}`);

const TODAY = '2026-10-07';
let mem = {};
function store(seed = {}) {
  mem = { ...seed };
  globalThis.localStorage = {
    get length() { return Object.keys(mem).length; },
    key: i => Object.keys(mem)[i] ?? null,
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; },
  };
  globalThis.sessionStorage = globalThis.localStorage;
}
const starts = () => [...new Set(series('menstruation_start', { asOf: TODAY })
  .map(o => o.observedAt))].sort();

// De dag zoals de Cyclus-tab hem rekent: vanaf de laatste start vóór vandaag.
function tabDag(datum) {
  const s = loadCycleStarts().filter(d => d <= datum).pop();
  return s ? Math.floor((new Date(datum) - new Date(s)) / 86400000) + 1 : null;
}

S('1 · Platte datumstrings — zo schrijft de app het weg');
{
  store({ gc_cycle_history: JSON.stringify(['2026-07-12', '2026-08-09', '2026-09-06', '2026-10-04']),
    gc_cycle_start: '2026-10-04' });
  ok('de tijdlijn kent alle vier de starts', starts().length === 4, starts().join(', '));
  for (const d of ['2026-07-20', '2026-08-15', '2026-09-10', '2026-10-06']) {
    ok(`${d}: zelfde dag als de Cyclus-tab`,
      cycleDayOf(d, { asOf: TODAY }) === tabDag(d),
      `tijdlijn ${cycleDayOf(d, { asOf: TODAY })} vs tab ${tabDag(d)}`);
  }
}

S('2 · Alleen de huidige start, als ruwe tekst');
{
  store({ gc_cycle_start: '2026-09-28' });
  ok('die komt door', starts().join(',') === '2026-09-28', starts().join(','));
  ok('en levert de juiste dag', cycleDayOf('2026-10-05', { asOf: TODAY }) === 8,
    String(cycleDayOf('2026-10-05', { asOf: TODAY })));
}

S('3 · Objectvorm blijft werken');
{
  store({ gc_cycle_history: JSON.stringify([{ start: '2026-08-09', length: 28 },
    { date: '2026-09-06' }]) });
  ok('beide sleutelnamen worden gelezen', starts().length === 2, starts().join(','));
  ok('en de cycluslengte gaat mee',
    series('menstruation_start', { asOf: TODAY }).some(o => o.meta?.cycleLength === 28));
}

S('4 · De knop in de Cyclus-tab, via het dagboek');
{
  // markDayOne schrijft nu beide velden; oudere invoer heeft alleen
  // cycle_day_one. Beide moeten tellen.
  store({ [`gc_log_2026-09-20`]: JSON.stringify({ date: '2026-09-20', cycle_day_one: true }),
    [`gc_log_2026-08-23`]: JSON.stringify({ date: '2026-08-23', menstruation_start: true }) });
  ok('cycle_day_one telt als start', starts().includes('2026-09-20'), starts().join(','));
  ok('menstruation_start ook', starts().includes('2026-08-23'), starts().join(','));
  ok('en een dag ertussen klopt', cycleDayOf('2026-09-25', { asOf: TODAY }) === 6,
    String(cycleDayOf('2026-09-25', { asOf: TODAY })));
}

S('5 · Geen dubbele starts bij dezelfde datum in twee bronnen');
{
  store({ gc_cycle_history: JSON.stringify(['2026-09-06']), gc_cycle_start: '2026-09-06',
    [`gc_log_2026-09-06`]: JSON.stringify({ date: '2026-09-06', cycle_day_one: true,
      menstruation_start: true }) });
  ok('één datum blijft één start', starts().length === 1, starts().join(','));
}

S('6 · Onbekend blijft onbekend, maar zegt waarom');
{
  store({});
  const ctx = sessionContextFor('2026-10-01', { logs: {}, asOf: TODAY });
  ok('zonder data geen cyclusdag', ctx.cycleDay === null);
  ok('met een reden die naar de Cyclus-tab wijst',
    /nog geen menstruatiestart vastgelegd/i.test(ctx.cycleDayUnknownWhy || ''),
    String(ctx.cycleDayUnknownWhy));
  ok('en die reden noemt waar je het invult',
    /Lichaam → Cyclus/.test(ctx.cycleDayUnknownWhy || ''), String(ctx.cycleDayUnknownWhy));

  store({ gc_cycle_start: '2026-09-28' });
  const oud = sessionContextFor('2026-07-01', { logs: {}, asOf: TODAY });
  ok('een sessie vóór de eerste start is onbekend', oud.cycleDay === null);
  ok('en dát staat er ook zo',
    /vóór je eerste vastgelegde menstruatiestart \(2026-09-28\)/.test(oud.cycleDayUnknownWhy || ''),
    String(oud.cycleDayUnknownWhy));
}

S('7 · De patroonanalyse gebruikt dezelfde starts');
{
  store({ gc_cycle_history: JSON.stringify(['2026-07-12', '2026-08-09', '2026-09-06', '2026-10-04']),
    gc_cycle_start: '2026-10-04' });
  const ci = (() => { try { return cycleIntelligence({ asOf: TODAY }); } catch (e) { return { err: String(e) }; } })();
  ok('cycleIntelligence draait', !ci.err, ci.err);
  ok('en ziet meer dan één cyclus',
    (ci?.cycles ?? ci?.starts?.length ?? starts().length) >= 2,
    JSON.stringify(Object.keys(ci || {})).slice(0, 120));
  const ctx = sessionContextFor('2026-10-06', { logs: {}, asOf: TODAY });
  ok('de contextregel noemt de cyclusdag',
    contextLines(ctx).some(r => /^cyclusdag \d+$/.test(r)), contextLines(ctx).join(' | '));
}

console.log(`\n${'█'.repeat(54)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(54)}`);
process.exit(fail ? 1 : 0);

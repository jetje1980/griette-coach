// Loopt haar rusthartslag over weken op, en zegt de app daar het juiste
// over?
//
// ─────────────────────────────────────────────────────────────────
// WAAR DIT VANDAAN KOMT
//
// Zij vroeg wat er voorafging aan haar beste sessie. Bij het nazoeken bleek
// iets groters: haar rusthartslag staat in de week van 15 september op 53,
// 54, 57, 58, 59 en deze week op 62, 62, 66. Dat is een stijging van
// ongeveer zes slagen in zes weken, in precies de periode waarin haar
// loopeconomie zakte.
//
// Wat er stond was een trend over 28 dagen die het eerste meetpunt van het
// laatste aftrok. Met haar lege weken erin zijn dat twee willekeurige
// dagen, geen trend. Daarom blokken van twee weken met een mediaan per
// blok — en geen uitspraak zolang een blok te weinig metingen heeft.
import './_storage-stub.js';
import { restingDrift, restingByPhase, DRIFT_SIGNAAL, DRIFT_STERK }
  from '../../src/restingDrift.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);
const TODAY = '2026-11-06';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

function zet(logs) {
  globalThis.__testStorage.reset();
  for (const [d, l] of Object.entries(logs)) {
    localStorage.setItem(`gc_log_${d}`, JSON.stringify({ date: d, ...l }));
  }
}

console.log('\n████ Rusthartslag over weken ████');

S('1 · Haar eigen cijfers');
{
  // Exact wat er in haar dagboek staat.
  zet({
    '2026-09-15': { hr_rest: 53, sleep_hours: 7.5, weight: 63 },
    '2026-09-16': { hr_rest: 54, sleep_hours: 9, weight: 63.5 },
    '2026-09-18': { hr_rest: 57, sleep_hours: 8, weight: 63.7 },
    '2026-09-19': { hr_rest: 58, sleep_hours: 7.5, weight: 63.4 },
    '2026-09-20': { hr_rest: 59, weight: 64 },
    '2026-10-04': { hr_rest: 59 },
    '2026-10-05': { hr_rest: 61 },
    '2026-10-07': { hr_rest: 64, weight: 62.7, sleep_hours: 4.5 },
    '2026-10-11': { hr_rest: 61, weight: 62.8 },
    '2026-10-12': { hr_rest: 61, weight: 62.8 },
    '2026-10-13': { hr_rest: 62, weight: 62.6 },
    '2026-10-14': { hr_rest: 65 },
    '2026-10-19': { hr_rest: 60, weight: 61.8 },
    '2026-10-21': { hr_rest: 62, weight: 61, sleep_hours: 7.5 },
    '2026-10-22': { hr_rest: 63, weight: 61.5 },
    '2026-10-23': { hr_rest: 63, weight: 61.7 },
    '2026-10-24': { hr_rest: 63, weight: 61.2 },
    '2026-11-04': { hr_rest: 62 },
    '2026-11-05': { hr_rest: 62 },
    '2026-11-06': { hr_rest: 66, weight: 61.5, sleep_hours: 6.5 },
  });
  const r = restingDrift({ currentDate: TODAY });
  console.log(`      ${r.line}`);
  ok('de drift is te berekenen', r.known === true, JSON.stringify(r).slice(0, 140));
  ok('en gaat omhoog', r.direction === 'omhoog' || r.direction === 'sterk_omhoog',
    r.direction);
  ok('van midden vijftig naar ruim zestig', r.from.median < 59 && r.to.median > 61,
    `${r.from.median} → ${r.to.median}`);
  ok('over meerdere weken', r.weeks >= 5, String(r.weeks));
  ok('het gewichtsverlies wordt erbij gezocht', r.weightDelta < 0, String(r.weightDelta));
  ok('en het energietekort staat bovenaan',
    r.causes[0]?.id === 'tekort', JSON.stringify(r.causes.map(c => c.id)));
  ok('met wat je eraan doet', /vast te houden|eiwit/.test(r.causes[0].wat),
    r.causes[0].wat);
  ok('en het wordt geen diagnose',
    r.causes.some(c => c.id === 'medisch' && /uit te sluiten met de gegevens/.test(c.why)),
    JSON.stringify(r.causes.map(c => c.id)));
  ok('het verband met economie wordt benoemd',
    /tempo bij een gegeven hartslag niet beter/.test(r.verdict), r.verdict);
}

S('2 · Lege weken breken de berekening niet');
{
  // Tussen 21 september en 4 oktober staat er niets in haar dagboek. Een
  // trend die het eerste meetpunt van het laatste aftrekt, pakt dan twee
  // willekeurige dagen.
  zet({
    '2026-09-13': { hr_rest: 56 }, '2026-09-15': { hr_rest: 57 },
    '2026-09-17': { hr_rest: 58 },
    // dan drie weken niets
    '2026-11-01': { hr_rest: 63 }, '2026-11-03': { hr_rest: 64 },
    '2026-11-05': { hr_rest: 63 },
  });
  const r = restingDrift({ currentDate: TODAY });
  ok('de lege weken leveren geen blok op',
    r.blocks.some(b => b.median == null), JSON.stringify(r.blocks.map(b => b.median)));
  ok('maar de uitspraak komt er wel', r.known === true);
  ok('en vergelijkt de twee blokken die er zijn', r.from.median === 57 && r.to.median === 63,
    `${r.from.median} → ${r.to.median}`);
}

S('3 · Te weinig metingen is geen trend');
{
  zet({ '2026-11-04': { hr_rest: 62 }, '2026-11-05': { hr_rest: 63 } });
  const r = restingDrift({ currentDate: TODAY });
  ok('twee metingen is te weinig', r.known === false, JSON.stringify(r).slice(0, 120));
  ok('met het aantal erbij', /2 rusthartslagmetingen/.test(r.why), r.why);

  // Genoeg metingen, maar allemaal in één blok: ook geen richting.
  zet({
    '2026-11-01': { hr_rest: 62 }, '2026-11-02': { hr_rest: 63 },
    '2026-11-03': { hr_rest: 62 }, '2026-11-04': { hr_rest: 64 },
    '2026-11-05': { hr_rest: 63 }, '2026-11-06': { hr_rest: 62 },
  });
  const een = restingDrift({ currentDate: TODAY });
  ok('alles in één periode geeft geen richting', een.known === false, een.why);
  ok('met uitleg waarom', /één periode/.test(een.why), een.why);
}

S('4 · Stabiel en dalend worden ook benoemd');
{
  const reeks = (waarden) => {
    const logs = {};
    waarden.forEach(([dag, hr]) => { logs[addDays(TODAY, dag)] = { hr_rest: hr }; });
    zet(logs);
  };
  reeks([[-60, 60], [-58, 61], [-56, 60], [-6, 60], [-4, 61], [-2, 60]]);
  const stabiel = restingDrift({ currentDate: TODAY });
  ok('gelijk blijven heet stabiel', stabiel.direction === 'stabiel',
    `${stabiel.direction} (${stabiel.delta})`);
  ok('en dat is goed nieuws', /wat je wilt zien/.test(stabiel.verdict), stabiel.verdict);
  ok('zonder lijst met oorzaken', stabiel.causes.length === 0);

  reeks([[-60, 66], [-58, 65], [-56, 66], [-6, 58], [-4, 59], [-2, 58]]);
  const omlaag = restingDrift({ currentDate: TODAY });
  ok('zakken wordt herkend', omlaag.direction === 'omlaag',
    `${omlaag.direction} (${omlaag.delta})`);
  ok('en benoemd als het duidelijkste teken van vooruitgang',
    /aerobe systeem meegroeit/.test(omlaag.verdict), omlaag.verdict);
}

S('5 · De grenzen zijn wat ze zeggen te zijn');
{
  const met = (delta) => {
    const logs = {};
    [[-60, 60], [-58, 60], [-56, 60]].forEach(([d, hr]) => { logs[addDays(TODAY, d)] = { hr_rest: hr }; });
    [[-6, 60 + delta], [-4, 60 + delta], [-2, 60 + delta]].forEach(([d, hr]) => {
      logs[addDays(TODAY, d)] = { hr_rest: hr };
    });
    zet(logs);
    return restingDrift({ currentDate: TODAY });
  };
  ok(`onder ${DRIFT_SIGNAAL} slagen is ruis`, met(DRIFT_SIGNAAL - 1).direction === 'stabiel',
    met(DRIFT_SIGNAAL - 1).direction);
  ok(`vanaf ${DRIFT_SIGNAAL} slagen is het een signaal`,
    met(DRIFT_SIGNAAL).direction === 'omhoog', met(DRIFT_SIGNAAL).direction);
  ok(`vanaf ${DRIFT_STERK} slagen is het te groot voor ruis`,
    met(DRIFT_STERK).direction === 'sterk_omhoog', met(DRIFT_STERK).direction);
  ok('en dat staat ook in de tekst',
    /te groot om aan meetruis/.test(met(DRIFT_STERK).verdict),
    met(DRIFT_STERK).verdict.slice(0, 100));
}

S('6 · Een dip en een opleving zijn geen "stabiel"');
{
  // Toen zij haar rusthartslag met terugwerkende kracht invulde, bleek de
  // vorm van de lijn anders dan uit de losse metingen: 63 in augustus, 58
  // in september, 62 nu. Eerste tegen laatste zegt "stabiel"; wat er
  // werkelijk staat is dat ze vijf slagen won en weer inleverde.
  const logs = {};
  const zet = (dag, hr) => { logs[addDays(TODAY, dag)] = { hr_rest: hr }; };
  // drie blokken van twee weken: hoog, laag, weer hoog
  [-80, -78, -76, -74].forEach(d => zet(d, 63));
  [-52, -50, -48, -46].forEach(d => zet(d, 58));
  [-10, -8, -6, -4, 0].forEach(d => zet(d, 62));
  globalThis.__testStorage.reset();
  for (const [d, l] of Object.entries(logs)) {
    localStorage.setItem(`gc_log_${d}`, JSON.stringify({ date: d, ...l }));
  }
  const r = restingDrift({ currentDate: TODAY, window: 84 });
  console.log(`      ${r.line}`);
  ok('het laagste blok wordt genoemd', r.lowest?.median === 58,
    JSON.stringify(r.lowest));
  ok('met hoeveel het sindsdien opliep', r.sinceLowest === 4, String(r.sinceLowest));
  ok('en dat heet een opleving, geen stabiel', r.reboundFromLow === true,
    `${r.direction} / ${r.reboundFromLow}`);
  ok('de regel toont alle drie de punten', /63 → 58 → 62/.test(r.line), r.line);
  ok('en de uitleg vraagt wat er tóen anders was',
    /Wat was er toen anders/.test(r.verdict), r.verdict);
  ok('het wordt uitdrukkelijk geen alarm genoemd',
    /geen alarm/.test(r.verdict), r.verdict);
}

S('7 · Rusthartslag per cyclusfase');
{
  globalThis.__testStorage.reset();
  // Drie starts, zodat er twee AFGESLOTEN cycli zijn: een lopende cyclus
  // telt niet mee, want zijn lengte staat nog niet vast.
  const start0 = addDays(TODAY, -84);
  const start1 = addDays(TODAY, -56), start2 = addDays(TODAY, -28);
  const zet = (d, hr, extra = {}) => localStorage.setItem(`gc_log_${d}`,
    JSON.stringify({ date: d, hr_rest: hr, ...extra }));
  for (const start of [start0, start1, start2]) {
    zet(start, 56, { cycle_day_one: true });
    for (let i = 1; i < 28; i++) {
      // dag 1–5 lager, de rest hoger
      zet(addDays(start, i), i < 5 ? 56 : 62);
    }
  }
  localStorage.setItem('gc_cycle_history', JSON.stringify([start0, start1, start2]));
  const r = restingByPhase({ currentDate: TODAY });
  console.log(`      ${r.phases.map(f => `${f.phase} ${f.delta}`).join(' · ') || r.why}`);
  ok('er komt een fase uit', r.known === true, JSON.stringify(r).slice(0, 150));
  const m = r.phases.find(f => f.phase === 'menstruatie');
  ok('menstruatie ligt lager', m && m.delta < 0, JSON.stringify(m));
  ok('met het aantal cycli erbij', m.cycles >= 2, String(m.cycles));
  ok('en de uitleg draagt de onzekerheid mee', /aanwijzing|patroon/.test(m.note), m.note);

  // Eén afgesloten cyclus is geen patroon.
  globalThis.__testStorage.reset();
  zet(start1, 56, { cycle_day_one: true });
  for (let i = 1; i < 28; i++) zet(addDays(start1, i), i < 5 ? 56 : 62);
  zet(start2, 56, { cycle_day_one: true });
  localStorage.setItem('gc_cycle_history', JSON.stringify([start1, start2]));
  const een = restingByPhase({ currentDate: TODAY });
  ok('met één cyclus komt er geen uitspraak', een.known === false, JSON.stringify(een).slice(0, 120));
  ok('met uitleg waarom', /twee cycli|te weinig cycli/.test(een.why), een.why);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

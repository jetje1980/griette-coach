// Wat remt haar vooruitgang — en zegt de app dat op grond van metingen?
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DEZE SUITE BESTAAT
//
// Zij vroeg om de allerbeste trainers: hoe maak ik écht meer progressie.
// Het antwoord bleek niet in haar loopschema te zitten maar ernaast —
// sinds 21 september geen enkele krachtsessie, terwijl dat in vijf weken
// de best onderbouwde route is naar hetzelfde tempo bij een lagere
// hartslag. Een knop die aanstaat in het plan en uitstaat in het echt is
// geen knop.
//
// Deze suite bewaakt dat zulke remmen uit gemeten gegevens komen en niet
// uit een vaste lijst adviezen: geen meting, geen rem. En dat ze op
// volgorde van grootte staan, want een lijst van vier gelijkwaardige
// adviezen is geen coaching.
import './_storage-stub.js';
import { remmen, VEILIG_KG_PER_WEEK, REM_GEWICHT } from '../../src/remmen.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-07';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

function wereld({ runs = [], kracht = [], logs = {} } = {}) {
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_workouts', JSON.stringify(
    runs.map((w, i) => ({ id: `w${i}`, activityType: 'run', ...w }))));
  localStorage.setItem('gc_strength_sessions', JSON.stringify(kracht));
  const metDatum = {};
  for (const [d, v] of Object.entries(logs)) {
    metDatum[d] = { date: d, ...v };
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(metDatum[d]));
  }
  return metDatum;
}

// Haar werkelijke gegevens van 7 november, als ijkpunt.
const HAAR_RUNS = [
  { date: '2026-11-06', duration: 34.1, distance: 3.31 },
  { date: '2026-11-01', duration: 33.4, distance: 3.01 },
  { date: '2026-11-01', duration: 66.3, distance: 6.27 },
  { date: '2026-10-28', duration: 22.4, distance: 2.0 },
  { date: '2026-10-24', duration: 45, distance: 4.48 },
  { date: '2026-10-22', duration: 33.1, distance: 3.41 },
  { date: '2026-10-18', duration: 36.6, distance: 3.88 },
  { date: '2026-10-11', duration: 37.2, distance: 3.88 },
];
const HAAR_LOGS = {
  '2026-11-07': { hr_rest: 66, sleep_hours: 6.5, weight: 60.5 },
  '2026-11-06': { hr_rest: 66, sleep_hours: 6.5, weight: 61.5 },
  '2026-11-05': { hr_rest: 62, sleep_hours: 8.5, weight: 62 },
  '2026-11-04': { hr_rest: 62, sleep_hours: 6, weight: 62 },
  '2026-11-03': { hr_rest: 62, sleep_hours: 7, weight: 61.5 },
  '2026-11-02': { hr_rest: 61, sleep_hours: 7, weight: 62 },
  '2026-11-01': { hr_rest: 61, sleep_hours: 8.5, weight: 62 },
  '2026-10-31': { hr_rest: 62, sleep_hours: 9.5, weight: 62 },
  '2026-10-30': { hr_rest: 62, sleep_hours: 7.5, weight: 61.8 },
  '2026-10-29': { hr_rest: 61, sleep_hours: 8, weight: 61.8 },
  '2026-10-28': { hr_rest: 62, sleep_hours: 8, weight: 62 },
  '2026-10-27': { hr_rest: 63, sleep_hours: 7, weight: 62 },
  '2026-10-26': { hr_rest: 61, sleep_hours: 8.5, weight: 62.5 },
  '2026-10-25': { hr_rest: 64, sleep_hours: 7, weight: 61 },
  '2026-10-24': { hr_rest: 63, sleep_hours: 7.5, weight: 61.2 },
  '2026-10-23': { hr_rest: 63, sleep_hours: 9.45, weight: 61.7 },
  '2026-10-22': { hr_rest: 63, sleep_hours: 9, weight: 61.5 },
  '2026-10-21': { hr_rest: 62, sleep_hours: 7.5, weight: 61 },
  '2026-10-13': { hr_rest: 62, sleep_hours: 8, weight: 62.6 },
  '2026-10-11': { hr_rest: 61, weight: 62.8 },
};

S('1 · Haar eigen 7 november');
{
  const logs = wereld({ runs: HAAR_RUNS, logs: HAAR_LOGS,
    kracht: [{ id: 's1', date: '2026-09-21', type: 'coach_class', duration: 30, rpe: 3 }] });
  const r = remmen({ currentDate: TODAY, logs });
  console.log(`      ${r.kop}`);
  console.log(`      ${r.remmen.map(x => x.label).join(' > ')}`);
  ok('er staan remmen', r.remmen.length >= 3, String(r.remmen.length));
  ok('kracht staat bovenaan', r.remmen[0].id === 'kracht', r.remmen[0].id);
  ok('en noemt hoeveel dagen geleden de laatste was',
    /47 dagen geleden/.test(r.remmen[0].stand), r.remmen[0].stand);
  const herstel = r.remmen.find(x => x.id === 'herstel');
  ok('de herstelrem noemt haar eigen basis, niet een tabelwaarde',
    /66 tegen 62/.test(herstel?.stand || ''), herstel?.stand);
  const eten = r.remmen.find(x => x.id === 'tekort');
  ok('het afvaltempo wordt gemeten en te snel bevonden',
    /0,6 kg per week/.test(eten?.stand || ''), eten?.stand);
  const freq = r.remmen.find(x => x.id === 'frequentie');
  ok('de loopfrequentie staat erbij met het grootste gat',
    /1,8 per week/.test(freq?.stand || '') && /gat 7 dagen/.test(freq?.stand || ''),
    freq?.stand);
  ok('ze staan op volgorde van grootte',
    r.remmen.every((x, i) => i === 0 || r.remmen[i - 1].gewicht >= x.gewicht),
    JSON.stringify(r.remmen.map(x => [x.id, x.gewicht])));
  ok('elke rem zegt wat de eerste stap is', r.remmen.every(x => !!x.wat),
    JSON.stringify(r.remmen.map(x => x.id)));
}

S('2 · Kracht die wel gedaan is maar te licht');
{
  // Dit is het verschil dat nergens stond: bandwerk op RPE 2–3 telt als
  // beweging en niet als economieprikkel. Het plan schreef zwaar werk al
  // voor; alleen zei niemand dat er een verschil tussen de twee zit.
  const licht = [-3, -7, -10, -14, -17, -21].map((n, i) => ({
    id: `l${i}`, date: addDays(TODAY, n), type: 'coach_class',
    duration: 30, rpe: 3, couldDoMore: 'beetje' }));
  const logs = wereld({ runs: HAAR_RUNS, logs: HAAR_LOGS, kracht: licht });
  const r = remmen({ currentDate: TODAY, logs });
  const k = r.alle.find(x => x.id === 'kracht');
  console.log(`      ${k.label} · ${k.stand}`);
  ok('zes lichte sessies gelden niet als economieprikkel', k.status === 'half', k.status);
  ok('maar wegen wel minder zwaar dan helemaal geen kracht',
    k.gewicht > 0 && k.gewicht < REM_GEWICHT.kracht, String(k.gewicht));
  ok('en de tekst zegt wat eraan moet veranderen, niet dat het fout was',
    /zwaar naast/.test(k.wat) && /mag blijven staan/.test(k.wat), k.wat);
}

S('3 · Zware kracht telt wél, en dan is de rem weg');
{
  const zwaar = [-2, -5, -9, -12, -16, -19, -23, -26].map((n, i) => ({
    id: `z${i}`, date: addDays(TODAY, n), type: 'coach_class',
    duration: 25, rpe: 5, couldDoMore: 'nee' }));
  const logs = wereld({ runs: HAAR_RUNS, logs: HAAR_LOGS, kracht: zwaar });
  const r = remmen({ currentDate: TODAY, logs });
  const k = r.alle.find(x => x.id === 'kracht');
  ok('zware sessies zetten de knop op aan', k.status === 'aan', k.status);
  ok('en hij staat niet meer in de lijst met remmen',
    !r.remmen.some(x => x.id === 'kracht'), JSON.stringify(r.remmen.map(x => x.id)));
  ok('hij staat wel bij wat goed gaat',
    r.goed.some(g => g.id === 'kracht'), JSON.stringify(r.goed.map(g => g.id)));
}

S('4 · Geen meting, geen rem');
{
  // De valkuil van elke adviesmotor: bij gebrek aan gegevens toch iets
  // roepen. Een rem zonder meting is een mening.
  const logs = wereld({ runs: HAAR_RUNS, logs: {
    '2026-11-07': { hr_rest: 62 }, '2026-11-06': { hr_rest: 62 },
  } });
  const r = remmen({ currentDate: TODAY, logs });
  const eten = r.alle.find(x => x.id === 'tekort');
  console.log(`      eten: ${eten.status} — ${eten.stand}`);
  ok('zonder weegmomenten geen uitspraak over eten', eten.status === 'onbekend',
    eten.status);
  ok('en geen gewicht in de volgorde', eten.gewicht === 0, String(eten.gewicht));
  ok('hij staat ook niet tussen de remmen',
    !r.remmen.some(x => x.id === 'tekort'), JSON.stringify(r.remmen.map(x => x.id)));
}

S('5 · Alles op orde');
{
  const runs = [];
  for (let n = 2; n <= 28; n += 2) runs.push({ date: addDays(TODAY, -n), duration: 30, distance: 3.2 });
  const kracht = [];
  for (let n = 1; n <= 28; n += 3.5) {
    kracht.push({ id: `k${n}`, date: addDays(TODAY, -Math.round(n)),
      type: 'coach_class', duration: 25, rpe: 5, couldDoMore: 'nee' });
  }
  const logs = {};
  for (let n = 0; n <= 27; n++) {
    logs[addDays(TODAY, -n)] = { hr_rest: 60, sleep_hours: 8, weight: 61 };
  }
  const metDatum = wereld({ runs, kracht, logs });
  const r = remmen({ currentDate: TODAY, logs: metDatum });
  console.log(`      ${r.kop}`);
  ok('geen enkele rem', r.remmen.length === 0,
    JSON.stringify(r.remmen.map(x => `${x.id}: ${x.stand}`)));
  ok('en de kopregel zegt dat ook',
    /Geen gemeten rem/.test(r.kop), r.kop);
  ok('een stabiel gewicht is geen tekort',
    r.alle.find(x => x.id === 'tekort').status === 'aan',
    r.alle.find(x => x.id === 'tekort').stand);
  ok('de veilige grens staat op een halve kilo per week',
    VEILIG_KG_PER_WEEK === 0.5, String(VEILIG_KG_PER_WEEK));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

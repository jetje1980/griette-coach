// Week, maand en kwartaal naast elkaar — dip of richting?
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG
//
// "Het gaat mij om patroon- en trendanalyse over week / weken /
// maanden."
//
// Elke analyse in deze app keek naar precies één venster: de drift naar
// twaalf weken, het voortgangsoordeel naar een half jaar in twee
// helften, de patroonvergelijking naar haar betere tegenover haar
// mindere sessies. Bruikbaar, en geen van drieën beantwoordt haar vraag.
//
// Want één venster kan het verschil tussen een dip en een richting niet
// zien. Een HRV die deze week acht procent lager ligt betekent iets heel
// anders als de maand vlak is dan wanneer de maand óók zakt. Het eerste
// is een slechte week; het tweede vraagt een ingreep. Precies dát
// onderscheid moet deze suite bewaken.
import './_storage-stub.js';
import { trends, trendVan, HORIZONS } from '../../src/trends.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-11';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// Een wereld waarin per dag een HRV-waarde staat die een functie is van
// hoeveel dagen geleden het was. Zo is elk scenario exact te sturen.
function wereld(hrvOpDag, { dagen = 200 } = {}) {
  globalThis.__testStorage.reset();
  const logs = {};
  for (let i = dagen; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    const rec = { date: d, hrv: hrvOpDag(i), hr_rest: 60, sleep_hours: 7.5 };
    logs[d] = rec;
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(rec));
  }
  localStorage.setItem('gc_workouts', JSON.stringify([]));
  localStorage.setItem('gc_strength_sessions', JSON.stringify([]));
  localStorage.setItem('gc_challenge75', JSON.stringify({ days: {} }));
  return logs;
}
const hrvVan = (logs) => trends({ currentDate: TODAY, logs, workouts: [] })
  .metrics.find(m => m.id === 'hrv');

S('1 · Drie vensters, elk tegen de periode ervoor');
{
  const logs = wereld(() => 40);
  const m = hrvVan(logs);
  console.log(`      ${m.horizons.map(h => `${h.kort}: ${h.weergave}`).join(' | ')}`);
  ok('er zijn drie vensters', m.horizons.length === 3,
    JSON.stringify(m.horizons.map(h => h.id)));
  ok('week, maand en kwartaal', HORIZONS.map(h => h.dagen).join() === '7,28,90',
    JSON.stringify(HORIZONS.map(h => h.dagen)));
  ok('een vlakke reeks is in alle drie gelijk',
    m.horizons.every(h => h.richting === 'gelijk'),
    JSON.stringify(m.horizons.map(h => h.richting)));
  ok('en dan is er niets om op te sturen', m.duiding.id === 'gemengd',
    m.duiding.tekst);
}

S('2 · Een losse slechte week is geen trend');
{
  // Alleen de laatste zeven dagen zakken; daarvoor is alles gelijk.
  const logs = wereld(i => (i < 7 ? 33 : 40));
  const m = hrvVan(logs);
  console.log(`      ${m.horizons.map(h => `${h.kort} ${h.richting}`).join(' | ')}`);
  ok('de week ziet de dip', m.horizons[0].richting === 'terug',
    m.horizons[0].weergave);
  ok('de maand blijft vlak', m.horizons[1].richting === 'gelijk',
    m.horizons[1].weergave);
  ok('en dat heet een dip, geen trend', m.duiding.id === 'dip', m.duiding.tekst);
  ok('met de raad eerst naar slaap en cyclus te kijken',
    /cyclusfase/.test(m.duiding.tekst), m.duiding.tekst);
}

S('3 · Zakt het over alle vensters, dan is het een richting');
{
  // Een gestage daling over het hele venster.
  const logs = wereld(i => 30 + i * 0.12);
  const m = hrvVan(logs);
  console.log(`      ${m.horizons.map(h => `${h.kort} ${h.richting}`).join(' | ')}`);
  // Niet "alle drie", maar: geen enkel venster spreekt tegen. Een
  // daling van een procent per week registreert over zeven dagen niet —
  // te weinig verschil voor de drempel — en zo'n te kort venster is
  // geen tegenspraak maar stilte.
  ok('geen enkel venster wijst de andere kant op',
    m.horizons.filter(h => h.known).every(h => h.richting !== 'vooruit')
    && m.horizons.filter(h => h.richting === 'terug').length >= 2,
    JSON.stringify(m.horizons.map(h => h.richting)));
  ok('en dat heet een richting', m.duiding.id === 'richting_slecht', m.duiding.tekst);
  ok('met de boodschap dat er iets moet veranderen',
    /ingreep/.test(m.duiding.tekst), m.duiding.tekst);

  const alles = trends({ currentDate: TODAY, logs, workouts: [] });
  ok('en hij staat in de samenvatting bovenaan',
    alles.directions.some(d => d.id === 'hrv' && d.goed === false),
    JSON.stringify(alles.directions));
}

S('4 · Een kering: de week keert, het kwartaal nog niet');
{
  // Lang gezakt, en de laatste week flink omhoog.
  const logs = wereld(i => (i < 7 ? 46 : 30 + i * 0.12));
  const m = hrvVan(logs);
  console.log(`      ${m.horizons.map(h => `${h.kort} ${h.richting}`).join(' | ')}`);
  ok('week omhoog, kwartaal omlaag',
    m.horizons[0].richting === 'vooruit' && m.horizons[2].richting === 'terug',
    JSON.stringify(m.horizons.map(h => h.richting)));
  ok('dat heet een kering', m.duiding.id === 'keert', m.duiding.tekst);
  ok('met de raad voorlopig het langste venster te geloven',
    /Geloof voorlopig het kwartaal/.test(m.duiding.tekst), m.duiding.tekst);
}

S('5 · Vooruit is ook een richting');
{
  const logs = wereld(i => 46 - i * 0.12);
  const m = hrvVan(logs);
  ok('minstens twee vensters vooruit en geen enkel terug',
    m.horizons.filter(h => h.richting === 'vooruit').length >= 2
    && m.horizons.filter(h => h.known).every(h => h.richting !== 'terug'),
    JSON.stringify(m.horizons.map(h => h.richting)));
  ok('en de boodschap is doorgaan', /Doorgaan/.test(m.duiding.tekst), m.duiding.tekst);
}

S('6 · Geen getallen uit de lucht');
{
  // Twee metingen in drie maanden is geen trend maar een toevalstreffer.
  globalThis.__testStorage.reset();
  const logs = {};
  for (const d of [addDays(TODAY, -1), addDays(TODAY, -50)]) {
    logs[d] = { date: d, hrv: 40 };
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(logs[d]));
  }
  localStorage.setItem('gc_workouts', JSON.stringify([]));
  localStorage.setItem('gc_strength_sessions', JSON.stringify([]));
  localStorage.setItem('gc_challenge75', JSON.stringify({ days: {} }));
  const m = hrvVan(logs);
  console.log(`      ${m.horizons.map(h => `${h.kort}: ${h.known ? 'wel' : 'niet'}`).join(' | ')}`);
  ok('met te weinig metingen staat er geen oordeel',
    m.horizons.every(h => !h.known), JSON.stringify(m.horizons.map(h => h.known)));
  ok('en er staat bij hoeveel er waren',
    m.horizons.every(h => /metingen/.test(h.why || '')), m.horizons[0].why);
}

S('7 · Een telling krijgt geen percentage op een bijna-nul basis');
{
  // Van 0,26 naar 1,14 loopdagen per week is "+338%", en dat getal
  // suggereert een explosie waar er een halve loopdag bij kwam.
  globalThis.__testStorage.reset();
  const W = [];
  for (let i = 160; i >= 0; i -= (i > 40 ? 20 : 3)) {
    const d = addDays(TODAY, -i);
    W.push({ id: d, date: d, activityType: 'run', duration: 30, distance: 3 });
  }
  localStorage.setItem('gc_workouts', JSON.stringify(W));
  localStorage.setItem('gc_strength_sessions', JSON.stringify([]));
  localStorage.setItem('gc_challenge75', JSON.stringify({ days: {} }));
  const t = trends({ currentDate: TODAY, logs: {}, workouts: W });
  const loop = t.metrics.find(m => m.id === 'loopdagen');
  const bekend = loop.horizons.filter(h => h.known);
  console.log(`      ${bekend.map(h => `${h.kort}: ${h.weergave}`).join(' | ')}`);
  ok('een telling toont de twee getallen en geen percentage',
    bekend.every(h => /→/.test(h.weergave) || /begonnen|gestopt/.test(h.weergave)),
    JSON.stringify(bekend.map(h => h.weergave)));
  ok('en nergens staat "null%"',
    !bekend.some(h => /null/.test(h.weergave)), JSON.stringify(bekend.map(h => h.weergave)));
}

S('8 · Van niets naar iets heet begonnen');
{
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_workouts', JSON.stringify([]));
  localStorage.setItem('gc_strength_sessions', JSON.stringify(
    [1, 3, 5].map(n => ({ id: `s${n}`, date: addDays(TODAY, -n), rpe: 5 }))));
  localStorage.setItem('gc_challenge75', JSON.stringify({ days: {} }));
  const t = trends({ currentDate: TODAY, logs: {}, workouts: [] });
  const k = t.metrics.find(m => m.id === 'kracht');
  const week = k.horizons.find(h => h.id === 'week');
  console.log(`      kracht deze week: ${week.weergave}`);
  ok('pas begonnen met kracht heet begonnen', week.weergave === 'begonnen', week.weergave);
  ok('en telt als vooruit', week.richting === 'vooruit', week.richting);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

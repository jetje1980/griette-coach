// Het kwartaaldossier: alles bij elkaar, en niets erbij verzonnen.
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG
//
// "Per kwartaal wellicht ook bij analyse van coach? Dat daar echt
// patroon qua slaap, HRV, alle data van cyclus tot gewicht tot hartslag
// tot toning van lichaam worden meegenomen, en er een analyse en
// patroonherkenning kan komen met mogelijk advies en observaties."
//
// De coach kreeg tot dan toe dertig dagen. Een cyclus duurt vier weken,
// dus in dertig dagen zie je er één en daarmee geen patroon;
// loopeconomie beweegt in maanden en lichaamsverandering nog trager.
//
// ─────────────────────────────────────────────────────────────────
// WAT DEZE SUITE BEWAAKT
//
// Niet of het dossier mooi leest, maar of het eerlijk is. Drie dingen:
//
//   · alles zit erin — training, herstel, cyclus, lichaam, foto's;
//   · wat ontbreekt staat er als ontbrekend, met wat het zou opleveren.
//     Een model dat niet weet wat het mist, vult dat gat met iets
//     plausibels, en zij heeft al twee keer een uitspraak moeten
//     weerleggen die nergens op rustte;
//   · en de observaties die de app zelf trekt, staan er ook zonder AI.
//     Dat is het verschil tussen een analyse en een praatje.
import './_storage-stub.js';
import { kwartaalDossier, dossierAlsTekst, KWARTAAL_DAGEN }
  from '../../src/kwartaalanalyse.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-11';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

function wereld({ metLogs = true, metRuns = true, metMaten = true,
  gaten = true } = {}) {
  globalThis.__testStorage.reset();
  const logs = {};
  if (metLogs) {
    for (let i = 120; i >= 0; i--) {
      const d = addDays(TODAY, -i);
      logs[d] = { date: d, hr_rest: 60 + (i < 20 ? 3 : 0), hrv: 40 - (i < 20 ? 5 : 0),
        sleep_hours: i % 5 ? 7.5 : 6, weight: +(63 - (120 - i) * 0.015).toFixed(1) };
      localStorage.setItem(`gc_log_${d}`, JSON.stringify(logs[d]));
    }
  }
  const W = [];
  if (metRuns) {
    for (let i = 118; i >= 0; i -= (gaten && i > 40 ? 9 : 3)) {
      const d = addDays(TODAY, -i);
      W.push({ id: d, date: d, activityType: 'run', duration: 30, distance: 3.2,
        laps: [{ movingTime: 420, distance: 0.78 * 145 * 7, avgHr: 145 },
          { movingTime: 420, distance: 0.78 * 145 * 7, avgHr: 145 }] });
    }
  }
  localStorage.setItem('gc_workouts', JSON.stringify(W));
  localStorage.setItem('gc_strength_sessions', JSON.stringify([]));
  localStorage.setItem('gc_challenge75', JSON.stringify({ days: Object.fromEntries(
    [1, 3, 5, 7, 9, 11, 13, 15].map(n => [addDays(TODAY, -n),
      { day: n, kind: 'circuit', doneAt: `${addDays(TODAY, -n)}T08:00:00Z` }])) }));
  localStorage.setItem('gc_measurements', JSON.stringify(metMaten ? [
    { date: addDays(TODAY, -85), waist: 72, hip: 94, navel: 75 },
    { date: addDays(TODAY, -5), waist: 69, hip: 92, navel: 70 }] : []));
  return { logs, W };
}

S('1 · Alle domeinen zitten erin');
{
  const { logs, W } = wereld();
  const d = kwartaalDossier({ currentDate: TODAY, logs, workouts: W });
  console.log(`      ${d.van} t/m ${d.tot}`);
  ok('het venster is negentig dagen', d.dagen === KWARTAAL_DAGEN && d.van === addDays(TODAY, -89),
    `${d.van} · ${d.dagen}`);
  ok('training zit erin', d.training.runDays > 0, JSON.stringify(d.training.runDays));
  ok('herstel zit erin met HRV én rusthartslag',
    d.herstel.hrv.median != null && d.herstel.hrRest.median != null,
    JSON.stringify([d.herstel.hrv, d.herstel.hrRest]));
  ok('slaap zit erin, met het aantal korte nachten',
    d.herstel.sleep.median != null && d.herstel.sleep.onder7 > 0,
    JSON.stringify(d.herstel.sleep));
  ok('het lichaam zit erin', d.lichaam.maten.some(m => m.known && m.id === 'waist'),
    JSON.stringify(d.lichaam.maten.map(m => [m.id, m.known])));
  ok('de trends over drie vensters zitten erin',
    d.trends?.metrics?.length >= 5, String(d.trends?.metrics?.length));
  ok('en kracht uit alle bronnen', d.training.strength.dagenMetKracht === 8,
    JSON.stringify(d.training.strength.dagenMetKracht));
}

S('2 · Wat ontbreekt staat er als ontbrekend');
{
  const { logs, W } = wereld();
  const d = kwartaalDossier({ currentDate: TODAY, logs, workouts: W });
  console.log(`      ${d.gaten.length} gaten benoemd`);
  ok('er is een lijst met wat ontbreekt', Array.isArray(d.gaten), '');
  ok('zonder afgesloten cycli staat dat erbij',
    d.gaten.some(g => /cycli/.test(g)), JSON.stringify(d.gaten));
  ok('zonder beoordeeld fotopaar ook',
    d.gaten.some(g => /fotopaar/.test(g)), JSON.stringify(d.gaten));

  // En zonder HRV hoort dat er óók te staan — dat is de belangrijkste,
  // want daar vroeg zij om en daar wordt dus op gerekend.
  const leeg = wereld({ metLogs: false });
  const d2 = kwartaalDossier({ currentDate: TODAY, logs: {}, workouts: leeg.W });
  ok('zonder HRV staat dat als gat benoemd',
    d2.gaten.some(g => /HRV/.test(g)), JSON.stringify(d2.gaten));
  ok('met het aantal dagen erbij', /\d+ van de 90/.test(d2.gaten.find(g => /HRV/.test(g)) || ''),
    d2.gaten.find(g => /HRV/.test(g)));
}

S('3 · De observaties staan er ook zonder AI');
{
  const { logs, W } = wereld();
  const d = kwartaalDossier({ currentDate: TODAY, logs, workouts: W });
  console.log(`      ${d.observaties.map(o => o.id).join(', ')}`);
  ok('er zijn observaties', d.observaties.length > 0, '');
  ok('de onderbrekingen worden benoemd',
    d.observaties.some(o => o.id === 'gaten'),
    JSON.stringify(d.observaties.map(o => o.id)));
  ok('en dat kracht wel gedaan is maar niet zwaar',
    d.observaties.some(o => o.id === 'kracht_licht'),
    JSON.stringify(d.observaties.map(o => o.id)));
  ok('elke observatie draagt een tekst', d.observaties.every(o => !!o.tekst), '');
}

S('4 · De tekst voor het model bevat de getallen én de gaten');
{
  const { logs, W } = wereld();
  const d = kwartaalDossier({ currentDate: TODAY, logs, workouts: W });
  const t = dossierAlsTekst(d);
  for (const kop of ['TRENDS', 'CYCLUSPATRONEN', 'TRAINING', 'HERSTEL', 'LICHAAM',
    'WAT ONTBREEKT']) {
    ok(`de tekst heeft een kop ${kop}`, t.includes(kop), '');
  }
  // Dit is de regel die telt: het model mag alleen rekenen met wat
  // hierin staat, dus moeten de getallen erin staan.
  ok('met het aantal metingen bij HRV, niet alleen de waarde',
    /HRV mediaan .* \(\d+ metingen\)/.test(t), t.split('\n').find(l => /HRV mediaan/.test(l)));
  ok('en met het grootste gat in de training',
    /grootste gat \d+ dagen/.test(t), t.split('\n').find(l => /grootste gat/.test(l)));
}

S('5 · Een leeg kwartaal levert geen verhaal op');
{
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_workouts', JSON.stringify([]));
  localStorage.setItem('gc_strength_sessions', JSON.stringify([]));
  localStorage.setItem('gc_challenge75', JSON.stringify({ days: {} }));
  localStorage.setItem('gc_measurements', JSON.stringify([]));
  const d = kwartaalDossier({ currentDate: TODAY, logs: {}, workouts: [] });
  console.log(`      ${d.gaten.length} gaten, ${d.observaties.length} observaties`);
  ok('geen loopdagen', d.training.runDays === 0, String(d.training.runDays));
  ok('en de gaten vullen het beeld in plaats van conclusies',
    d.gaten.length >= 3, JSON.stringify(d.gaten.length));
  ok('het dossier laat zich nog steeds als tekst opbouwen',
    typeof dossierAlsTekst(d) === 'string' && dossierAlsTekst(d).length > 100, '');
  ok('en er staan geen verzonnen waarden in',
    !/NaN|undefined|null ms/.test(dossierAlsTekst(d)),
    dossierAlsTekst(d).split('\n').filter(l => /NaN|undefined/.test(l)).join(' | '));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

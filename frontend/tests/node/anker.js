// Eén tempo vasthouden en kijken of de hartslag zakt.
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG
//
// "Hoe gaan we zorgen dat ik echt sneller op dit tempo kom met lagere
// hartslag? Kan ik niet gewoon op dit tempo trainen, en dat elke x dan de
// hartslag wel omlaag gaat?"
//
// Dat kan, en als meting is het beter dan wat er stond. De sleutelsessie
// werd voorgeschreven op hartslag — dan is het tempo de uitkomst en
// bewegen beide getallen, en is geen sessie met een andere te
// vergelijken. Met een vast tempo is de hartslag de enige variabele, en
// dat is precies het getal waar haar vraag over gaat.
//
// ─────────────────────────────────────────────────────────────────
// WAT DEZE SUITE BEWAAKT
//
// Drie dingen, en de eerste kostte mij bijna een verkeerde meetlat:
//
//   · het anker moet een tempo zijn dat zij aantoonbaar heeft gelopen,
//     en uit een sessie die de rest van de app óók vertrouwt. Mijn eerste
//     versie koos haar sessie van 4 oktober — 7:53/km op hartslag 125 —
//     precies de meting die efficiencyTrend als uitbijter weggooit. Dan
//     is de meetlat een meetfout, en ziet elke volgende sessie er
//     slechter uit dan hij was;
//   · een richting pas bij genoeg metingen, en pas bij een verschil dat
//     groter is dan de ruis van een polsmeter. Twee sessies vergelijken
//     is één sessie tegen één sessie;
//   · en de meetlat mag niet meebewegen. Een lat die meeschuift meet niets.
import './_storage-stub.js';
import { ankerTempo, ankerSessie, ankerTrend, ANKER_MIN_METINGEN, ANKER_RUIS,
  ANKER_MARGE } from '../../src/tempoAnker.js';
import { racePlan } from '../../src/racePlanDays.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 260) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-20';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// Een sessie met blokken op een gegeven tempo en hartslag. Let op: meters
// per minuut moet boven de 95 blijven, anders telt het als wandelen.
const sessie = (date, paceMin, hr, { blokMin = 8, blokken = 2 } = {}) => ({
  id: date, date, activityType: 'run', duration: blokMin * blokken + 6,
  distance: (blokMin * blokken) / paceMin,
  laps: Array.from({ length: blokken }, () => ({
    movingTime: blokMin * 60,
    distance: (blokMin / paceMin) * 1000,
    avgHr: hr,
  })),
});

function wereld(ws) {
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_hr_settings', JSON.stringify({ easyLow: 106, easyHigh: 150,
    resumeBelow: 105, walkTrigger: 150 }));
  localStorage.setItem('gc_workouts', JSON.stringify(ws));
  localStorage.setItem('gc_strength_sessions', '[]');
  localStorage.setItem('gc_challenge75', JSON.stringify({ days: {} }));
}

S('1 · Het anker is een tempo dat zij heeft gelopen');
{
  const W = [
    sessie(addDays(TODAY, -30), 9.5, 145),
    sessie(addDays(TODAY, -24), 8.6, 149),   // de snelste van de reeks
    sessie(addDays(TODAY, -18), 9.2, 147),
    sessie(addDays(TODAY, -12), 9.4, 146),
  ];
  wereld(W);
  const a = ankerTempo({ currentDate: TODAY });
  console.log(`      ${a.pace}/km van ${a.vanaf}, hartslag ${a.hrToen}`);
  ok('er is een anker', a.known === true, a.why);
  ok('het is haar snelste gemeten blok', Math.abs(a.paceMin - 8.6) < 0.05,
    String(a.paceMin));
  ok('met de datum erbij', a.vanaf === addDays(TODAY, -24), a.vanaf);
  ok('en de hartslag van toen', a.hrToen === 149, String(a.hrToen));
  ok('en hoe lang ze het volhield', a.blokMin >= 5, String(a.blokMin));
  // De uitleg moet zeggen wat de opdracht is, want "snelste tempo" klinkt
  // als een doel om te verbeteren en dat is het juist niet.
  ok('de uitleg zegt dat het om de hartslag gaat, niet om sneller worden',
    /niet sneller worden/.test(a.uitleg), a.uitleg);
}

S('2 · Maar nooit uit een meting die de app zelf wantrouwt');
{
  // DE KERNTEST. Haar sessie van 4 oktober: 7:53/km op hartslag 125, een
  // efficiëntie van 1,02 tegen een reeks rond 0,73. efficiencyTrend gooit
  // die weg als uitbijter. Werd hij hier wél het anker, dan stond de
  // meetlat op een meetfout.
  const W = [
    sessie(addDays(TODAY, -30), 9.5, 145),
    sessie(addDays(TODAY, -26), 9.3, 146),
    sessie(addDays(TODAY, -22), 8.6, 149),
    sessie(addDays(TODAY, -18), 9.2, 147),
    sessie(addDays(TODAY, -14), 9.4, 146),
    sessie(addDays(TODAY, -10), 7.9, 125),   // de uitbijter
  ];
  wereld(W);
  const a = ankerTempo({ currentDate: TODAY });
  console.log(`      anker werd ${a.pace}/km (hr ${a.hrToen})`);
  ok('de uitbijter wordt niet het anker', Math.abs(a.paceMin - 7.9) > 0.1,
    `${a.paceMin} op hr ${a.hrToen}`);
  ok('maar haar snelste geloofwaardige blok wel',
    Math.abs(a.paceMin - 8.6) < 0.05, String(a.paceMin));

  // En een sessie waarin de hartslagmeter wegviel evenmin.
  const raar = { id: 'r', date: addDays(TODAY, -8), activityType: 'run', duration: 30,
    distance: 4, laps: [
      { movingTime: 360, distance: 1000 / 8.0 * 6, avgHr: 150 },
      { movingTime: 360, distance: 1000 / 7.8 * 6, avgHr: 136 },
      { movingTime: 360, distance: 1000 / 7.9 * 6, avgHr: 120 }] };
  wereld([...W, raar]);
  const a2 = ankerTempo({ currentDate: TODAY });
  ok('en een weggevallen hartslagmeting ook niet',
    a2.vanaf !== raar.date, `${a2.pace} van ${a2.vanaf}`);
}

S('3 · De sessie: vast tempo, hartslag als uitkomst');
{
  const W = [sessie(addDays(TODAY, -20), 8.6, 149), sessie(addDays(TODAY, -14), 9.2, 147)];
  wereld(W);
  const a = ankerTempo({ currentDate: TODAY });
  const s0 = ankerSessie({ anker: a, weekIndex: 0 });
  const s6 = ankerSessie({ anker: a, weekIndex: 6 });
  console.log(`      week 0: ${s0.label} · week 6: ${s6.label}`);
  ok('het tempo staat in de opdracht', s0.label.includes(a.pace), s0.label);
  ok('en is hetzelfde in week nul en week zes', s0.paceMin === s6.paceMin,
    `${s0.paceMin} vs ${s6.paceMin}`);
  ok('alleen het aantal blokken loopt op', s6.reps > s0.reps,
    `${s0.reps} → ${s6.reps}`);
  ok('met wandelpauzes ertussen', s0.pauzeMin > 0, String(s0.pauzeMin));
  ok('de uitleg zegt: niet sneller, ook niet als het makkelijk voelt',
    /niet sneller/.test(s0.how), s0.how);
  ok('en dat de hartslag is wat gemeten wordt',
    /hartslag is wat we meten/.test(s0.how), s0.how);
  ok('zonder anker geen sessie', ankerSessie({ anker: { known: false } }) === null, '');
}

S('4 · Een richting pas bij genoeg metingen');
{
  // Twee sessies vergelijken is één tegen één. Dat heet elders in deze
  // app ruis, en dan hoort het hier ook zo te heten.
  const anker = 8.6;
  const W = [sessie(addDays(TODAY, -30), anker, 152), sessie(addDays(TODAY, -24), anker, 151)];
  wereld(W);
  const t = ankerTrend({ currentDate: TODAY });
  console.log(`      ${t.why}`);
  ok('met twee metingen nog geen richting', t.known === false, JSON.stringify(t.known));
  // Maar wat er wél is, staat er: een leeg scherm verzwijgt haar werk.
  ok('de metingen staan er wel', (t.metingen || []).length === 2,
    JSON.stringify(t.metingen));
  ok('met de hartslag per sessie', /152/.test(t.why) && /151/.test(t.why), t.why);
  ok('en hoeveel er nodig zijn', t.why.includes(String(ANKER_MIN_METINGEN)), t.why);
}

S('5 · En een verschil dat groter is dan de ruis');
{
  const anker = 8.6;
  const zakt = [[-30, 153], [-24, 152], [-18, 146], [-12, 145]]
    .map(([n, hr]) => sessie(addDays(TODAY, n), anker, hr));
  wereld(zakt);
  const t = ankerTrend({ currentDate: TODAY });
  console.log(`      ${t.regel}`);
  ok('vier metingen geven een richting', t.known === true, t.why);
  ok('een duidelijke daling heet zakken', t.richting === 'zakt',
    `${t.richting} (${t.delta})`);
  ok('met beide hartslagen in de regel',
    /153|152/.test(t.regel) && /145|146/.test(t.regel), t.regel);
  ok('en de nadruk dat het gemeten is', /gemeten en niet gevoeld/.test(t.regel), t.regel);

  // Eén of twee slagen is geen vooruitgang maar een polsmeter.
  const bijna = [[-30, 150], [-24, 150], [-18, 149], [-12, 149]]
    .map(([n, hr]) => sessie(addDays(TODAY, n), anker, hr));
  wereld(bijna);
  const t2 = ankerTrend({ currentDate: TODAY });
  console.log(`      ${t2.delta} slagen → ${t2.richting}`);
  ok(`onder ${ANKER_RUIS} slagen blijft het gelijk`, t2.richting === 'gelijk',
    `${t2.richting} (${t2.delta})`);
  ok('en de regel zegt dat dat weken duurt, geen sessies',
    /weken, niet sessies/.test(t2.regel), t2.regel);

  // Omhoog telt ook, en dan eerst de omstandigheden.
  const omhoog = [[-30, 144], [-24, 145], [-18, 151], [-12, 152]]
    .map(([n, hr]) => sessie(addDays(TODAY, n), anker, hr));
  wereld(omhoog);
  const t3 = ankerTrend({ currentDate: TODAY });
  ok('een stijging wordt ook gemeld', t3.richting === 'stijgt', t3.richting);
  ok('met de omstandigheden eerst, niet vormverlies',
    /omstandigheden/.test(t3.regel) && /cyclus/.test(t3.regel), t3.regel);
}

S('6 · Alleen sessies op dát tempo tellen mee');
{
  // Een rustige duurloop zegt niets over hoe zwaar dit tempo is. Telde
  // die mee, dan zou een week met veel rustig lopen eruitzien als
  // vooruitgang.
  const anker = 8.6;
  const W = [
    sessie(addDays(TODAY, -30), anker, 152),
    sessie(addDays(TODAY, -27), 10.5, 128),   // rustig, ver van het anker
    sessie(addDays(TODAY, -24), anker, 151),
    sessie(addDays(TODAY, -21), 10.2, 130),   // rustig
    sessie(addDays(TODAY, -18), anker, 146),
    sessie(addDays(TODAY, -12), anker, 145),
  ];
  wereld(W);
  const t = ankerTrend({ currentDate: TODAY });
  console.log(`      ${t.aantal} metingen op het anker van ${W.length} sessies`);
  ok('de rustige lopen tellen niet mee', t.aantal === 4, String(t.aantal));
  ok('alle meetellende sessies liggen bij het ankertempo',
    t.metingen.every(m => Math.abs(m.paceMin - t.anker.paceMin) <= ANKER_MARGE),
    JSON.stringify(t.metingen.map(m => m.paceMin)));
}

S('7 · Het plan schrijft de ankersessie voor');
{
  const W = [
    sessie(addDays(TODAY, -30), 9.5, 145),
    sessie(addDays(TODAY, -24), 8.6, 149),
    sessie(addDays(TODAY, -18), 9.2, 147),
    sessie(addDays(TODAY, -12), 9.4, 146),
  ];
  wereld(W);
  const logs = {};
  for (let i = 40; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    logs[d] = { date: d, hr_rest: 61, sleep_hours: 7.5 };
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(logs[d]));
  }
  const plan = racePlan({ currentDate: TODAY, logs, raceDate: addDays(TODAY, 22),
    raceKm: 5, raceSec: 2100 });
  const sleutels = plan.days.filter(d => d.run && d.role === 'sleutel');
  console.log(`      ${sleutels.length} sleutelsessies: `
    + sleutels.map(d => d.run.description).join(' | '));
  ok('er staan sleutelsessies in het plan', sleutels.length > 0, '');

  // Dit was de stille fout: een dag die "sleutel" heet en een gewone
  // easy-loop oplevert. In de ritmefase viel hij terug op EASY_ECONOMY.
  ok('elke sleutelsessie draagt het ankertempo',
    sleutels.every(d => /\d:\d\d\/km/.test(d.run.description)),
    JSON.stringify(sleutels.map(d => d.run.description)));
  ok('en dat tempo is het anker', sleutels.every(d =>
    d.run.description.includes(plan.anker.pace)),
  `${plan.anker.pace} — ${sleutels[0]?.run.description}`);
  ok('het anker hangt aan het plan', plan.anker?.known === true, '');
  ok('met de trend erbij', plan.ankerTrend != null, '');

  // Niet elke dag: dit is één sessie per week, de rest blijft rustig.
  const loopdagen = plan.days.filter(d => d.run && !d.run.isRace);
  ok('het blijft één sessie per week, niet alle',
    sleutels.length < loopdagen.length / 2,
    `${sleutels.length} van ${loopdagen.length}`);
}

S('8 · Zonder bewezen blok geen verzonnen tempo');
{
  // Niets om op te ankeren: dan geen tempo uit de lucht, maar het eerlijke
  // antwoord dat er nog niet genoeg is gelopen.
  wereld([]);
  const a = ankerTempo({ currentDate: TODAY });
  ok('geen anker zonder metingen', a.known === false, '');
  ok('met uitleg waarom', /loopblok van vijf minuten/.test(a.why), a.why);
  const t = ankerTrend({ currentDate: TODAY });
  ok('en dus ook geen trend', t.known === false, '');

  // En het plan valt dan terug op het hartslagvoorschrift in plaats van
  // op een tempo dat nergens op rust.
  const logs = {};
  for (let i = 40; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    logs[d] = { date: d, hr_rest: 61 };
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(logs[d]));
  }
  const plan = racePlan({ currentDate: TODAY, logs, raceDate: addDays(TODAY, 22),
    raceKm: 5, raceSec: 2100 });
  const sleutels = plan.days.filter(d => d.run && d.role === 'sleutel');
  ok('het plan verzint geen ankertempo',
    sleutels.every(d => !/\d:\d\d\/km/.test(d.run.description)),
    JSON.stringify(sleutels.map(d => d.run.description)));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

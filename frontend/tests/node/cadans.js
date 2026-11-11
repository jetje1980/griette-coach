// Waarom staat de volgende loop daar, en niet eerder?
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG
//
// "Waarom staat er nu zondag pas weer een trainingsrun klaar in plaats
// van vrijdag? Volgens mij kom je zo niet aan de 4 per week."
//
// Ze had op allebei gelijk. Haar weekplafond stond op drie loopdagen, en
// bij drie valt het schema terug op vaste weekdagen (zondag, dinsdag,
// donderdag) in plaats van op de cyclus van twee dagen. Dat geeft precies
// drie loopdagen per week en één gat van drie dagen — donderdag naar
// zondag.
//
// Het schema deed dus wat het moest doen. Wat ontbrak was dat het dat
// ergens zéi. Zij keek naar een gat van drie dagen zonder uitleg en
// concludeerde dat er iets stuk was; de app liet haar dat denken.
//
// ─────────────────────────────────────────────────────────────────
// WAT DEZE SUITE BEWAAKT
//
// Drie dingen, en de eerste is een rekensom en geen smaak:
//
//   · bij drie loopdagen is een gat van drie onvermijdelijk, en bij vier
//     is het grootste gat twee. Verschuift die eigenschap, dan klopt de
//     uitleg niet meer en moet iemand dat merken;
//   · de uitleg staat er, met háár eerstvolgende sprong erin — niet een
//     algemene zin die overal op past;
//   · en het oordeel van de poort staat erbij, met de reden. Die reden
//     bleek bij haar geen oordeel over haar vorm maar openstaande
//     herstelchecks, en dat verschil mag niet wegvallen.
import './_storage-stub.js';
import { racePlan, cadansUitleg } from '../../src/racePlanDays.js';
import { runDayCeiling } from '../../src/restday.js';
import { saveGoal } from '../../src/goals.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 260) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-11';
const RACE = '2026-12-12';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };
const dagen = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

// Een wereld waarin zij netjes om de dag heeft gelopen en alles goed
// verdroeg: dan ligt het níét aan haar herstel als het plafond laag staat.
function wereld({ plafond = null, schoon = false } = {}) {
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_hr_settings', JSON.stringify({ easyLow: 106, easyHigh: 145,
    resumeBelow: 105, walkTrigger: 150 }));
  const logs = {};
  const W = [];
  for (let i = 60; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    logs[d] = { date: d, hr_rest: 60, sleep_hours: 7.5, hrv: 42 };
  }
  for (let i = 30; i >= 2; i -= 2) {
    const d = addDays(TODAY, -i);
    W.push({ id: d, date: d, activityType: 'run', duration: 30, distance: 3,
      laps: [{ movingTime: 600, distance: 0.75 * 132 * 10, avgHr: 132 }] });
    if (schoon) {
      logs[d] = { ...logs[d], training_recovery: 0, recovery_check: 'good' };
      logs[addDays(d, 1)] = { ...logs[addDays(d, 1)], training_recovery: 0,
        recovery_check: 'good' };
    }
  }
  for (const [d, l] of Object.entries(logs)) {
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(l));
  }
  localStorage.setItem('gc_workouts', JSON.stringify(W));
  localStorage.setItem('gc_strength_sessions', '[]');
  localStorage.setItem('gc_challenge75', JSON.stringify({ days: {} }));
  if (plafond) {
    saveGoal({ domain: 'RUN', metric: 'run_days_week', target_value: String(plafond),
      direction: 'at_most' });
  }
  return logs;
}

const planMet = (plafond, schoon) => {
  const logs = wereld({ plafond, schoon });
  return { logs, plan: racePlan({ currentDate: TODAY, logs, raceDate: RACE,
    raceKm: 5, raceSec: 2100 }) };
};
const loopdata = (plan) => plan.days.filter(d => d.run && !d.run.isRace).map(d => d.date);

S('1 · De rekensom waar de uitleg op rust');
{
  // Drie runs in zeven dagen: de gaten tellen samen op tot zeven, dus er
  // is er altijd één van drie. Dit is geen ontwerpkeuze maar rekenen, en
  // het is precies wat zij zag gebeuren tussen donderdag en zondag.
  const { plan: p3 } = planMet(null, false);
  const l3 = loopdata(p3);
  const g3 = l3.slice(1).map((d, i) => dagen(l3[i], d));
  console.log(`      plafond ${runDayCeiling()}: ${l3.length} loopdagen, gaten ${g3.join(',')}`);
  ok('zonder doel staat het plafond op drie', runDayCeiling() === 3, String(runDayCeiling()));
  ok('en dan is er een gat van drie dagen', Math.max(...g3) === 3, String(Math.max(...g3)));

  const { plan: p4 } = planMet(4, false);
  const l4 = loopdata(p4);
  const g4 = l4.slice(1).map((d, i) => dagen(l4[i], d));
  console.log(`      plafond 4: ${l4.length} loopdagen, gaten ${[...new Set(g4)].join(',')}`);
  ok('met plafond vier is het grootste gat twee dagen', Math.max(...g4) === 2,
    String(Math.max(...g4)));
  ok('en nooit twee loopdagen op rij', Math.min(...g4) >= 1, String(Math.min(...g4)));

  // Het gemiddelde over volle weken: zij vroeg om drie à vier.
  const volleWeken = (lijst) => {
    const zo = (d) => { const x = new Date(d + 'T12:00:00');
      x.setDate(x.getDate() - x.getDay()); return x.toISOString().slice(0, 10); };
    const m = new Map();
    for (const d of lijst) m.set(zo(d), (m.get(zo(d)) || 0) + 1);
    const vol = [...m].filter(([w]) => w >= addDays(TODAY, 4));
    return vol.reduce((a, [, n]) => a + n, 0) / vol.length;
  };
  const gem3 = volleWeken(l3), gem4 = volleWeken(l4);
  console.log(`      gemiddeld per week: ${gem3.toFixed(1)} tegen ${gem4.toFixed(1)}`);
  ok('plafond drie geeft precies drie per week', Math.abs(gem3 - 3) < 0.01, String(gem3));
  ok('plafond vier geeft er meer dan drie', gem4 > 3, String(gem4));
  ok('en blijft binnen de drie à vier die zij vroeg', gem4 >= 3 && gem4 <= 4, String(gem4));
}

S('2 · Het schema legt dit zelf uit, op het scherm');
{
  const { plan } = planMet(null, false);
  const c = plan.cadans;
  console.log(`      ${c.kop}`);
  ok('er is een uitleg bij het schema', !!c && !!c.uitleg, '');
  ok('hij noemt het plafond', c.plafond === 3 && /3 loopdagen/.test(c.kop), c.kop);
  ok('en zegt dat om de dag bij drie niet kán',
    /kunnen niet om de dag/.test(c.uitleg), c.uitleg);
  // Niet een algemene zin maar háár eerstvolgende sprong.
  ok('met de sprong die zij op het scherm ziet',
    !!c.sprong && c.sprong.dagen === 3, JSON.stringify(c.sprong));
  ok('en die sprong staat met datum in de tekst',
    /november|december/.test(c.uitleg), c.uitleg);
  ok('het grootste gat staat als getal apart', c.grootsteGat === 3, String(c.grootsteGat));
  // En wat verhogen oplevert, concreet.
  ok('er staat wat plafond vier oplevert', /grootste gat twee dagen/.test(c.winst || ''),
    c.winst);
  ok('met het aantal per week erbij', /3,3 loopdagen per week/.test(c.winst || ''), c.winst);
}

S('3 · En wat de poort ervan vindt, mét de reden');
{
  const { plan } = planMet(null, false);
  const c = plan.cadans;
  console.log(`      ${c.poort?.regel}`);
  ok('het oordeel van de poort staat erbij', !!c.poort, '');
  ok('met de blokkade die hem tegenhoudt', (c.poort.blokkades || []).length > 0,
    JSON.stringify(c.poort.blokkades));
  // Dit is het punt. Bij haar is de blokkade niet "je lichaam kan het
  // niet" maar "er staan herstelchecks open" — administratie. Dat
  // verschil moet in de tekst staan, anders leest zij een verbod waar
  // een onvolledige invoer staat.
  if ((c.poort.blokkades || []).some(b => /herstelcheck/.test(b))) {
    ok('en als het om openstaande herstelchecks gaat, staat dat er als zodanig',
      /boekhouding, geen oordeel over je vorm/.test(c.poort.regel), c.poort.regel);
  } else {
    ok('de regel benoemt de eerste blokkade',
      c.poort.regel.includes(c.poort.blokkades[0]), c.poort.regel);
  }

  // Het plafond is een planningsgrens; de dagelijkse veiligheid blijft de
  // poort. Zonder die zin lijkt verhogen roekelozer dan het is.
  ok('en er staat bij dat de poort elke dag blijft beslissen',
    /beslist de poort elke ochtend opnieuw/.test(c.nuance), c.nuance);
}

S('4 · Staat het plafond al op vier, dan verandert de tekst mee');
{
  const { plan } = planMet(4, false);
  const c = plan.cadans;
  console.log(`      ${c.kop} — ${c.uitleg.slice(0, 70)}…`);
  ok('de kop zegt dat ze om de dag loopt', c.omDeDag === true && /om de dag/.test(c.kop),
    c.kop);
  ok('er staat geen "wat verhogen oplevert" meer', c.winst === null, String(c.winst));
  // Het poortoordeel gaat dan over een víjfde loopdag, en dat is niet de
  // vraag. Een waarschuwing bij een schema dat precies doet wat ze wilde,
  // leest als een fout.
  ok('en geen poortwaarschuwing bij een schema dat al klopt', c.poort === null, '');
  ok('het grootste gat is twee dagen', c.grootsteGat === 2, String(c.grootsteGat));
  ok('en er is geen sprong van meer dan twee dagen', c.sprong === null,
    JSON.stringify(c.sprong));
}

S('5 · Met schone herstelchecks mag de poort het wél verhogen');
{
  // De andere kant van sectie 3: wordt alles ingevuld en goed verdragen,
  // dan hoort de poort groen te staan. Anders is de blokkade geen
  // meting maar een muur.
  const { plan } = planMet(null, true);
  const c = plan.cadans;
  console.log(`      ${c.poort?.regel}`);
  ok('de poort oordeelt op de ingevulde gegevens',
    !!c.poort && typeof c.poort.magVanzelf === 'boolean', JSON.stringify(c.poort));
  ok('en de reden is niet meer "herstelchecks open"',
    !(c.poort.blokkades || []).some(b => /wachten nog op een herstelcheck/.test(b)),
    JSON.stringify(c.poort.blokkades));
}

S('6 · De cadans telt door vanaf de dag dat ze loopt');
{
  // Zij vroeg: "voeg dus ook 13 nov toe". De cadans was verankerd op haar
  // laatste gelopen training en telde van daaruit met stappen van twee.
  // Maar vandaag staat er ook een loop — die komt van de dagkaart, niet
  // uit het patroon. Dus plande het schema vandaag én morgen: twee dagen
  // op rij, precies wat de poort daarna blokkeert.
  const { plan } = planMet(4, false);
  const loop = loopdata(plan);
  console.log(`      ${loop.slice(0, 5).join(' ')}`);
  const vandaagLoopt = loop.includes(TODAY);
  ok('vandaag is een loopdag', vandaagLoopt, loop[0]);
  ok('en de volgende is twee dagen later, niet morgen',
    loop[1] === addDays(TODAY, 2), `${loop[0]} → ${loop[1]}`);
  ok('dus geen twee loopdagen op rij',
    loop.slice(1).every((d, i) => dagen(loop[i], d) >= 2),
    JSON.stringify(loop.slice(1).map((d, i) => dagen(loop[i], d))));

  // En dit is de regel waar zij om vroeg: nooit meer dan twee dagen
  // ertussen. De dag vóór de race is de enige uitzondering, en die is
  // met opzet: daar valt niets meer te winnen.
  const tot = loop.filter(d => d < addDays(plan.race?.date || RACE, -2));
  const gaten = tot.slice(1).map((d, i) => dagen(tot[i], d));
  ok('nooit meer dan twee dagen tussen twee trainingen',
    Math.max(...gaten) <= 2, JSON.stringify([...new Set(gaten)]));
}

S('7 · Drie per week mag, twee niet — hoogstens één overslaan');
{
  // Haar regel: "zet het plafond op 4 waarbij het er ook 3 mogen zijn,
  // dus ik mag max 1 training skippen in de week". De frequentierem
  // hing op 3,4 per week — een los getal dat niets wist van het plafond.
  const { remmen } = await import('../../src/remmen.js');
  const maakRuns = (perWeek) => {
    const W = [];
    const stap = Math.round(28 / (perWeek * 4));
    for (let i = 27; i >= 1; i -= stap) {
      const d = addDays(TODAY, -i);
      W.push({ id: d, date: d, activityType: 'run', duration: 30, distance: 3,
        laps: [{ movingTime: 600, distance: 0.75 * 132 * 10, avgHr: 132 }] });
    }
    return W;
  };
  for (const [perWeek, verwacht] of [[3.5, 'aan'], [2, 'uit']]) {
    const logs = wereld({ plafond: 4 });
    localStorage.setItem('gc_workouts', JSON.stringify(maakRuns(perWeek)));
    const r = remmen({ currentDate: TODAY, logs }).alle.find(x => x.id === 'frequentie');
    console.log(`      ~${perWeek}/week → ${r.status}: ${r.stand}`);
    ok(`ongeveer ${perWeek} per week staat op "${verwacht}"`, r.status === verwacht,
      `${r.status} — ${r.stand}`);
  }

  // En de tekst noemt haar eigen plafond, niet een getal uit de code.
  const logs = wereld({ plafond: 4 });
  localStorage.setItem('gc_workouts', JSON.stringify(maakRuns(2)));
  const r = remmen({ currentDate: TODAY, logs }).alle.find(x => x.id === 'frequentie');
  ok('het advies noemt haar plafond', /plafond staat op 4/.test(r.wat), r.wat);
  ok('en dat drie nog binnen de afspraak valt', /3 per week is nog binnen/.test(r.wat),
    r.wat);
}

S('8 · De uitlegfunctie staat op zichzelf');
{
  // Zonder dagen, zonder oordeel: geen fout, geen verzonnen getallen.
  const leeg = cadansUitleg({ plafond: 3, verdict: null, dagen: [] });
  ok('zonder dagen geen grootste gat', leeg.grootsteGat === null, String(leeg.grootsteGat));
  ok('en geen sprong', leeg.sprong === null, '');
  ok('zonder oordeel geen poortblok', leeg.poort === null, '');
  ok('maar de uitleg staat er nog steeds', !!leeg.uitleg && !!leeg.nuance, '');
  ok('en er staan geen lege plekken in', !/undefined|NaN|null/.test(
    [leeg.kop, leeg.uitleg, leeg.winst, leeg.nuance].join(' ')),
  [leeg.kop, leeg.uitleg, leeg.winst].join(' | '));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

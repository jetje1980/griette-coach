// Telt haar circuit van acht minuten overal mee?
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DEZE SUITE BESTAAT
//
// Zij vroeg het twee keer. De eerste keer: "ik ben niet gestopt met
// kracht, ik heb Les Mills gedaan en die 8 min kracht" — toen bleek dat
// ik één bron las. De tweede keer: "ook telt mn 75 dagen challenge van 8
// min kracht volgens mij nog niet mee in de patroonherkenning" — en toen
// bleek dat ik de gedeelde bron wel had gemaakt, maar hem op de
// Ameland-tab was vergeten. Die knop meldde "0 krachtsessies in de
// laatste vier weken" terwijl ze er veertien had gedaan.
//
// Twee keer dezelfde fout, en de tweede keer in een reparatie van de
// eerste. Dat is precies waar een test voor is: niet of één plek klopt,
// maar of élke plek dezelfde bron leest. Deze suite loopt ze allemaal af
// met een wereld waarin de challenge de énige krachtbron is.
//
// Met één uitzondering die er met opzet in zit, zie sectie 3.
import './_storage-stub.js';
import { krachtBeeld } from '../../src/krachtBronnen.js';
import { remmen } from '../../src/remmen.js';
import { voortgang } from '../../src/voortgang.js';
import { trends } from '../../src/trends.js';
import { kwartaalDossier } from '../../src/kwartaalanalyse.js';
import { racePlan } from '../../src/racePlanDays.js';
import { trainingLoad } from '../../src/restday.js';
import { series } from '../../src/timeline.js';
import { CYCLE_METRICS } from '../../src/cyclePatterns.js';
import { saveGoal } from '../../src/goals.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-11';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// De challenge is hier de ENIGE krachtbron: geen krachtmodule, geen
// vinkje in het dagboek. Komt er ergens nul uit, dan leest die plek de
// verkeerde bron.
function wereld() {
  globalThis.__testStorage.reset();
  const dagen = {};
  for (let i = 1; i <= 28; i++) {
    if (i % 2) {
      const d = addDays(TODAY, -i);
      dagen[d] = { day: i, kind: 'circuit', doneAt: `${d}T08:00:00Z` };
    }
  }
  localStorage.setItem('gc_challenge75',
    JSON.stringify({ id: 'vs75', startDate: addDays(TODAY, -28), days: dagen }));
  localStorage.setItem('gc_strength_sessions', JSON.stringify([]));
  localStorage.setItem('gc_hr_settings',
    JSON.stringify({ easyLow: 106, easyHigh: 145, resumeBelow: 105 }));
  localStorage.setItem('gc_race_goals', JSON.stringify([{ id: 'a', date: '2026-12-12',
    name: 'Ameland', type: 'TARGET', enabled: true, terrain: 'trail',
    distanceKm: 5, targetTimeSec: 2100 }]));
  saveGoal({ domain: 'RUN', metric: 'run_days_week', target_value: '4',
    direction: 'at_most' });
  const logs = {}; const W = [];
  for (let i = 90; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    logs[d] = { date: d, hr_rest: 61, hrv: 40, sleep_hours: 7.5, weight: 61 };
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(logs[d]));
  }
  for (let i = 88; i >= 0; i -= 3) {
    const d = addDays(TODAY, -i);
    W.push({ id: d, date: d, activityType: 'run', duration: 30, distance: 3.2,
      laps: [{ movingTime: 420, distance: 0.78 * 145 * 7, avgHr: 145 }] });
  }
  localStorage.setItem('gc_workouts', JSON.stringify(W));
  return { logs, W };
}

S('1 · Elke analyse die over kracht gaat, telt hem mee');
{
  const { logs, W } = wereld();
  const b = krachtBeeld({ currentDate: TODAY, logs, dagen: 28 });
  console.log(`      ${b.regel}`);
  ok('de gedeelde bron ziet 14 dagen', b.dagenMetKracht === 14,
    String(b.dagenMetKracht));
  ok('en noemt waar ze vandaan komen',
    b.bronnen.some(x => /circuit/.test(x)), JSON.stringify(b.bronnen));

  const k = remmen({ currentDate: TODAY, logs }).alle.find(x => x.id === 'kracht');
  ok('de remkaart ziet hem', /14 dagen/.test(k.stand), k.stand);

  const v = voortgang({ currentDate: TODAY, logs, workouts: W });
  ok('het voortgangsoordeel ziet hem',
    v.byId.kracht.nu > 0, v.byId.kracht.regel);

  const t = trends({ currentDate: TODAY, logs, workouts: W });
  const tk = t.metrics.find(m => m.id === 'kracht');
  ok('de trendanalyse ziet hem',
    tk.horizons.some(h => h.known && h.nu > 0),
    JSON.stringify(tk.horizons.map(h => h.weergave)));

  const d = kwartaalDossier({ currentDate: TODAY, logs, workouts: W });
  ok('het kwartaaldossier ziet hem', d.training.strength.dagenMetKracht > 0,
    d.training.strength.regel);

  // Dit is de plek die ik vergat toen ik de gedeelde bron maakte.
  const pl = racePlan({ currentDate: TODAY, logs, raceDate: '2026-12-12',
    raceKm: 5, raceSec: 2100 });
  const knop = pl.levers.find(x => x.id === 'kracht');
  console.log(`      knop op de Ameland-tab: ${knop.stand}`);
  ok('en de knop op de Ameland-tab ook', /14 dagen/.test(knop.stand), knop.stand);
}

S('2 · Maar meetellen blijft iets anders dan gelijkstellen');
{
  const { logs, W } = wereld();
  const b = krachtBeeld({ currentDate: TODAY, logs, dagen: 28 });
  ok('geen van die dagen telt als zwaar', b.zwaar === 0, String(b.zwaar));
  const pl = racePlan({ currentDate: TODAY, logs, raceDate: '2026-12-12',
    raceKm: 5, raceSec: 2100 });
  const knop = pl.levers.find(x => x.id === 'kracht');
  ok('de knop staat dus nog steeds op open', knop.status === 'open', knop.status);
  ok('met de uitleg dat de economiewinst van zwaar werk komt',
    /zware, lage herhalingen/.test(knop.waarom), knop.waarom);
  ok('en dat haar circuit gewoon blijft staan',
    /blijft daarnaast gewoon staan/.test(knop.doel), knop.doel);
  const v = voortgang({ currentDate: TODAY, logs, workouts: W });
  ok('"waarvan zwaar" staat apart en op nul',
    v.byId.kracht_zwaar.nu === 0, v.byId.kracht_zwaar.regel);
}

S('3 · Eén plek telt hem met opzet níét mee');
{
  // De rustdagteller. Die dient één regel: zeven dagen achter elkaar
  // belast, dan is een echte rustdag de training. Het circuit is met
  // opzet dagelijks en klein; telde het mee, dan had zij vanaf dag zeven
  // van haar challenge permanent "geen rustdag" en zou de poort haar
  // blijven blokkeren voor acht minuten bandwerk. Dat is de regel
  // misbruiken tegen zijn bedoeling in.
  const { logs } = wereld();
  const load = trainingLoad(logs, TODAY);
  console.log(`      rustdagen in de laatste 7: ${load.restDays7}`);
  ok('het circuit maakt van haar week geen aaneengesloten belasting',
    load.restDays7 > 0, String(load.restDays7));
}

S('4 · En hij is zelf een patroon geworden');
{
  // Niet "hoeveel kracht" maar "houd je het vol" — één of nul per dag,
  // zodat de cyclusanalyse kan zien wanneer het wegvalt.
  wereld();
  const s = series('challenge_done', { asOf: TODAY });
  console.log(`      ${s.length} dagwaarden, waarvan ${s.filter(o => o.value === 1).length} gedaan`);
  ok('elke dag sinds de start heeft een waarde', s.length >= 27, String(s.length));
  ok('gedaan is 1 en niet gedaan is 0',
    s.some(o => o.value === 1) && s.some(o => o.value === 0),
    JSON.stringify([...new Set(s.map(o => o.value))]));
  ok('en het is een cyclusmaat geworden',
    CYCLE_METRICS.some(m => m.id === 'challenge_done'),
    JSON.stringify(CYCLE_METRICS.map(m => m.id)));
  // Vóór de start van de challenge staat er niets: een nul invullen voor
  // augustus zou een patroon suggereren dat er niet was.
  ok('vóór de startdatum staat er geen nul',
    s.every(o => o.observedAt >= addDays(TODAY, -28)),
    s[0]?.observedAt);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

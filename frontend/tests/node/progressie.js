// Zegt Progressie hetzelfde als de Ameland-tab?
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG, EN WAT ER UITKWAM
//
// "Is het tabblad progressie ook opgelijnd met de nieuwe uitgangspunten?"
//
// Nee, en op twee manieren tegelijk.
//
// 1. Wélke races er zijn, kwam uit twee met de hand bijgehouden lijsten:
//    RACES in raceGoals.js en de wedstrijden met een vaste datum in het
//    oude trainingsschema. Allebei kenden ze precies 3 en 31 oktober, en
//    die zijn voorbij. Ameland op 12 december stond in geen van beide, en
//    kon er ook niet in komen zonder de code te wijzigen. Op Progressie
//    stond dus geen enkele race meer, terwijl de Ameland-tab een
//    volledige voorspelling liet zien.
//
// 2. De verwachte tijd kwam uit een tweede racemodel met een eigen anker,
//    een eigen winst per week en eigen terrein- en wegzak-opslagen —
//    naast progressExpectation.js, dat dezelfde vraag beantwoordt voor de
//    Ameland-tab.
//
// Deze suite bewaakt allebei: de racedoelen zijn de bron voor wélke races
// er zijn, en de verwachting is de bron voor de tijden. De veiligheids-
// grenzen die forecast.js als enige heeft, blijven staan.
import './_storage-stub.js';
import { allRaceForecasts, upcomingRaces as forecastRaces } from '../../src/forecast.js';
import { upcomingRaces as dashboardRaces } from '../../src/raceGoals.js';
import { raceExpectation } from '../../src/progressExpectation.js';
import { saveRaceGoal } from '../../src/raceGoalModel.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-08';
const RACE = '2026-12-12';
const mk = (date, laps) => ({ id: date, date, activityType: 'run',
  duration: laps.reduce((a, l) => a + l[0], 0) / 60,
  distance: laps.reduce((a, l) => a + l[1], 0) / 1000,
  laps: laps.map(([movingTime, distance, avgHr]) => ({ movingTime, distance, avgHr })) });

function wereld() {
  globalThis.__testStorage.reset();
  const W = [
    mk('2026-11-06', [[525, 1000, 136.7], [624, 1000, 142.6], [300, 371.37, 111.6]]),
    mk('2026-11-01', [[1998, 2911.3, 121], [1086, 1560.7, 130], [1532, 2270.1, 121]]),
    mk('2026-10-28', [[480, 751.87, 153.8], [453, 659.39, 164.4], [300, 430.77, 127.6]]),
    mk('2026-10-24', [[548, 1000, 144.2], [595, 1000, 147.3], [579, 1000, 146.4]]),
    mk('2026-10-22', [[480, 835.65, 152.2], [480, 832.19, 148.9], [480, 935.71, 147.2]]),
    mk('2026-10-18', [[480, 965.26, 152.4], [480, 838.94, 152.1], [480, 988.46, 141.9]]),
    mk('2026-10-11', [[300, 573.9, 145.3], [300, 586.94, 160], [300, 566.78, 150.6]]),
  ];
  localStorage.setItem('gc_workouts', JSON.stringify(W));
  localStorage.setItem('gc_hr_settings',
    JSON.stringify({ easyLow: 106, easyHigh: 145, resumeBelow: 105 }));
  const logs = {};
  for (const d of ['2026-11-08', '2026-11-06', '2026-11-01', '2026-10-28',
    '2026-10-24', '2026-10-22', '2026-10-18']) {
    logs[d] = { date: d, hr_rest: 62, recovery_check: 'good', headache_severity: 0, energy: 2 };
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(logs[d]));
  }
  return logs;
}

S('1 · Ameland staat op Progressie, en de voorbije races niet meer');
{
  const logs = wereld();
  // Haar werkelijke racedoelen: twee voorbije en één toekomstige. Alleen
  // de laatste hoort er nog te staan — en hij hoort er te staan, want
  // vóór deze reparatie stond er geen enkele.
  saveRaceGoal({ id: 'okt3', date: '2026-10-03', name: 'Trail 5 km',
    terrain: 'trail', distanceKm: 5, targetTime: '35:00', enabled: true });
  saveRaceGoal({ id: 'ameland', date: RACE, name: 'Ameland Adventure Run 5 km',
    terrain: 'trail', distanceKm: 5, targetTime: '35:00', enabled: true });

  const a = forecastRaces(TODAY);
  const b = dashboardRaces(TODAY);
  console.log(`      forecast: ${a.map(r => r.name).join(', ') || 'geen'}`);
  console.log(`      dashboard: ${b.map(r => r.name).join(', ') || 'geen'}`);
  ok('de racevoorspelling kent Ameland', a.some(r => r.date === RACE),
    JSON.stringify(a.map(r => r.date)));
  ok('het dashboard ook', b.some(r => r.date === RACE), JSON.stringify(b.map(r => r.date)));
  ok('allebei precies één race, want de andere is voorbij',
    a.length === 1 && b.length === 1, `${a.length} / ${b.length}`);
  ok('de afstand en het terrein komen uit het doel',
    a[0].distanceKm === 5 && a[0].terrain === 'trail', JSON.stringify(a[0]));

  // Een race die zij uitzet, verdwijnt — ook dat kon eerst niet.
  saveRaceGoal({ id: 'ameland', enabled: false });
  ok('een uitgezet racedoel verdwijnt van beide schermen',
    forecastRaces(TODAY).length === 0 && dashboardRaces(TODAY).length === 0,
    `${forecastRaces(TODAY).length} / ${dashboardRaces(TODAY).length}`);
  saveRaceGoal({ id: 'ameland', enabled: true });
}

S('2 · Dezelfde tijden als de Ameland-tab');
{
  const logs = wereld();
  saveRaceGoal({ id: 'ameland', date: RACE, name: 'Ameland Adventure Run 5 km',
    terrain: 'trail', distanceKm: 5, targetTime: '35:00', enabled: true });

  const e = raceExpectation({ currentDate: TODAY, raceDate: RACE,
    distanceKm: 5, terrain: 'trail' });
  const f = allRaceForecasts(logs, TODAY).find(x => x.race.date === RACE);
  console.log(`      Ameland-tab: ${e.fmt.time(e.low.time)} / ${e.fmt.time(e.mid.time)} / ${e.fmt.time(e.high.time)}`);
  console.log(`      Progressie : ${f.scenarios.map(s => s.finishTime).join(' / ')}`);
  ok('de voorspelling is beschikbaar', f?.available === true, JSON.stringify(f?.reason));
  const per = Object.fromEntries(f.scenarios.map(s => [s.key, s]));
  ok('conservatief komt overeen', per.conservative.finishTime === e.fmt.time(e.low.time),
    `${per.conservative.finishTime} ≠ ${e.fmt.time(e.low.time)}`);
  ok('waarschijnlijk komt overeen', per.likely.finishTime === e.fmt.time(e.mid.time),
    `${per.likely.finishTime} ≠ ${e.fmt.time(e.mid.time)}`);
  ok('en stretch ook, als het herstel schoon is',
    !per.stretch || per.stretch.finishTime === e.fmt.time(e.high.time),
    `${per.stretch?.finishTime} ≠ ${e.fmt.time(e.high.time)}`);
  ok('de scenario\'s zeggen uit welke motor ze komen',
    f.scenarios.every(s => s.bron === 'verwachting'),
    JSON.stringify(f.scenarios.map(s => s.bron)));
  ok('de toelichting noemt of het tempo gemeten is of uit de literatuur',
    /gemeten tempo|literatuurgetal/.test(per.likely.note), per.likely.note);
}

S('3 · Wat forecast.js als enige heeft, blijft staan');
{
  // De tijden komen nu ergens anders vandaan, maar de veiligheidskant van
  // dit bestand is niet dubbel en mag dus niet verdwijnen: hoe je de race
  // veilig loopt, en waar de voorspelling ophoudt betrouwbaar te zijn.
  const logs = wereld();
  saveRaceGoal({ id: 'ameland', date: RACE, name: 'Ameland Adventure Run 5 km',
    terrain: 'trail', distanceKm: 5, targetTime: '35:00', enabled: true });
  const f = allRaceForecasts(logs, TODAY).find(x => x.race.date === RACE);
  ok('het veilige advies staat er nog', !!f.safe?.lines?.length,
    JSON.stringify(f.safe));
  ok('met de regel dat klimmen gewandeld wordt',
    f.safe.lines.some(l => /[Kk]limmen/.test(l)), f.safe.lines.join(' | '));
  ok('de beperkingen van de voorspelling staan erbij', f.limits.length > 0,
    JSON.stringify(f.limits).slice(0, 200));
  ok('en een vertrouwensniveau', !!f.confidence, String(f.confidence));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

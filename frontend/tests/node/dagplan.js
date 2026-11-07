// Het dagplan naar Ameland: staat er voor elke dag iets, klopt de opbouw,
// en past het zich aan aan wat er werkelijk gebeurt?
//
// ─────────────────────────────────────────────────────────────────
// WAAR DE VALKUIL ZIT
//
// Een schema van zevenendertig dagen is precies wat deze app eerder de das
// omdeed: runningSchema.js hield vijfendertig genummerde sessies vast, en
// sessie 14 kwam na 13 ook als 13 slecht viel. Deze suite bewaakt daarom
// niet alleen dát er een plan staat, maar vooral dat het meebeweegt:
//
//   · de dag van vandaag blijft van de dagkaart, niet van dit plan;
//   · de laatluteale week wordt uit háár cyclus berekend en krijgt geen
//     sleutelsessie;
//   · de taper telt terug vanaf de racedatum, niet vanaf een weeknummer;
//   · het niveau stijgt één stap per opbouwweek en niet in de luteale week;
//   · wat er al gelopen is, staat als gelopen en niet als schuld.
import './_storage-stub.js';
import { racePlan, luteaalVenster, swapDays, clearSwaps, loadSwaps, swapMap,
  planWaarschuwingen, DAG, FASE, INVOER } from '../../src/racePlanDays.js';
import { weightPlan, saveWeightPhase, fuelLine, FASE as GEWICHT, MAX_KG_PER_WEEK }
  from '../../src/weightPhase.js';
import { nextSession as liveSessie } from '../../src/coachPlan.js';
import { runDayCeiling } from '../../src/restday.js';
import { saveGoal } from '../../src/goals.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-06';          // vrijdag
const RACE = '2026-12-12';           // zaterdag
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// Haar werkelijke uitgangspositie: blokken van acht à tien minuten,
// menstruatiestarts op 29 september en 27 oktober (cyclus van 28 dagen),
// een rusthartslag die oploopt en gewicht dat zakt.
function haarData({ cyclus = true, drift = true } = {}) {
  globalThis.__testStorage.reset();
  const workouts = [
    { id: 'w1', date: '2026-10-18', activityType: 'run', distance: 3.88, duration: 36.6,
      laps: [{ movingTime: 480, distance: 988, avgHr: 142 }] },
    { id: 'w2', date: '2026-10-22', activityType: 'run', distance: 3.41, duration: 33.1,
      laps: [{ movingTime: 480, distance: 935, avgHr: 147 }] },
    { id: 'w3', date: '2026-10-24', activityType: 'run', distance: 4.48, duration: 45,
      laps: [{ movingTime: 548, distance: 1000, avgHr: 144 }] },
    { id: 'w4', date: TODAY, activityType: 'run', distance: 3.31, duration: 34.1,
      laps: [{ movingTime: 525, distance: 1000, avgHr: 137 }] },
  ];
  localStorage.setItem('gc_workouts', JSON.stringify(workouts));

  const logs = {};
  const zet = (d, v) => { logs[d] = { date: d, ...v };
    localStorage.setItem(`gc_log_${d}`, JSON.stringify(logs[d])); };
  if (cyclus) { zet('2026-09-29', { cycle_day_one: true }); zet('2026-10-27', { cycle_day_one: true }); }
  if (drift) {
    [['2026-09-15', 53], ['2026-09-16', 54], ['2026-09-18', 57],
      ['2026-10-21', 62], ['2026-10-22', 63], ['2026-10-24', 63],
      ['2026-11-04', 62], ['2026-11-05', 62], [TODAY, 66]]
      .forEach(([d, hr]) => zet(d, { hr_rest: hr, weight: d < '2026-10-01' ? 63.5 : 61.5 }));
  }
  // De verdragen sessies waar het niveau uit volgt.
  zet('2026-10-19', { recovery_check: 'good', headache_severity: 0 });
  zet('2026-10-23', { recovery_check: 'good', headache_severity: 0 });
  return logs;
}

console.log('\n████ Dagplan naar Ameland ████');

S('1 · Er staat een dag voor elke dag tot de race');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  ok('het plan bestaat', p.known === true, JSON.stringify(p).slice(0, 140));
  ok('van vandaag tot en met de racedag', p.days.length === 37,
    `${p.days.length} dagen`);
  ok('de eerste dag is vandaag', p.days[0].date === TODAY, p.days[0].date);
  ok('de laatste is de race', p.days[p.days.length - 1].date === RACE
    && p.days[p.days.length - 1].kind === DAG.RACE,
    `${p.days[p.days.length - 1].date} ${p.days[p.days.length - 1].kind}`);
  ok('elke dag heeft een soort', p.days.every(d => !!d.kind));
  ok('en elke dag heeft doelen voor slaap en eten',
    p.days.every(d => d.targets.some(t => t.id === 'slaap')
      && d.targets.some(t => t.id === 'eten')));
  ok('en invulvelden', p.days.every(d => d.inputs.length >= 6),
    JSON.stringify(p.days.map(d => d.inputs.length).slice(0, 5)));
  ok('alle invulvelden bestaan ook echt',
    p.days.every(d => d.inputs.every(i => !!INVOER[i])),
    JSON.stringify([...new Set(p.days.flatMap(d => d.inputs))]));
}

S('2 · Het schema plant precies zoveel loopdagen als de poort toelaat');
{
  // Hier stond "vier loopdagen in een volle week", terwijl het weekplafond
  // van de poort standaard op drie staat. Dan plant het schema een vierde
  // loopdag die de poort daarna zelf blokkeert met "al 3 loopdagen deze
  // week" — elke week opnieuw. Zij zag het meteen: "alleen zit je nu niet
  // op 4x per week?" Twee getallen voor één vraag, en dus hoort hier niet
  // het getal vier maar de gelijkheid met het plafond.
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const plafond = runDayCeiling();
  const vol = p.weeks.filter(w => w.index > 0 && w.to < p.taperFrom);
  console.log(`      plafond ${plafond} · ${vol.map(w => `${w.from.slice(5)}: ${w.runs}× lopen, ${w.strength}× kracht`).join(' | ')}`);
  ok('evenveel loopdagen als het weekplafond', vol.every(w => w.runs === plafond),
    `plafond ${plafond}, gepland ${JSON.stringify(vol.map(w => w.runs))}`);

  // En als het plafond omhoog gaat, gaat het schema mee — in dezelfde
  // handeling, zonder dat zij ergens anders iets hoeft na te lopen.
  saveGoal({ domain: 'RUN', metric: 'run_days_week', target_value: '4',
    direction: 'at_most' });
  const p4 = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const vol4 = p4.weeks.filter(w => w.index > 0 && w.to < p4.taperFrom);
  console.log(`      na verhogen: ${vol4.map(w => w.runs).join(', ')}× lopen`);
  ok('een plafond van vier geeft vier loopdagen', vol4.every(w => w.runs === 4),
    JSON.stringify(vol4.map(w => w.runs)));
  ok('en de knop staat dan op goed',
    p4.levers.find(k => k.id === 'loopdagen')?.status === 'goed',
    JSON.stringify(p4.levers.find(k => k.id === 'loopdagen')));
  ok('bij een lager plafond blijven de lange loop en de sleutelsessie staan',
    vol.every(w => w.runs === plafond)
    && p.days.some(d => d.role === 'lang') && p.days.some(d => d.role === 'sleutel'),
    p.days.filter(d => d.run).map(d => d.role).join(','));
  saveGoal({ domain: 'RUN', metric: 'run_days_week', target_value: String(plafond),
    direction: 'at_most' });
  ok('twee krachtdagen', vol.every(w => w.strength === 2),
    JSON.stringify(vol.map(w => w.strength)));
  ok('er is minstens één echte rustdag per week',
    p.days.filter(d => d.kind === DAG.RUST).length >= 4,
    String(p.days.filter(d => d.kind === DAG.RUST).length));
}

S('3 · De taper telt terug vanaf de racedatum');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE, taperDays: 6 });
  ok('de taper begint zes dagen voor de race', p.taperFrom === addDays(RACE, -6),
    p.taperFrom);
  const taper = p.days.filter(d => d.phase === FASE.TAPER.id);
  ok('en er staan taperdagen', taper.length >= 5, String(taper.length));
  ok('zonder sleutelsessie', taper.every(d => d.role !== 'sleutel'),
    JSON.stringify(taper.map(d => d.role)));
  const dagVoor = p.days.find(d => d.daysToRace === 1);
  ok('de dag vóór de race is rust', dagVoor.kind === DAG.RUST,
    `${dagVoor.date} ${dagVoor.kind}`);

  // Een race een week later schuift alles mee: geen vaste weeknummers.
  const later = racePlan({ currentDate: TODAY, logs, raceDate: addDays(RACE, 7) });
  ok('een andere racedatum verschuift de taper',
    later.taperFrom === addDays(addDays(RACE, 7), -6), later.taperFrom);
  ok('en maakt het plan langer', later.days.length === 44, String(later.days.length));
}

S('4 · De laatluteale week komt uit haar eigen cyclus');
{
  const logs = haarData();
  const v = luteaalVenster({ currentDate: TODAY, tot: RACE });
  console.log(`      cycluslengte ${v.cycleLength}, vensters: ${v.windows.map(w => `${w.van}→${w.tot}`).join(', ')}`);
  ok('de cycluslengte is gemeten', v.known && v.cycleLength === 28, JSON.stringify(v));
  ok('en er is een venster vóór de race', v.windows.length >= 1,
    JSON.stringify(v.windows));

  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const luteaal = p.days.filter(d => d.lateLuteal);
  ok('die dagen staan in het plan gemarkeerd', luteaal.length >= 5, String(luteaal.length));
  ok('zonder sleutelsessie', luteaal.every(d => d.role !== 'sleutel'),
    JSON.stringify(luteaal.map(d => `${d.date}:${d.role}`)));
  ok('met uitleg waarom', luteaal.every(d => d.targets.some(t => t.id === 'cyclus')));
  ok('en het niveau stijgt er niet',
    luteaal.every(d => !d.run || d.run.level <= p.baseLevel + 1),
    JSON.stringify(luteaal.filter(d => d.run).map(d => d.run.level)));

  // Zonder cyclusdata geen venster en geen verzonnen 28 dagen.
  globalThis.__testStorage.reset();
  const leeg = luteaalVenster({ currentDate: TODAY, tot: RACE });
  ok('zonder menstruatiedata geen venster', leeg.known === false, JSON.stringify(leeg));
  ok('met uitleg', /Geen menstruatiestarts/.test(leeg.why), leeg.why);
}

S('5 · Het niveau bouwt op, één stap per opbouwweek');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const niveaus = p.days.filter(d => d.run).map(d => d.run.level);
  console.log(`      basis ${p.baseLevel}, niveaus ${Math.min(...niveaus)}–${Math.max(...niveaus)}`);
  ok('het basisniveau komt uit wat ze verdraagt', p.baseLevel >= 5,
    String(p.baseLevel));
  ok('het loopt op', Math.max(...niveaus) > Math.min(...niveaus),
    JSON.stringify([...new Set(niveaus)]));
  ok('maar niet meer dan één stap per week',
    Math.max(...niveaus) - p.baseLevel <= p.weeks.length,
    `${p.baseLevel} → ${Math.max(...niveaus)} over ${p.weeks.length} weken`);
  // De race duurt bij haar tempo drie kwartier; die duur moet een keer
  // gedaan zijn, maar niet als loopminuten.
  const lange = p.days.filter(d => d.role === 'lang' && d.run?.timeOnFeet);
  console.log(`      tijd op de benen: ${[...new Set(lange.map(d => d.run.timeOnFeet))].join(', ')} min`);
  ok('de lange dag bouwt tijd op de benen op',
    lange.length >= 3 && Math.max(...lange.map(d => d.run.timeOnFeet)) >= 55,
    JSON.stringify(lange.map(d => d.run.timeOnFeet)));
  ok('en legt uit waarom dat wandelen is',
    lange.every(d => /wandelen/.test(d.run.timeOnFeetWhy)), lange[0]?.run.timeOnFeetWhy);
  ok('in de taper staat dat er niet',
    p.days.filter(d => d.phase === 'TAPER' && d.run).every(d => !d.run.timeOnFeet));

  ok('elke loopdag heeft een beschrijving',
    p.days.filter(d => d.run).every(d => !!d.run.description),
    JSON.stringify(p.days.filter(d => d.run).slice(0, 3).map(d => d.run.description)));
}

S('6 · Het plan past zich aan wat er echt gebeurde');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const vandaag = p.days[0];
  ok('vandaag staat als gelopen', vandaag.done?.run === true, JSON.stringify(vandaag.done));
  ok('en is gemarkeerd als vandaag', vandaag.isToday === true);
  ok('een toekomstige dag heeft geen status, maar een voornemen',
    p.days[5].done === null, JSON.stringify(p.days[5].done));

  // De oplopende rusthartslag verandert wat er over eten staat.
  const etenDoel = p.days.find(d => d.kind === DAG.RUN && !d.isToday)
    ?.targets.find(t => t.id === 'eten');
  console.log(`      eten: ${etenDoel.waarom.slice(0, 90)}`);
  ok('de rusthartslagdrift staat in het eetadvies',
    /rusthartslag loopt op|tekort/.test(etenDoel.waarom), etenDoel.waarom);

  // Zonder drift geen alarmerende tekst.
  const zonder = racePlan({ currentDate: TODAY, logs: haarData({ drift: false }),
    raceDate: RACE });
  const rustig = zonder.days.find(d => d.kind === DAG.RUST)?.targets.find(t => t.id === 'eten');
  ok('zonder drift staat er geen tekortwaarschuwing',
    !/tekort/.test(rustig.waarom), rustig.waarom);
}

S('7 · De knoppen staan met hun werkelijke stand erbij');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const ids = p.levers.map(k => k.id);
  console.log(`      knoppen: ${ids.join(', ')}`);
  ok('frequentie staat erbij', ids.includes('frequentie'));
  ok('eten ook', ids.includes('eten'));
  ok('kracht, cadans en cyclus ook',
    ids.includes('kracht') && ids.includes('cadans') && ids.includes('cyclus'),
    JSON.stringify(ids));
  ok('elke knop heeft een gemeten stand',
    p.levers.every(k => !!k.stand && !!k.doel && !!k.waarom));
  const freq = p.levers.find(k => k.id === 'frequentie');
  ok('de frequentie telt haar echte loopdagen', /loopdag(en)? per week/.test(freq.stand),
    freq.stand);
  const eten = p.levers.find(k => k.id === 'eten');
  ok('de eetknop noemt de rusthartslag', /Rusthartslag/.test(eten.stand), eten.stand);
  ok('en staat op open zolang hij oploopt', eten.status === 'open', eten.status);
}

S('8 · Zonder race geen plan');
{
  const logs = haarData();
  const geen = racePlan({ currentDate: TODAY, logs, raceDate: null });
  ok('geen racedatum geeft geen plan', geen.known === false, JSON.stringify(geen));
  const voorbij = racePlan({ currentDate: TODAY, logs, raceDate: '2026-10-01' });
  ok('een race in het verleden ook niet', voorbij.known === false, JSON.stringify(voorbij));
  ok('met uitleg', /racedatum/.test(voorbij.why), voorbij.why);
}

S('9 · Afvallen maakt sneller — en kost tegelijk snelheid');
{
  // Haar vraag: minder zwaar is toch sneller? Ja, en het is te becijferen.
  // Maar het tekort waarin dat gebeurt kost economie, en bij haar heffen
  // die twee elkaar grofweg op. De app rekent allebei en laat haar kiezen.
  haarData();
  saveWeightPhase({ target: 57, phase: null, holdUntil: null });  // ná haarData: die wist de opslag
  const w = weightPlan({ currentDate: TODAY, raceDate: RACE, easyPaceMin: 9.5 });
  console.log(`      ${w.current} → ${w.target} kg · ${w.gainSeconds} sec/km winst`);
  ok('het weet haar gewicht', w.known === true && w.current > 55, String(w.current));
  ok('en het doel', w.target === 57, String(w.target));
  ok('het rekent de winst uit in seconden per kilometer',
    w.gainSeconds > 15 && w.gainSeconds < 40, String(w.gainSeconds));
  ok('met de vijf kilometer erbij', /op vijf kilometer/.test(w.tradeoff.totalLine),
    w.tradeoff.totalLine);
  ok('en benoemt wat het kost', /economie zakte/.test(w.tradeoff.costLine),
    w.tradeoff.costLine);
  ok('met het advies om het na elkaar te doen', /Ná elkaar/.test(w.tradeoff.advice),
    w.tradeoff.advice);
  ok(`een verantwoord tempo is ${MAX_KG_PER_WEEK} kg per week`,
    w.weeksNeeded === Math.ceil(w.toGo / MAX_KG_PER_WEEK), String(w.weeksNeeded));
  ok('en dat haalt 12 december niet', w.beforeRace === false,
    `${w.weeksNeeded} weken nodig`);
}

S('10 · De gekozen fase stuurt het eetadvies');
{
  haarData();
  saveWeightPhase({ target: 57, phase: GEWICHT.BEHOUD, holdUntil: RACE });
  const behoud = fuelLine({ currentDate: TODAY, raceDate: RACE });
  ok('onderhoud geeft het onderhoudsadvies', behoud.phase === GEWICHT.BEHOUD
    && /Onderhoud/.test(behoud.line), JSON.stringify(behoud));
  const logsB = haarData();
  saveWeightPhase({ target: 57, phase: GEWICHT.BEHOUD, holdUntil: RACE });
  const pBehoud = racePlan({ currentDate: TODAY, logs: logsB, raceDate: RACE });
  const rust = pBehoud.days.find(d => d.kind === DAG.RUST);
  ok('en komt in het dagplan terecht',
    /onderhoud|Onderhoud/.test(rust.targets.find(t => t.id === 'eten').waarde),
    rust.targets.find(t => t.id === 'eten').waarde);

  saveWeightPhase({ phase: GEWICHT.AFVALLEN, holdUntil: null });
  const afvallen = fuelLine({ currentDate: TODAY, raceDate: RACE });
  ok('afvallen geeft een ander advies', afvallen.phase === GEWICHT.AFVALLEN,
    JSON.stringify(afvallen));
  ok('zonder te doen alsof het gratis is',
    /minder tempowinst/.test(afvallen.why), afvallen.why);
  ok('maar ook zonder preek — het mag',
    /Dat mag/.test(afvallen.why), afvallen.why);
  const logsA = haarData();
  saveWeightPhase({ target: 57, phase: GEWICHT.AFVALLEN, holdUntil: null });
  const pAfvallen = racePlan({ currentDate: TODAY, logs: logsA, raceDate: RACE });
  const knop = pAfvallen.levers.find(k => k.id === 'gewicht');
  ok('en er is een gewichtsknop met de afweging', !!knop && /scheelt ongeveer/.test(knop.waarom),
    String(JSON.stringify(knop)).slice(0, 200));
  const etenA = pAfvallen.days.find(d => d.kind === DAG.RUST)
    .targets.find(t => t.id === 'eten');
  ok('en het dagplan praat haar keuze niet tegen',
    /Afvallen/.test(etenA.waarde), etenA.waarde);
}

S('11 · Te snel afvallen wordt benoemd');
{
  globalThis.__testStorage.reset();
  // Anderhalve kilo in drie weken is een halve kilo per week — precies op
  // de grens; twee kilo in drie weken zit erboven.
  const zet = (d, kg) => localStorage.setItem(`gc_log_${d}`,
    JSON.stringify({ date: d, weight: kg }));
  zet(addDays(TODAY, -21), 62.5); zet(addDays(TODAY, -14), 62.2);
  zet(addDays(TODAY, -7), 61.8); zet(TODAY, 61.5);
  saveWeightPhase({ target: 57 });
  const rustig = weightPlan({ currentDate: TODAY, raceDate: RACE, easyPaceMin: 9.5 });
  ok('een verantwoord tempo wordt niet afgekeurd', rustig.tooFast === false,
    rustig.rateNote);

  globalThis.__testStorage.reset();
  zet(addDays(TODAY, -21), 64.5); zet(addDays(TODAY, -14), 63);
  zet(addDays(TODAY, -7), 62); zet(TODAY, 61);
  saveWeightPhase({ target: 57 });
  const snel = weightPlan({ currentDate: TODAY, raceDate: RACE, easyPaceMin: 9.5 });
  console.log(`      ${snel.rateNote} → ${snel.rateVerdict}`);
  ok('te snel wordt herkend', snel.tooFast === true, snel.rateNote);
  ok('met de reden erbij', /spier/.test(snel.rateVerdict), snel.rateVerdict);
}

S('12 · Tempo en hartslag staan erbij');
{
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE,
    raceKm: 5, raceSec: 2100 });
  const loopdagen = p.days.filter(d => d.run);
  const metTempo = loopdagen.filter(d => d.run.pace);
  const metHr = loopdagen.filter(d => d.run.hr);
  console.log(`      ${metTempo.length}/${loopdagen.length} met tempo, ${metHr.length} met hartslag`);
  console.log(`      voorbeeld: ${loopdagen[1]?.run.description} · ${loopdagen[1]?.run.pace} · ${loopdagen[1]?.run.hr}`);
  ok('elke loopdag heeft een tempo', metTempo.length === loopdagen.length,
    `${metTempo.length} van ${loopdagen.length}`);
  ok('en een hartslagvoorschrift', metHr.length === loopdagen.length,
    `${metHr.length} van ${loopdagen.length}`);
  ok('het tempo staat als min:sec per kilometer',
    /^\d+:\d\d\/km$/.test(loopdagen[1].run.pace), loopdagen[1].run.pace);
  ok('en is niet het onuitvoerbare doeltempo van 7:00',
    loopdagen.every(d => d.run.paceMin > 7.5),
    JSON.stringify([...new Set(loopdagen.map(d => d.run.pace))]));
  ok('de hartslagregel noemt een bereik',
    /\d+–\d+ bpm/.test(loopdagen[1].run.hr), loopdagen[1].run.hr);
}

S('13 · De dag van vandaag komt van de planner, niet van de sjabloon');
{
  // Dit was de tegenstrijdigheid die zij zag: Vandaag, Lichaam en
  // Progressie tonen de beslissing van de planner, en dit overzicht zette
  // er zijn eigen projectie naast.
  const logs = haarData();
  const p = racePlan({ currentDate: TODAY, logs, raceDate: RACE,
    raceKm: 5, raceSec: 2100 });
  const vandaag = p.days[0];
  const echt = liveSessie({ log: logs[TODAY] || {}, logs, currentDate: TODAY });
  // De poort is de beslissing, niet de vorm. `planNextSession` levert met
  // een forcePurpose óók een sessie als de poort dicht staat — dat is de
  // vooruitblik "dit staat klaar zodra je weer mag". Wie alleen naar
  // `run` kijkt en de poort overslaat, zet die vooruitblik op vandaag. Dat
  // was precies wat zij zag: Vandaag zei "op slot", dit overzicht zei
  // "lopen".
  const poortDicht = echt?.gate && echt.gate.action !== 'RUN_TODAY'
    && echt.gate.earliestRunDate > TODAY;
  console.log(`      poort: ${echt?.gate?.action} · vrij vanaf ${echt?.gate?.earliestRunDate}`);
  if (poortDicht) {
    ok('staat lopen op slot, dan is vandaag hier geen loopdag',
      vandaag.kind !== DAG.RUN && vandaag.kind !== DAG.RUN_KRACHT && !vandaag.run,
      `${vandaag.kind} · ${JSON.stringify(vandaag.run).slice(0, 80)}`);
    ok('en staat de reden erbij die de datum werkelijk bepaalt',
      /op slot/.test(vandaag.note || '') && /vrij vanaf/.test(vandaag.note || ''),
      vandaag.note);
    ok('geen enkele dag vóór die datum is een loopdag',
      p.days.filter(d => d.date < echt.gate.earliestRunDate)
        .every(d => d.kind !== DAG.RUN && d.kind !== DAG.RUN_KRACHT && !d.run),
      p.days.filter(d => d.date < echt.gate.earliestRunDate && d.run)
        .map(d => d.date).join(', ') || 'geen');
    const wacht = p.days.filter(d => d.run?.waitingForGate);
    const vrijDag = wacht[0];
    ok('de sessie die klaarstaat staat één keer, op de eerste loopdag die weer mag',
      wacht.length === 1 && vrijDag.date >= echt.gate.earliestRunDate
      && (vrijDag.kind === DAG.RUN || vrijDag.kind === DAG.RUN_KRACHT),
      `${wacht.length}× · ${vrijDag?.date} ${vrijDag?.kind}`);
    // De poort zegt wannéér er weer gelopen mag worden; het weekpatroon
    // zegt op welke dag. De wachtende sessie mag dus geen loopdag
    // toevoegen op een dag die het patroon als rust heeft.
    ok('en er komt geen loopdag bij op een dag die het patroon rust noemt',
      vrijDag.run.templateDescription != null,
      `${vrijDag.date}: ${vrijDag.run.templateDescription}`);
    ok('met dezelfde beschrijving als de dagkaart geeft',
      vrijDag.run.description === echt.run.description,
      `${vrijDag.run.description} ≠ ${echt.run.description}`);
    ok('en met een tempo en een hartslag erbij',
      !!vrijDag.run.pace && !!vrijDag.run.hr,
      `${vrijDag.run.pace} · ${vrijDag.run.hr}`);
    ok('de poort staat ook op het plan zelf', p.gate?.earliestRunDate === echt.gate.earliestRunDate,
      JSON.stringify(p.gate).slice(0, 120));
  } else if (echt?.run) {
    ok('vandaag komt uit de planner', vandaag.run?.fromPlanner === true,
      JSON.stringify(vandaag.run).slice(0, 140));
    ok('met exact dezelfde beschrijving als de dagkaart',
      vandaag.run.description === echt.run.description,
      `${vandaag.run.description} ≠ ${echt.run.description}`);
    ok('en hetzelfde hartslagvoorschrift', vandaag.run.hr === echt.hrZone,
      `${vandaag.run.hr} ≠ ${echt.hrZone}`);
  } else {
    ok('zonder sessie van de planner blijft de sjabloon staan',
      vandaag.run == null || vandaag.run.fromPlanner !== true, 'geen planner-sessie');
  }
  // Morgen is wél een voornemen uit het weekpatroon.
  const morgen = p.days[1];
  ok('morgen is een voornemen, geen plannerbeslissing',
    !morgen.run || morgen.run.fromPlanner !== true,
    JSON.stringify(morgen.run).slice(0, 100));
}

S('14 · Dagen ruilen');
{
  const logs = haarData();
  const basis = racePlan({ currentDate: TODAY, logs, raceDate: RACE, raceKm: 5, raceSec: 2100 });
  // Zondag 8 november is de lange loop, maandag 9 november de rustdag.
  const zo = basis.days.find(d => d.date === '2026-11-08');
  const ma = basis.days.find(d => d.date === '2026-11-09');
  console.log(`      vóór: zo ${zo.kind}/${zo.role}, ma ${ma.kind}/${ma.role}`);
  ok('zondag is de lange loop', zo.role === 'lang', `${zo.kind} ${zo.role}`);
  ok('maandag is rust', ma.kind === DAG.RUST, ma.kind);

  swapDays('2026-11-08', '2026-11-09');
  const na = racePlan({ currentDate: TODAY, logs, raceDate: RACE, raceKm: 5, raceSec: 2100 });
  const zo2 = na.days.find(d => d.date === '2026-11-08');
  const ma2 = na.days.find(d => d.date === '2026-11-09');
  console.log(`      na:   zo ${zo2.kind}/${zo2.role}, ma ${ma2.kind}/${ma2.role}`);
  ok('de lange loop staat nu op maandag', ma2.role === 'lang', `${ma2.kind} ${ma2.role}`);
  ok('en de rustdag op zondag', zo2.kind === DAG.RUST, zo2.kind);
  ok('allebei de dagen zijn als geruild gemarkeerd',
    zo2.swappedWith === '2026-11-09' && ma2.swappedWith === '2026-11-08',
    `${zo2.swappedWith} / ${ma2.swappedWith}`);
  ok('het weektotaal blijft gelijk',
    na.weeks[1].runs === basis.weeks[1].runs && na.weeks[1].strength === basis.weeks[1].strength,
    `${na.weeks[1].runs}×lopen vs ${basis.weeks[1].runs}`);
  ok('de verplaatste loop houdt zijn tijd op de benen',
    ma2.run?.timeOnFeet === zo.run?.timeOnFeet,
    `${ma2.run?.timeOnFeet} vs ${zo.run?.timeOnFeet}`);

  // Dezelfde ruil nog eens draait hem terug.
  swapDays('2026-11-08', '2026-11-09');
  const terug = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  ok('nog een keer ruilen draait het terug',
    terug.days.find(d => d.date === '2026-11-08').role === 'lang',
    terug.days.find(d => d.date === '2026-11-08').role);
  ok('en de markering is weg',
    terug.days.find(d => d.date === '2026-11-08').swappedWith === null);
}

S('15 · Wat aan de kalender hangt, verhuist niet mee');
{
  const logs = haarData();
  clearSwaps();
  const v = luteaalVenster({ currentDate: TODAY, tot: RACE });
  const luteaalDag = v.windows[0].van;          // eerste dag van haar laatluteale week
  // Zoek een sleutelsessie buiten dat venster en haal hem erin.
  const basis = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const sleutel = basis.days.find(d => d.role === 'sleutel' && !d.lateLuteal);
  ok('er is een sleutelsessie om te verplaatsen', !!sleutel, 'geen gevonden');

  swapDays(sleutel.date, luteaalDag);
  const na = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const verplaatst = na.days.find(d => d.date === luteaalDag);
  console.log(`      sleutel van ${sleutel.date} naar ${luteaalDag}: rol ${verplaatst.role}`);
  ok('de sleutelsessie wordt in de luteale week een rustige',
    verplaatst.role !== 'sleutel', verplaatst.role);
  ok('en de dag houdt zijn eigen cyclusstand', verplaatst.lateLuteal === true);
  ok('met uitleg erbij',
    verplaatst.targets.some(t => t.id === 'cyclus'),
    JSON.stringify(verplaatst.targets.map(t => t.id)));
  clearSwaps();
}

S('16 · Na een ruil wordt de indeling nagekeken');
{
  const logs = haarData();
  clearSwaps();
  // Twee zware dagen op elkaar maken: de lange loop naar de dag vóór de
  // sleutelsessie halen.
  const basis = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const sleutel = basis.days.find(d => d.role === 'sleutel' && d.date > addDays(TODAY, 7));
  const dagErvoor = addDays(sleutel.date, -1);
  const lange = basis.days.find(d => d.role === 'lang' && d.date > addDays(TODAY, 7));
  swapDays(lange.date, dagErvoor);

  const na = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  const zwaar = na.warnings.filter(w => w.id.startsWith('zwaar_'));
  console.log(`      ${zwaar.length} waarschuwing(en): ${zwaar[0]?.text.slice(0, 90)}`);
  ok('twee zware dagen op elkaar wordt gemeld', zwaar.length >= 1,
    JSON.stringify(na.warnings.map(w => w.id)));
  ok('met beide dagen erin', /staan allebei als zware dag/.test(zwaar[0].text), zwaar[0].text);
  ok('maar het blokkeert niets — de ruil staat er gewoon',
    na.days.find(d => d.date === dagErvoor).role === 'lang',
    na.days.find(d => d.date === dagErvoor).role);
  clearSwaps();

  // Zonder ruil geen waarschuwing over zware dagen op elkaar.
  const schoon = racePlan({ currentDate: TODAY, logs, raceDate: RACE });
  ok('het standaardpatroon zet geen zware dagen op elkaar',
    schoon.warnings.filter(w => w.id.startsWith('zwaar_')).length === 0,
    JSON.stringify(schoon.warnings.map(w => w.id)));
}

S('17 · Ruilen stapelen en zijn terug te draaien');
{
  clearSwaps();
  swapDays('2026-11-08', '2026-11-09');
  swapDays('2026-11-09', '2026-11-10');
  const m = swapMap();
  console.log(`      map: ${[...m.entries()].map(([k, v]) => `${k.slice(8)}→${v.slice(8)}`).join(', ')}`);
  ok('twee ruilen achter elkaar werken door', m.size >= 2, JSON.stringify([...m]));
  ok('de opslag houdt ze allebei', loadSwaps().length === 2, String(loadSwaps().length));
  clearSwaps();
  ok('wissen maakt alles leeg', loadSwaps().length === 0 && swapMap().size === 0);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

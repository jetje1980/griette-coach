// De intensiteitsverdeling: welk deel van je loopminuten is echt rustig?
//
// Deze maat ontbrak volledig, en hij is voor duuropbouw de eerste die telt.
// Bij haar werkelijke sessies van 7, 11 en 18 oktober bleek nul procent van
// de loopminuten onder VT1 te liggen — en intensityRelease() gaf haar juist
// daarom méér intensiteit vrij: drie sessies boven VT1 goed verdragen, dus
// plafond naar VT2. Twee modellen die elkaars bijwerking belonen.
import { zoneOf, cpetZones, loadHrModel, intensityRelease } from '../../src/hrModel.js';
import { CPET } from '../../src/runningHistory.js';
import { raceReadiness, runningState, upcomingRaces } from '../../src/raceGoals.js';
import { loadHrSettings } from '../../src/goals.js';
import { economyAnalysis } from '../../src/economyAnalysis.js';
import { intensityDistribution, distributionReading, distributionAsText }
  from '../../src/intensityDistribution.js';

const TODAY = '2026-10-21';
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
let mem={};
globalThis.localStorage={get length(){return Object.keys(mem).length;},key:i=>Object.keys(mem)[i]??null,
getItem:k=>(k in mem?mem[k]:null),setItem:(k,v)=>{mem[k]=String(v);},removeItem:k=>{delete mem[k];}};
globalThis.sessionStorage=globalThis.localStorage;

const RONDES = {
  '2026-10-18': [[300,404.75,119,61],[480,988.46,142,79],[120,175.98,144,58],[480,838.94,152,75],
                 [120,165.46,141,61],[480,965.26,152,80],[256,338.74,143,59]],
  '2026-10-11': [[300,419.51,124,59],[300,573.90,145,75],[60,84.23,141,58],[300,560.70,149,74],
                 [60,82.34,160,59],[300,579.64,150,76],[60,92.91,153,64],[300,566.78,151,73],
                 [60,80.79,149,58],[300,586.94,160,75],[196,255.63,148,56]],
  '2026-10-07': [[300,427.85,111,58],[300,587.54,141,76],[60,86.49,139,60],[300,544.74,146,72],
                 [60,84.03,135,57],[300,526.74,135,72],[60,87.64,118,56],[300,519.25,150,68],
                 [60,89.43,141,58],[300,525.91,155,69],[259,249.25,162,56]],
};
const workouts = Object.entries(RONDES).map(([date, rondes]) => {
  const laps = rondes.map(([sec,m,hr,cad]) => ({ distance:m, moving_time:sec,
    average_heartrate:hr, average_cadence:cad }));
  const km = laps.reduce((s,l)=>s+l.distance,0)/1000;
  const min = laps.reduce((s,l)=>s+l.moving_time,0)/60;
  const hrGem = Math.round(laps.reduce((s,l)=>s+l.average_heartrate*l.moving_time,0)/laps.reduce((s,l)=>s+l.moving_time,0));
  return { id:`s_${date}`, date, activityType:'run', source:'strava',
    distance:+km.toFixed(2), duration:Math.round(min), averageHR:hrGem, laps, confirmedByUser:true };
});
mem.gc_workouts = JSON.stringify(workouts.sort((a,b)=>b.date.localeCompare(a.date)));
mem.gc_hr_settings = JSON.stringify({ easyLow:106, easyHigh:132, released:154, vt1:132, vt2:156 });
const logs={};
for(let i=0;i<60;i++){const d=addDays(TODAY,-i);const log={date:d,energy:2,sleep_quality:2,sleep_hours:7.5,
steps:8000,headache_severity:0,recovery_check:'good',training_recovery:0,muscle_type:'none'};
if(workouts.some(w=>w.date===d))log.run_done=true; mem[`gc_log_${d}`]=JSON.stringify(log); logs[d]=log;}

console.log('═══ 1. HARTSLAGVERDELING VAN HAAR LOOPBLOKKEN ═══\n');
console.log(`CPET-ankers: VT1 ${CPET.vt1Hr} · VT2 ${CPET.vt2Hr} · gemeten ${CPET.date}`);
console.log(`Easy-band in de app: ${loadHrSettings().easyLow}–${loadHrSettings().easyHigh}\n`);

let perZone = {};
let totaalMin = 0;
for (const [datum, rondes] of Object.entries(RONDES)) {
  for (const [sec, m, hr, cad] of rondes) {
    if (cad < 65) continue;                  // alleen loopblokken
    const z = zoneOf(hr);
    const min = sec / 60;
    perZone[z.label] = (perZone[z.label] || 0) + min;
    totaalMin += min;
  }
}
for (const [zone, min] of Object.entries(perZone).sort((a,b)=>b[1]-a[1])) {
  console.log(`  ${zone.padEnd(28)} ${min.toFixed(0).padStart(3)} min  ${'█'.repeat(Math.round(min/totaalMin*40))} ${Math.round(min/totaalMin*100)}%`);
}
console.log(`\n  totaal loopminuten: ${totaalMin.toFixed(0)}`);
const onderVT1 = Object.entries(perZone).filter(([z]) => /onder VT1|herstel/i.test(z))
  .reduce((s,[,m])=>s+m,0);
console.log(`  onder VT1 (easy):   ${Math.round(onderVT1/totaalMin*100)}%  ← voor basisopbouw hoort dit 80%+ te zijn`);

console.log('\n═══ 2. WAT DE APP OVER INTENSITEIT ZEGT ═══\n');
const rel = intensityRelease({ logs, currentDate: TODAY, model: loadHrModel() });
console.log(`  vrijgegeven tot HR ${rel.ceiling} — "${rel.label}"`);
console.log(`  reden: ${(rel.why || '').slice(0, 200)}`);

console.log('\n═══ 3. DE RACEPROGNOSE ═══\n');
const st = runningState({ logs, currentDate: TODAY });
console.log(`  langst verdragen: ${st.longestTolerated} km · looptempo ${st.runPaceLabel}/km bij HR ${st.runHr}`);
for (const r of upcomingRaces(TODAY).map(r => raceReadiness(r, { logs, currentDate: TODAY, state: st }))) {
  console.log(`\n  ${r.race.name} (${r.race.date}, ${r.race.distanceKm} km, doel ${r.targetLabel})`);
  console.log(`    verwacht nu: ${r.forecastLabel || '—'} · afstand gedekt ${r.coverage ?? '—'}% · tempoverschil ${r.paceGapSec ?? '—'} s/km`);
  console.log(`    ${(r.advice || '').slice(0, 220)}`);
}

console.log('\n═══ 4. DE ECONOMIEANALYSE ═══\n');
const a = economyAnalysis({ logs, currentDate: TODAY });
console.log(`  ${a.available ? `${a.verdict} — ${a.label}` : 'niet beschikbaar: ' + a.note}`);
if (a.available) {
  console.log(`  ${(a.detail||'').slice(0,200)}`);
  console.log(`  zwaarst wegende factor: ${a.factors[0]?.naam} [${a.factors[0]?.weight}]`);
}


console.log('\n═══ 5. DE NIEUWE VERDELINGSLEZING ═══\n');
const d = intensityDistribution({ currentDate: TODAY });
const r = distributionReading(d);
console.log(`  ${r.label}`);
console.log(`  ${r.detail}`);
for (const a of (r.advice||[])) console.log(`  → ${a}`);
console.log('\n  en wat de intensiteitspoort nu zegt:');
const rel2 = intensityRelease({ logs, currentDate: TODAY, model: loadHrModel() });
console.log(`  plafond ${rel2.ceiling} — "${rel2.label}"`);
console.log(`  ${(rel2.why||'').slice(0,260)}`);


// ── Asserties ──────────────────────────────────────────────────
let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 220) : ''}`); }
};

console.log('\n═══ ASSERTIES ═══\n');
ok('haar verdeling is meetbaar', d.available, d.note);
ok('nul procent van haar loopminuten was rustig', d.easyShare === 0, String(d.easyShare));
ok('de uitspraak is "omgekeerd"', d.verdict === 'omgekeerd', d.verdict);
ok('de lezing noemt dat het drempeltraining is',
  /drempeltempo/.test(r.detail), r.detail.slice(0, 120));
ok('met advies dat begint bij de hartslag, niet bij de afstand',
  r.advice.length >= 2 && /hartslagalarm|onder VT1/.test(r.advice.join(' ')),
  r.advice.join(' | ').slice(0, 160));
ok('de intensiteitspoort geeft NIET meer vrij', rel2.ceiling === 132, String(rel2.ceiling));
ok('en legt uit dat de rustige basis eerst moet komen',
  /rustige basis ontbreekt|bouwt op zand/.test(rel2.why || ''), (rel2.why || '').slice(0, 140));

// ── Tegenproef: wél rustig gelopen ─────────────────────────────
// Dezelfde structuur, maar met de loopblokken onder VT1. Dan hoort de
// verdeling goed te zijn én de poort weer open te kunnen.
{
  const rustig = Object.entries(RONDES).map(([date, rondes]) => {
    const laps = rondes.map(([sec, m, hr, cad]) => ({ distance: m, moving_time: sec,
      average_heartrate: cad >= 65 ? 126 : 108, average_cadence: cad }));
    const km = laps.reduce((s, l) => s + l.distance, 0) / 1000;
    return { id: `r_${date}`, date, activityType: 'run', source: 'strava',
      distance: +km.toFixed(2), duration: Math.round(laps.reduce((s,l)=>s+l.moving_time,0)/60),
      averageHR: 120, laps, confirmedByUser: true };
  });
  mem.gc_workouts = JSON.stringify(rustig.sort((a, b) => b.date.localeCompare(a.date)));
  const d2 = intensityDistribution({ currentDate: TODAY });
  const r2 = distributionReading(d2);
  console.log(`\n  tegenproef: ${r2.label} — ${d2.easyShare}% rustig`);
  ok('rustig gelopen levert de uitspraak "goed"', d2.verdict === 'goed',
    `${d2.verdict} bij ${d2.easyShare}%`);
  ok('en dan is er geen advies nodig', (r2.advice || []).length === 0,
    (r2.advice || []).join(' | '));
}

// ── Te weinig data zegt dat ook ────────────────────────────────
{
  mem.gc_workouts = JSON.stringify([]);
  const d3 = intensityDistribution({ currentDate: TODAY });
  ok('zonder loopblokken geen uitspraak', !d3.available, JSON.stringify(d3).slice(0, 100));
  ok('en het zegt wat er nodig is', /rondeknop|loopminuten/.test(d3.note || ''), d3.note);
}


// ── Het werkplafond is een afspraak, geen meting ────────────────
//
// Zij en haar begeleiding spraken 145 af. hrModel klemde elke waarde terug
// naar VT1 uit de CPET van februari 2025 (132) en schreef die ook nog terug
// naar de opslag — de afspraak kon niet bestaan. Deze sectie houdt dat dicht.
{
  console.log('\n═══ WERKPLAFOND ═══\n');
  const { loadHrModel, saveHrModel, easyCeilingLine } = await import('../../src/hrModel.js');

  // Haar echte sessies terugzetten.
  mem.gc_workouts = JSON.stringify(workouts.sort((a, b) => b.date.localeCompare(a.date)));
  delete mem.gc_hr_model;
  mem.gc_hr_settings = JSON.stringify({ easyLow: 106, easyHigh: 145, released: 154,
    vt1: 132, vt2: 156 });

  const m = loadHrModel();
  ok('een afgesproken plafond van 145 blijft 145', m.easyTargetHigh === 145,
    String(m.easyTargetHigh));
  ok('en wordt niet naar VT1 teruggeklemd', m.easyTargetHigh !== m.vt1Hr,
    `${m.easyTargetHigh} tegenover VT1 ${m.vt1Hr}`);
  ok('de herkomst is "afspraak"', m.easyCeilingSource === 'afspraak', m.easyCeilingSource);
  ok('het verschil met de meting is benoemd', m.easyCeilingVsVt1 === 13,
    String(m.easyCeilingVsVt1));
  ok('en de regel zegt dat het afgesproken is, niet gemeten',
    /afgesproken, niet gemeten/.test(easyCeilingLine(m)), easyCeilingLine(m));
  ok('met de CPET-datum erbij', /2025/.test(easyCeilingLine(m)), easyCeilingLine(m));

  // Handmatig zetten legt het vast als afspraak, niet als meting.
  const na = saveHrModel({ easyTargetHigh: 140 });
  ok('handmatig zetten blijft staan', na.easyTargetHigh === 140, String(na.easyTargetHigh));
  ok('en wordt als afspraak vastgelegd', na.easyCeilingSource === 'afspraak',
    na.easyCeilingSource);
  // Buiten bereik wordt niet opgeslagen — en wordt dus ook geen afspraak.
  const tehoog = saveHrModel({ easyTargetHigh: 200 });
  ok('boven VT2 wordt geweigerd', !!tehoog.rejected, JSON.stringify(tehoog.rejected));
  ok('en de oude waarde blijft staan', tehoog.easyTargetHigh === 140,
    String(tehoog.easyTargetHigh));
  ok('met een reden die de grens noemt', /VT2/.test(tehoog.rejected?.reason || ''),
    tehoog.rejected?.reason);
  ok('de opslag is niet stil opgeschoven',
    loadHrModel().easyTargetHigh === 140, String(loadHrModel().easyTargetHigh));

  // De verdeling toetst aan het plafond, met VT1 ernaast. Beide stores
  // terugzetten: saveHrModel schrijft ook naar de oude instellingen.
  delete mem.gc_hr_model;
  mem.gc_hr_settings = JSON.stringify({ easyLow: 106, easyHigh: 145, released: 154,
    vt1: 132, vt2: 156 });
  const d4 = intensityDistribution({ currentDate: TODAY });
  const r4 = distributionReading(d4);
  console.log(`\n  bij plafond ${d4.ceiling}: ${d4.easyShare}% binnen de band (onder VT1: ${d4.underVt1Share}%)`);
  ok('de verdeling toetst aan 145', d4.ceiling === 145, String(d4.ceiling));
  // Geen exact getal: de segmentclassificatie van paceBreakdown kan per
  // sessie iets anders uitpakken dan een handmatige telling op cadans, en
  // dan hoort de test niet te breken op een procent. Wat telt is dat een
  // deel binnen de band valt en dat het ruim onder de richtlijn blijft.
  ok('een flink deel valt nu binnen de band, maar niet genoeg',
    d4.easyShare > 20 && d4.easyShare < 80, `${d4.easyShare}%`);
  ok('en dat is meer dan onder de oude grens van 132',
    d4.easyShare > d4.underVt1Share, `${d4.easyShare}% tegenover ${d4.underVt1Share}%`);
  ok('de uitspraak is "te hard", niet "omgekeerd"', d4.verdict === 'te_hard', d4.verdict);
  ok('het aandeel onder de gemeten VT1 staat er ook', d4.underVt1Share === 0,
    String(d4.underVt1Share));
  ok('de lezing noemt de afspraak als grens',
    /afgesproken werkplafond van 145/.test(r4.detail), r4.detail.slice(0, 160));
  ok('en zet de meting er eerlijk naast',
    /VT1 van 132/.test(r4.detail), r4.detail.slice(0, 260));
  ok('het advies verwijst naar 145, niet naar 132',
    r4.advice.some(a => /145/.test(a)) && !r4.advice.some(a => /onder 132/.test(a)),
    r4.advice.join(' | ').slice(0, 200));
}

console.log(`\n${'█'.repeat(56)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(56)}`);
process.exit(fail ? 1 : 0);

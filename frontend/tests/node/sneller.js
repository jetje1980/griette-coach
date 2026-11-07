// Sneller worden bij een lagere hartslag: wat de app voorschrijft, en of
// dat klopt met wat haar eigen data zegt.
//
// ─────────────────────────────────────────────────────────────────
// DE VRAAG WAAR DIT UIT VOORTKOMT
//
// Zij wil richting 12 december van ~9:00/km naar 6:30/km, met de hartslag
// onder 145. Haar gemeten loopblokken staan op 9:00–9:40/km bij 144–152
// bpm, en haar VT1 ligt op 132.
//
// Wat de app daaraan fout deed: het afgesproken werkplafond van 145 werd
// óók het richtgebied van een rustige training. Elke easy sessie mocht dus
// tot 145, en dat is boven VT1. Daarmee traint ze elke keer net te zwaar
// om aerobe basis op te bouwen en te licht om een prikkel te zijn — precies
// het patroon waarin het tempo bij gelijke hartslag niet zakt.
//
// Wat erbij moest: versnellingen (de enige snelheidsprikkel zonder lange
// hoge hartslag) en een pasfrequentiedoel (de goedkoopste economiewinst).
import './_storage-stub.js';
import { hrPrescription } from '../../src/hrModel.js';
import { stridesFor, STRIDES } from '../../src/raceplan.js';
import { cadenceTarget, STAP_PCT, BOVENGRENS } from '../../src/cadence.js';
import { prescribedPace } from '../../src/easyPace.js';
import { efficiencyTrend, paceAtHr } from '../../src/efficiency.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-06';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// Haar werkelijke instellingen: plafond 145 (afspraak, 19 aug), VT1 132 en
// VT2 156 uit de CPET van 4 februari 2025.
function haarInstellingen() {
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_hr_settings', JSON.stringify({
    easyLow: 106, easyHigh: 145, walkTrigger: 150, resumeBelow: 105,
    recoveryHR: null, rpeEasy: 4, rpeThreshold: 6 }));
}

console.log('\n████ Sneller bij een lagere hartslag ████');

S('1 · Rustig is onder VT1, niet tot het plafond');
{
  haarInstellingen();
  const p = hrPrescription({ purpose: 'EASY_ECONOMY', currentDate: TODAY });
  console.log(`      ${p.line}`);
  ok('het richtgebied stopt bij VT1', p.easy.high === 132, String(p.easy.high));
  ok('en begint waar het begon', p.easy.low === 106, String(p.easy.low));
  ok('de afgesproken 145 blijft bestaan als grens', p.agreedCeiling === 145,
    String(p.agreedCeiling));
  ok('de kaartregel noemt allebei', /132/.test(p.line) && /145/.test(p.line), p.line);
  ok('de uitleg zegt waaróm onder VT1', /onder VT1/i.test(p.text), p.text.slice(0, 120));
  ok('en legt het verband met sneller worden',
    /lágere hartslag|economie|opbouw/i.test(p.why), p.why.slice(0, 140));

  // Dit was de echte fout: een voorschrift dat 106–145 zei en er ónder
  // schreef dat we rond of onder 132 blijven.
  ok('geen tegenspraak meer tussen band en uitleg',
    !(p.easy.high > p.vt1Hr && /rond of onder VT1/.test(p.why)),
    `${p.easy.high} vs ${p.why.slice(0, 80)}`);
}

S('2 · De wandelgrens hangt aan de afspraak, niet aan VT1+8');
{
  haarInstellingen();
  const p = hrPrescription({ purpose: 'EASY_ECONOMY', currentDate: TODAY });
  ok('wandelen vanaf het afgesproken plafond', p.walkTrigger === 145,
    String(p.walkTrigger));
  ok('en dat is niet hoger dan de afspraak zelf', p.walkTrigger <= p.agreedCeiling,
    `${p.walkTrigger} > ${p.agreedCeiling}`);
}

S('3 · Een kwaliteitsblok mag juist wél boven VT1');
{
  haarInstellingen();
  const p = hrPrescription({ purpose: 'FIVE_K_SPECIFIC', currentDate: TODAY });
  console.log(`      ${p.line}`);
  ok('het easy deel blijft het afgesproken gebied', p.easy.high === 145,
    String(p.easy.high));
  ok('rustig en kwaliteit krijgen niet hetzelfde voorschrift',
    hrPrescription({ purpose: 'EASY_ECONOMY', currentDate: TODAY }).easy.high
      !== p.easy.high);
}

S('4 · Versnellingen horen achter een rustige sessie');
{
  const bij = (purpose, extra = {}) => stridesFor({ purpose, mayBuild: true, ...extra });
  ok('achter een easy sessie', bij('EASY_ECONOMY')?.reps === STRIDES.REPS,
    JSON.stringify(bij('EASY_ECONOMY')));
  ok('achter een duursessie', !!bij('DURABILITY'));
  ok('in de taper, maar minder', bij('TAPER')?.reps === STRIDES.TAPER_REPS,
    String(bij('TAPER')?.reps));
  ok('niet op een kwaliteitsdag — twee zware prikkels op één dag is stapelen',
    bij('FIVE_K_SPECIFIC') === null);
  ok('niet op een hersteldag', bij('RECOVERY') === null);
  ok('niet op een amberdag', bij('EASY_ECONOMY', { amber: true }) === null);
  ok('niet als er niet opgebouwd mag worden',
    stridesFor({ purpose: 'EASY_ECONOMY', mayBuild: false }) === null);
  ok('niet als de poort dicht staat',
    bij('EASY_ECONOMY', { gate: { allowed: false } }) === null);

  const s = bij('EASY_ECONOMY');
  ok('twaalf seconden, niet een minuut', s.seconds === 12, String(s.seconds));
  ok('met twee minuten wandelen ertussen', s.recoveryMin === 2, String(s.recoveryMin));
  ok('en het zegt erbij dat hartslag hier niet telt', /hartslag telt hier niet/i.test(s.hr),
    s.hr.slice(0, 80));
}

S('5 · Pasfrequentie: haar eigen getal plus vijf procent');
{
  globalThis.__testStorage.reset();
  // Exact de vorm waarin haar Strava-sessies binnenkomen: cadans per been
  // (77 betekent 154 passen), wandellaps ertussen.
  localStorage.setItem('gc_workouts', JSON.stringify([
    { id: 'a', date: addDays(TODAY, -5), distance: 3.4, duration: 33, laps: [
      { derivedKind: 'walk', cadence: 59, movingTime: 300 },
      { derivedKind: 'run', cadence: 77, movingTime: 480 },
      { derivedKind: 'run', cadence: 79, movingTime: 480 },
    ] },
    { id: 'b', date: addDays(TODAY, -12), distance: 4.5, duration: 45, laps: [
      { derivedKind: 'run', cadence: 78, movingTime: 548 },
      { derivedKind: 'walk', cadence: 60, movingTime: 120 },
    ] },
  ]));
  const c = cadenceTarget({ currentDate: TODAY });
  console.log(`      ${c.line}`);
  ok('de cadans is bekend', c.known === true, JSON.stringify(c));
  ok('per been wordt verdubbeld — 78 is geen pasfrequentie',
    c.current >= 150 && c.current <= 160, String(c.current));
  ok('het wandelen telt niet mee', c.current > 140,
    'anders zakt het gemiddelde naar wandelniveau');
  ok('het doel is vijf procent erboven',
    c.target === Math.min(BOVENGRENS, Math.round(c.current * (1 + STAP_PCT))),
    `${c.current} → ${c.target}`);
  ok('en dat is een handvol passen, geen sprong', c.delta >= 5 && c.delta <= 10,
    String(c.delta));
  ok('met uitleg hoe je het telt', /tien seconden|metronoom/i.test(c.how), c.how);
  ok('en de bron erbij', /loopsessie/.test(c.why), c.why.slice(0, 90));
  ok('180 wordt niet als norm verkocht', /geen norm/.test(c.why));
}

S('6 · Zonder meting wordt er niets verzonnen');
{
  globalThis.__testStorage.reset();
  const c = cadenceTarget({ currentDate: TODAY });
  ok('onbekend blijft onbekend', c.known === false);
  ok('met uitleg waarom', /Nog geen loopblokken/.test(c.why), c.why);

  // Een sessie die alleen uit wandelen bestaat, levert geen looptempo op.
  localStorage.setItem('gc_workouts', JSON.stringify([
    { id: 'w', date: addDays(TODAY, -2), laps: [
      { derivedKind: 'walk', cadence: 59, movingTime: 1800 }] },
  ]));
  ok('een wandelsessie telt niet als loopcadans',
    cadenceTarget({ currentDate: TODAY }).known === false);

  // En een sessie van tien weken geleden zegt niets over nu.
  localStorage.setItem('gc_workouts', JSON.stringify([
    { id: 'oud', date: addDays(TODAY, -70), laps: [
      { derivedKind: 'run', cadence: 77, movingTime: 600 }] },
  ]));
  ok('een sessie buiten het venster telt niet mee',
    cadenceTarget({ currentDate: TODAY }).known === false);
}

S('7 · Een doeltempo is geen trainingstempo');
{
  // WAT ER MIS WAS
  //
  // Haar doeltijd staat op 5 km in 35 minuten: 7:00/km. Haar snelste
  // gemeten kilometer was 9:08 en haar rustige tempo ligt rond 10:30. Het
  // voorschrift nam het doeltempo onvoorwaardelijk over, dus een blok van
  // twee minuten "op 7:00" — in de praktijk een sprint voorbij VT2, met
  // dagen herstel en geen enkele training van wat dit blok zou moeten doen.
  const doel = { distanceKm: 5, targetTimeSec: 2100, targetPaceSecPerKm: 420 };
  const easy = { available: true, paceMin: 10.5, usable: 4, note: 'gemeten' };

  const p = prescribedPace({ purpose: 'FIVE_K_SPECIFIC', goal: doel, easy });
  console.log(`      ${p.paceMin} min/km · ${p.source}`);
  ok('het voorgeschreven tempo is niet het doeltempo', p.paceMin !== 7,
    String(p.paceMin));
  ok('maar anderhalve minuut onder haar rustige tempo', p.paceMin === 9,
    String(p.paceMin));
  ok('en dat is herkenbaar aan de bron', p.source === 'race_goal_capped', p.source);
  ok('de uitleg noemt het doeltempo', /7:00/.test(p.why), p.why.slice(0, 120));
  ok('en zegt dat het doel niet verlaagd is', /niet verlaagd/.test(p.why),
    p.why.slice(-120));

  // Een doel dat wél binnen bereik ligt, wordt gewoon voorgeschreven.
  const dichtbij = { distanceKm: 5, targetTimeSec: 2850, targetPaceSecPerKm: 570 };
  const q = prescribedPace({ purpose: 'FIVE_K_SPECIFIC', goal: dichtbij, easy });
  ok('een haalbaar doeltempo blijft staan', q.paceMin === 9.5 && q.source === 'race_goal',
    `${q.paceMin} ${q.source}`);

  // Zonder gemeten tempo valt er niets te begrenzen; dan is het doel het
  // enige wat er is, en dat hoort zichtbaar te blijven.
  const r = prescribedPace({ purpose: 'FIVE_K_SPECIFIC', goal: doel,
    easy: { available: false } });
  ok('zonder meting blijft het doeltempo staan', r.paceMin === 7, String(r.paceMin));
}

S('8 · Het tempo spreekt de hartslag niet tegen');
{
  // WAT ER MIS WAS
  //
  // Het "gemeten easy tempo" is het tempo van haar loopblokken, en die
  // liep ze op hartslag 141–152 — boven VT1. Voor een rustige sessie
  // schrijft de app 106–132 voor. Er stond dus: "loop 8:55 per kilometer
  // en houd je hartslag onder 132". Twee opdrachten die elkaar uitsluiten.
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_hr_settings', JSON.stringify({ easyLow: 106, easyHigh: 145,
    walkTrigger: 150, resumeBelow: 105, rpeEasy: 4, rpeThreshold: 6 }));
  const loop = (datum, meters, sec, hr) => ({ id: datum, date: datum,
    laps: [{ movingTime: sec, distance: meters, avgHr: hr }] });
  localStorage.setItem('gc_workouts', JSON.stringify([
    loop(addDays(TODAY, -20), 988, 480, 142), loop(addDays(TODAY, -16), 935, 480, 147),
    loop(addDays(TODAY, -12), 1000, 548, 144), loop(addDays(TODAY, -8), 1000, 525, 137),
    loop(addDays(TODAY, -4), 950, 500, 143), loop(addDays(TODAY, -2), 960, 505, 141),
  ]));

  const rustig = prescribedPace({ purpose: 'EASY_ECONOMY', currentDate: TODAY });
  const band = hrPrescription({ purpose: 'EASY_ECONOMY', currentDate: TODAY });
  const bijPlafond = paceAtHr(efficiencyTrend({ currentDate: TODAY }).current, band.easy.high);
  console.log(`      rustig: ${rustig.paceMin} min/km bij ≤${band.easy.high} (bron ${rustig.source})`);
  ok('het tempo hoort bij de voorgeschreven hartslag',
    Math.abs(rustig.paceMin - bijPlafond) < 0.05,
    `${rustig.paceMin} vs ${bijPlafond}`);
  ok('en is herkenbaar aan de bron', rustig.source === 'bij_hartslag', rustig.source);
  ok('de uitleg noemt de hartslag', new RegExp(`hartslag ${band.easy.high}`).test(rustig.why),
    rustig.why.slice(0, 120));
  // Trager dan wat ze werkelijk liep, want dat liep ze op een hogere
  // hartslag. Vergelijken met haar gemeten sessies, niet met een vast
  // getal — dat zou alleen over deze testgegevens iets zeggen.
  const gemeten = efficiencyTrend({ currentDate: TODAY }).sessions;
  const snelsteGemeten = Math.min(...gemeten.map(x => x.paceMin));
  ok('het is trager dan wat ze werkelijk liep, want dat was op een hogere hartslag',
    rustig.paceMin > snelsteGemeten,
    `${rustig.paceMin} vs gemeten ${snelsteGemeten} bij HR ${gemeten.map(x => x.avgHr).join('/')}`);

  // Een kwaliteitsblok houdt zijn eigen tempo: dat loopt juist hoger.
  const kwaliteit = prescribedPace({ purpose: 'FIVE_K_SPECIFIC', currentDate: TODAY,
    goal: { distanceKm: 5, targetTimeSec: 2100, targetPaceSecPerKm: 420 },
    easy: { available: true, paceMin: 10.4, usable: 4 } });
  ok('een tempoblok blijft sneller dan de rustige sessie',
    kwaliteit.paceMin < rustig.paceMin, `${kwaliteit.paceMin} vs ${rustig.paceMin}`);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);

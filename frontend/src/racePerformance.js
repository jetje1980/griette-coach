// Twee verschillende vragen, twee verschillende antwoorden.
//
//   A. SUSTAINABLE EASY CAPACITY
//      Wat je nu rustig en herhaalbaar aankunt. Zie easyPace.js.
//      Dit is een meting, en hij is bewust conservatief.
//
//   B. CURRENT RACE-PERFORMANCE ESTIMATE
//      Wat je op deze afstand zou neerzetten als je er vandaag stond.
//      Dat is iets anders: een race wordt harder gelopen dan een rustige
//      training, over een andere afstand, met een andere loop/wandel-
//      verhouding.
//
// De app haalde ze door elkaar, en op de slechtst denkbare manier. De
// racevoorspelling ankerde op `paceAtHRTrend`, en die functie had geen
// enkele filter op activiteitstype. Op Griëtte's echte data waren zes van
// de zeven punten wandelingen — Hikes van 11:49 tot 17:20 per kilometer.
// Haar 5 km-voorspelling werd dus vrijwel geheel op wandeltempo gebouwd.
//
// Dit bestand bouwt B expliciet op, uit bronnen die er wél iets over zeggen,
// in volgorde van bewijskracht. Zonder bewijs komt er geen getal — dat is
// eerlijker dan een schatting die zich voordoet als een prognose.

import { todayLocal, addDays } from './datetime';
import { loadWorkouts } from './workouts';
import { allBreakdowns, runEconomyTrend, observedWalkPace } from './pace';
import { exertionalResponse, pemFreeWeeks } from './symptoms';
import { easyRunPace } from './easyPace';
import { intensityRelease, loadHrModel, RELEASE } from './hrModel';
import { runningState } from './raceGoals';
import { fmtSec, fmtPaceSec, paceToSec, sessionDistance } from './sessionMath';

// Terreinopslag: hoeveel trager dan wegtempo.
export const TERRAIN_PENALTY = {
  road: { min: 0, max: 0.02, label: 'weg' },
  trail: { min: 0.08, max: 0.15, label: 'trail' },
  beach: { min: 0.05, max: 0.12, label: 'strand' },
};

// Hoeveel sneller dan je rustige looptempo je op wedstrijdinspanning loopt.
// Bewust gekoppeld aan wat er aan intensiteit is vrijgegeven: je kunt geen
// racetempo claimen dat je nooit hebt laten zien.
const EFFORT_UPLIFT = {
  BASE: 0.00,        // niets boven VT1 vrijgegeven → race ≈ rustig tempo
  PROBE: 0.02,
  PARTIAL: 0.04,
  OPEN: 0.07,
  RESTRICTED: 0.00,  // slechte respons: geen enkele opslag
};

function load5kTests() {
  try {
    const arr = JSON.parse(localStorage.getItem('gc_5k_tests') || '[]');
    return arr.filter(t => t.minutes > 0).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch { return []; }
}

// ── Hoeveel van de race kun je lopen in plaats van wandelen? ────
// Een race is bij deze loper ook run/walk. De verhouding volgt uit wat ze
// aantoonbaar aaneengesloten heeft gelopen, niet uit een wens.
export function raceRunFraction({ state, estimatedMinutes }) {
  const continuous = state.longestContinuousMin || 0;
  const block = state.longestRunBlockMin || 0;

  // Zonder enige aaneengesloten run is de aanname: de verhouding die ze in
  // training verdraagt.
  if (!estimatedMinutes) return null;

  // Wie 20 minuten aaneengesloten kan, kan bij een race van 40 minuten
  // grofweg de helft lopen — plus wat de blokken erbovenop leveren.
  const fromContinuous = continuous ? Math.min(1, continuous / estimatedMinutes) : 0;
  const fromBlocks = block ? Math.min(0.75, (block / (block + 2)) ) : 0;
  const fraction = Math.max(fromContinuous, fromBlocks);

  return {
    fraction: +Math.max(0.25, Math.min(1, fraction)).toFixed(2),
    fromContinuous: +fromContinuous.toFixed(2),
    fromBlocks: +fromBlocks.toFixed(2),
    basis: fromContinuous >= fromBlocks
      ? `${continuous} min aaneengesloten gelopen`
      : `loopblokken van ${block} min`,
  };
}

// ── Wandeltempo voor een race komt uit je herstelwandelingen ────
// Niet uit losse Hikes. Die zijn bij haar 17:00/km over duinen met
// hoogtemeters; de wandelpauze binnen een run ligt rond 10:30. Wie de
// eerste gebruikt, laat een trailwandeling de racevoorspelling bepalen —
// precies wat hier niet mag gebeuren.
export function raceWalkPace({ currentDate = todayLocal() } = {}) {
  const seg = allBreakdowns({ limit: 40, currentDate })
    .map(b => b.walkPace)
    .filter(p => p != null && p > 0)
    .sort((a, b) => a - b);
  if (seg.length) {
    return { paceMin: seg[Math.floor(seg.length / 2)], source: 'walk_segments',
      count: seg.length,
      note: `wandelpauzes binnen je runs (${seg.length} sessies)` };
  }
  const fallback = observedWalkPace();
  return { paceMin: fallback, source: 'fallback', count: 0,
    note: 'geschat wandeltempo — nog geen wandelpauzes binnen een run gemeten' };
}

// ── B: de racevoorspelling ──────────────────────────────────────
export function racePerformanceEstimate({ goal, logs = {}, currentDate = todayLocal(),
  state = null } = {}) {
  const st = state || runningState({ logs, currentDate });
  const hrm = loadHrModel();
  const rel = intensityRelease({ logs, currentDate, model: hrm });
  const easy = easyRunPace({ logs, currentDate });
  const econ = runEconomyTrend({ currentDate });
  const km = Number(goal?.distanceKm) || null;
  const basis = [], limits = [];

  if (!km) {
    return { available: false, reason: 'geen raceafstand', basis, limits };
  }

  // ── 1. Een echte tijdtest op deze afstand telt het zwaarst ────
  const tests = load5kTests();
  if (km <= 5.5 && tests.length) {
    const t = tests[0];
    const paceSec = paceToSec(t.minutes / 5);
    basis.push(`5 km-test van ${t.date}: ${fmtSec(t.minutes * 60)}`);
    return finish({ paceSec, source: 'time_trial', confidence: 'HIGH',
      goal, km, st, rel, basis, limits, currentDate, runFraction: null });
  }

  // ── 2. Looptempo uit de segmenten, plus wedstrijdinspanning ───
  // Alleen loopblokken. Geen sessietempo, geen wandelingen.
  const runPaceMin = econ.enough ? econ.late.pace : (easy.available ? easy.paceMin : null);

  if (runPaceMin == null) {
    // Laatste terugval: sessietempo van échte runs. Duidelijk gemarkeerd,
    // want dit telt de wandelpauzes mee en is dus geen looptempo.
    const runs = loadWorkouts()
      .filter(w => (w.activityType === 'run' || w.activityType == null))
      .filter(w => w.date <= currentDate && w.distance > 0 && w.duration > 0)
      .slice(0, 6);
    if (!runs.length) {
      return { available: false, basis, limits,
        reason: 'Nog geen hardloopdata om een racevoorspelling op te baseren.' };
    }
    const paces = runs.map(w => w.duration / w.distance).sort((a, b) => a - b);
    const med = paces[Math.floor(paces.length / 2)];
    basis.push(`sessietempo van je laatste ${runs.length} runs (wandelpauzes inbegrepen)`);
    limits.push('Nog geen sessie waarin de loopblokken te scheiden waren. ' +
      'Dit is daarom een sessietempo, geen looptempo — de voorspelling is navenant grof.');
    return finish({ paceSec: paceToSec(med), source: 'session_pace_runs_only',
      confidence: 'LOW', goal, km, st, rel, basis, limits, currentDate, runFraction: null });
  }

  basis.push(econ.enough
    ? `looptempo ${fmtPaceSec(paceToSec(runPaceMin))}/km bij HR ${econ.late.hr}, uit ${econ.count} sessies`
    : `gemeten easy looptempo ${easy.paceLabel}/km bij HR ${easy.atHr}`);

  // Wedstrijdinspanning: sneller dan rustig, maar alleen zover als er
  // intensiteit is vrijgegeven.
  const uplift = EFFORT_UPLIFT[rel.level] ?? 0;
  const raceRunPace = runPaceMin * (1 - uplift);
  if (uplift > 0) {
    basis.push(`${Math.round(uplift * 100)}% wedstrijdinspanning bovenop rustig tempo (${rel.label.toLowerCase()})`);
  } else {
    limits.push(`Er is nog geen werk boven VT1 vrijgegeven (${rel.label.toLowerCase()}), ` +
      'dus rekent de voorspelling met je rustige looptempo. Zodra intensiever werk ' +
      'wordt verdragen, wordt deze schatting sneller.');
  }

  // ── 3. De race is run/walk ────────────────────────────────────
  const walk = raceWalkPace({ currentDate });
  const walkPace = walk.paceMin;
  // Eerste schatting van de duur om de loopfractie te bepalen, daarna één
  // keer terugrekenen. Twee iteraties zijn ruim genoeg.
  let estMinutes = raceRunPace * km;
  let frac = null;
  for (let i = 0; i < 2; i++) {
    frac = raceRunFraction({ state: st, estimatedMinutes: estMinutes });
    if (!frac) break;
    const d = sessionDistance({
      runMinutes: estMinutes * frac.fraction,
      walkMinutes: estMinutes * (1 - frac.fraction),
      runPace: raceRunPace, walkPace,
    });
    if (!d?.sessionPace) break;
    estMinutes = d.sessionPace * km;
  }

  const sessionPaceMin = km ? estMinutes / km : raceRunPace;
  if (frac && frac.fraction < 1) {
    basis.push(`${Math.round(frac.fraction * 100)}% lopend, rest wandelend — ${frac.basis}`);
    basis.push(walk.note);
  }

  return finish({ paceSec: paceToSec(sessionPaceMin), source: 'run_segments',
    confidence: econ.enough && econ.count >= 5 ? 'MEDIUM' : 'LOW',
    goal, km, st, rel, basis, limits, currentDate,
    runFraction: frac, raceRunPaceSec: paceToSec(raceRunPace),
    walkPaceSec: paceToSec(walkPace) });
}

// Terrein, wegzakken over de afstand en herstelvertrouwen erbovenop.
function finish({ paceSec, source, confidence, goal, km, st, rel, basis, limits,
  currentDate, runFraction, raceRunPaceSec = null, walkPaceSec = null }) {
  const terrain = TERRAIN_PENALTY[goal?.terrain] || TERRAIN_PENALTY.road;

  // Wegzakken: alles boven wat ze aantoonbaar verdraagt kost extra.
  const tolerated = st.longestTolerated || 0;
  const over = tolerated > 0 ? Math.max(0, (km - tolerated) / km) : 1;
  const fade = Math.min(0.20, over * 0.18);
  if (fade > 0.01) {
    limits.push(`Je verdraagt nu ${tolerated} km van de ${km}. Voor het stuk daarboven ` +
      `is ${Math.round(fade * 100)}% wegzakken ingerekend.`);
  }

  const mk = (terrainP, fadeP, label, note) => {
    const p = paceSec * (1 + terrainP) * (1 + fadeP);
    return { key: label.toLowerCase(), label, note,
      paceSecPerKm: Math.round(p), paceLabel: fmtPaceSec(p),
      finishSec: Math.round(p * km), finishLabel: fmtSec(p * km),
      terrainPenalty: Math.round(terrainP * 100), fadePenalty: Math.round(fadeP * 100) };
  };

  const conservative = mk(terrain.max, fade, 'Conservatief',
    'Terrein op zijn zwaarst, volledig wegzakken over de afstand. Hier mag je op rekenen.');
  const likely = mk((terrain.min + terrain.max) / 2, fade * 0.7, 'Waarschijnlijk',
    'Terrein gemiddeld ingeschat.');
  const stretch = rel.level !== RELEASE.RESTRICTED.id
    ? mk(terrain.min, fade * 0.4, 'Stretch', 'Gunstige dag, terrein mee.')
    : null;

  return {
    available: true, source, confidence,
    goal, distanceKm: km,
    basePaceSecPerKm: Math.round(paceSec),
    basePaceLabel: fmtPaceSec(paceSec),
    raceRunPaceSec, raceRunPaceLabel: raceRunPaceSec ? fmtPaceSec(raceRunPaceSec) : null,
    walkPaceSec, walkPaceLabel: walkPaceSec ? fmtPaceSec(walkPaceSec) : null,
    runFraction,
    terrain: { ...terrain, id: goal?.terrain || 'road' },
    fade: Math.round(fade * 100),
    scenarios: [conservative, likely, stretch].filter(Boolean),
    likely,
    basis, limits,
    // De regel die het onderscheid bewaakt.
    caveat: 'Dit is een schatting van wat je op deze afstand zou neerzetten, niet van ' +
      'wat je duurzaam aankunt. Je rustige trainingstempo staat er los van.',
  };
}

// ── A naast B, expliciet ────────────────────────────────────────
// Zodat een scherm ze nooit meer als hetzelfde getal kan tonen.
export function capacityVersusPerformance({ goal, logs = {}, currentDate = todayLocal(),
  state = null } = {}) {
  const st = state || runningState({ logs, currentDate });
  const easy = easyRunPace({ logs, currentDate });
  const perf = racePerformanceEstimate({ goal, logs, currentDate, state: st });
  return {
    sustainable: {
      label: 'Wat je duurzaam aankunt',
      paceSecPerKm: easy.available ? easy.paceSecPerKm : null,
      paceLabel: easy.paceLabel,
      atHr: easy.atHr,
      toleratedKm: st.longestTolerated,
      note: easy.available ? easy.note : easy.note,
    },
    performance: {
      label: 'Wat je op deze afstand zou neerzetten',
      paceSecPerKm: perf.available ? perf.basePaceSecPerKm : null,
      paceLabel: perf.available ? perf.basePaceLabel : null,
      finishLabel: perf.available ? perf.likely.finishLabel : null,
      confidence: perf.confidence,
      basis: perf.basis, limits: perf.limits,
    },
    different: perf.available && easy.available
      && Math.abs(perf.basePaceSecPerKm - easy.paceSecPerKm) > 5,
  };
}

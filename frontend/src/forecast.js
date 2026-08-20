// Voorspellingen: wat gaat de volgende sessie opleveren, en wat zit er
// op de racedag in?
//
// Strikte scheiding, en die scheiding is het hele punt van dit bestand:
//   PERFORMANCE FORECAST      wat er waarschijnlijk gebeurt
//   SAFE COACH RECOMMENDATION wat er verstandig is om te doen
// De eerste mag optimistisch zijn, de tweede nooit. Ze worden apart
// teruggegeven zodat de UI ze nooit per ongeluk als één advies toont.
//
// Alles is afgeleid uit geregistreerde sessies. Waar de data te dun is,
// zegt de forecast dat met zoveel woorden in plaats van een getal te
// verzinnen — vandaar dat elke uitkomst een `confidence` en een
// `dataNote` draagt.

import { RUNS, runDistanceKm } from './data/runningSchema';
import {
  loadWorkouts, toleranceFor, paceToMin, fmtPace, cardiacDrift, paceAtHRTrend,
} from './workouts';
import { loadHrSettings } from './goals';
import { longestToleratedRun, addDays } from './restday';
import { pacePrediction } from './pace';

// Wandeltempo uit het schema (6:30–7:00 /km). Wordt overschreven zodra er
// echte wandelsessies geregistreerd zijn.
const DEFAULT_WALK_PACE = 6.75;

// Bovengrens op hoeveel loopeconomie er per week bij kan komen. Zonder
// deze rem projecteert een paar goede weken zich door tot onzin.
const MAX_GAIN_SEC_PER_KM_PER_WEEK = 4;

// Terrein is geen detail: wegtempo mag niet zomaar naar trail of strand
// worden doorgetrokken. Per ondergrond een expliciete bandbreedte.
export const TERRAIN = {
  road:  { label: 'weg',            min: 0.00, max: 0.00 },
  trail: { label: 'trail met hoogtemeters', min: 0.08, max: 0.15 },
  beach: { label: 'strand en duin', min: 0.05, max: 0.12 },
};

// Welke race op welke ondergrond. Losgekoppeld van het schema zodat een
// nieuwe race alleen hier hoeft te worden bijgeschreven.
const RACE_TERRAIN = { 21: 'trail', 33: 'beach' };

function isRun(w) { return w.activityType === 'run' || w.activityType == null; }
function num(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

function median(arr) {
  const v = arr.filter(x => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Mediane absolute afwijking, met een ondergrens. Vier identieke sessies
// betekenen niet dat de volgende exact hetzelfde wordt — een bandbreedte
// van nul zou schijnzekerheid zijn.
function spread(arr, floor = 0) {
  const v = arr.filter(x => x != null && isFinite(x));
  if (v.length < 2) return null;
  const m = median(v);
  return Math.max(floor, median(v.map(x => Math.abs(x - m))));
}

function sessionPace(w) {
  const p = paceToMin(w.averagePace);
  if (p) return p;
  const d = num(w.distance), t = num(w.duration);
  return d && t ? t / d : null;
}

function weeksBetween(a, b) {
  return (new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / (7 * 86400000);
}

// ── Wandeltempo uit eigen data ──────────────────────────────────
export function observedWalkPace() {
  const walks = loadWorkouts().filter(w => w.activityType === 'walk');
  const paces = walks.map(sessionPace).filter(Boolean);
  const m = median(paces);
  return m && m > 4 && m < 12 ? m : DEFAULT_WALK_PACE;
}

// ── Run/walk-structuur van een geplande sessie ──────────────────
export function runWalkSplit(run) {
  if (!run) return null;
  const reps = run.reps || null;
  const runMin = run.runMin || null;
  const walkMin = run.walkMin || null;
  if (reps && runMin != null && walkMin != null) {
    return { runTime: reps * runMin, walkTime: reps * walkMin,
      totalTime: run.duration || reps * (runMin + walkMin), reps, runMin, walkMin };
  }
  // Races geven geen reps maar wel een verhouding en een totale duur
  if (runMin != null && walkMin != null && run.duration) {
    const cycles = run.duration / (runMin + walkMin);
    return { runTime: cycles * runMin, walkTime: cycles * walkMin,
      totalTime: run.duration, reps: Math.round(cycles), runMin, walkMin };
  }
  return { runTime: run.duration || null, walkTime: 0,
    totalTime: run.duration || null, reps: null, runMin, walkMin };
}

// Uit een totaaltempo het tempo van de loopblokken afleiden. De
// wandelminuten leggen een bekende afstand af; wat overblijft is gelopen.
export function runBlockPaceFrom(totalPace, split, walkPace = observedWalkPace()) {
  if (!totalPace || !split?.totalTime || !split.runTime) return null;
  if (!split.walkTime) return totalPace;   // geen wandelblokken: alles is lopen

  // Het sessiegemiddelde moet tussen looptempo en wandeltempo in liggen.
  // Ligt het aangenomen wandeltempo daaronder, dan klopt de aanname niet
  // voor deze sessies en levert de aftrek een onzinnig looptempo op —
  // liever niets tonen dan een getal van 17:30/km.
  if (walkPace <= totalPace) return null;

  const totalDist = split.totalTime / totalPace;
  const walkDist = split.walkTime / walkPace;
  const runDist = totalDist - walkDist;
  // De loopblokken moeten een noemenswaardig deel van de afstand dekken;
  // anders is de splitsing niet betrouwbaar te maken.
  if (runDist <= 0.1 || runDist < totalDist * 0.2) return null;
  return split.runTime / runDist;
}

// En andersom: van looptempo naar totaaltempo van de sessie.
export function totalPaceFrom(runPace, split, walkPace = observedWalkPace()) {
  if (!runPace || !split?.totalTime) return null;
  const dist = split.runTime / runPace + split.walkTime / walkPace;
  return dist > 0 ? split.totalTime / dist : null;
}

// ── Vergelijkbare sessies ───────────────────────────────────────
// Vergelijkbaar = zelfde geplande sessie, of een run met een duur binnen
// een kwart van de geplande duur. Nieuwste eerst, hooguit acht.
export function comparableSessions(run, { limit = 8 } = {}) {
  const all = loadWorkouts().filter(isRun);
  const exact = run?.nr ? all.filter(w => Number(w.plannedSessionId) === Number(run.nr)) : [];
  const target = run?.duration || null;
  const near = target
    ? all.filter(w => {
        const d = num(w.duration);
        return d && Math.abs(d - target) / target <= 0.25;
      })
    : [];
  const seen = new Set();
  const out = [];
  for (const w of [...exact, ...near, ...all]) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    out.push(w);
    if (out.length >= limit) break;
  }
  return out;
}

function confidenceFrom(observations, recentCount, variation) {
  if (observations >= 5 && recentCount >= 2 && variation != null && variation < 0.08) return 'HIGH';
  if (observations >= 3 && recentCount >= 1) return 'MEDIUM';
  return 'LOW';
}

const CONFIDENCE_TEXT = {
  HIGH: 'Genoeg vergelijkbare sessies met een stabiel beeld.',
  MEDIUM: 'Een paar vergelijkbare sessies — de bandbreedte is nog ruim.',
  LOW: 'Te weinig vergelijkbare sessies; dit is een eerste schatting, geen voorspelling.',
};

// ── Forecast voor de volgende sessie ────────────────────────────
// `run` = de sessie uit RUNS die de coach heeft gekozen.
// `gate` = het resultaat van restDayDecision — bepaalt het veilige advies.
export function nextSessionForecast({ run, logs = {}, currentDate, gate = null }) {
  const hr = loadHrSettings();
  if (!run) {
    return {
      available: false,
      reason: 'Er staat vandaag geen loopsessie gepland.',
      safe: gate ? { headline: gate.headline, detail: gate.summary } : null,
    };
  }
  // Staat lopen op slot, dan is dit een vooruitblik op de sessie die
  // straks weer vrijkomt — niet iets om vandaag te doen.
  const deferred = gate ? gate.action !== 'RUN_TODAY' : false;

  const split = runWalkSplit(run);
  const walkPace = observedWalkPace();
  const comps = comparableSessions(run);
  const recent = comps.filter(w => w.date >= addDays(currentDate, -21));

  const paces = comps.map(sessionPace).filter(Boolean);
  const hrs = comps.map(w => num(w.averageHR)).filter(Boolean);
  const rpes = comps.map(w => num(w.rpe)).filter(Boolean);

  const medPace = median(paces);
  const padPace = spread(paces, medPace ? medPace * 0.04 : 0)
    ?? (medPace ? medPace * 0.08 : null);
  const variation = medPace && padPace != null ? padPace / medPace : null;

  const confidence = confidenceFrom(comps.length, recent.length, variation);

  // Duur: het plan is de basis; de adaptieve staat kan hem verkorten
  const duration = run.duration || split?.totalTime || null;

  // Afstand volgt uit duur en verwacht totaaltempo
  const range = (mid, pad) => (mid == null || pad == null)
    ? null : { low: mid - pad, high: mid + pad, mid };

  const paceRange = range(medPace, padPace);
  const distRange = paceRange && duration
    ? { low: +(duration / paceRange.high).toFixed(2),
        high: +(duration / paceRange.low).toFixed(2),
        mid: +(duration / paceRange.mid).toFixed(2) }
    : null;

  const medHR = median(hrs);
  const padHR = spread(hrs, 3) ?? (medHR ? 5 : null);
  const hrRange = range(medHR, padHR);

  const medRpe = median(rpes);
  const rpeRange = medRpe != null
    ? { low: Math.max(1, Math.round(medRpe - 1)), high: Math.min(10, Math.round(medRpe + 1)), mid: medRpe }
    : null;

  const runBlockPace = paceRange ? runBlockPaceFrom(paceRange.mid, split, walkPace) : null;
  const rbLow = paceRange ? runBlockPaceFrom(paceRange.low, split, walkPace) : null;
  const rbHigh = paceRange ? runBlockPaceFrom(paceRange.high, split, walkPace) : null;
  // Alleen tonen als de hele band te splitsen valt; anders is de
  // bovengrens een artefact van de aftrek in plaats van een uitkomst.
  const runBlockRange = (runBlockPace && rbLow && rbHigh)
    ? { low: rbLow, high: rbHigh, mid: runBlockPace } : null;
  const runBlockNote = runBlockRange ? null
    : `Niet te splitsen: je sessies gaan gemiddeld langzamer dan het aangenomen wandeltempo van ${fmtPace(walkPace)}/km. Registreer één wandelsessie met afstand en tijd, dan kan ik loop- en wandelblokken uit elkaar halen.`;

  // Vergelijking met de laatste vergelijkbare sessie
  const last = comps[0] || null;
  const lastPace = last ? sessionPace(last) : null;
  const comparison = last ? {
    date: last.date,
    distance: num(last.distance),
    duration: num(last.duration),
    pace: lastPace,
    hr: num(last.averageHR),
    rpe: num(last.rpe),
    tolerance: toleranceFor(last, logs),
    sameSession: Number(last.plannedSessionId) === Number(run.nr),
    paceDelta: lastPace && medPace ? +(medPace - lastPace).toFixed(2) : null,
  } : null;

  const dataNote = comps.length === 0
    ? 'Nog geen enkele vergelijkbare sessie geregistreerd — hier staat alleen wat het schema voorschrijft.'
    : comps.length < 3
      ? `Gebaseerd op ${comps.length} vergelijkbare sessie${comps.length > 1 ? 's' : ''} — dat is te weinig voor een smalle bandbreedte.`
      : `Gebaseerd op ${comps.length} vergelijkbare sessies, waarvan ${recent.length} in de afgelopen drie weken.`;

  // ── Het veilige advies staat los van de voorspelling ──────────
  const safe = (() => {
    if (gate && gate.action !== 'RUN_TODAY') {
      return {
        headline: gate.headline,
        detail: gate.blockers[0] || gate.summary,
        runToday: false,
      };
    }
    const caps = [
      `Richtgebied ${hr.easyLow}–${hr.easyHigh} bpm. Kort erboven is geen fout; blijft de ` +
        'hartslag er structureel boven, laat dan het tempo zakken.',
      `RPE niet boven ${hr.rpeEasy}/10 — als het zwaarder voelt, is het te snel, ongeacht wat de klok zegt.`,
    ];
    if (confidence === 'LOW') {
      caps.push('De voorspelling hierboven is een schatting; laat je vandaag door je hartslag leiden, niet door het verwachte tempo.');
    }
    if (comparison?.tolerance === 'pending') {
      caps.push('De vorige vergelijkbare sessie wacht nog op een herstelcheck — vul die alsnog in.');
    }
    return {
      headline: 'Lopen is vrijgegeven — maar het tempo hierboven is een verwachting, geen doel.',
      detail: caps.join(' '),
      runToday: true,
      caps,
    };
  })();

  // De drie tempo's apart. Session pace is nadrukkelijk niet haar
  // hardloopsnelheid en wordt daarom nooit als zodanig gepresenteerd.
  const paceModel = pacePrediction({ run, currentDate });

  return {
    available: true,
    deferred,
    earliestDate: gate?.earliestRunDate || currentDate,
    run, split, walkPace,
    paces: paceModel,
    duration,
    distanceKm: distRange,
    targetHR: { low: hr.easyLow, high: hr.easyHigh },
    expectedHR: hrRange,
    runBlockPace: runBlockRange,
    runBlockNote,
    sessionPace: paceRange,
    expectedRPE: rpeRange,
    confidence,
    confidenceText: CONFIDENCE_TEXT[confidence],
    dataNote,
    observations: comps.length,
    comparison,
    safe,
  };
}

// ── Loopeconomie-trend: hoeveel wint er per week bij? ───────────
// Gebaseerd op pace bij vergelijkbare hartslag; dat is de enige eerlijke
// maat voor vooruitgang zolang er in één zone getraind wordt.
export function economyTrend() {
  const hr = loadHrSettings();
  const t = paceAtHRTrend(hr.easyLow, hr.easyHigh, 3);
  if (!t.enough) {
    return { enough: false, count: t.count,
      note: `Nog ${Math.max(0, 3 - t.count)} sessie(s) met hartslag in de easy-band nodig voor een trendlijn.` };
  }
  const weeks = Math.max(1, weeksBetween(t.early.from, t.late.to));
  const rawRate = t.improvementSec / weeks;                   // sec/km per week
  const rate = Math.max(-MAX_GAIN_SEC_PER_KM_PER_WEEK,
    Math.min(MAX_GAIN_SEC_PER_KM_PER_WEEK, rawRate));
  return {
    enough: true, count: t.count, points: t.points,
    currentPace: t.late.pace, currentHR: t.late.hr,
    startPace: t.early.pace, startHR: t.early.hr,
    improvementSec: t.improvementSec,
    weeks: +weeks.toFixed(1),
    ratePerWeek: +rate.toFixed(2),
    capped: Math.abs(rawRate) > MAX_GAIN_SEC_PER_KM_PER_WEEK,
  };
}

// Gemiddelde cardiac drift over de recente sessies — een hoge drift
// betekent dat een lange race harder wegzakt dan het korte tempo suggereert.
export function averageDrift(limit = 6) {
  const drifts = loadWorkouts().filter(isRun).slice(0, limit)
    .map(cardiacDrift).filter(Boolean).map(d => d.drift);
  if (!drifts.length) return null;
  return { drift: Math.round(median(drifts)), n: drifts.length };
}

function load5kTests() {
  try {
    return JSON.parse(localStorage.getItem('gc_5k_tests') || '[]')
      .filter(t => t.date && t.minutes)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch { return []; }
}

// ── Aankomende races ────────────────────────────────────────────
export function upcomingRaces(currentDate) {
  return RUNS
    .filter(r => r.race && r.fixedDate && r.fixedDate >= currentDate)
    .map(r => ({
      nr: r.nr,
      date: r.fixedDate,
      name: r.description.replace(/^🏁\s*/, '').split('·')[0].trim(),
      distanceKm: runDistanceKm(r),
      terrain: RACE_TERRAIN[r.nr] || 'road',
      strategy: { runMin: r.runMin, walkMin: r.walkMin },
      run: r,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function fmtTime(minutes) {
  if (minutes == null || !isFinite(minutes)) return null;
  // Eerst afronden op hele seconden, dán opdelen — anders levert
  // 110,996 min de onmogelijke uitkomst 1:50:60 op.
  const totalSec = Math.round(minutes * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

// ── Racevoorspelling ────────────────────────────────────────────
// Drie scenario's over dezelfde onderliggende berekening:
//   Conservative  geen verdere winst, terrein op zijn zwaarst, ruim wandelen
//   Likely        60% van de waargenomen trend, terrein in het midden
//   Stretch       volle trend, terrein op zijn gunstigst — alleen bij een
//                 schone tolerantiehistorie
export function raceForecast(race, logs = {}, currentDate) {
  const hr = loadHrSettings();
  const econ = economyTrend();
  const drift = averageDrift();
  const longest = longestToleratedRun(logs);
  const tests = load5kTests();
  const terrain = TERRAIN[race.terrain] || TERRAIN.road;
  const weeksOut = Math.max(0, weeksBetween(currentDate, race.date));
  const split = runWalkSplit(race.run);
  const walkPace = observedWalkPace();

  // Anker: het huidige totaaltempo van een sessie in de easy-band.
  // Voor 5 km telt een echte tijdtest zwaarder dan een trainingsgemiddelde.
  let anchorPace = null, anchorSource = null;
  if (race.distanceKm && race.distanceKm <= 5.5 && tests.length) {
    anchorPace = tests[0].minutes / 5;
    anchorSource = `5 km-test van ${tests[0].date}`;
  } else if (econ.enough) {
    // pace@HR is al een sessietempo inclusief wandelpauzes, net als de
    // race zelf gelopen wordt — vergelijkbaar zonder herrekening.
    anchorPace = econ.currentPace;
    anchorSource = `sessietempo bij hartslag ${econ.currentHR} over ${econ.count} sessies`;
  } else {
    const runs = loadWorkouts().filter(isRun).slice(0, 6).map(sessionPace).filter(Boolean);
    anchorPace = median(runs);
    anchorSource = runs.length ? `gemiddelde van je laatste ${runs.length} sessies` : null;
  }

  if (!anchorPace) {
    return {
      race, available: false,
      reason: 'Nog geen tempo-data om een racevoorspelling op te baseren. Registreer een paar sessies met afstand en tijd.',
      safe: safeRaceAdvice(race, longest, hr, null),
    };
  }

  // Hoeveel winst mag er nog bij tot de racedag?
  const gainPerWeek = econ.enough ? econ.ratePerWeek : 0;   // sec/km per week
  const gainMin = (factor) => (gainPerWeek * weeksOut * factor) / 60;

  // Drift-correctie: een hoge drift betekent dat een lange inspanning
  // wegzakt. Alleen toepassen op afstanden boven de langste verdragen run.
  const driftPenalty = (() => {
    if (!drift || drift.drift < 6) return 0;
    const longestKm = longest ? num(longest.distance) : null;
    if (!race.distanceKm) return 0;
    if (longestKm && longestKm >= race.distanceKm * 0.7) return 0;
    return Math.min(0.10, (drift.drift - 5) * 0.012);   // tot 10% trager
  })();

  // Wegzakken over de afstand. Trainingstempo over 3 km zegt weinig over
  // kilometer 9 als die nooit gelopen is; hoe verder de race boven de
  // langst verdragen run ligt, hoe zwaarder deze correctie weegt.
  const longestKmNow = longest ? num(longest.distance) : null;
  const coverageNow = longestKmNow && race.distanceKm ? longestKmNow / race.distanceKm : null;
  const fadePenalty = (() => {
    if (coverageNow == null) return 0.10;          // niets bewezen → volle correctie
    if (coverageNow >= 0.7) return 0;
    if (coverageNow >= 0.4) return 0.05 * (0.7 - coverageNow) / 0.3;
    return 0.05 + 0.07 * Math.min(1, (0.4 - coverageNow) / 0.4);
  })();

  const cleanRecord = (() => {
    const recent = loadWorkouts().filter(isRun)
      .filter(w => w.date >= addDays(currentDate, -28));
    return recent.length >= 3 && recent.every(w => toleranceFor(w, logs) !== 'poor');
  })();

  function scenario(name, { gainFactor, terrainPenalty, extraWalk, fadeFactor, label, note }) {
    const base = anchorPace - gainMin(gainFactor);
    const fade = fadePenalty * fadeFactor;
    const paced = base * (1 + terrainPenalty) * (1 + driftPenalty)
      * (1 + extraWalk) * (1 + fade);
    const km = race.distanceKm;
    const finish = km ? paced * km : null;
    return {
      key: name, label, note,
      paceMin: paced,
      pace: fmtPace(paced),
      finishMinutes: finish,
      finishTime: fmtTime(finish),
      terrainPenalty: Math.round(terrainPenalty * 100),
      extraWalkPenalty: Math.round(extraWalk * 100),
      fadePenalty: Math.round(fade * 100),
    };
  }

  const conservative = scenario('conservative', {
    gainFactor: 0, terrainPenalty: terrain.max, extraWalk: 0.06, fadeFactor: 1,
    label: 'Conservatief',
    note: 'Geen verdere vooruitgang, terrein op zijn zwaarst, extra wandelpauzes, volledig wegzakken over de afstand. Dit is de uitkomst waar je op mag rekenen.',
  });
  const likely = scenario('likely', {
    gainFactor: 0.6, terrainPenalty: (terrain.min + terrain.max) / 2, extraWalk: 0.02, fadeFactor: 0.7,
    label: 'Waarschijnlijk',
    note: 'Zestig procent van je waargenomen trend doorgetrokken, terrein gemiddeld ingeschat.',
  });
  const stretch = cleanRecord ? scenario('stretch', {
    gainFactor: 1, terrainPenalty: terrain.min, extraWalk: 0, fadeFactor: 0.4,
    label: 'Stretch',
    note: 'Volle trend, gunstige dag, terrein mee. Alleen als je herstel schoon blijft.',
  }) : null;

  // Vertrouwen: hoe ver weg, hoeveel data, en hoe verhoudt de afstand zich
  // tot wat je aantoonbaar verdraagt?
  const longestKm = longestKmNow;
  const coverage = coverageNow;
  const confidence = (() => {
    if (!econ.enough || coverage == null) return 'LOW';
    if (coverage >= 0.7 && weeksOut <= 8 && econ.count >= 5) return 'HIGH';
    if (coverage >= 0.4 && weeksOut <= 16) return 'MEDIUM';
    return 'LOW';
  })();

  const limits = [];
  if (!econ.enough) limits.push(econ.note);
  if (coverage != null && coverage < 0.5) {
    limits.push(`Je langste goed verdragen run is ${longestKm} km — ${Math.round(coverage * 100)}% van de raceafstand. Alles daarboven is extrapolatie.`);
  }
  if (!longest) limits.push('Nog geen enkele run met een bevestigde goede 24–48u-respons — de bovengrens van je belastbaarheid is onbekend.');
  if (driftPenalty > 0) limits.push(`Je hartslag loopt gemiddeld ${drift.drift} slagen op tijdens een sessie; over deze afstand is dat verdisconteerd als ${Math.round(driftPenalty * 100)}% tragere pace.`);
  if (fadePenalty > 0) limits.push(`De raceafstand ligt boven wat je aantoonbaar verdraagt; er is ${Math.round(fadePenalty * 100)}% wegzakken ingerekend voor het conservatieve scenario, minder voor de andere twee.`);
  if (terrain.max > 0) limits.push(`${terrain.label}: wegtempo is hier niet één-op-één van toepassing, daarom een terreinopslag van ${Math.round(terrain.min * 100)}–${Math.round(terrain.max * 100)}%.`);
  if (econ.capped) limits.push('De waargenomen verbetering is afgetopt op 4 sec/km per week — een korte goede reeks mag zich niet maandenlang doorprojecteren.');
  if (weeksOut > 12) limits.push(`De race is nog ${Math.round(weeksOut)} weken weg; op die termijn is elke voorspelling grof.`);

  return {
    race, available: true,
    weeksOut: +weeksOut.toFixed(1),
    anchorPace, anchorSource,
    scenarios: [conservative, likely, stretch].filter(Boolean),
    expectedHR: { low: hr.easyLow, high: hr.easyHigh },
    confidence, confidenceText: CONFIDENCE_TEXT[confidence],
    limits,
    economy: econ, drift, longestTolerated: longest,
    safe: safeRaceAdvice(race, longest, hr, coverage),
  };
}

// Het veilige advies is nadrukkelijk geen tijdsdoel. Het beschrijft
// uitsluitend hoe de race gelopen moet worden.
function safeRaceAdvice(race, longest, hr, coverage) {
  const s = race.strategy || {};
  let runMin = s.runMin, walkMin = s.walkMin;
  const adjusted = coverage != null && coverage < 0.5;
  if (adjusted && runMin) {
    runMin = Math.max(1, runMin - 1);
    walkMin = (walkMin || 2) + 1;
  }
  const lines = [
    runMin && walkMin
      ? `Run/walk ${runMin} min lopen / ${walkMin} min wandelen vanaf de start — ook als het makkelijk voelt.`
      : 'Run/walk vanaf de start, ook als het makkelijk voelt.',
    `Wedstrijdhartslag volgt een eigen advies per afstand — zie het raceplan. ` +
      `De easy delen liggen rond ${hr.easyLow}–${hr.easyHigh} bpm.`,
    'Klimmen altijd wandelen, ongeacht hoe je je voelt.',
    'Finishen binnen de hartslagband is het doel. De tijd is een uitkomst, geen opdracht.',
  ];
  if (adjusted) {
    lines.unshift(`De raceafstand ligt ver boven je langste goed verdragen run — daarom een ruimere wandelverhouding dan het schema voorschrijft.`);
  }
  if (longest) {
    lines.push(`Langste run die je aantoonbaar goed verdroeg: ${longest.distance} km op ${longest.date}.`);
  }
  return { headline: 'Zo loop je hem veilig', lines };
}

export function allRaceForecasts(logs, currentDate) {
  return upcomingRaces(currentDate).map(r => raceForecast(r, logs, currentDate));
}

// ── Verwacht versus werkelijk, per sessie ───────────────────────
// Achteraf toetsen of de forecast klopte. Zonder deze terugkoppeling is
// een voorspelling niet te vertrouwen.
export function forecastAccuracy(logs, currentDate, limit = 12) {
  const all = loadWorkouts().filter(isRun);
  const runs = all.filter(w => w.date <= currentDate).slice(0, limit).reverse();
  return runs.map(w => {
    const planned = w.plannedSessionId ? RUNS.find(r => r.nr === Number(w.plannedSessionId)) : null;
    const actualPace = sessionPace(w);
    // De verwachting van toen: mediaan van de sessies die eraan voorafgingen
    const before = all.filter(x => x.date < w.date);
    const expected = median(before.slice(0, 6).map(sessionPace).filter(Boolean));
    return {
      date: w.date,
      sessionNr: w.plannedSessionId || null,
      plannedDuration: planned?.duration ?? null,
      actualDuration: num(w.duration),
      expectedPace: expected,
      actualPace,
      deltaPace: expected && actualPace ? +(actualPace - expected).toFixed(2) : null,
      hr: num(w.averageHR),
      tolerance: toleranceFor(w, logs),
    };
  });
}

export { fmtTime };

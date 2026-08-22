// Doelgestuurde sessiegeneratie.
//
// Hiervóór koos de coach de volgende training als "hoogste gedane
// sessienummer + 1" uit een vast schema van 35 sessies. Dat schema wist
// niets van 3 oktober, niets van 35:00, en er stond nergens een blok op
// 7:00/km in — het snelste tempo in het hele schema was 9:00/km. De
// racedoelen bestonden wel, maar alleen als iets om naar te kijken.
//
// Dit bestand draait dat om. De volgende sessie wordt afgeleid uit drie
// dingen, in deze volgorde:
//
//   1. MAG HET      de herstelpoort. PEM, hoofdpijn en een afwijkende
//                   respons gaan vóór alles. Zonder groen licht is er geen
//                   prikkel, hoe dicht de race ook bij is.
//   2. WAT NU       hoeveel weken tot de eerstvolgende race, en dus welke
//                   fase: basis, specifiek of taper.
//   3. HOE ZWAAR    wat je aantoonbaar verdraagt — bewezen loopblok,
//                   looptempo bij je hartslagband, verdragen afstand.
//
// De racedatum bepaalt het dóél van de sessie. Je belastbaarheid bepaalt de
// zwaarte. Nooit andersom: een naderende race maakt een sessie nooit
// zwaarder dan je herstel toestaat.

import { todayLocal, addDays, daysBetween, startOfWeek } from './datetime';
import { loadWorkouts, fmtPace } from './workouts';
import { loadHrSettings } from './goals';
import { allBreakdowns } from './pace';
import { exertionalResponse } from './symptoms';
import { calibrateHr } from './runningHistory';
import { hrPrescription, intensityRelease, loadHrModel } from './hrModel';
import { recoveryBudget, BAND } from './recoveryBudget';
import { dayVerdict, DECISION, AMBER_KIND } from './dayVerdict';
import { easyRunPace, prescribedPace } from './easyPace';
import { runningState } from './raceGoals';
import { loadRaceGoals, saveRaceGoal, resetRaceGoals, DEFAULT_GOALS } from './raceGoalModel';
import { restDayDecision, MAX_WEEKLY_VOLUME_GROWTH } from './restday';
import { RUNS } from './data/runningSchema';

// ── Fasen, op de kalender ───────────────────────────────────────
export const PHASE = {
  BASE: 'BASE',           // meer dan 6 weken: breedte bouwen
  SPECIFIC: 'SPECIFIC',   // 10 dagen tot 6 weken: racetempo leren kennen
  TAPER: 'TAPER',         // laatste 10 dagen: vers worden, niets meer winnen
};

export const TAPER_DAYS = 10;
export const SPECIFIC_WEEKS = 6;

// ── Trainingsdoelen ─────────────────────────────────────────────
// Elke voorgestelde sessie heeft er precies één. Zonder doel is het geen
// training maar een rondje.
export const PURPOSE = {
  RECOVERY: {
    id: 'RECOVERY', label: 'Herstel',
    aim: 'Niets opbouwen. Bewegen mag, belasten niet.',
  },
  EASY_ECONOMY: {
    id: 'EASY_ECONOMY', label: 'Easy economy',
    aim: 'Sneller worden bij dezelfde goed verdragen hartslag.',
  },
  DURABILITY: {
    id: 'DURABILITY', label: 'Durability',
    aim: 'Meer echte hardloopkilometers verdragen.',
  },
  QUALITY_LITE: {
    id: 'QUALITY_LITE', label: 'Quality-lite',
    aim: 'Korte, gecontroleerde versnelling zonder de herstelkosten van racetempo.',
  },
  FIVE_K_SPECIFIC: {
    id: 'FIVE_K_SPECIFIC', label: '5 km-specifiek',
    aim: 'Wennen aan het tempo dat je op 3 oktober nodig hebt.',
  },
  TEN_K_SPECIFIC: {
    id: 'TEN_K_SPECIFIC', label: '10 km-specifiek',
    aim: 'Wennen aan het tempo dat de 10 km op 31 oktober vraagt.',
  },
  TAPER: {
    id: 'TAPER', label: 'Taper',
    aim: 'Vers aan de start staan. Er valt nu niets meer te winnen, alleen te verliezen.',
  },
};

// ── Racedoelen als echte, bewerkbare data ───────────────────────
// De standaardwaarden staan in raceGoals.js; alles wat jij aanpast komt in
// gc_races te staan en wint. Doeltempo wordt altijd afgeleid uit doeltijd
// en afstand, nooit los opgeslagen — dan kunnen ze niet uit elkaar lopen.
export function targetPaceOf({ targetMinutes, distanceKm }) {
  const t = Number(targetMinutes), d = Number(distanceKm);
  if (!t || !d) return null;
  return +(t / d).toFixed(4);
}

const DEFAULT_META = {
  okt3: { priority: 1, enabled: true, confidence: 'MEDIUM' },
  okt31: { priority: 2, enabled: true, confidence: 'LOW' },
};

// De racedoelen komen uit het RaceGoal-model: afstand + gewenste eindtijd +
// datum, met het tempo als afgeleide. De oude `RACES`-constante had het
// tempo hardgecodeerd naast de tijd, waardoor ze uit elkaar konden lopen.
export function loadRaces() {
  return loadRaceGoals().map(g => ({
    ...g,
    // De vorm die de rest van de planner al gebruikt.
    targetMinutes: g.targetTimeSec / 60,
    targetPace: g.targetPaceSecPerKm / 60,
    confidence: DEFAULT_META[g.id]?.confidence || 'LOW',
    conditions: STRETCH_CONDITIONS[g.id] || null,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

// Voorwaarden bij een stretchdoel horen bij het doel, niet bij de
// tempoberekening — daarom staan ze hier en niet in het model.
const STRETCH_CONDITIONS = {
  okt31: [
    { id: 'fiveK', label: '5 km goed verdragen', test: (s) => s.longestTolerated >= 5 },
    { id: 'volume', label: '7–8 km goed verdragen, later 8–9 km',
      test: (s) => s.longestTolerated >= 7 },
    { id: 'pace', label: 'Blokken van 6:30–6:45/km beheersbaar',
      test: (s) => s.runPace != null && s.runPace <= 6.75 },
    { id: 'pem', label: 'Geen relevante PEM-signalen', test: (s) => s.pemFreeWeeks >= 4 },
  ],
};

export function saveRace(id, patch) {
  const next = { ...patch, id };
  // Een doeltijd in minuten mag; het model rekent hem om naar seconden.
  if (patch.targetMinutes != null && patch.targetTimeSec == null) {
    next.targetTimeSec = Math.round(Number(patch.targetMinutes) * 60);
    delete next.targetMinutes;
  }
  saveRaceGoal(next);
  return loadRaces();
}

export function resetRaces() {
  resetRaceGoals();
  return loadRaces();
}

// Controle dat duur, tempo en afstand niet uit elkaar kunnen lopen.
export function checkRaceMath(races = loadRaces()) {
  const problems = [];
  for (const r of races) {
    const derived = targetPaceOf(r);
    if (derived == null) {
      problems.push({ id: r.id, problem: 'doeltijd of afstand ontbreekt' });
      continue;
    }
    if (r.targetPace != null && Math.abs(r.targetPace - derived) > 0.005) {
      problems.push({ id: r.id, problem: 'doeltempo klopt niet bij doeltijd en afstand',
        stored: r.targetPace, derived });
    }
  }
  return problems;
}

// ── De kalender ─────────────────────────────────────────────────
export function raceTimeline({ currentDate = todayLocal(), races = null } = {}) {
  const all = (races || loadRaces()).filter(r => r.enabled !== false);
  const upcoming = all
    .filter(r => r.date >= currentDate)
    .map(r => {
      const days = daysBetween(currentDate, r.date);
      const weeksOut = days / 7;
      const phase = days <= TAPER_DAYS ? PHASE.TAPER
        : weeksOut <= SPECIFIC_WEEKS ? PHASE.SPECIFIC
        : PHASE.BASE;
      return { ...r, daysOut: days, weeksOut: +weeksOut.toFixed(2), phase };
    })
    .sort((a, b) => a.daysOut - b.daysOut || a.priority - b.priority);

  const primary = upcoming[0] || null;
  const next = upcoming[1] || null;

  return {
    races: upcoming,
    primary,
    next,
    // Hoeveel ruimte er tussen de twee doelen zit — bepaalt of er tussen de
    // races nog iets te bouwen valt of dat het meteen taper wordt.
    gapWeeks: primary && next ? +((next.daysOut - primary.daysOut) / 7).toFixed(2) : null,
  };
}

// ── Wat je aantoonbaar aankunt ──────────────────────────────────
// Het bewezen loopblok en de vorm van je laatste goed verdragen sessie.
// Niet het schemanummer, en niet de zwaarste sessie die je ooit hebt
// afgemaakt — alleen wat erna schoon werd verdragen.
export function provenStructure({ logs = {}, currentDate = todayLocal() } = {}) {
  const rows = allBreakdowns({ limit: 40, currentDate })
    .filter(b => (b.segments || []).some(s => s.kind === 'run'))
    .filter(b => exertionalResponse({ workoutDate: b.workout.date, logs, currentDate })
      .countsAsVolume)
    .sort((a, b) => b.workout.date.localeCompare(a.workout.date));

  if (!rows.length) return null;

  const median = (arr) => {
    const v = arr.filter(x => x != null && x > 0).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };

  // De vorm van de meest recente verdragen sessie is het uitgangspunt.
  const last = rows[0];
  const runSegs = last.segments.filter(s => s.kind === 'run');
  const walkSegs = last.segments.filter(s => s.kind === 'walk');

  const bestBlock = rows.reduce((m, b) =>
    Math.max(m, ...b.segments.filter(s => s.kind === 'run').map(s => s.minutes || 0)), 0);

  return {
    date: last.workout.date,
    runMin: +(median(runSegs.map(s => s.minutes)) || 0).toFixed(1),
    walkMin: +(median(walkSegs.map(s => s.minutes)) || 0).toFixed(1),
    reps: runSegs.length,
    duration: Math.round(Number(last.workout.duration) || 0),
    provenBlockMin: +bestBlock.toFixed(1),
    sessions: rows.length,
  };
}

// Hoeveel loopprikkels staan er deze week al?
function stimuliThisWeek(currentDate) {
  const monday = startOfWeek(currentDate);
  const sunday = addDays(monday, 6);
  return loadWorkouts()
    .filter(w => (w.activityType === 'run' || w.activityType == null))
    .filter(w => w.date >= monday && w.date <= sunday && w.date <= currentDate)
    .length;
}

// ── Tempo per doel ──────────────────────────────────────────────
// Rustige sessies staan nooit op racetempo. Dat is geen detail: op
// racetempo trainen zonder de basis eronder is precies het patroon dat in
// 2024 misging.
export function paceFor(purpose, { runPace, race }) {
  const easy = runPace || null;
  switch (purpose) {
    case 'FIVE_K_SPECIFIC':
      return race?.targetPace ?? 7.0;
    case 'TEN_K_SPECIFIC': {
      // De opdracht vraagt 6:30–6:45; we mikken op het midden en gaan
      // nooit onder het doeltempo zelf.
      const t = race?.targetPace ?? 6.5;
      return +Math.min(6.75, Math.max(t, t + 0.1)).toFixed(2);
    }
    case 'QUALITY_LITE': {
      if (easy == null) return null;
      // Een halve minuut per kilometer sneller dan rustig — merkbaar, maar
      // ver van racetempo, want daar hangt een herstelprijs aan.
      const target = easy - 0.5;
      const floor = (race?.targetPace ?? 7.0) + 0.33;
      return +Math.max(target, floor).toFixed(2);
    }
    case 'RECOVERY':
      return easy != null ? +(easy + 0.5).toFixed(2) : null;
    case 'TAPER':
    case 'DURABILITY':
    case 'EASY_ECONOMY':
    default:
      return easy != null ? +easy.toFixed(2) : null;
  }
}

// ── De sessie zelf ──────────────────────────────────────────────
// ── De amberdosis ───────────────────────────────────────────────
// Doelen die op een fysieke amberdag niet passen. Geen kwaliteit, geen
// racespecifiek werk — dat zijn intensiteitsprikkels, en die horen niet op een
// dag waarop het lichaam iets meldt.
const DOSE_HEAVY = ['QUALITY_LITE', 'FIVE_K_SPECIFIC', 'TEN_K_SPECIFIC'];

// KALIBRATIEPARAMETER — GEEN FYSIOLOGISCHE WAARHEID.
//
// Hoeveel korter moet een amberdag zijn? Daar is voor deze gebruiker geen
// bewijs voor. Er zijn nog geen amberdagen met en zonder verkorting naast
// elkaar gemeten, dus elk getal hier is een keuze en geen bevinding.
//
// De keuze is bewust conservatief en hangt aan het herstelbudget, dat wél uit
// bestaande belastinglogica komt: hoe minder budget er over is, hoe minder
// blokken. Zodra er genoeg overrides en amberdagen beoordeeld zijn, hoort dit
// getal vervangen te worden door iets wat uit haar eigen respons volgt.
const AMBER_REP_FACTOR = {
  [BAND.GOOD]:     0.80,
  [BAND.MODERATE]: 0.70,
  [BAND.LOW]:      0.60,
  [BAND.NONE]:     0.60,
};
const AMBER_REP_FACTOR_DEFAULT = 0.70;
const AMBER_MIN_REPS = 3;

// Eén as, en dat is het aantal blokken.
//
// Niet ook trager, niet ook lagere hartslag, niet ook meer wandelen. Dat zou
// vier dingen tegelijk veranderen en dan weet je achteraf niet welke ervan de
// dag draaglijk maakte. Het tempo blijft het gemeten easy tempo, de hartslag
// blijft wat hrModel voorschrijft, de bloklengte blijft wat ze aantoonbaar
// aankan. Alleen: minder ervan.
function amberDose({ base, budget }) {
  const factor = AMBER_REP_FACTOR[budget?.band] ?? AMBER_REP_FACTOR_DEFAULT;
  const gewenst = Math.floor(base.reps * factor);
  const reps = Math.max(AMBER_MIN_REPS, Math.min(base.reps, gewenst));

  // Levert de factor niets op — bijvoorbeeld omdat de basis al op het minimum
  // zit — dan is er geen verlaging en wordt er ook niet net gedaan alsof.
  if (reps >= base.reps) return null;

  return {
    base: { ...base, reps, duration: Math.round(reps * (base.runMin + base.walkMin)) },
    info: {
      axis: 'reps',
      from: base.reps, to: reps,
      factor, band: budget?.band || null,
      source: 'calibratie',
      lever: `minder blokken (${base.reps} → ${reps})`,
      why: 'Fysieke amberdag: hetzelfde blok, hetzelfde tempo, dezelfde hartslag — alleen minder herhalingen.',
    },
  };
}

function buildRun({ purpose, base, targetPace, hrZone, race, walkPace }) {
  const round1 = (x) => +x.toFixed(1);
  let runMin = base.runMin, walkMin = base.walkMin, reps = base.reps;
  let duration = base.duration;
  const levers = [];

  switch (purpose) {
    case 'DURABILITY': {
      // Eén variabele omhoog: meer loopminuten, zelfde tempo. De groei
      // blijft binnen de weekgrens van 10%.
      duration = Math.round(base.duration * (1 + MAX_WEEKLY_VOLUME_GROWTH));
      runMin = round1(Math.max(base.runMin, duration / reps - walkMin));
      levers.push('meer loopminuten');
      break;
    }
    case 'QUALITY_LITE': {
      // Kortere blokken, iets sneller, zelfde totaal. Intensiteit omhoog
      // betekent volume gelijk — nooit allebei.
      runMin = round1(Math.max(1, base.runMin * 0.7));
      walkMin = round1(Math.max(base.walkMin, runMin * 0.75));
      reps = Math.max(3, Math.round(base.duration / (runMin + walkMin)));
      duration = Math.round(reps * (runMin + walkMin));
      levers.push('meer tempo-exposure');
      break;
    }
    case 'FIVE_K_SPECIFIC': {
      // Korte blokken op 7:00/km met ruim wandelherstel. Kort genoeg om het
      // tempo écht vast te houden in plaats van eraan te hangen.
      runMin = Math.min(3, Math.max(2, round1(base.runMin * 0.8)));
      walkMin = round1(Math.max(2, runMin));
      reps = Math.max(4, Math.min(6, Math.round(base.duration / (runMin + walkMin))));
      duration = Math.round(reps * (runMin + walkMin));
      levers.push('meer tempo-exposure');
      break;
    }
    case 'TEN_K_SPECIFIC': {
      runMin = Math.min(4, Math.max(2, round1(base.runMin * 0.9)));
      walkMin = round1(Math.max(2, runMin * 0.75));
      reps = Math.max(3, Math.min(5, Math.round(base.duration / (runMin + walkMin))));
      duration = Math.round(reps * (runMin + walkMin));
      levers.push('meer tempo-exposure');
      break;
    }
    case 'TAPER': {
      // Zestig procent van het volume, dezelfde bloklengte. De vorm blijft,
      // de vermoeidheid zakt.
      duration = Math.max(12, Math.round(base.duration * 0.6));
      reps = Math.max(2, Math.round(duration / (runMin + walkMin)));
      duration = Math.round(reps * (runMin + walkMin));
      break;
    }
    case 'RECOVERY': {
      duration = Math.max(10, Math.round(base.duration * 0.5));
      runMin = round1(Math.max(1, base.runMin * 0.6));
      reps = Math.max(2, Math.round(duration / (runMin + walkMin)));
      duration = Math.round(reps * (runMin + walkMin));
      break;
    }
    case 'EASY_ECONOMY':
    default:
      // Hetzelfde nog een keer goed uitvoeren ís de opbouw.
      break;
  }

  const km = targetPace && walkPace
    ? (reps * runMin) / targetPace + (reps * walkMin) / walkPace
    : null;

  const paceText = targetPace ? `Looptempo: ~${fmtPace(targetPace)} min/km` : null;
  const walkText = walkPace ? ` · Wandeltempo: ~${fmtPace(walkPace)} min/km` : '';

  return {
    run: {
      nr: null,
      purpose,
      description: `${fmtBlock(runMin)} lopen / ${fmtBlock(walkMin)} wandelen × ${reps}`,
      runMin, walkMin, reps,
      duration,
      hrZone,
      hrTip: null,
      tempo: paceText ? paceText + walkText : null,
      goal: PURPOSE[purpose].aim,
      km_estimate: km ? `${km.toFixed(1)} km` : null,
      targetPace,
      race: race?.id || null,
    },
    levers,
  };
}

function fmtBlock(min) {
  if (min == null) return '—';
  return Number.isInteger(min) ? `${min} min` : `${String(min).replace('.', ',')} min`;
}

// ── De planner ──────────────────────────────────────────────────
export function planNextSession({
  log = {}, logs = {}, currentDate = todayLocal(),
  gate = null, state = null, forcePurpose = null, ignoreGate = false,
} = {}) {
  const timeline = raceTimeline({ currentDate });
  const st = state || runningState({ logs, currentDate });
  const hrSettings = loadHrSettings();
  const cal = calibrateHr({ logs, currentDate });

  // Fysiologie en tolerantie apart: de CPET zegt wat er bestaat, de
  // herstelrespons van de afgelopen weken zegt hoeveel daarvan nu vrij is.
  const hrModelSnapshot = loadHrModel();
  const releaseSnapshot = intensityRelease({ logs, currentDate, model: hrModelSnapshot });

  const runGate = gate || restDayDecision({ log, logs, currentDate });

  // De respons op de laatste sessie: dit bepaalt of er überhaupt opgebouwd
  // mag worden, ongeacht wat de kalender wil.
  const lastRun = loadWorkouts().find(w =>
    (w.activityType === 'run' || w.activityType == null) && w.date <= currentDate);
  const lastResponse = lastRun
    ? exertionalResponse({ workoutDate: lastRun.date, logs, currentDate }) : null;

  const warnings = st.warnings?.signals?.length || 0;
  // Het dagoordeel komt uit dayVerdict, dezelfde bron als het scherm. Twee
  // keer amber narekenen zou twee definities geven die uit elkaar lopen.
  const verdict = dayVerdict(log, logs, currentDate);
  const fysiekAmber = verdict.decision === DECISION.AMBER &&
    verdict.amberKind === AMBER_KIND.PHYSICAL;

  const mayBuild = !!(lastResponse ? lastResponse.allowsBuild : true)
    && (runGate.action === 'RUN_TODAY' || ignoreGate)
    && warnings < 2
    // Geen opbouw op een dag waarop het lichaam iets meldt. Amber was tot nu
    // toe alleen een kleur; dit is waar hij gevolg krijgt.
    && !fysiekAmber;

  const inputs = {
    runPace: st.runPace, runHr: st.runHr,
    longestTolerated: st.longestTolerated,
    longestRunBlockMin: st.longestRunBlockMin,
    longestContinuousMin: st.longestContinuousMin,
    runKm7: st.runKm7, runKm28: st.runKm28,
    runMin7: st.runMin7, runMin28: st.runMin28,
    pemFreeWeeks: st.pemFreeWeeks,
    hrRange: cal.currentRange, easyHigh: cal.easyHigh ?? cal.currentRange.high,
    vt1Hr: hrModelSnapshot.vt1Hr, vt2Hr: hrModelSnapshot.vt2Hr,
    intensityCeiling: releaseSnapshot.ceiling, releaseLevel: releaseSnapshot.level,
    lastResponse: lastResponse?.status || null,
    warnings,
  };

  // ── Poort eerst ───────────────────────────────────────────────
  if (runGate.action !== 'RUN_TODAY' && !forcePurpose && !ignoreGate) {
    return {
      purpose: 'RECOVERY', race: timeline.primary || null, timeline,
      run: null, targetPace: null, hrZone: null, mayBuild: false,
      derivedFrom: 'gate',
      reason: runGate.blockers?.[0] || runGate.headline,
      why: `Vandaag geen loopprikkel: ${(runGate.blockers?.[0] || runGate.headline || '').toLowerCase()}. ` +
        (timeline.primary
          ? `Dat kost je niets richting ${dateText(timeline.primary.date)} — een sessie die je niet verdraagt telt daar toch niet mee.`
          : 'Herstel is vandaag de investering met de hoogste opbrengst.'),
      gate: runGate, inputs, levers: [],
    };
  }

  // ── Uitgangspunt: wat je aantoonbaar verdraagt ────────────────
  const proven = provenStructure({ logs, currentDate });
  const derivedFrom = proven ? 'capability' : 'schema';

  const base = proven
    ? { runMin: proven.runMin, walkMin: proven.walkMin || 2,
        reps: proven.reps || 5, duration: proven.duration || 20 }
    : (() => {
        // Koude start: nog geen verdragen sessie met loopblokken. Dan is de
        // veilige opbouw uit het schema het uitgangspunt — niet een aanname
        // over wat je aankunt.
        const first = RUNS[0];
        return { runMin: first.runMin, walkMin: first.walkMin,
          reps: first.reps, duration: first.duration };
      })();

  // ── Doel kiezen ───────────────────────────────────────────────
  // Op een fysieke amberdag geen kwaliteit en geen race-specifieke sessie.
  // Dat is geen nieuwe fysiologie maar dezelfde regel als bij mayBuild: als
  // het lichaam iets meldt, is de vorm van vandaag herhalen genoeg.
  let chosen = forcePurpose || choosePurpose({
    timeline, st, mayBuild, currentDate,
  });
  if (fysiekAmber && !forcePurpose && DOSE_HEAVY.includes(chosen)) {
    chosen = 'EASY_ECONOMY';
  }

  const race = raceForPurpose(chosen, timeline);

  // Twee bronnen die niet door elkaar mogen lopen: je gemeten rustige
  // looptempo, en het doeltempo dat uit afstand en eindtijd volgt.
  const easy = easyRunPace({ logs, currentDate });
  const prescribed = prescribedPace({ purpose: chosen, goal: race, easy, logs, currentDate });
  const targetPace = prescribed.paceMin ?? paceFor(chosen, { runPace: st.runPace, race });
  const walkPace = st.runPace ? +(st.runPace + 1.25).toFixed(2) : null;
  // Eén hartslaginstructie per sessie, en die komt uit het hartslagmodel:
  // fysiologie (CPET), tolerantie (herstelrespons) en het doel van déze
  // sessie samen. Nooit een richtgebied naast een wandelgrens die elkaar
  // overlappen.
  const hrx = hrPrescription({ purpose: chosen, logs, currentDate,
    model: hrModelSnapshot, release: releaseSnapshot });
  const hrZone = hrx.line;
  const hrDetail = hrx.text;

  // Eén as omlaag op een fysieke amberdag: het aantal blokken. Bloklengte,
  // wandelpauze, tempo en hartslag blijven exact wat ze op een groene dag
  // zouden zijn — zie amberDose() voor waarom juist die ene.
  const dose = fysiekAmber
    ? amberDose({ base, budget: recoveryBudget({ log, logs, currentDate, runGate }) })
    : null;

  const { run, levers } = buildRun({
    purpose: chosen, base: dose ? dose.base : base,
    targetPace, hrZone, race, walkPace,
  });
  if (dose) {
    run.doseAdjust = dose.info;
    levers.push(dose.info.lever);
  }
  run.hrDetail = hrDetail;
  run.hrWhy = hrx.why;

  return {
    purpose: chosen, race, timeline, run,
    targetPace, paceSource: prescribed.source, paceWhy: prescribed.why,
    easyPace: easy, hrZone, hr: hrx, mayBuild, derivedFrom,
    reason: reasonFor({ chosen, mayBuild, lastResponse, st }),
    why: whyText({ chosen, race, timeline, st, proven, mayBuild, targetPace, currentDate }),
    gate: runGate, inputs, levers,
    verdict, doseAdjust: dose?.info || null,
    proven,
  };
}

// Welk doel past vandaag? Kalender bepaalt de richting, herstel het plafond.
function choosePurpose({ timeline, st, mayBuild, currentDate }) {
  const primary = timeline.primary;

  // Taper is een datumbeslissing en overrulet de weekindeling.
  if (primary?.phase === PHASE.TAPER) return 'TAPER';

  if (!mayBuild) return 'EASY_ECONOMY';

  const done = stimuliThisWeek(currentDate);
  if (done >= 3) return 'RECOVERY';
  if (done === 0) return 'EASY_ECONOMY';
  if (done === 1) return 'DURABILITY';

  // Derde prikkel: kwaliteit. Racetempo alleen met bewijs eronder.
  if (primary?.phase === PHASE.SPECIFIC && raceSpecificAllowed(st, primary)) {
    return primary.distanceKm <= 5 ? 'FIVE_K_SPECIFIC' : 'TEN_K_SPECIFIC';
  }
  return 'QUALITY_LITE';
}

// Racetempo vraagt om herhaalde tolerantie, niet om een naderende datum.
function raceSpecificAllowed(st, race) {
  if (st.pemFreeWeeks < 4) return false;
  if (st.warnings?.signals?.length >= 2) return false;
  if (!st.longestTolerated || !race?.distanceKm) return false;
  return st.longestTolerated >= race.distanceKm * 0.6;
}

function raceForPurpose(purpose, timeline) {
  if (purpose === 'FIVE_K_SPECIFIC') {
    return timeline.races.find(r => r.distanceKm <= 5) || timeline.primary;
  }
  if (purpose === 'TEN_K_SPECIFIC') {
    return timeline.races.find(r => r.distanceKm >= 10) || timeline.primary;
  }
  return timeline.primary;
}

function reasonFor({ chosen, mayBuild, lastResponse, st }) {
  if (!mayBuild && lastResponse && lastResponse.status !== 'good') {
    return lastResponse.reason;
  }
  if (chosen === 'RECOVERY') return 'Drie loopprikkels deze week gehad — dat is het plafond.';
  if (st.pemFreeWeeks < 4) {
    return `Nog ${4 - st.pemFreeWeeks} PEM-vrije week(en) nodig voordat racetempo aan de orde is.`;
  }
  return null;
}

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

function dateText(d) {
  if (!d) return '';
  const [, m, day] = d.split('-');
  return `${Number(day)} ${MONTHS[Number(m) - 1]}`;
}

// "Waarom deze training?" — altijd in termen van het doel, nooit in termen
// van een sessienummer.
function whyText({ chosen, race, timeline, st, proven, mayBuild, targetPace, currentDate }) {
  const primary = timeline.primary;
  const when = primary
    ? `nog ${Math.round(primary.weeksOut)} weken tot ${dateText(primary.date)}`
    : 'geen race gepland';
  const goalLine = primary
    ? `${primary.distanceKm} km op ${dateText(primary.date)}`
    : 'je volgende doel';

  if (!proven) {
    return 'Nog geen sessie met loopblokken die aantoonbaar goed is verdragen, ' +
      'dus dit is de eerste veilige stap in plaats van een schatting. Zodra er ' +
      'twee schone responsen liggen, bouwt de coach hierop verder richting ' + goalLine + '.';
  }

  const tol = st.longestTolerated
    ? `${String(st.longestTolerated).replace('.', ',')} km` : 'nog onbekend';

  switch (chosen) {
    case 'TAPER':
      return `Nog ${primary?.daysOut} dagen tot ${goalLine}. Er valt nu niets meer bij te ` +
        `trainen, alleen te verliezen: minder volume, dezelfde bloklengte, zodat je vers ` +
        `aan de start staat.`;
    case 'FIVE_K_SPECIFIC':
      return `Korte blokken op ${fmtPace(targetPace)}/km — precies het tempo dat ${goalLine} ` +
        `in ${race?.targetMinutes}:00 vraagt. Je verdraagt nu ${tol}; deze sessie leert je ` +
        `benen het tempo kennen zonder de afstand er al bij te vragen. Er zijn ${when}.`;
    case 'TEN_K_SPECIFIC':
      return `Blokken op ${fmtPace(targetPace)}/km richting de 10 km op ` +
        `${dateText(race?.date)} in ${race?.targetMinutes}:00. Dit is een stretchdoel: het ` +
        `blijft alleen staan zolang je herstel meebeweegt.`;
    case 'DURABILITY':
      return `Vandaag bouwen we je verdragen afstand op zonder extra intensiteit — je staat ` +
        `op ${tol}. Dit is de bodem onder ${goalLine} en later onder de 10 km. Er zijn ${when}.`;
    case 'QUALITY_LITE':
      return `Een korte, gecontroleerde versnelling naar ${fmtPace(targetPace)}/km. Nog niet ` +
        `op racetempo: dat vraagt ${st.pemFreeWeeks < 4
          ? `eerst ${4 - st.pemFreeWeeks} PEM-vrije week(en)`
          : 'eerst meer verdragen afstand'}. Zo bouw je richting ${goalLine} zonder de ` +
        `herstelprijs van racetempo.`;
    case 'RECOVERY':
      return `Je hebt deze week al drie loopprikkels gehad. Een vierde levert richting ` +
        `${goalLine} niets op wat je herstel niet weer inlevert.`;
    case 'EASY_ECONOMY':
    default:
      return mayBuild
        ? `Rustig lopen bij ${fmtPace(targetPace)}/km binnen je hartslagband. Sneller worden ` +
          `bij dezelfde goed verdragen hartslag is de kern van ${goalLine} — dit is de sessie ` +
          `waar dat gebeurt. Er zijn ${when}.`
        : `Hetzelfde niveau als de vorige keer, bewust niet zwaarder: de respons op je laatste ` +
          `sessie was niet schoon genoeg om op te bouwen. Richting ${goalLine} is een ` +
          `herhaalde sessie meer waard dan een gemiste week.`;
  }
}

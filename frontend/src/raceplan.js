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
import { runningState, RACES as DEFAULT_RACES } from './raceGoals';
import { restDayDecision, MAX_WEEKLY_VOLUME_GROWTH } from './restday';
import { RUNS } from './data/runningSchema';

const RACE_KEY = 'gc_races';

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

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(RACE_KEY) || '{}'); } catch { return {}; }
}

export function loadRaces() {
  const over = loadOverrides();
  return DEFAULT_RACES.map((r, i) => {
    const meta = DEFAULT_META[r.id] || { priority: i + 1, enabled: true, confidence: 'LOW' };
    const merged = { ...meta, ...r, ...(over[r.id] || {}) };
    // Doeltempo is afgeleid, niet ingevoerd.
    merged.targetPace = targetPaceOf(merged);
    return merged;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function saveRace(id, patch) {
  const over = loadOverrides();
  over[id] = { ...(over[id] || {}), ...patch };
  // Doeltempo bewaren we bewust niet: het volgt uit tijd en afstand.
  delete over[id].targetPace;
  localStorage.setItem(RACE_KEY, JSON.stringify(over));
  return loadRaces();
}

export function resetRaces() {
  localStorage.removeItem(RACE_KEY);
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
      hrTip: purpose === 'FIVE_K_SPECIFIC' || purpose === 'TEN_K_SPECIFIC'
        ? 'Tempoblokken mogen boven je rustige band uitkomen, maar stop het blok zodra je de praatregel verliest. Wandel volledig uit tussen de blokken.'
        : 'Boven je bovengrens: wandelen tot je weer onder je rustige band zit.',
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

  const runGate = gate || restDayDecision({ log, logs, currentDate });

  // De respons op de laatste sessie: dit bepaalt of er überhaupt opgebouwd
  // mag worden, ongeacht wat de kalender wil.
  const lastRun = loadWorkouts().find(w =>
    (w.activityType === 'run' || w.activityType == null) && w.date <= currentDate);
  const lastResponse = lastRun
    ? exertionalResponse({ workoutDate: lastRun.date, logs, currentDate }) : null;

  const warnings = st.warnings?.signals?.length || 0;
  const mayBuild = !!(lastResponse ? lastResponse.allowsBuild : true)
    && (runGate.action === 'RUN_TODAY' || ignoreGate)
    && warnings < 2;

  const inputs = {
    runPace: st.runPace, runHr: st.runHr,
    longestTolerated: st.longestTolerated,
    longestRunBlockMin: st.longestRunBlockMin,
    longestContinuousMin: st.longestContinuousMin,
    runKm7: st.runKm7, runKm28: st.runKm28,
    runMin7: st.runMin7, runMin28: st.runMin28,
    pemFreeWeeks: st.pemFreeWeeks,
    hrRange: cal.currentRange, hrCeiling: cal.ceiling,
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
  const chosen = forcePurpose || choosePurpose({
    timeline, st, mayBuild, currentDate,
  });

  const race = raceForPurpose(chosen, timeline);
  const targetPace = paceFor(chosen, { runPace: st.runPace, race });
  const walkPace = st.runPace ? +(st.runPace + 1.25).toFixed(2) : null;
  // Een band van 128 tot 128 is geen band. Bij te weinig spreiding in de
  // metingen tonen we een werkbare marge in plaats van één getal.
  const lo = cal.currentRange.low, hi = cal.currentRange.high;
  const band = hi - lo >= 6 ? { lo, hi }
    : { lo: Math.max(90, Math.round((lo + hi) / 2) - 6),
        hi: Math.min(cal.ceiling ?? hi + 6, Math.round((lo + hi) / 2) + 6) };
  const hrZone = `Rustige band ${band.lo}–${band.hi} bpm` +
    (cal.ceiling ? ` · boven ${cal.ceiling} wandelen` : '');

  const { run, levers } = buildRun({
    purpose: chosen, base, targetPace, hrZone, race, walkPace,
  });

  return {
    purpose: chosen, race, timeline, run,
    targetPace, hrZone, mayBuild, derivedFrom,
    reason: reasonFor({ chosen, mayBuild, lastResponse, st }),
    why: whyText({ chosen, race, timeline, st, proven, mayBuild, targetPace, currentDate }),
    gate: runGate, inputs, levers,
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

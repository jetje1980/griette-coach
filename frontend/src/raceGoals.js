// Racedoelen en readiness — ambitie zonder het patroon van 2024 te herhalen.
//
// Twee doelen dit najaar:
//   3 oktober 2026    5 km rond 35:00  (7:00/km)   — checkpoint
//   31 oktober 2026  10 km rond 65:00  (6:30/km)   — stretch, voorwaardelijk
//
// Het tweede doel blijft alleen staan zolang aan harde voorwaarden is
// voldaan. Als die niet gehaald worden, verschuift het doel — niet de
// opbouw. Inhaaltraining is precies wat dit systeem moet voorkomen.

import { todayLocal, addDays, daysBetween } from './datetime';
import { loadWorkouts, fmtPace, paceToMin } from './workouts';
import { allBreakdowns, runEconomyTrend, runWalkStructure } from './pace';
import { exertionalResponse, headacheTrend, pemFreeWeeks } from './symptoms';
import { calibrateHr, earlyWarnings } from './runningHistory';

export const RACES = [
  {
    // De naam noemde jarenlang een tienkilometer terwijl het doel vijf is. Het
    // parcours mag heten wat het wil; wat jij loopt is vijf kilometer, en dat
    // is wat er op elk scherm hoort te staan. Het gezaghebbende doel staat in
    // raceGoalModel.
    id: 'okt3', date: '2026-10-03', name: 'Trail 5 km',
    distanceKm: 5, targetMinutes: 35, targetPace: 7.0,
    kind: 'checkpoint', terrain: 'trail',
    note: 'Checkpoint, geen eindexamen. Uitlopen binnen je hartslagband telt als geslaagd.',
  },
  {
    id: 'okt31', date: '2026-10-31', name: 'Bereloop Terschelling 10 km',
    distanceKm: 10, targetMinutes: 65, targetPace: 6.5,
    kind: 'stretch', terrain: 'beach',
    note: 'Stretchdoel. Blijft alleen staan als de voorwaarden hieronder gehaald worden.',
    conditions: [
      { id: 'fiveK', label: '5 km goed verdragen', test: (s) => s.longestTolerated >= 5 },
      { id: 'volume', label: '7–8 km goed verdragen, later 8–9 km',
        test: (s) => s.longestTolerated >= 7 },
      { id: 'pace', label: 'Blokken van 6:30–6:45/km beheersbaar',
        test: (s) => s.runPace != null && s.runPace <= 6.75 },
      { id: 'pem', label: 'Geen relevante PEM-signalen', test: (s) => s.pemFreeWeeks >= 4 },
    ],
  },
];

export const findRace = (id) => RACES.find(r => r.id === id) || null;
export const upcomingRaces = (currentDate = todayLocal()) =>
  RACES.filter(r => r.date >= currentDate).sort((a, b) => a.date.localeCompare(b.date));

// ── Mijlpalen onderweg ──────────────────────────────────────────
// Concreet en oplopend, zodat er iets te halen valt tussen vandaag en
// oktober in.
export const MILESTONES = [
  { id: 'block10', label: 'Loopblok van 10 minuten', test: (s) => s.longestRunBlockMin >= 10 },
  { id: 'cont20', label: '20 minuten aaneengesloten', test: (s) => s.longestContinuousMin >= 20 },
  { id: 'cont30', label: '30 minuten aaneengesloten', test: (s) => s.longestContinuousMin >= 30 },
  { id: 'km4', label: '4 km goed verdragen', test: (s) => s.longestTolerated >= 4 },
  { id: 'km5', label: '5 km goed verdragen', test: (s) => s.longestTolerated >= 5 },
  { id: 'km5pace', label: '5 km op 7:00/km', test: (s) => s.longestTolerated >= 5 && s.runPace <= 7.0 },
  { id: 'km8', label: '7–8 km goed verdragen', test: (s) => s.longestTolerated >= 7 },
  { id: 'km10', label: '10 km goed verdragen', test: (s) => s.longestTolerated >= 10 },
];

// ── De huidige staat, alleen uit hardloopdata ───────────────────
// Losse wandelingen tellen hier nadrukkelijk niet mee. Dat is het eerste
// filter: een Walk of Hike is beweging, geen hardlooptraining.
export function runningState({ logs = {}, currentDate = todayLocal() } = {}) {
  const all = loadWorkouts().filter(w => w.date <= currentDate);

  // Alleen echte hardlooptrainingen. Een Run met wandelblokken telt wél.
  const runs = all.filter(w => w.activityType === 'run' || w.activityType == null);
  const walks = all.filter(w => w.activityType === 'walk');

  const breakdowns = allBreakdowns({ limit: 40, currentDate })
    .filter(b => b.workout.activityType === 'run' || b.workout.activityType == null);

  // Verdragen = de respons erna was schoon. Niet: de afstand is afgelegd.
  const tolerated = runs.filter(w =>
    exertionalResponse({ workoutDate: w.date, logs, currentDate }).countsAsVolume);

  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const inWindow = (arr, days) => arr.filter(w => w.date >= addDays(currentDate, -(days - 1)));

  // Runafstand: waar segmenten bekend zijn tellen we alleen de loopblokken.
  const runKmOf = (w) => {
    const b = breakdowns.find(x => x.workout.id === w.id);
    return b?.runKm != null ? b.runKm : num(w.distance);
  };
  const runMinOf = (w) => {
    const b = breakdowns.find(x => x.workout.id === w.id);
    return b?.runMinutes != null ? b.runMinutes : num(w.duration);
  };

  const econ = runEconomyTrend({ currentDate });
  const hr = calibrateHr({ logs, currentDate });
  const head = headacheTrend({ logs, currentDate });
  const pemFree = pemFreeWeeks({ logs, currentDate });
  const warnings = earlyWarnings({ logs, currentDate });

  // Langste aaneengesloten loopblok
  const longestRunBlockMin = breakdowns.reduce((m, b) => {
    const longest = (b.segments || []).filter(s => s.kind === 'run')
      .reduce((x, s) => Math.max(x, s.minutes || 0), 0);
    return Math.max(m, longest);
  }, 0);

  // Doorlopende run: een sessie zonder wandelblokken
  const longestContinuousMin = breakdowns
    .filter(b => !(b.segments || []).some(s => s.kind === 'walk'))
    .reduce((m, b) => Math.max(m, num(b.workout.duration)), 0);

  return {
    runs: runs.length, walks: walks.length,
    walkExcluded: walks.length,

    runKm7: +inWindow(runs, 7).reduce((s, w) => s + runKmOf(w), 0).toFixed(1),
    runKm28: +inWindow(runs, 28).reduce((s, w) => s + runKmOf(w), 0).toFixed(1),
    runMin7: Math.round(inWindow(runs, 7).reduce((s, w) => s + runMinOf(w), 0)),
    runMin28: Math.round(inWindow(runs, 28).reduce((s, w) => s + runMinOf(w), 0)),

    longestTolerated: +tolerated.reduce((m, w) => Math.max(m, runKmOf(w)), 0).toFixed(2),
    longestCompleted: +runs.reduce((m, w) => Math.max(m, num(w.distance)), 0).toFixed(2),
    longestRunBlockMin: +longestRunBlockMin.toFixed(1),
    longestContinuousMin: Math.round(longestContinuousMin),

    runPace: econ.enough ? econ.late.pace : null,
    runPaceLabel: econ.enough ? fmtPace(econ.late.pace) : null,
    runHr: econ.enough ? econ.late.hr : null,
    economyGainSec: econ.enough ? econ.gainSec : null,
    economyHonest: econ.enough ? econ.honest : null,

    hrRange: hr.currentRange, hrCeiling: hr.ceiling, hrConfidence: hr.confidence,
    headache: head, pemFreeWeeks: pemFree.weeks, warnings,

    lastRunDate: runs[0]?.date || null,
    toleratedCount: tolerated.length,
  };
}

// ── Race readiness ──────────────────────────────────────────────
export const READINESS = {
  ON_TRACK: { label: 'ON TRACK', color: 'var(--sage)',
    meaning: 'Op koers voor het doel, mits het herstel zo blijft.' },
  POSSIBLE: { label: 'POSSIBLE', color: 'var(--gold)',
    meaning: 'Haalbaar, maar er moet nog iets gebeuren.' },
  STRETCH: { label: 'STRETCH', color: 'var(--rust)',
    meaning: 'Alleen bij een gunstig verloop. Niet iets om de opbouw voor te versnellen.' },
  NOT_READY: { label: 'NOT READY', color: 'var(--alert)',
    meaning: 'Op dit moment niet realistisch. Het doel schuift, de opbouw niet.' },
};

export function raceReadiness(race, { logs = {}, currentDate = todayLocal(), state = null } = {}) {
  const s = state || runningState({ logs, currentDate });
  const weeksOut = Math.max(0, daysBetween(currentDate, race.date) / 7);

  // Voorwaarden voor een stretchdoel worden hard getoetst.
  const conditions = (race.conditions || []).map(c => ({
    ...c, met: !!c.test(s),
  }));
  const conditionsMet = conditions.filter(c => c.met).length;

  // Waar staat ze nu ten opzichte van de raceafstand?
  const coverage = race.distanceKm ? s.longestTolerated / race.distanceKm : null;
  const paceGap = s.runPace != null ? s.runPace - race.targetPace : null;

  // De verwachte finishtijd op het huidige looptempo, met een terreinopslag.
  const terrainPenalty = race.terrain === 'trail' ? 0.12
    : race.terrain === 'beach' ? 0.09 : 0;
  const forecastMin = s.runPace != null
    ? s.runPace * race.distanceKm * (1 + terrainPenalty) : null;

  // Het oordeel. Herstel weegt zwaarder dan tempo — dat is de hele les.
  let verdict;
  if (s.warnings?.severe || s.pemFreeWeeks === 0) {
    verdict = 'NOT_READY';
  } else if (coverage == null || coverage < 0.4) {
    verdict = 'NOT_READY';
  } else if (race.kind === 'stretch' && conditionsMet < conditions.length) {
    verdict = conditionsMet >= conditions.length - 1 ? 'STRETCH' : 'NOT_READY';
  } else if (coverage >= 0.9 && paceGap != null && paceGap <= 0.25 && s.pemFreeWeeks >= 4) {
    verdict = 'ON_TRACK';
  } else if (coverage >= 0.6) {
    verdict = 'POSSIBLE';
  } else {
    verdict = 'STRETCH';
  }

  // Wat er nog moet gebeuren, in gewone taal en op volgorde van belang.
  const gaps = [];
  if (s.pemFreeWeeks < 4) {
    gaps.push(`Nog ${4 - s.pemFreeWeeks} PEM-vrije week${4 - s.pemFreeWeeks > 1 ? 'en' : ''} nodig; herstel weegt hier zwaarder dan tempo.`);
  }
  if (coverage != null && coverage < 0.9) {
    gaps.push(`Je langste goed verdragen afstand is ${s.longestTolerated} km van de ${race.distanceKm} km.`);
  }
  if (paceGap != null && paceGap > 0.25) {
    gaps.push(`Je looptempo is ${fmtPace(s.runPace)}/km; het doel vraagt ${fmtPace(race.targetPace)}/km.`);
  }
  if (s.warnings?.signals?.length) {
    gaps.push(s.warnings.signals[0].label.toLowerCase() + ' — eerst stabiliseren.');
  }

  const confidence = s.toleratedCount >= 8 && s.hrConfidence === 'HIGH' ? 'HIGH'
    : s.toleratedCount >= 4 ? 'MEDIUM' : 'LOW';

  return {
    race, weeksOut: +weeksOut.toFixed(1),
    verdict, ...READINESS[verdict],
    forecastMinutes: forecastMin ? Math.round(forecastMin) : null,
    forecastLabel: forecastMin ? formatTime(forecastMin) : null,
    targetLabel: formatTime(race.targetMinutes),
    coverage: coverage != null ? Math.round(coverage * 100) : null,
    paceGapSec: paceGap != null ? Math.round(paceGap * 60) : null,
    conditions, conditionsMet,
    gaps, confidence,
    terrainPenaltyPct: Math.round(terrainPenalty * 100),
    // Het advies is nooit "meer trainen om het te halen".
    advice: verdict === 'NOT_READY'
      ? 'Dit doel is nu niet realistisch. De datum blijft staan; wat de dag zelf haalbaar is, past zich aan. Er komt geen inhaaltraining.'
      : verdict === 'STRETCH'
        ? 'Houd dit als stretch, niet als plan. Als de voorwaarden niet gehaald worden, schuift het doel — niet de opbouw.'
        : verdict === 'POSSIBLE'
          ? 'Haalbaar bij een normaal verloop. Blijf bij één progressievariabele per week.'
          : 'Op koers. De grootste bedreiging is nu ongeduld, niet gebrek aan capaciteit.',
  };
}

function formatTime(minutes) {
  if (minutes == null) return null;
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

// ── Volgende mijlpaal ───────────────────────────────────────────
export function nextMilestone({ logs = {}, currentDate = todayLocal(), state = null } = {}) {
  const s = state || runningState({ logs, currentDate });
  const done = MILESTONES.filter(m => m.test(s));
  const next = MILESTONES.find(m => !m.test(s));
  return {
    achieved: done, next,
    achievedCount: done.length, total: MILESTONES.length,
    label: next ? next.label : 'Alle mijlpalen gehaald',
  };
}

// ── Trainingsvormen ─────────────────────────────────────────────
// Maximaal drie loopprikkels per week, en per week hooguit één
// progressievariabele omhoog.
export const SESSION_TYPES = [
  { id: 'easy_economy', label: 'Easy economy',
    goal: 'Sneller worden bij dezelfde goed verdragen hartslag.',
    when: 'De standaardsessie. Altijd binnen de band.' },
  { id: 'durability', label: 'Durability / long easy',
    goal: 'Meer loopminuten en kilometers verdragen.',
    when: 'Eén keer per week, alleen na een schone respons op de vorige.' },
  { id: 'quality_lite', label: 'Quality-lite',
    goal: 'Korte, gecontroleerde blokken op racetempo.',
    when: 'Alleen op een groene dag, en alleen als de twee andere vormen staan.' },
];

export const PROGRESSION_VARIABLES = [
  'langere loopblokken', 'meer loopminuten', 'meer afstand', 'meer tempo-exposure',
];

// Uniform WorkoutResult-model: elke training — handmatig, screenshot of Strava —
// komt in hetzelfde datamodel terecht. De adaptive engine is bron-onafhankelijk.
//
// WorkoutResult = {
//   id, date, plannedSessionId (run-nr of null), activityType,
//   source: 'manual' | 'screenshot' | 'strava',
//   duration (min), distance (km), averagePace ('m:ss'), averageHR, maxHR,
//   hrZones, splits, cadence, elevation,
//   rpe (1-10), legs ('fris'|'normaal'|'zwaar'), couldDoMore ('ja'|'beetje'|'nee'),
//   completedAsPlanned: 'full' | 'modified' | 'stopped',
//   modificationReason, symptomsDuring, notes,
//   sourceImageIds: [], aiExtractionConfidence, confirmedByUser,
//   createdAt, updatedAt
// }

import { RUNS } from './data/runningSchema';
import { addDays } from './datetime';

const KEY = 'gc_workouts';
const ADAPTIVE_LOG_KEY = 'gc_adaptive_log';

// ── Opslag ──────────────────────────────────────────────────────
export function loadWorkouts() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch { return []; }
}

function persist(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }

export function saveWorkout(w) {
  const arr = loadWorkouts();
  const now = new Date().toISOString();
  const workout = {
    id: w.id || `w_${Date.now()}`,
    confirmedByUser: true,
    createdAt: w.createdAt || now,
    ...w,
    updatedAt: now,
  };
  const idx = arr.findIndex(x => x.id === workout.id);
  if (idx >= 0) arr[idx] = workout; else arr.unshift(workout);
  persist(arr);
  return workout;
}

export function deleteWorkout(id) {
  persist(loadWorkouts().filter(w => w.id !== id));
}

export function getWorkout(id) {
  return loadWorkouts().find(w => w.id === id) || null;
}

export function workoutsForSession(nr) {
  return loadWorkouts().filter(w => Number(w.plannedSessionId) === Number(nr));
}

export function workoutOn(date) {
  return loadWorkouts().find(w => w.date === date) || null;
}

export function lastRunWorkout(beforeDate = null) {
  return loadWorkouts().find(w =>
    (!beforeDate || w.date <= beforeDate) &&
    (w.activityType === 'run' || w.activityType == null)
  ) || null;
}

// ── Afgeleide waarden ───────────────────────────────────────────
// afstand (km) + duur (min) → pace 'm:ss /km'
export function computePace(distanceKm, durationMin) {
  const d = parseFloat(distanceKm), t = parseFloat(durationMin);
  if (!d || !t || d <= 0 || t <= 0) return null;
  const minPerKm = t / d;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function paceToMin(pace) {
  if (pace == null) return null;
  if (typeof pace === 'number') return pace;
  const m = String(pace).match(/(\d+)[:.](\d{1,2})/);
  if (!m) { const f = parseFloat(pace); return isNaN(f) ? null : f; }
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
}

export function fmtPace(minPerKm) {
  if (minPerKm == null || !isFinite(minPerKm)) return null;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Tolerantie: pas succesvol als 24-48u later goed verdragen ───
// 'good' | 'poor' | 'pending' (nog geen dag-erna data)
export function toleranceFor(workout, logs) {
  if (!workout?.date) return 'pending';
  const l1 = logs?.[addDays(workout.date, 1)], l2 = logs?.[addDays(workout.date, 2)];
  const bad = (l) => l && (l.delayed_fatigue || l.delayed_brainfog || l.delayed_breathless ||
    l.symptom_pem || l.recovery_check === 'bad' || l.training_recovery === 2);
  if (bad(l1) || bad(l2)) return 'poor';
  const answered = (l) => l && (l.recovery_check === 'good' || l.energy != null || l.training_recovery != null);
  if (answered(l1) || answered(l2)) return 'good';
  return 'pending';
}

// De zware-sessie check: hoge RPE / zware benen / "nee" op meer gekund / gestopt
export function workoutWasHeavy(w) {
  if (!w) return false;
  return (w.rpe != null && Number(w.rpe) >= 7) || w.legs === 'zwaar' ||
    w.couldDoMore === 'nee' || w.completedAsPlanned === 'stopped';
}

// ── Sessievergelijking: vorige workout van dezelfde geplande sessie ──
export function compareWithPrevious(workout) {
  if (!workout?.plannedSessionId) return null;
  const prev = loadWorkouts().find(w =>
    w.id !== workout.id &&
    Number(w.plannedSessionId) === Number(workout.plannedSessionId) &&
    w.date <= workout.date
  );
  if (!prev) return null;

  const paceNow = paceToMin(workout.averagePace) ?? (workout.distance && workout.duration ? workout.duration / workout.distance : null);
  const pacePrev = paceToMin(prev.averagePace) ?? (prev.distance && prev.duration ? prev.duration / prev.distance : null);

  const deltas = {
    distance: workout.distance != null && prev.distance != null ? +(workout.distance - prev.distance).toFixed(2) : null,
    pace: paceNow != null && pacePrev != null ? +(paceNow - pacePrev).toFixed(2) : null, // negatief = sneller
    hr: workout.averageHR != null && prev.averageHR != null ? Math.round(workout.averageHR - prev.averageHR) : null,
    rpe: workout.rpe != null && prev.rpe != null ? workout.rpe - prev.rpe : null,
  };

  // Coach-oordeel: progressie alleen als het samen klopt
  const better = [];
  const worse = [];
  if (deltas.distance != null) (deltas.distance > 0.05 ? better : deltas.distance < -0.05 ? worse : []).push('afstand');
  if (deltas.pace != null) (deltas.pace < -0.05 ? better : deltas.pace > 0.05 ? worse : []).push('tempo');
  if (deltas.hr != null) (deltas.hr < -1 ? better : deltas.hr > 1 ? worse : []).push('hartslag');
  if (deltas.rpe != null) (deltas.rpe < 0 ? better : deltas.rpe > 0 ? worse : []).push('RPE');

  let verdict;
  const strained = (workout.rpe != null && workout.rpe >= 7) || (deltas.hr != null && deltas.hr > 3);
  if (deltas.pace != null && deltas.pace < -0.05 && strained) {
    verdict = 'Sneller, maar met duidelijk hogere belasting (HR/RPE). Dit is géén aerobe progressie — eerst kijken hoe je herstelt.';
  } else if (better.length >= 2 && worse.length === 0) {
    verdict = `${better.map(b => b[0].toUpperCase() + b.slice(1)).join(', ')} verbeterd zonder hogere belasting. Dit is duidelijke aerobe progressie.`;
  } else if (better.length > 0 && worse.length > 0) {
    verdict = `Gemengd beeld: ${better.join('/')} beter, ${worse.join('/')} minder. Vergelijkbare belasting — consistentie telt.`;
  } else if (worse.length >= 2) {
    verdict = 'Zwaarder dan de vorige keer. Geen probleem — kijk vooral naar je herstel de komende 24–48 uur.';
  } else {
    verdict = 'Vergelijkbaar met de vorige keer — dezelfde belasting opnieuw goed uitvoeren ís de opbouw.';
  }

  return { prev, deltas, verdict };
}

// ── Pace@HR: running economy over tijd ──────────────────────────
// Workouts met HR in aerobe band → pace-trend bij vergelijkbare hartslag
export function paceAtHRTrend(hrLow = 120, hrHigh = 135, minObservations = 3) {
  const pts = loadWorkouts()
    .filter(w => w.averageHR != null && w.averageHR >= hrLow && w.averageHR <= hrHigh)
    .map(w => {
      const pace = paceToMin(w.averagePace) ?? (w.distance && w.duration ? w.duration / w.distance : null);
      return pace ? { date: w.date, pace, hr: w.averageHR } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < minObservations) return { enough: false, count: pts.length, points: pts };
  const first = pts.slice(0, Math.max(1, Math.floor(pts.length / 3)));
  const last  = pts.slice(-Math.max(1, Math.floor(pts.length / 3)));
  const avgP = (a) => a.reduce((s, p) => s + p.pace, 0) / a.length;
  const avgH = (a) => Math.round(a.reduce((s, p) => s + p.hr, 0) / a.length);
  return {
    enough: true, count: pts.length, points: pts,
    early: { pace: avgP(first), hr: avgH(first), from: first[0].date },
    late:  { pace: avgP(last),  hr: avgH(last),  to: last[last.length - 1].date },
    improvementSec: Math.round((avgP(first) - avgP(last)) * 60),
  };
}

// ── Cardiac drift: alleen als eerste/tweede-helft HR beschikbaar is ──
export function cardiacDrift(w) {
  if (w?.hrFirstHalf != null && w?.hrSecondHalf != null) {
    return { drift: Math.round(w.hrSecondHalf - w.hrFirstHalf), source: 'halves' };
  }
  if (Array.isArray(w?.splits) && w.splits.length >= 4) {
    const hrs = w.splits.map(s => s.hr).filter(h => h != null);
    if (hrs.length >= 4) {
      const half = Math.floor(hrs.length / 2);
      const a = hrs.slice(0, half), b = hrs.slice(half);
      const avg = (x) => x.reduce((s, v) => s + v, 0) / x.length;
      return { drift: Math.round(avg(b) - avg(a)), source: 'splits' };
    }
  }
  return null;
}

// ── Adaptieve log: levende trainingshistorie per sessie ─────────
// entry = { id, date, sessionNr, event, note }
// events: 'planned' | 'done_full' | 'done_modified' | 'stopped' | 'repeated'
//         'deload' | 'swap' | 'tolerated' | 'poorly_tolerated' | 'released'
export function loadAdaptiveLog() {
  try { return JSON.parse(localStorage.getItem(ADAPTIVE_LOG_KEY) || '[]'); } catch { return []; }
}

export function logAdaptiveEvent(entry) {
  const arr = loadAdaptiveLog();
  arr.unshift({ id: `ae_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...entry });
  localStorage.setItem(ADAPTIVE_LOG_KEY, JSON.stringify(arr.slice(0, 400)));
}

export function adaptiveHistoryForSession(nr) {
  return loadAdaptiveLog()
    .filter(e => Number(e.sessionNr) === Number(nr))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Sessiestatus voor het trainingsplan ─────────────────────────
// 'done' | 'current' | 'todo' | 'repeated' | 'modified' | 'skipped'
export function sessionStatus(nr, logs, currentNr) {
  const ws = workoutsForSession(nr);
  const logDone = Object.values(logs || {}).some(l => l.run_done && Number(l.run_session) === Number(nr));
  const events = adaptiveHistoryForSession(nr);
  if (ws.some(w => w.completedAsPlanned === 'full') || (logDone && !ws.length)) {
    return ws.length > 1 || events.some(e => e.event === 'repeated') ? 'repeated-done' : 'done';
  }
  if (ws.some(w => w.completedAsPlanned === 'modified')) return 'modified';
  if (ws.some(w => w.completedAsPlanned === 'stopped')) return 'stopped';
  if (events.some(e => e.event === 'skipped')) return 'skipped';
  if (Number(nr) === Number(currentNr)) return 'current';
  return 'todo';
}

// ── Lokaal coach-oordeel (regel-gebaseerd; werkt zonder AI) ─────
// Gebruikt alleen data die er echt is — geen schijnprecisie.
export function localVerdict(w, plannedRun) {
  const parts = [];
  const facts = [];
  if (w.distance) facts.push(`${w.distance} km`);
  if (w.duration) facts.push(`${w.duration} min`);
  const pace = w.averagePace || computePace(w.distance, w.duration);
  if (pace) facts.push(`${pace}/km`);
  if (w.averageHR) facts.push(`gem. HR ${w.averageHR}`);
  if (facts.length) parts.push(`Je liep ${facts.join(' · ')}.`);

  if (w.averageHR != null) {
    if (w.averageHR <= 132 && w.averageHR >= 100) {
      parts.push('Je hartslag bleef binnen het aerobe doel (zone B, 106–132) — dat is precies waar deze fase om draait.');
    } else if (w.averageHR > 132) {
      parts.push(`Gemiddelde HR ${w.averageHR} ligt boven zone B (max 132). Volgende keer eerder wandelen — tempo is bijzaak.`);
    } else {
      parts.push('Rustige hartslag — prima als dit een herstel- of wandelsessie was.');
    }
    const drift = cardiacDrift(w);
    if (drift && drift.drift >= 5) {
      parts.push(`In de tweede helft liep je HR ~${drift.drift} slagen op bij vergelijkbaar tempo — mogelijk cardiac drift/vermoeidheid. Geen reden om te stoppen met opbouwen, maar ik wil eerst je 24-uursrespons zien.`);
    }
  }

  if (plannedRun && w.duration) {
    const ratio = w.duration / plannedRun.duration;
    if (ratio >= 0.9 && ratio <= 1.2) parts.push('De omvang paste bij de geplande sessie.');
    else if (ratio < 0.9) parts.push('Korter dan gepland — helemaal ok als dat een bewuste aanpassing was.');
    else parts.push('Langer dan gepland — let extra op je herstel de komende twee dagen.');
  }

  if (w.rpe != null) {
    if (w.rpe <= 4) parts.push(`RPE ${w.rpe}/10 — de belasting tijdens de training lijkt passend.`);
    else if (w.rpe <= 6) parts.push(`RPE ${w.rpe}/10 — stevig maar acceptabel.`);
    else parts.push(`RPE ${w.rpe}/10 is hoog voor een aerobe sessie — de volgende sessie bouwen we niet automatisch op.`);
  }
  if (w.legs === 'zwaar') parts.push('Zware benen gemeld — dat weegt mee in de volgende beslissing.');
  if (w.completedAsPlanned === 'stopped') parts.push('Je bent gestopt — goed geluisterd naar je lichaam.');

  parts.push('Ik bepaal pas na je vertraagde herstelcheck (morgenochtend) of de volgende sessie wordt vrijgegeven.');
  return parts.join(' ');
}

// ── ACTUAL vs PLAN totalen ──────────────────────────────────────
export function actualTotals(logs) {
  const ws = loadWorkouts().filter(w => w.activityType === 'run' || w.activityType == null);
  const actualKm = ws.reduce((s, w) => s + (parseFloat(w.distance) || 0), 0);
  const actualMin = ws.reduce((s, w) => s + (parseFloat(w.duration) || 0), 0);
  // sessies met run_done maar zonder WorkoutResult → schatting uit plan
  const wsNrs = new Set(ws.map(w => Number(w.plannedSessionId)).filter(Boolean));
  const planOnly = Object.values(logs || {})
    .filter(l => l.run_done && l.run_session && !wsNrs.has(Number(l.run_session)));
  const estKm = planOnly.reduce((s, l) => {
    const run = RUNS.find(r => r.nr === Number(l.run_session));
    return s + (run ? parseFloat(run.km_estimate) || 0 : 0);
  }, 0);
  return {
    actualKm: +actualKm.toFixed(1), actualMin: Math.round(actualMin),
    actualCount: ws.length,
    estKm: +estKm.toFixed(1), estCount: planOnly.length,
  };
}

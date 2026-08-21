// Performance-indicatoren voor de Vandaag-strip.
// Regel: alleen een percentage tonen als er een verdedigbare berekening
// achter zit én genoeg data. Anders null → de UI toont een streepje.

import { loadWorkouts, toleranceFor } from './workouts';
import { loadStrengthSessions } from './data/strengthSchema';
import { goalTarget } from './goals';
import { USER } from './config';
import { todayLocal } from './datetime';
import { activeRunGoals } from './runGoalModel';
import { allRunGoalStatuses } from './runGoalStatus';

function pastDates(currentDate, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ── HERSTEL ─────────────────────────────────────────────────────
// Gewogen uit slaapkwaliteit, energie, herstelgevoel en symptoomlast
// over de laatste 3 dagen. Vereist minstens 2 ingevulde dagen.
export function recoveryScore(logs, currentDate) {
  const days = pastDates(currentDate, 3).map(d => logs?.[d]).filter(Boolean);
  const filled = days.filter(l =>
    l.sleep_quality != null || l.energy != null || l.training_recovery != null);
  if (filled.length < 2) return { value: null, reason: 'te weinig check-ins' };

  let total = 0, weight = 0;
  for (const l of filled) {
    if (l.sleep_quality != null)     { total += (l.sleep_quality / 3) * 30; weight += 30; }
    if (l.energy != null)            { total += (l.energy / 3) * 30;        weight += 30; }
    if (l.training_recovery != null) { total += (1 - l.training_recovery / 2) * 25; weight += 25; }
    const symptoms = [l.symptom_pem, l.symptom_exhaustion, l.symptom_breathless,
      l.symptom_brainfog, l.symptom_pain].filter(Boolean).length;
    total += Math.max(0, 1 - symptoms / 3) * 15; weight += 15;
  }
  if (!weight) return { value: null, reason: 'te weinig data' };
  return { value: Math.round((total / weight) * 100), n: filled.length };
}

// ── RUN BUILD ───────────────────────────────────────────────────
// Hoe ver ben je richting je loopdoel?
//
// Hier stond het hoogste afgevinkte sessienummer gedeeld door 35. Dat mat
// niet je opbouw maar je positie in een lijstje: één sessie overslaan zette
// de balk stil, en een sessie van tien minuten telde even zwaar als een van
// veertig. Erger nog, het suggereerde dat er een eindpunt op nummer 35 lag.
//
// Wat er nu staat is de afstandsdekking uit distanceCoverage: hoeveel van de
// doelafstand je al goed verdragen hebt uitgelopen. Dat beweegt alleen als je
// werkelijk verder komt, en het hoort bij een doel dat jij hebt gesteld.
export function runBuildScore(logs, currentDate = todayLocal()) {
  const goals = activeRunGoals({ currentDate });
  if (!goals.length) return { value: 0, label: 'nog geen loopdoel' };

  const { driving } = allRunGoalStatuses({ goals, logs: logs || {}, currentDate });
  const cov = driving?.coverage;
  if (!cov?.available) {
    return { value: 0, label: driving?.goal?.name || 'nog geen gemeten run' };
  }
  return {
    value: Math.min(100, cov.pct),
    label: `${cov.tolerated} van ${driving.goal.distanceKm} km`,
  };
}

// ── SHAPE ───────────────────────────────────────────────────────
// Voortgang naar het ingestelde gewichtsdoel; alleen met een start-
// en huidige meting. Doel komt uit de goal engine, niet uit code.
export function shapeScore(logs) {
  const weights = Object.values(logs || {}).filter(l => l.weight)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!weights.length) return { value: null, reason: 'geen weging' };
  const now = weights[weights.length - 1].weight;
  const start = USER.startWeight;
  const target = parseFloat(goalTarget('BODY', 'weight', USER.goalWeight));
  if (!target || start === target) return { value: null, reason: 'geen doel ingesteld' };
  const pct = ((start - now) / (start - target)) * 100;
  return { value: Math.round(Math.max(0, Math.min(100, pct))), label: `${now} kg` };
}

// ── CAPACITEIT ──────────────────────────────────────────────────
// Woordwaarde in plaats van percentage: dagcapaciteit, energie en
// recente belasting samen.
export function capacityLevel(log, logs, currentDate) {
  if (log?.day_capacity === 'herstel') return { word: 'herstel', color: 'var(--blue)' };
  if (log?.day_capacity === 'minimum') return { word: 'laag', color: 'var(--rust)' };
  if (log?.day_capacity === 'hoog')    return { word: 'hoog', color: 'var(--green)' };

  const e = log?.energy;
  if (e == null) return { word: '—', color: 'var(--ghost)' };
  const recentTrain = pastDates(currentDate, 4)
    .map(d => logs?.[d])
    .filter(l => l && (l.run_done || l.strength_done || l.core_done)).length;
  if (e >= 3 && recentTrain < 3) return { word: 'hoog',   color: 'var(--green)' };
  if (e <= 1 || recentTrain >= 4) return { word: 'laag',   color: 'var(--rust)' };
  return { word: 'medium', color: 'var(--gold)' };
}

// ── FRESHNESS (Progressie) ──────────────────────────────────────
export function strengthTrendDirection() {
  const sessions = loadStrengthSessions().filter(s => s.program !== 'snack');
  if (sessions.length < 2) return null;
  const vol = (s) => (s.exercises || []).reduce((v, e) =>
    v + (parseFloat(e.weight) || 0) * (parseInt(e.sets, 10) || 0) * (parseInt(e.reps, 10) || 0), 0);
  const recent = sessions.slice(0, Math.ceil(sessions.length / 2)).map(vol);
  const older  = sessions.slice(Math.ceil(sessions.length / 2)).map(vol);
  const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const r = avg(recent), o = avg(older);
  if (!r || !o) return null;
  return r > o * 1.05 ? 'up' : r < o * 0.95 ? 'down' : 'flat';
}

// ── Wekelijkse trainingsbelasting (voor grafiek) ────────────────
export function weeklyLoad(logs, currentDate, weeks = 6) {
  const monday = (() => {
    const d = new Date(currentDate + 'T12:00:00');
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    return d;
  })();
  const workouts = loadWorkouts();
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const mon = new Date(monday); mon.setDate(monday.getDate() - i * 7);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const ms = mon.toISOString().slice(0, 10), ss = sun.toISOString().slice(0, 10);
    const minutes = workouts
      .filter(w => w.date >= ms && w.date <= ss)
      .reduce((s, w) => s + (parseFloat(w.duration) || 0), 0);
    const sessions = Object.values(logs || {})
      .filter(l => l.date >= ms && l.date <= ss && (l.run_done || l.strength_done || l.core_done)).length;
    out.push({ label: ms.slice(5), minutes: Math.round(minutes), sessions });
  }
  return out;
}

// ── Tolerantie-overzicht: hoeveel sessies goed verdragen ────────
export function toleranceSummary(logs) {
  const runs = loadWorkouts().filter(w => w.activityType === 'run' || w.activityType == null);
  let good = 0, poor = 0, pending = 0;
  for (const w of runs) {
    const t = toleranceFor(w, logs);
    if (t === 'good') good++; else if (t === 'poor') poor++; else pending++;
  }
  return { good, poor, pending, total: runs.length };
}

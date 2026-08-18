import { RUNS } from './data/runningSchema';

export const DECISIONS = ['BUILD', 'HOLD', 'REPEAT', 'DELOAD', 'SWAP', 'TEST'];

export function getWorkoutResults() {
  try { return JSON.parse(localStorage.getItem('gc_workout_results') || '[]'); } catch { return []; }
}

export function saveWorkoutResult(result) {
  const items = getWorkoutResults().filter(r => r.id !== result.id);
  const next = [{ ...result, updated_at: new Date().toISOString() }, ...items].slice(0, 200);
  localStorage.setItem('gc_workout_results', JSON.stringify(next));
  return next;
}

export function nextRunNumber(results = getWorkoutResults()) {
  const actualRuns = results.filter(r => r.status === 'ACTUAL' && Number.isFinite(Number(r.run_nr)));
  if (!actualRuns.length) return 1;
  const latest = [...actualRuns].sort((a, b) => (b.completed_at || b.date || '').localeCompare(a.completed_at || a.date || ''))[0];
  const n = Number(latest.run_nr);
  switch (latest.decision) {
    case 'BUILD': return Math.min(35, n + 1);
    case 'REPEAT': return n;
    case 'DELOAD': return Math.max(1, n - 1);
    case 'TEST': return n;
    case 'HOLD': return n;
    case 'SWAP': return n;
    default: return Math.min(35, n + 1);
  }
}

export function getRun(n) {
  return RUNS.find(r => r.nr === Number(n)) || RUNS[0];
}

export function evaluateWorkout(result) {
  const rpe = Number(result.rpe || 0);
  const symptomsNow = Number(result.symptoms_now || 0);
  const symptomsLater = Number(result.symptoms_24_48h || 0);
  const recovery = result.recovered_24_48h;
  const completed = result.completed !== false;
  const hrUnexpected = result.hr_unexpected === true;
  const pain = Number(result.pain || 0);

  // Decision order is intentionally conservative: delayed symptom response outranks performance.
  if (symptomsLater >= 4 || recovery === 'worse' || pain >= 5) {
    return { decision: 'DELOAD', reason: 'De reactie na de training is te zwaar om nu op te bouwen. Eerst belasting verlagen.' };
  }
  if (!completed || symptomsNow >= 4 || hrUnexpected) {
    return { decision: 'SWAP', reason: 'De geplande sessie paste niet goed bij vandaag. Kies een lichtere of andere trainingsprikkel.' };
  }
  if (recovery == null || recovery === '' || result.feedback_complete !== true) {
    return { decision: 'HOLD', reason: 'Nog geen definitief opbouwbesluit: eerst de reactie over 24–48 uur meenemen.' };
  }
  if (symptomsLater >= 2 || recovery === 'same' || rpe >= 8) {
    return { decision: 'REPEAT', reason: 'De sessie is gedaan, maar er is nog onvoldoende marge om de trainingsprikkel te verhogen.' };
  }
  if (rpe <= 6 && symptomsNow <= 1 && symptomsLater <= 1 && recovery === 'good') {
    return { decision: 'BUILD', reason: 'Training én herstelrespons laten voldoende marge zien om één stap op te bouwen.' };
  }
  return { decision: 'HOLD', reason: 'Behoud de huidige belasting totdat de respons consistenter is.' };
}

export function decisionForResult(result) {
  if (DECISIONS.includes(result?.decision)) return { decision: result.decision, reason: result.decision_reason || '' };
  return evaluateWorkout(result || {});
}

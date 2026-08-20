// Racedoelen als echte doelen.
//
// Wat hier fout zat, zat er dubbel fout. Het doel "5 km in 35:00" stond in
// de doelenlijst als metric `pace_easy` — "Easy tempo, 7 min/km". Daarmee
// werd een wedstrijddoel gemodelleerd als een rustig trainingstempo, en die
// twee hebben niets met elkaar te maken. Racetempo is waar je naartoe
// werkt; easy pace is wat je lichaam vandaag rustig aankan.
//
// Een RaceGoal is dus: een afstand, een gewenste eindtijd, een datum en een
// soort doel. Het tempo is een uitkomst van de eerste twee — je rekent het
// niet zelf uit en het wordt nooit los opgeslagen, want dan kunnen ze uit
// elkaar lopen.
//
//   5 km  + 35:00 → 7:00/km
//   5 km  + 30:00 → 6:00/km
//   5 km  + 25:00 → 5:00/km
//   10 km + 65:00 → 6:30/km

import { todayLocal, daysBetween } from './datetime';
import { paceFromGoal, timeFromPace, fmtSec, fmtPaceSec, parseTime, secToPace } from './sessionMath';

const KEY = 'gc_race_goals';

// ── Soorten doelen ──────────────────────────────────────────────
export const GOAL_TYPE = {
  CHECKPOINT: { id: 'CHECKPOINT', label: 'Checkpoint',
    meaning: 'Een peiling onderweg. Uitlopen telt als geslaagd.' },
  TARGET: { id: 'TARGET', label: 'Doel',
    meaning: 'Hier werk je naartoe. De opbouw richt zich hierop.' },
  STRETCH: { id: 'STRETCH', label: 'Stretch',
    meaning: 'Alleen bij een gunstig verloop. Als het niet lukt, schuift het doel — niet de opbouw.' },
  LONG_TERM: { id: 'LONG_TERM', label: 'Lange termijn',
    meaning: 'Ver weg genoeg om de opbouw richting te geven zonder hem te haasten.' },
};

export const GOAL_TYPES = Object.values(GOAL_TYPE);

// ── De doelen zoals ze nu staan ─────────────────────────────────
// Datum, afstand en eindtijd. Verder niets: het tempo volgt.
export const DEFAULT_GOALS = [
  {
    id: 'okt3', name: 'Trail 5 km',
    distanceKm: 5, targetTimeSec: 35 * 60, date: '2026-10-03',
    type: 'CHECKPOINT', priority: 1, enabled: true,
    terrain: 'trail',
    note: 'Checkpoint, geen eindexamen. Uitlopen binnen je hartslagband telt als geslaagd.',
  },
  {
    id: 'okt31', name: 'Bereloop Terschelling 10 km',
    distanceKm: 10, targetTimeSec: 65 * 60, date: '2026-10-31',
    type: 'STRETCH', priority: 2, enabled: true,
    terrain: 'beach',
    note: 'Stretchdoel. Blijft alleen staan als de voorwaarden gehaald worden.',
  },
];

// ── Afleiden, nooit opslaan ─────────────────────────────────────
export function hydrate(goal) {
  const targetPaceSecPerKm = paceFromGoal(goal);
  return {
    ...goal,
    targetPaceSecPerKm,
    // Leesbaar, en de vormen die de rest van de app al gebruikt.
    targetTimeLabel: fmtSec(goal.targetTimeSec),
    targetPaceLabel: fmtPaceSec(targetPaceSecPerKm),
    targetMinutes: goal.targetTimeSec != null ? goal.targetTimeSec / 60 : null,
    targetPace: targetPaceSecPerKm != null ? secToPace(targetPaceSecPerKm) : null,
    kind: goal.type === 'STRETCH' ? 'stretch'
      : goal.type === 'CHECKPOINT' ? 'checkpoint' : 'target',
  };
}

function loadRaw() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(saved)) return saved;
    // Oudere opslag was een overrides-object per id.
    if (saved && typeof saved === 'object') {
      return DEFAULT_GOALS.map(g => ({ ...g, ...(saved[g.id] || {}) }));
    }
  } catch { /* val terug op de standaard */ }
  // Kopieën, geen verwijzingen. Zonder deze regel schrijft saveRaceGoal in
  // DEFAULT_GOALS zelf, en geeft "terug naar standaard" je bewerkte waarden
  // terug in plaats van de standaard.
  return DEFAULT_GOALS.map(g => ({ ...g }));
}

export function loadRaceGoals({ includeDisabled = true } = {}) {
  return loadRaw()
    .map(hydrate)
    .filter(g => includeDisabled || g.enabled !== false)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') ||
      (a.priority ?? 9) - (b.priority ?? 9));
}

function persist(list) {
  // Afgeleide velden gaan er weer af: alleen de invoer wordt bewaard.
  const clean = list.map(({ targetPaceSecPerKm, targetTimeLabel, targetPaceLabel,
    targetMinutes, targetPace, kind, ...rest }) => rest);
  localStorage.setItem(KEY, JSON.stringify(clean));
  return loadRaceGoals();
}

// ── Bewerken ────────────────────────────────────────────────────
// `targetTime` mag "35:00", "1:05:00" of een aantal minuten zijn.
export function saveRaceGoal(patch) {
  const list = loadRaw();
  const id = patch.id || `race_${Date.now()}`;
  const next = { ...patch, id };

  if (patch.targetTime != null) {
    next.targetTimeSec = parseTime(patch.targetTime);
    delete next.targetTime;
  }
  // Het tempo is nooit invoer.
  delete next.targetPaceSecPerKm;
  delete next.targetPace;

  const idx = list.findIndex(g => g.id === id);
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push({ type: 'TARGET', priority: list.length + 1, enabled: true, ...next });
  return persist(list);
}

export function deleteRaceGoal(id) {
  return persist(loadRaw().filter(g => g.id !== id));
}

export function resetRaceGoals() {
  localStorage.removeItem(KEY);
  return loadRaceGoals();
}

// ── Validatie ───────────────────────────────────────────────────
export function validateRaceGoal(g) {
  const problems = [];
  const d = Number(g?.distanceKm), t = Number(g?.targetTimeSec);
  if (!d || d <= 0) problems.push({ field: 'distanceKm', problem: 'afstand ontbreekt' });
  if (!t || t <= 0) problems.push({ field: 'targetTimeSec', problem: 'eindtijd ontbreekt' });
  if (!g?.date) problems.push({ field: 'date', problem: 'datum ontbreekt' });
  if (g?.type && !GOAL_TYPE[g.type]) {
    problems.push({ field: 'type', problem: `onbekend type ${g.type}` });
  }
  if (d && t) {
    const pace = paceFromGoal({ distanceKm: d, targetTimeSec: t });
    // Onder 2:30/km loopt niemand een wedstrijd; boven 20:00/km is het geen
    // hardlopen meer. Dit vangt tikfouten, geen ambitie.
    if (pace < 150) problems.push({ field: 'targetTimeSec',
      problem: `${fmtPaceSec(pace)}/km — sneller dan een wereldrecord, klopt de eindtijd?` });
    if (pace > 1200) problems.push({ field: 'targetTimeSec',
      problem: `${fmtPaceSec(pace)}/km — dat is wandeltempo, klopt de afstand?` });
    // Tijd en tempo moeten elkaar heen en terug opleveren.
    const back = timeFromPace({ distanceKm: d, paceSecPerKm: pace });
    if (Math.abs(back - t) > d) {
      problems.push({ field: 'targetTimeSec', problem: 'tijd en tempo lopen uiteen' });
    }
  }
  return problems;
}

// ── Een voorbeeld doorrekenen, voor de invoer ───────────────────
// Zodat het scherm meteen kan tonen wat je invoer betekent.
export function previewGoal({ distanceKm, targetTime }) {
  const sec = parseTime(targetTime);
  const pace = paceFromGoal({ distanceKm, targetTimeSec: sec });
  if (pace == null) return null;
  return {
    distanceKm: Number(distanceKm),
    targetTimeSec: sec,
    targetTimeLabel: fmtSec(sec),
    targetPaceSecPerKm: pace,
    targetPaceLabel: fmtPaceSec(pace),
    text: `${distanceKm} km in ${fmtSec(sec)} is ${fmtPaceSec(pace)}/km`,
  };
}

// ── De agenda ───────────────────────────────────────────────────
export function upcomingGoals(currentDate = todayLocal()) {
  return loadRaceGoals({ includeDisabled: false })
    .filter(g => g.date >= currentDate)
    .map(g => ({ ...g, daysOut: daysBetween(currentDate, g.date),
      weeksOut: +(daysBetween(currentDate, g.date) / 7).toFixed(2) }))
    .sort((a, b) => a.daysOut - b.daysOut || a.priority - b.priority);
}

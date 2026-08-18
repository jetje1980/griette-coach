// Krachttraining: twee basisprogramma's (A/B) + strength snack.
// Bewegingspatronen: squat/lunge · hinge · glutes · push · pull · core/carry · calves/feet
// Historie per oefening in localStorage (gc_strength_sessions) + progressive-overloadadvies.

export const PATTERN_LABELS = {
  squat:  'Squat/Lunge',
  hinge:  'Hinge',
  glutes: 'Hip thrust/Glutes',
  push:   'Push',
  pull:   'Pull',
  core:   'Core/Carry',
  calves: 'Calves/Feet',
};

export const PROGRAM_A = {
  id: 'A',
  name: 'Kracht A — Fundament',
  emoji: '🅰️',
  exercises: [
    { id: 'a_squat',  pattern: 'squat',  name: 'Goblet squat',            cue: 'Dumbbell voor de borst, diep en gecontroleerd', defaultSets: 3, defaultReps: 10, bodyweight: false },
    { id: 'a_hinge',  pattern: 'hinge',  name: 'Romanian deadlift (DB)',  cue: 'Heup naar achter, rug lang, stretch in hamstrings', defaultSets: 3, defaultReps: 10, bodyweight: false },
    { id: 'a_glutes', pattern: 'glutes', name: 'Hip thrust',              cue: 'Schouders op bank/verhoging, boven 1s knijpen', defaultSets: 3, defaultReps: 12, bodyweight: false },
    { id: 'a_push',   pattern: 'push',   name: 'Push-up',                 cue: 'Op knieën of tenen — volledige range', defaultSets: 3, defaultReps: 8, bodyweight: true },
    { id: 'a_pull',   pattern: 'pull',   name: 'Dumbbell row',            cue: 'Eén arm, steun op bank, elleboog langs het lijf', defaultSets: 3, defaultReps: 10, bodyweight: false },
    { id: 'a_core',   pattern: 'core',   name: 'Dead bug',                cue: 'Onderrug op de grond gedrukt houden', defaultSets: 3, defaultReps: 10, bodyweight: true },
    { id: 'a_calves', pattern: 'calves', name: 'Calf raise (staand)',     cue: 'Volledige range, boven 1s vasthouden', defaultSets: 3, defaultReps: 15, bodyweight: true },
  ],
};

export const PROGRAM_B = {
  id: 'B',
  name: 'Kracht B — Balans',
  emoji: '🅱️',
  exercises: [
    { id: 'b_lunge',  pattern: 'squat',  name: 'Split squat',             cue: 'Achterste knie richting grond, romp rechtop', defaultSets: 3, defaultReps: 8, bodyweight: false },
    { id: 'b_hinge',  pattern: 'hinge',  name: 'Kettlebell deadlift',     cue: 'KB tussen de voeten, heupen duwen door', defaultSets: 3, defaultReps: 10, bodyweight: false },
    { id: 'b_glutes', pattern: 'glutes', name: 'Single-leg glute bridge', cue: 'Eén been, heup hoog, bekken stabiel', defaultSets: 3, defaultReps: 10, bodyweight: true },
    { id: 'b_push',   pattern: 'push',   name: 'Shoulder press (DB)',     cue: 'Zittend of staand, core aangespannen', defaultSets: 3, defaultReps: 10, bodyweight: false },
    { id: 'b_pull',   pattern: 'pull',   name: 'Band pull-apart / row',   cue: 'Schouderbladen naar elkaar, langzaam terug', defaultSets: 3, defaultReps: 12, bodyweight: false },
    { id: 'b_carry',  pattern: 'core',   name: 'Farmer carry',            cue: 'Zwaar gewicht per hand, 30–40m rechtop lopen', defaultSets: 3, defaultReps: 1, bodyweight: false, repsLabel: 'lengtes' },
    { id: 'b_feet',   pattern: 'calves', name: 'Tenenheffen + voetboog',  cue: 'Voeten sterk maken voor het hardlopen', defaultSets: 3, defaultReps: 12, bodyweight: true },
  ],
};

// 5–10 min voor drukke dagen. GEEN vervanging van progressieve krachttraining.
export const STRENGTH_SNACK = {
  id: 'snack',
  name: 'Strength Snack — 5–10 min',
  emoji: '⚡',
  note: 'Voor drukke dagen. Dit vervangt geen volledige progressieve krachttraining.',
  exercises: [
    { id: 's_squat',  pattern: 'squat',  name: 'Squats (lichaamsgewicht)', cue: '15 herhalingen, rustig tempo', defaultSets: 1, defaultReps: 15, bodyweight: true },
    { id: 's_push',   pattern: 'push',   name: 'Push-ups',                 cue: '8 herhalingen (knie-variant ok)', defaultSets: 1, defaultReps: 8, bodyweight: true },
    { id: 's_glutes', pattern: 'glutes', name: 'Glute bridge',             cue: '15 herhalingen, boven knijpen', defaultSets: 1, defaultReps: 15, bodyweight: true },
    { id: 's_core',   pattern: 'core',   name: 'Plank',                    cue: '30–45 seconden', defaultSets: 1, defaultReps: 1, bodyweight: true, repsLabel: 'holds' },
  ],
};

export const PROGRAMS = { A: PROGRAM_A, B: PROGRAM_B, snack: STRENGTH_SNACK };

export function allExercises() {
  return [...PROGRAM_A.exercises, ...PROGRAM_B.exercises, ...STRENGTH_SNACK.exercises];
}

export function findExercise(exId) {
  return allExercises().find(e => e.id === exId) || null;
}

// ── Opslag ──────────────────────────────────────────────────────
const SESSIONS_KEY = 'gc_strength_sessions';

export function loadStrengthSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; }
}

export function saveStrengthSessions(arr) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(arr));
}

// session = { id, date, program, exercises: [{ id, weight, sets, reps, rir, done }] }
export function upsertStrengthSession(session) {
  const sessions = loadStrengthSessions();
  const idx = sessions.findIndex(s => s.date === session.date && s.program === session.program);
  if (idx >= 0) sessions[idx] = { ...sessions[idx], ...session };
  else sessions.unshift(session);
  sessions.sort((a, b) => b.date.localeCompare(a.date));
  saveStrengthSessions(sessions);
  return sessions;
}

export function getSessionFor(date, program) {
  return loadStrengthSessions().find(s => s.date === date && s.program === program) || null;
}

// Laatste geregistreerde prestatie voor een oefening (nieuwste eerst)
export function lastPerformance(exId, beforeDate = null) {
  const sessions = loadStrengthSessions();
  for (const s of sessions) {
    if (beforeDate && s.date >= beforeDate) continue;
    const entry = (s.exercises || []).find(e => e.id === exId && (e.done || e.weight || e.reps));
    if (entry) return { ...entry, date: s.date };
  }
  return null;
}

export function exerciseHistory(exId, limit = 10) {
  const out = [];
  for (const s of loadStrengthSessions()) {
    const entry = (s.exercises || []).find(e => e.id === exId);
    if (entry && (entry.done || entry.weight || entry.reps)) out.push({ ...entry, date: s.date });
    if (out.length >= limit) break;
  }
  return out;
}

// Welk programma is aan de beurt? (A ↔ B afwisselend, snack telt niet mee)
export function suggestedProgram() {
  const last = loadStrengthSessions().find(s => s.program === 'A' || s.program === 'B');
  if (!last) return 'A';
  return last.program === 'A' ? 'B' : 'A';
}

// ── Progressive overload advies ─────────────────────────────────
// Vorige keer: goblet squat 8 kg, 3×10, RIR 3 → Voorstel: 9 kg 3×8–10 OF 8 kg 3×11.
export function overloadAdvice(exercise, last) {
  if (!last) {
    return exercise.bodyweight
      ? `Eerste keer — start met ${exercise.defaultSets}×${exercise.defaultReps}, houd 2–3 reps reserve (RIR 2–3).`
      : `Eerste keer — kies een gewicht waarmee ${exercise.defaultReps} herhalingen lukken met 2–3 reps reserve (RIR 2–3).`;
  }
  const w    = parseFloat(last.weight) || 0;
  const reps = parseInt(last.reps, 10) || exercise.defaultReps;
  const sets = parseInt(last.sets, 10) || exercise.defaultSets;
  const rir  = last.rir != null ? Number(last.rir) : null;
  const prev = w > 0
    ? `Vorige keer: ${w} kg, ${sets}×${reps}${rir != null ? `, RIR ${rir}` : ''}.`
    : `Vorige keer: ${sets}×${reps}${rir != null ? `, RIR ${rir}` : ''} (lichaamsgewicht).`;

  if (last.done === false) {
    return `${prev} Niet afgemaakt — herhaal hetzelfde, eventueel ${Math.max(5, reps - 2)} reps per set.`;
  }
  if (rir == null) {
    return `${prev} Herhaal en noteer je RIR, dan kan ik gericht adviseren.`;
  }
  if (rir >= 3) {
    if (w > 0) {
      return `${prev} Voorstel: ${w + 1} kg ${sets}×${Math.max(6, reps - 2)}–${reps} OF ${w} kg ${sets}×${reps + 1}.`;
    }
    return `${prev} Voorstel: ${sets}×${reps + 2} OF een zwaardere variant (bijv. voeten verhoogd / extra gewicht).`;
  }
  if (rir >= 1) {
    return `${prev} Houd dit — zelfde ${w > 0 ? 'gewicht' : 'variant'}, probeer alle sets strak op ${reps}${rir === 2 ? ` of ${reps + 1}` : ''} reps.`;
  }
  // RIR 0 — te zwaar
  if (w > 0) {
    return `${prev} RIR 0 is te zwaar voor herstel — terug naar ${Math.max(1, w - 1)} kg of ${Math.max(5, reps - 2)} reps.`;
  }
  return `${prev} RIR 0 is te zwaar — doe ${Math.max(5, reps - 3)} reps of een lichtere variant.`;
}

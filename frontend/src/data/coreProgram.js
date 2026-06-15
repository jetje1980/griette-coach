// Core-programma 10 weken, 5 dagen/week
// Fases: foundation → build → strengthen → define → peak
// Oefeningen: plank, dead bug, glute bridge, side plank, russian twist, hollow hold, V-ups

const W = (plank, db, gb, sp, rt, hh, vu) => ({ plank, deadBug: db, gluteBridge: gb, sidePlank: sp, russianTwist: rt, hollowHold: hh, vUps: vu });

// [week] → oefening-sets per dag
const PHASES = {
  foundation: W('20s', '6 reps', '10 reps', '15s', null, null, null),
  build:       W('30s', '8 reps', '12 reps', '20s', '8 reps', null, null),
  strengthen:  W('40s', '10 reps', '15 reps', '25s', '10 reps', '15s', null),
  define:      W('50s', '12 reps', '20 reps', '30s', '12 reps', '20s', '8 reps'),
  peak:        W('60s', '15 reps', '25 reps', '40s', '15 reps', '30s', '10 reps'),
};

const PHASE_NAMES = {
  foundation: 'Foundation',
  build:      'Build',
  strengthen: 'Strengthen',
  define:     'Define',
  peak:       'Peak',
};

function phaseForWeek(week) {
  if (week <= 2) return 'foundation';
  if (week <= 4) return 'build';
  if (week <= 6) return 'strengthen';
  if (week <= 8) return 'define';
  return 'peak';
}

export function getCoreForWeek(week) {
  const phase = phaseForWeek(week);
  const sets = PHASES[phase];
  const exercises = [];

  if (sets.plank)        exercises.push({ name: 'Plank',          duration: sets.plank,        sets: 3, emoji: '🧱' });
  if (sets.deadBug)      exercises.push({ name: 'Dead bug',        reps: sets.deadBug,          sets: 3, emoji: '🐛' });
  if (sets.gluteBridge)  exercises.push({ name: 'Glute bridge',    reps: sets.gluteBridge,      sets: 3, emoji: '🌉' });
  if (sets.sidePlank)    exercises.push({ name: 'Side plank',      duration: sets.sidePlank,    sets: 2, emoji: '↔️' });
  if (sets.russianTwist) exercises.push({ name: 'Russian twist',   reps: sets.russianTwist,     sets: 3, emoji: '🔄' });
  if (sets.hollowHold)   exercises.push({ name: 'Hollow hold',     duration: sets.hollowHold,   sets: 3, emoji: '🍌' });
  if (sets.vUps)         exercises.push({ name: 'V-ups',           reps: sets.vUps,             sets: 3, emoji: '⬆️' });

  return { phase: PHASE_NAMES[phase], exercises };
}

// Geef aan hoeveel weken de gebruiker bezig is op basis van startdatum
export function coreWeekFromDate(startDate, today = new Date()) {
  const start = new Date(startDate);
  const diffDays = Math.floor((today - start) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

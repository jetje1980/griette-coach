// Eén antwoord op de vraag "wat is er die dag met training gebeurd?".
//
// Voorheen beantwoordde elk scherm die vraag zelf, en elk scherm keek naar
// een andere bron. De weekkalender keek uitsluitend naar `run_done` in de
// daglog. Een run die als WorkoutResult bestond — handmatig ingevoerd, uit
// een screenshot gehaald of via Strava binnengekomen — telde daar niet mee.
// En omdat er geen enkele regel naar de datum keek, bleef een dinsdag die
// allang voorbij was gewoon "Gepland" tonen.
//
// Alles loopt nu via resolveTrainingDayStatus(). Die combineert:
//   · bevestigde WorkoutResults (elke bron)
//   · Strava-activiteiten die als workout zijn ingelezen
//   · run_done / run_session uit de daglog
//   · het dagplan (gepland type training, of expliciete rustdag)
//   · de kalenderdatum ten opzichte van vandaag
//
// Een datum in het verleden kan nooit PLANNED zijn.

import { RUNS } from './data/runningSchema';
import { loadWorkouts, toleranceFor, fmtPace, paceToMin } from './workouts';
import { loadStrengthSessions } from './data/strengthSchema';
import { todayLocal, isPast, isToday, isFuture, addDays, dayNameShort } from './datetime';

export const STATUS = {
  DONE: 'DONE',
  PLANNED_TODAY: 'PLANNED_TODAY',
  PLANNED_FUTURE: 'PLANNED_FUTURE',
  MISSED: 'MISSED',
  REST: 'REST',
  RECOVERY: 'RECOVERY',
  EMPTY: 'EMPTY',
};

export const STATUS_META = {
  DONE:           { label: '✓ Gedaan',      color: 'var(--sage)',  weight: 800 },
  PLANNED_TODAY:  { label: 'Vandaag',       color: 'var(--rust)',  weight: 700 },
  PLANNED_FUTURE: { label: 'Gepland',       color: 'var(--sub)',   weight: 600 },
  MISSED:         { label: 'Niet gedaan',   color: 'var(--gold)',  weight: 700 },
  REST:           { label: 'Rustdag',       color: 'var(--blue)',  weight: 600 },
  RECOVERY:       { label: 'Herstel',       color: 'var(--blue)',  weight: 600 },
  EMPTY:          { label: '',              color: 'var(--ghost)', weight: 500 },
};

function readDayPlan(date) {
  try { return JSON.parse(localStorage.getItem(`gc_day_plan_${date}`) || '{}'); }
  catch { return {}; }
}

const isRunWorkout = (w) => w.activityType === 'run' || w.activityType == null;

// Een workout telt als bewijs zodra hij bevestigd is. Alleen een
// screenshot-extractie die nog op bevestiging wacht telt niet mee — die kan
// nog verkeerde getallen bevatten.
function counts(w) {
  return w.confirmedByUser !== false;
}

/**
 * @param {string} date        kalenderdag 'JJJJ-MM-DD' (Europe/Amsterdam)
 * @param {object} ctx
 *   logs      map van datum → daglog
 *   today     kalenderdag van nu (default todayLocal())
 *   workouts  vooraf geladen WorkoutResults (bespaart herhaald inlezen)
 *   gate      resultaat van restDayDecision voor vandaag, optioneel
 */
export function resolveTrainingDayStatus(date, {
  logs = {}, today = todayLocal(), workouts = null, gate = null,
} = {}) {
  const all = workouts || loadWorkouts();
  const log = logs?.[date] || null;
  const plan = readDayPlan(date);

  const dayWorkouts = all.filter(w => w.date === date && counts(w));
  const runs = dayWorkouts.filter(isRunWorkout);
  const strength = loadStrengthSessions().filter(s => s.date === date);

  const plannedType = plan.training || null;
  const plannedRun = plannedType === 'run';
  const plannedRest = plannedType === 'rest';

  // ── 1. Bewijs gaat vóór plan ────────────────────────────────
  // Een geregistreerde training is een feit; wat er gepland stond is dat niet.
  if (runs.length || log?.run_done || strength.length || log?.strength_done || log?.core_done) {
    const primary = runs[0] || dayWorkouts[0] || null;
    const sessionNr = primary?.plannedSessionId ?? log?.run_session ?? null;
    const run = sessionNr ? RUNS.find(r => r.nr === Number(sessionNr)) || null : null;

    // run_done zonder WorkoutResult: dan is er wel bewijs dat er gelopen is,
    // maar geen meetgegevens. Dat verschil moet zichtbaar blijven.
    const kind = runs.length || log?.run_done ? 'run'
      : strength.length || log?.strength_done ? 'strength' : 'other';

    return {
      date, status: STATUS.DONE, kind,
      sessionNr: sessionNr ? Number(sessionNr) : null,
      run,
      workout: primary,
      sources: [
        runs.length ? (primary?.source === 'strava' ? 'strava'
          : primary?.source === 'manual+strava' ? 'handmatig + strava'
          : primary?.source || 'workout') : null,
        log?.run_done && !runs.length ? 'daglog' : null,
        strength.length ? 'kracht' : null,
      ].filter(Boolean),
      hasMetrics: !!(primary && (primary.distance || primary.duration)),
      tolerance: primary ? toleranceFor(primary, logs) : null,
      summary: summarize(primary, run, kind),
    };
  }

  // ── 2. Expliciete rust ──────────────────────────────────────
  if (plannedRest || log?.day_capacity === 'herstel') {
    return { date, status: STATUS.REST, kind: 'rest', sessionNr: null, run: null,
      workout: null, sources: [plannedRest ? 'dagplan' : 'dagtype'], summary: null };
  }

  // ── 3. Geplande training, afgezet tegen de kalender ─────────
  if (plannedType && plannedType !== 'free') {
    if (isFuture(date, today)) {
      return { date, status: STATUS.PLANNED_FUTURE, kind: plannedType,
        sessionNr: null, run: null, workout: null, sources: ['dagplan'], summary: null };
    }
    if (isToday(date, today)) {
      // Adviseert de poort vandaag rust, dan is dat de status — ook al staat
      // er een training in het dagplan.
      if (gate && gate.action !== 'RUN_TODAY' && plannedRun) {
        return { date, status: STATUS.RECOVERY, kind: 'rest', sessionNr: null, run: null,
          workout: null, sources: ['herstelpoort'], summary: gate.blockers?.[0] || gate.headline };
      }
      return { date, status: STATUS.PLANNED_TODAY, kind: plannedType,
        sessionNr: null, run: null, workout: null, sources: ['dagplan'], summary: null };
    }
    // Verleden zonder registratie: niet gedaan. Nooit "Gepland".
    return { date, status: STATUS.MISSED, kind: plannedType,
      sessionNr: null, run: null, workout: null, sources: ['dagplan'],
      summary: 'Stond gepland, niet geregistreerd.' };
  }

  // ── 4. Niets gepland, niets gebeurd ─────────────────────────
  if (isPast(date, today)) {
    return { date, status: STATUS.REST, kind: 'rest', sessionNr: null, run: null,
      workout: null, sources: [], summary: null };
  }
  return { date, status: STATUS.EMPTY, kind: null, sessionNr: null, run: null,
    workout: null, sources: [], summary: null };
}

// De echte resultaten, niet wat het schema voorschreef.
function summarize(workout, run, kind) {
  if (!workout) {
    return kind === 'strength' ? 'Krachttraining geregistreerd'
      : 'Afgevinkt zonder meetgegevens';
  }
  // Bewust kort: afstand, duur en hartslag. Het tempo volgt uit de eerste
  // twee en zou de regel op een telefoon van 360 px laten omslaan; het
  // staat voluit bij de sessievergelijking in Progressie.
  const parts = [];
  if (workout.distance) parts.push(`${Number(workout.distance).toFixed(1).replace('.', ',')} km`);
  if (workout.duration) parts.push(`${Math.round(workout.duration)} min`);
  if (workout.averageHR) parts.push(`HR ${Math.round(workout.averageHR)}`);
  return parts.length ? parts.join(' · ') : 'Geregistreerd zonder meetgegevens';
}

// ── De week in één keer ─────────────────────────────────────────
export function resolveWeek(mondayDate, ctx = {}) {
  const workouts = ctx.workouts || loadWorkouts();
  const today = ctx.today || todayLocal();
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(mondayDate, i);
    const res = resolveTrainingDayStatus(date, { ...ctx, workouts, today });
    return { ...res, dow: dayNameShort(date), isToday: date === today };
  });
}

// De dagen die het waard zijn om in "Deze week" te tonen: alles wat gebeurd
// is, alles wat gepland staat, en alles wat gemist is. Lege dagen niet.
export function weekTrainingRows(mondayDate, ctx = {}) {
  return resolveWeek(mondayDate, ctx)
    .filter(d => d.status !== STATUS.EMPTY &&
      !(d.status === STATUS.REST && !d.sources.length));
}

// Waar mag de eerstvolgende sessie worden aangeboden? Nooit op een gemiste
// dag, en nooit "morgen dezelfde run" alleen omdat gisteren niet doorging —
// die keuze is aan de herstel- en frequentiepoort.
export function nextOfferDate(week, { gate = null, today = todayLocal() } = {}) {
  const earliest = gate?.earliestRunDate && gate.earliestRunDate > today
    ? gate.earliestRunDate : today;
  const candidate = week.find(d =>
    d.date >= earliest &&
    d.status !== STATUS.DONE &&
    d.status !== STATUS.MISSED &&
    d.status !== STATUS.REST);
  return candidate?.date || null;
}

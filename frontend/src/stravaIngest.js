// Strava-activiteiten doortrekken naar het eigen trainingsmodel.
//
// Tot nu toe schreef de sync alleen naar `workout_imports` op de server.
// Niets las die tabel terug, dus een run die via Strava binnenkwam bestond
// nergens in de app: niet in `gc_workouts`, niet als `run_done`. De
// weekkalender bleef daardoor "Gepland" tonen op een dag waarop je
// aantoonbaar gelopen had.
//
// Deze module leest `workout_imports` rechtstreeks — de tabel heeft RLS op
// `auth.uid() = user_id`, dus de browser ziet uitsluitend eigen rijen — en
// zet elke activiteit om in één WorkoutResult.
//
// Idempotent op twee manieren:
//   1. het id is afgeleid van het Strava-id, dus opnieuw inlezen werkt bij
//      zonder een tweede regel te maken;
//   2. staat er al een handmatige registratie op diezelfde dag, dan wordt
//      die verrijkt in plaats van gedupliceerd — en nooit overschreven waar
//      je zelf iets hebt ingevuld.

import { supabase, getUserId } from './supabase';
import { loadWorkouts, saveWorkout, computePace } from './workouts';
import { store } from './store';
import { RUNS } from './data/runningSchema';
import { todayLocal, addDays, localDayOf } from './datetime';

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);
const WALK_TYPES = new Set(['Walk', 'Hike']);

export function activityKind(type) {
  if (RUN_TYPES.has(type)) return 'run';
  if (WALK_TYPES.has(type)) return 'walk';
  return 'other';
}

// Ruwe Strava-payload → de velden die de app gebruikt.
// start_date_local draagt een misleidende 'Z' maar is lokale tijd; de eerste
// tien tekens zijn dus rechtstreeks de kalenderdag, zonder omrekening.
export function normalizeActivity(row) {
  const a = row?.payload || {};
  const distM = Number(a.distance) || null;
  const movingS = Number(a.moving_time) || null;
  const local = String(a.start_date_local || a.start_date || '');
  const date = localDayOf(local);
  if (!date) return null;

  const distance = distM ? +(distM / 1000).toFixed(2) : null;
  const duration = movingS ? +(movingS / 60).toFixed(1) : null;

  return {
    externalId: String(row.external_id),
    externalUrl: row.external_url || `https://www.strava.com/activities/${row.external_id}`,
    name: a.name || null,
    stravaType: a.sport_type || a.type || null,
    activityType: activityKind(a.sport_type || a.type),
    date,
    startedAt: local || null,
    distance,
    duration,
    averagePace: computePace(distance, duration),
    averageHR: a.average_heartrate != null ? Math.round(Number(a.average_heartrate)) : null,
    maxHR: a.max_heartrate != null ? Math.round(Number(a.max_heartrate)) : null,
    elevation: a.total_elevation_gain != null ? Number(a.total_elevation_gain) : null,
    cadence: a.average_cadence != null ? Number(a.average_cadence) : null,
  };
}

// Alle geïmporteerde activiteiten van de ingelogde gebruiker.
export async function fetchStravaImports({ sinceDays = 180, limit = 300 } = {}) {
  const userId = await getUserId();
  if (!userId) return { ok: false, reason: 'niet ingelogd', activities: [] };

  const since = addDays(todayLocal(), -sinceDays);
  const { data, error } = await supabase
    .from('workout_imports')
    .select('external_id, external_url, payload')
    .eq('user_id', userId)
    .eq('external_provider', 'strava')
    .order('imported_at', { ascending: false })
    .limit(limit);

  if (error) return { ok: false, reason: error.message, activities: [] };

  const activities = (data || [])
    .map(normalizeActivity)
    .filter(a => a && a.date >= since)
    .sort((a, b) => a.date.localeCompare(b.date));   // oud → nieuw

  return { ok: true, activities };
}

// Welke geplande sessie hoort bij deze run? Eerst wat er al vastligt in de
// daglog, dan wat er voor die dag gepland stond, en anders de eerstvolgende
// sessie in het schema gerekend tot díe datum — zodat inlezen met
// terugwerkende kracht dezelfde nummering oplevert als live registreren.
function resolveSessionNr(date, logs, alreadyAssigned) {
  const log = logs?.[date];
  if (log?.run_session) return Number(log.run_session);

  try {
    const plan = JSON.parse(localStorage.getItem(`gc_day_plan_${date}`) || '{}');
    if (plan.runSession) return Number(plan.runSession);
  } catch { /* geen dagplan */ }

  const doneBefore = [
    ...Object.values(logs || {})
      .filter(l => l.run_done && l.run_session && l.date && l.date < date)
      .map(l => Number(l.run_session)),
    ...alreadyAssigned.filter(x => x.date < date).map(x => x.nr),
  ];
  const highest = doneBefore.length ? Math.max(...doneBefore) : 0;
  return Math.min(RUNS.length, highest + 1);
}

// Alleen aanvullen wat leeg is; wat jij zelf hebt ingevuld blijft staan.
function fillGaps(existing, incoming, fields) {
  const patch = {};
  for (const f of fields) {
    const cur = existing[f];
    if ((cur == null || cur === '') && incoming[f] != null) patch[f] = incoming[f];
  }
  return patch;
}

const ENRICH_FIELDS = ['distance', 'duration', 'averagePace', 'averageHR',
  'maxHR', 'elevation', 'cadence', 'startedAt'];

// De hoofdroutine. Levert een verslag terug in plaats van stil te falen,
// zodat de UI kan tonen wat er precies gebeurd is.
export async function ingestStravaWorkouts({ logs = {}, sinceDays = 180 } = {}) {
  const res = await fetchStravaImports({ sinceDays });
  if (!res.ok) return { ok: false, reason: res.reason, added: 0, enriched: 0, skipped: 0, dates: [] };

  const existing = loadWorkouts();
  const byExternal = new Map(
    existing.filter(w => w.externalId).map(w => [String(w.externalId), w]));

  let added = 0, enriched = 0, skipped = 0;
  const touched = [];
  const assigned = [];       // sessienummers die we in deze ronde uitdelen

  for (const act of res.activities) {
    // Alleen wat de coach als training telt; ritjes en zwemmen laten we
    // voorlopig met rust omdat de hardlooplogica er niets mee doet.
    if (act.activityType === 'other') { skipped++; continue; }

    const already = byExternal.get(act.externalId);
    if (already) {
      // Al bekend. Alleen aanvullen als er velden leeg staan.
      const patch = fillGaps(already, act, ENRICH_FIELDS);
      if (Object.keys(patch).length) {
        saveWorkout({ ...already, ...patch });
        enriched++;
        touched.push(act.date);
      } else {
        skipped++;
      }
      if (act.activityType === 'run') {
        assigned.push({ date: act.date, nr: Number(already.plannedSessionId) || 0 });
      }
      continue;
    }

    // Handmatige registratie op dezelfde dag en van hetzelfde type?
    // Dan is dat dezelfde training — koppelen, niet verdubbelen.
    const manual = existing.find(w =>
      !w.externalId && w.date === act.date && (w.activityType || 'run') === act.activityType);

    if (manual) {
      const patch = fillGaps(manual, act, ENRICH_FIELDS);
      saveWorkout({
        ...manual, ...patch,
        externalId: act.externalId,
        externalUrl: act.externalUrl,
        source: manual.source === 'manual' ? 'manual+strava' : manual.source,
      });
      byExternal.set(act.externalId, manual);
      enriched++;
      touched.push(act.date);
      if (act.activityType === 'run') {
        assigned.push({ date: act.date, nr: Number(manual.plannedSessionId) || 0 });
      }
      continue;
    }

    const sessionNr = act.activityType === 'run'
      ? resolveSessionNr(act.date, logs, assigned) : null;

    const workout = saveWorkout({
      id: `strava_${act.externalId}`,
      date: act.date,
      activityType: act.activityType,
      source: 'strava',
      externalId: act.externalId,
      externalUrl: act.externalUrl,
      externalName: act.name,
      startedAt: act.startedAt,
      plannedSessionId: sessionNr,
      distance: act.distance,
      duration: act.duration,
      averagePace: act.averagePace,
      averageHR: act.averageHR,
      maxHR: act.maxHR,
      elevation: act.elevation,
      cadence: act.cadence,
      // Meetdata van een horloge, geen AI-extractie: geen bevestiging nodig.
      // Wat er níet in staat is hoe het voelde — RPE, benen en of je meer
      // gekund had blijven leeg tot je ze zelf invult.
      confirmedByUser: true,
      completedAsPlanned: null,
      rpe: null, legs: null, couldDoMore: null,
    });
    byExternal.set(act.externalId, workout);
    added++;
    touched.push(act.date);
    if (act.activityType === 'run') assigned.push({ date: act.date, nr: sessionNr });
  }

  // Daglogs bijwerken: een geregistreerde run betekent run_done op die dag.
  // Zonder deze stap blijft de rest van de coach denken dat er niet gelopen is.
  const logUpdates = [];
  for (const a of assigned) {
    const log = logs?.[a.date] || {};
    const needsDone = !log.run_done;
    const needsSession = a.nr && Number(log.run_session) !== a.nr;
    if (needsDone || needsSession) {
      logUpdates.push({ date: a.date, run_done: true, ...(a.nr ? { run_session: a.nr } : {}) });
    }
  }
  for (const u of logUpdates) {
    const { date, ...fields } = u;
    try { await store.saveLog(date, fields); } catch { /* lokaal blijft staan */ }
  }

  return {
    ok: true, added, enriched, skipped,
    logUpdates: logUpdates.length,
    dates: [...new Set(touched)].sort(),
    total: res.activities.length,
  };
}

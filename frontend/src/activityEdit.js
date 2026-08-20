// Een verkeerd ingevoerde activiteit rechtzetten — en alles wat eruit volgt
// opnieuw laten kloppen.
//
// De aanleiding: een wandeling van 4 km stond per ongeluk als hardlooptraining
// geboekt. Dat is geen cosmetisch probleem. Zo'n regel schuift op tegelijk:
// je hardloopkilometers, je langst verdragen afstand, je weekbelasting, je
// loopeconomie, je hartslagkalibratie en je race readiness. Bij deze loper
// betekent een te rooskleurig beeld dat de coach eerder gaat opbouwen dan haar
// herstel toestaat — precies het patroon dat 2024 heeft gekost.
//
// Bijna alles is afgeleid en herberekent zichzelf zodra de activiteit klopt.
// Eén ding niet: `run_done` in het daglog is opgeslagen, niet berekend. Dat is
// hier de kern van het werk — die vlag moet volgen uit de activiteiten die er
// werkelijk staan, niet blijven hangen uit een eerdere invoer.

import { loadWorkouts, saveWorkout, deleteWorkout, getWorkout } from './workouts';
import { store } from './store';
import { todayLocal } from './datetime';

export const ACTIVITY_TYPES = [
  { id: 'run', label: 'Hardlopen', hint: 'Telt mee voor je hardloopcijfers en je racedoelen.' },
  { id: 'walk', label: 'Wandelen', hint: 'Telt mee als beweging en tijd op de benen, niet als hardlooptraining.' },
  { id: 'other', label: 'Anders', hint: 'Fietsen, zwemmen, kracht — buiten het hardloopmodel.' },
];

const isRun = (w) => w.activityType === 'run' || w.activityType == null;
const isWalk = (w) => w.activityType === 'walk';

// ── De feiten van één dag ───────────────────────────────────────
export function dayFacts(date) {
  const all = loadWorkouts().filter(w => w.date === date);
  return {
    all,
    runs: all.filter(isRun),
    walks: all.filter(isWalk),
  };
}

// ── Het daglog laten volgen uit de activiteiten ─────────────────
// `force` is nodig na een verwijdering: dan zijn er geen activiteiten meer
// over om uit af te leiden, en moet de vlag alsnog omlaag. Zonder die vlag
// zouden we een handmatig aangevinkte "gelopen" op een dag zónder
// activiteitregel stilzwijgend wissen, en dat is data weggooien.
export async function reconcileDayLog(date, { force = false } = {}) {
  if (!date) return null;
  const { runs, walks, all } = dayFacts(date);
  if (!all.length && !force) return null;

  const log = (await store.getLog(date)) || {};
  const runDone = runs.length > 0;
  const walkDone = walks.length > 0;

  // Het sessienummer komt van de eerste run die er een draagt.
  const session = runs.map(r => r.plannedSessionId).find(n => n != null) ?? null;

  const patch = {};
  if (!!log.run_done !== runDone) patch.run_done = runDone;
  if ((log.run_session ?? null) !== session) patch.run_session = session;
  if (!!log.walk_done !== walkDone) patch.walk_done = walkDone;

  if (!Object.keys(patch).length) return { date, changed: false, patch: {} };

  await store.saveLog(date, patch);
  return { date, changed: true, patch, runs: runs.length, walks: walks.length };
}

// ── Een activiteit opslaan of wijzigen ──────────────────────────
// Wijzigt de datum mee, dan moeten beide dagen opnieuw worden nagerekend:
// de oude dag verliest een activiteit, de nieuwe krijgt er een.
export async function saveActivity(patch) {
  const before = patch.id ? getWorkout(patch.id) : null;
  const oldDate = before?.date || null;

  // Zet jij het type zelf, dan is dat jouw oordeel en overschrijft een
  // latere Strava-synchronisatie het niet meer.
  const next = { ...patch };
  if (before && patch.activityType && patch.activityType !== before.activityType) {
    next.activityTypeUser = true;
    next.correctedAt = todayLocal();
  }
  // Alleen hardlopen hangt aan het schema. Wordt het een wandeling, dan
  // verdwijnt die koppeling — anders telt de wandeling als uitgevoerde
  // trainingssessie.
  if (next.activityType && next.activityType !== 'run') next.plannedSessionId = null;

  const saved = saveWorkout(next);

  const touched = [];
  if (oldDate && oldDate !== saved.date) touched.push(await reconcileDayLog(oldDate, { force: true }));
  touched.push(await reconcileDayLog(saved.date, { force: true }));

  return { workout: saved, reconciled: touched.filter(Boolean) };
}

// ── Een activiteit verwijderen ──────────────────────────────────
export async function deleteActivity(id) {
  const before = getWorkout(id);
  if (!before) return { deleted: false };
  deleteWorkout(id);
  const reconciled = await reconcileDayLog(before.date, { force: true });
  return { deleted: true, workout: before, reconciled };
}

// ── Alleen het type omzetten ────────────────────────────────────
// De veruit meest voorkomende correctie: dit was geen training maar een
// wandeling. Eén handeling, en de rest volgt.
export async function retypeActivity(id, activityType) {
  const w = getWorkout(id);
  if (!w) return null;
  return saveActivity({ ...w, activityType });
}

// ── De lijst om uit te kiezen ───────────────────────────────────
// Álle activiteiten, ook die zonder schemakoppeling. Dat was het gat: de
// verkeerd geboekte wandeling had geen sessienummer en kwam daarom in de
// enige bestaande lijst niet voor. Onbereikbaar is hetzelfde als afwezig.
export function activityList({ limit = 40, currentDate = todayLocal() } = {}) {
  return loadWorkouts()
    .filter(w => w.date && w.date <= currentDate)
    .slice(0, limit)
    .map(w => {
      const km = Number(w.distance) || null;
      const min = Number(w.duration) || null;
      return {
        ...w,
        kind: isRun(w) ? 'run' : isWalk(w) ? 'walk' : 'other',
        pace: km && min ? min / km : null,
        counts: isRun(w),
      };
    });
}

// De brug tussen de strategie en de schermen.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT BESTAAT
//
// strategy.js weet niets van Strava, hartslagmodellen of racedoelen — met
// opzet, want daardoor is hij testbaar en kan er geen tweede berekening van
// dezelfde dingen ontstaan. Maar iemand moet die gegevens wél bij elkaar
// halen. Dat is dit bestand, en verder doet het niets.
//
// Wat het vervangt is belangrijker dan wat het toevoegt. Op vier plaatsen
// stond dit:
//
//     return Math.min(RUNS.length, Math.max(...doneNrs) + 1);
//
// "Het hoogste sessienummer dat je hebt afgevinkt, plus één, en niet verder
// dan de 35 die er zijn." Dat is een wachtrij, geen coach. Het weet niet
// hoe sessie 13 viel, het weet niet wat je doel is, en na nummer 35 weet
// het niets meer. In ProgressieScreen stond het zelfs als voortgangsbalk:
// "X% van het plan afgerond" — alsof training een lijst is die je afwerkt.
//
// Wat ervoor in de plaats komt is een niveau dat uit je werkelijke sessies
// volgt, en een keuze die van alles wat je hebt gedaan heeft geleerd.
// ─────────────────────────────────────────────────────────────────

import { todayLocal } from './datetime';
import { currentStrategy } from './strategy';
import { chooseSession } from './sessionChoice';
import { provenStructure } from './raceplan';
import { runningState } from './raceGoals';
import { upcomingGoals } from './raceGoalModel';
import { exertionalResponse } from './symptoms';
import { loadWorkouts } from './workouts';
import { MAX_LEVEL } from './data/sessionLibrary';

// ── De historie waar de keuze van leert ─────────────────────────
//
// Elke afgeronde run met de respons erop. `sessionId` verwijst naar een vorm
// uit de bibliotheek; oude sessies die nog een plannedSessionId uit het
// afgeschafte weekschema dragen, krijgen er geen — die tellen mee voor
// vermogen, niet voor vormkeuze.
export function sessionHistory({ logs = {}, currentDate = todayLocal() } = {}) {
  return loadWorkouts()
    .filter(w => (w.activityType === 'run' || w.activityType == null) && w.date <= currentDate)
    .map(w => ({
      sessionId: w.libraryId || null,
      date: w.date,
      response: exertionalResponse({ workoutDate: w.date, logs, currentDate }).status,
    }))
    .filter(h => h.sessionId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Alles bij elkaar ────────────────────────────────────────────
export function coachPlan({ log = {}, logs = {}, currentDate = todayLocal() } = {}) {
  const proven = provenStructure({ logs, currentDate });
  const st = (() => {
    try { return runningState({ logs, currentDate }); } catch { return null; }
  })();

  const capability = {
    provenBlockMin: proven?.provenBlockMin ?? 0,
    longestToleratedKm: st?.longestTolerated ?? 0,
    sessions: proven?.sessions ?? 0,
  };

  const goal = (() => {
    try {
      const komend = upcomingGoals(currentDate) || [];
      const g = komend.find(x => x.enabled !== false) || komend[0];
      return g ? { name: g.name, date: g.date, distanceKm: g.distanceKm,
        targetTimeSec: g.targetTimeSec } : null;
    } catch { return null; }
  })();

  // Groen betekent hier: geen twee waarschuwingen tegelijk én vier PEM-vrije
  // weken. Dezelfde drempels als elders; ze staan hier niet opnieuw
  // gedefinieerd maar afgelezen.
  const recovery = {
    green: (st?.warnings?.signals?.length ?? 0) < 2 && (st?.pemFreeWeeks ?? 0) >= 1,
    pemFreeWeeks: st?.pemFreeWeeks ?? 0,
    warnings: st?.warnings?.signals?.length ?? 0,
  };

  const strategy = currentStrategy({ capability, goal, recovery, currentDate });
  const history = sessionHistory({ logs, currentDate });
  const choice = chooseSession({ strategy, history, currentDate });

  return {
    strategy, choice, capability, goal, recovery,
    history: { count: history.length, forms: new Set(history.map(h => h.sessionId)).size },
    // Waar sta je, en hoe ver reikt de ladder? Dit vervangt de oude
    // voortgangsbalk. Geen percentage van een lijst, maar een niveau op een
    // schaal die niet opraakt.
    progress: {
      level: strategy.level,
      maxLevel: MAX_LEVEL,
      label: `Niveau ${strategy.level} van ${MAX_LEVEL}`,
      blockMin: capability.provenBlockMin,
      note: capability.provenBlockMin
        ? `Je langste verdragen loopblok is ${capability.provenBlockMin} minuten.`
        : 'Nog geen verdragen sessie met af te lezen loopblokken.',
    },
  };
}

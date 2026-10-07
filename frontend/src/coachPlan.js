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
import { provenStructure, planNextSession } from './raceplan';
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
  // Een expliciete `null` slaat de standaardwaarde hierboven over; verderop
  // wordt `log.symptom_pem` gelezen en dan valt de hele app om. Dat gebeurde
  // ook: computeHeadCoach(null, …) kwam via deze route binnen.
  log = log || {};
  logs = logs || {};
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

// ── De volgende looptraining. Eén antwoord, voor elk scherm ─────
//
// ─────────────────────────────────────────────────────────────────
// WAT ER MIS WAS
//
// Er waren twee motoren die onafhankelijk van elkaar bepaalden wat je
// volgende looptraining was:
//
//   raceplan.planNextSession()   leidde een vorm af uit provenStructure en
//                                boog die om met een hefboom per doel
//   sessionChoice.chooseSession() koos een vorm uit de bibliotheek, lerend
//                                van hoe élke eerdere sessie viel
//
// Vandaag las de eerste, Progressie de tweede. Op dezelfde dag, met dezelfde
// data, stond er op het ene scherm "5 min lopen / 2 min wandelen × 4" en op
// het andere "5 min lopen / 1 min wandelen × 5". Zij zag dat en vroeg welke
// van de twee het was. Terechte vraag: twee antwoorden betekent dat er geen
// antwoord is.
//
// ─────────────────────────────────────────────────────────────────
// DE REGEL DIE HIER GELDT
//
// De bibliotheek kiest de vorm, want die keuze leert van alle trainingen en
// kan een vorm overslaan die tweemaal slecht viel. raceplan doet wat het als
// enige kan en wat geen vorm is: het doel uit de racekalender, het
// voorgeschreven tempo, het hartslagvoorschrift, de poort (mag er vandaag
// gelopen worden) en de dosering op een amberdag.
//
// Deze functie is de enige plek waar die twee bij elkaar komen. Elk scherm
// leest hiervan. Wie een tweede bron toevoegt, maakt dezelfde fout terug.
// ─────────────────────────────────────────────────────────────────

// Een bibliotheekdoel naar het doel van de planner. RACE_SPECIFIC hangt aan
// de afstand van de eerstvolgende race: 5 km vraagt andere blokken dan 10.
function plannerPurpose(libraryPurpose, goal) {
  if (libraryPurpose !== 'RACE_SPECIFIC') return libraryPurpose || null;
  const km = goal?.distanceKm ?? null;
  if (km == null) return 'QUALITY_LITE';
  return km <= 7 ? 'FIVE_K_SPECIFIC' : 'TEN_K_SPECIFIC';
}

export function nextSession({ log = {}, logs = {}, currentDate = todayLocal(),
  ignoreGate = false, gate = null, level = null } = {}) {
  log = log || {};
  logs = logs || {};
  const plan = coachPlan({ log, logs, currentDate });

  // De adaptieve toestanden (terugnemen na een slechte respons, testen na
  // een pauze) vragen om een ánder niveau, niet om een andere motor. Dan
  // wordt hier op dat niveau gekozen, met precies dezelfde regels: leren
  // van wat eerder slecht viel, en niet drie keer dezelfde vorm in twee
  // weken. Eerder werd in zo'n geval `sessionsAtLevel(niveau)[0]` gepakt —
  // de eerste uit de lijst, zonder iets te leren.
  // Vergelijken met het niveau waarop de keuze al uitkwam, niet met het
  // niveau van de strategie. Verdient zij een stap, dan kiest coachPlan al
  // op het hogere niveau; wie dan tegen strategy.level vergelijkt, ziet een
  // verschil dat er niet is en kiest nóg een keer — met een andere uitkomst.
  // Dat was precies het verschil tussen Vandaag en Progressie.
  const alGekozen = plan.choice.available ? plan.choice.level : plan.strategy.level;
  const keuze = (level != null && level !== alGekozen)
    ? chooseSession({
        strategy: { ...plan.strategy, level, nextLevel: null, builds: false },
        history: sessionHistory({ logs, currentDate }), currentDate })
    : plan.choice;

  const vorm = keuze.available ? keuze.session : null;

  const prescriptie = planNextSession({
    log, logs, currentDate, gate, ignoreGate,
    form: vorm,
    forcePurpose: plannerPurpose(vorm?.purpose, plan.goal),
  });

  return {
    ...prescriptie,
    // De vorm, één keer, met één tekst. `run` houdt dezelfde tekst omdat
    // buildRun() het label van de vorm overneemt — niet omdat het hier nog
    // eens wordt overgeschreven.
    session: vorm,
    form: vorm,
    // De dosering kan een blok van de vorm af halen; dan is de tekst van de
    // sessie die van de dosering, niet het label van de onaangeroerde vorm.
    text: prescriptie.run?.description || vorm?.label || null,
    level: plan.strategy.level,
    chosenLevel: keuze.available ? keuze.level : null,
    // Waarom juist deze vorm — de uitleg van de keuze, niet van het doel.
    choiceWhy: keuze.available ? keuze.why : null,
    strategy: plan.strategy,
    choice: keuze,
    plan,
  };
}

// ── Welk niveau hoort bij een adaptieve toestand? ───────────────
//
// Deze afbeelding stond in computeNextSession, en de kopregel op Vandaag
// kende hem niet. Daardoor noemde de groene banner bovenaan een andere
// sessie dan de kaart eronder: de banner las het kale plan, de kaart de
// adaptieve beslissing. Eén afbeelding, twee lezers.
// Twee niveaus doen hier mee en ze zijn niet hetzelfde:
//
//   current  het niveau dat je aantoonbaar verdraagt (strategy.level)
//   chosen   het niveau waarop de keuze uitkwam — een stap hoger als die
//            verdiend is
//
// Alleen BUILD mag die stap gebruiken. "Vasthouden" dat op het hogere
// niveau vasthoudt is geen vasthouden. Met één `level`-argument was dat
// onderscheid niet te maken, en dan kiest de ene lezer het ene niveau.
export function adaptiveLevel(state, { current, chosen } = {}) {
  const nu = current ?? chosen ?? 1;
  switch (state) {
    case 'DELOAD': return Math.max(1, nu - 2);
    case 'TEST': return Math.max(1, nu - 1);
    case 'HOLD':
    case 'REPEAT': return Math.max(1, nu);
    default: return Math.max(1, chosen ?? nu);   // BUILD
  }
}

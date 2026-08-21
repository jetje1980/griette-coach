// Loopdoelen in vijf vormen.
//
// Het RaceGoal-model kon één ding: een afstand met een streeftijd op een
// datum. Dat is precies goed voor een wedstrijd en te weinig voor de rest.
// "Twintig kilometer aaneengesloten uitlopen, tijd maakt niet uit, mits het
// herstel goed blijft" past er niet in. "Vijf kilometer in dertig minuten bij
// een gemiddelde hartslag onder de 140" ook niet.
//
// Dus vijf vormen, met per vorm alleen de velden die er toe doen:
//
//   RACE        wedstrijd: afstand, streeftijd, datum
//   PERFORMANCE snelheid: afstand, streeftijd, venster
//   ECONOMY     dezelfde afstand goedkoper: tijd én hartslag zijn beide
//               succescriterium
//   ENDURANCE   afstand uitlopen, aaneengesloten, tijd secundair, herstel
//               telt mee als criterium
//   COMPOSITE   meerdere criteria tegelijk
//
// ─────────────────────────────────────────────────────────────────
// HET BELANGRIJKSTE ONDERSCHEID IN DIT HELE BESTAND
//
// Een hartslag in een doel is een UITKOMST, geen grens.
//
// "5 km in 30:00 bij gemiddeld ≤140" betekent: dát wil ik ooit kunnen. Het
// betekent niet dat je vandaag bij 141 moet stoppen. Wat je vandaag mag komt
// uit hrModel — CPET-context, recente verdragen runs, de vertraagde respons,
// de actuele intensity release — en dat model kent deze doelen niet en hoort
// ze niet te kennen.
//
// Daarom staat het veld hier `outcomeAvgHr` en niet `maxHr` of `hrCeiling`.
// Een naam is hier geen smaak: `maxHr` zou vroeg of laat door iemand als
// plafond worden gelezen. Er staat een test op die faalt zodra dit veld ergens
// in de dagelijkse hartslagsturing opduikt.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, daysBetween } from './datetime';
import {
  paceFromGoal, fmtSec, fmtPaceSec, parseTime, secToPace,
} from './sessionMath';
// Geen kringetje: raceGoalModel kent alleen datetime en sessionMath.
import { loadRaceGoals, saveRaceGoal, deleteRaceGoal } from './raceGoalModel';

const KEY = 'gc_run_goals';

// ── De vijf vormen ──────────────────────────────────────────────
export const GOAL_KIND = {
  RACE: 'RACE',
  PERFORMANCE: 'PERFORMANCE',
  ECONOMY: 'ECONOMY',
  ENDURANCE: 'ENDURANCE',
  COMPOSITE: 'COMPOSITE',
};

export const KIND_META = {
  RACE: {
    label: 'Wedstrijd', emoji: '🏁',
    vraag: 'Een race met een startschot en een datum.',
    velden: ['name', 'distanceKm', 'targetTimeSec', 'date', 'terrain'],
  },
  PERFORMANCE: {
    label: 'Snelheid', emoji: '⚡',
    vraag: 'Een afstand sneller kunnen dan nu, zonder dat er een wedstrijd bij hoort.',
    velden: ['name', 'distanceKm', 'targetTimeSec', 'window'],
  },
  ECONOMY: {
    label: 'Economie', emoji: '🌿',
    vraag: 'Dezelfde afstand, dezelfde tijd, maar goedkoper — bij een lagere hartslag.',
    velden: ['name', 'distanceKm', 'targetTimeSec', 'outcomeAvgHr', 'continuous', 'window'],
  },
  ENDURANCE: {
    label: 'Afstand', emoji: '🥾',
    vraag: 'Een afstand uitlopen. Tijd is bijzaak; goed herstel hoort erbij.',
    velden: ['name', 'distanceKm', 'continuous', 'effort', 'recoveryCriterion', 'window'],
  },
  COMPOSITE: {
    label: 'Samengesteld', emoji: '🎯',
    vraag: 'Meerdere eisen tegelijk.',
    velden: ['name', 'distanceKm', 'targetTimeSec', 'outcomeAvgHr', 'continuous',
      'effort', 'recoveryCriterion', 'window'],
  },
};

export const KINDS = Object.entries(KIND_META).map(([id, m]) => ({ id, ...m }));

// Hoe zwaar de inspanning mag voelen bij een afstandsdoel.
export const EFFORT = {
  EASY: { id: 'easy', label: 'Easy', meaning: 'Rustig, praten kan de hele tijd.' },
  CONTROLLED: { id: 'controlled', label: 'Gecontroleerd', meaning: 'Stevig maar beheerst.' },
  FINISH: { id: 'finish', label: 'Uitlopen', meaning: 'Aankomen is het doel, hoe dan ook.' },
};
export const EFFORTS = Object.values(EFFORT);

// Prioriteit zoals de gebruiker hem zelf zet.
export const PRIORITY = { PRIMARY: 'primary', SECONDARY: 'secondary', SOMEDAY: 'someday' };

// ── Opslag ──────────────────────────────────────────────────────
function readRaw() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || 'null');
    return Array.isArray(arr) ? arr : null;
  } catch { return null; }
}

function writeRaw(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }

// ── Afleiden, nooit opslaan ─────────────────────────────────────
// Alles wat uit andere velden volgt wordt bij het lezen berekend. Wie een
// afgeleide waarde opslaat, krijgt vroeg of laat twee getallen die elkaar
// tegenspreken — dat is precies hoe "5 km in 35:00" ooit naast "7 min/km" is
// komen te staan zonder dat iemand merkte dat ze uit elkaar liepen.
export function hydrate(goal) {
  const kind = goal.kind || GOAL_KIND.RACE;
  const heeftTijd = goal.targetTimeSec != null && goal.distanceKm > 0;
  const targetPaceSecPerKm = heeftTijd ? paceFromGoal(goal) : null;

  // Het venster. Een wedstrijd heeft één datum; de rest heeft een periode,
  // want "ergens in de winter" is een eerlijker doel dan een verzonnen dag.
  const from = goal.windowStart || goal.date || null;
  const to = goal.windowEnd || goal.date || null;

  return {
    ...goal,
    kind,
    kindLabel: KIND_META[kind]?.label || kind,
    // Tijd en tempo
    targetTimeLabel: goal.targetTimeSec != null ? fmtSec(goal.targetTimeSec) : null,
    targetPaceSecPerKm,
    targetPaceLabel: targetPaceSecPerKm != null ? fmtPaceSec(targetPaceSecPerKm) : null,
    targetMinutes: goal.targetTimeSec != null ? goal.targetTimeSec / 60 : null,
    targetPace: targetPaceSecPerKm != null ? secToPace(targetPaceSecPerKm) : null,
    // Venster
    windowStart: from, windowEnd: to,
    windowLabel: from && to && from !== to ? `${from} t/m ${to}` : (from || null),
    // De succescriteria als lijst, want dat is wat een doel eigenlijk is.
    criteria: criteriaFor({ ...goal, kind }),
  };
}

// Wat moet er waar zijn om dit doel gehaald te noemen?
export function criteriaFor(goal) {
  const c = [];
  if (goal.distanceKm > 0) {
    c.push({ id: 'distance', label: `${goal.distanceKm} km`, required: true });
  }
  if (goal.targetTimeSec != null) {
    c.push({
      id: 'time',
      label: `binnen ${fmtSec(goal.targetTimeSec)}`,
      // Bij een afstandsdoel is tijd expliciet bijzaak. Dat moet zichtbaar
      // zijn, anders wordt het alsnog als eis gelezen.
      required: goal.kind !== GOAL_KIND.ENDURANCE,
      secondary: goal.kind === GOAL_KIND.ENDURANCE,
    });
  }
  if (goal.outcomeAvgHr != null) {
    c.push({
      id: 'hr',
      label: `gemiddelde hartslag ≤ ${goal.outcomeAvgHr}`,
      required: true,
      // Deze markering reist mee door de hele app. Wie hem leest weet dat dit
      // getal iets zegt over de gewenste uitkomst en niets over vandaag.
      outcomeOnly: true,
      note: 'Uitkomstcriterium. Wat je tijdens een training mag, komt uit je hartslagmodel.',
    });
  }
  if (goal.continuous) {
    c.push({ id: 'continuous', label: 'aaneengesloten, zonder wandelpauzes', required: true });
  }
  if (goal.effort) {
    const e = EFFORTS.find(x => x.id === goal.effort);
    c.push({ id: 'effort', label: `inspanning: ${e?.label || goal.effort}`, required: true });
  }
  if (goal.recoveryCriterion) {
    c.push({
      id: 'recovery',
      label: 'goed herstel binnen 24–48 uur',
      required: true,
      note: 'Zonder schoon herstel telt de afstand niet als gehaald.',
    });
  }
  return c;
}

// ── Migratie vanuit het racemodel ───────────────────────────────
// De twee bestaande racedoelen blijven bestaan, met dezelfde id's, zodat elke
// verwijzing in het schema en in de geschiedenis blijft kloppen.
export function fromRaceGoal(rg) {
  return {
    id: rg.id,
    kind: GOAL_KIND.RACE,
    name: rg.name,
    distanceKm: rg.distanceKm,
    targetTimeSec: rg.targetTimeSec,
    date: rg.date,
    windowStart: rg.date, windowEnd: rg.date,
    terrain: rg.terrain || 'road',
    type: rg.type,
    priority: rg.priority === 1 ? PRIORITY.PRIMARY : PRIORITY.SECONDARY,
    enabled: rg.enabled !== false,
    note: rg.note || null,
    continuous: false,
    outcomeAvgHr: null,
    effort: null,
    recoveryCriterion: false,
    createdAt: rg.createdAt || new Date().toISOString(),
  };
}

// ── Eén waarheid per wedstrijd ──────────────────────────────────
// Een wedstrijddoel wordt hier NIET bewaard. `gc_race_goals` blijft de bron,
// want dat is wat raceplan, racePerformance en de forecast lezen. Zou ik het
// kopiëren, dan bestaan er twee versies van "5 km op 3 oktober" en loopt de
// ene weg zodra de andere wordt bijgewerkt — precies de fout die het oude
// schema maakte.
//
// Wat een wedstrijd hier wél extra kan hebben zijn de velden die het racemodel
// niet kent (een uitkomsthartslag, aaneengesloten, herstelcriterium). Die
// worden als overlay bewaard: alleen de extra velden, op dezelfde id.
const OVERLAY_VELDEN = ['outcomeAvgHr', 'continuous', 'effort', 'recoveryCriterion'];

function overlayOf(stored) {
  const o = {};
  for (const k of OVERLAY_VELDEN) if (stored[k] != null) o[k] = stored[k];
  return o;
}

export function loadRunGoals() {
  const stored = readRaw() || [];
  // Wedstrijden komen live uit het racemodel, met de overlay eroverheen.
  const overlays = new Map(
    stored.filter(g => (g.kind || GOAL_KIND.RACE) === GOAL_KIND.RACE)
      .map(g => [g.id, overlayOf(g)]));
  const races = loadRaceGoals().map(rg => ({ ...fromRaceGoal(rg), ...(overlays.get(rg.id) || {}) }));
  const overige = stored.filter(g => g.kind && g.kind !== GOAL_KIND.RACE);
  return [...races, ...overige].map(hydrate);
}

export function activeRunGoals({ currentDate = todayLocal() } = {}) {
  return loadRunGoals()
    .filter(g => g.enabled !== false)
    .filter(g => !g.windowEnd || g.windowEnd >= currentDate)
    .sort((a, b) => (a.windowEnd || '9999').localeCompare(b.windowEnd || '9999'));
}

export function findRunGoal(id) {
  return loadRunGoals().find(g => g.id === id) || null;
}

export function saveRunGoal(fields) {
  const arr = readRaw() || [];
  const now = new Date().toISOString();

  // Een wedstrijd gaat naar het racemodel, niet hierheen. Wat overblijft is de
  // overlay met de velden die het racemodel niet kent.
  const bestaand = fields.id ? findRunGoal(fields.id) : null;
  const kind = fields.kind || bestaand?.kind || GOAL_KIND.RACE;
  if (kind === GOAL_KIND.RACE) {
    // De id komt van hier en niet van het racemodel: loadRaceGoals() sorteert
    // op datum, dus "de laatste in de lijst" is niet de zojuist toegevoegde.
    const id = fields.id || `race_${Date.now()}`;
    saveRaceGoal({
      id,
      ...(fields.name != null ? { name: fields.name } : {}),
      ...(fields.distanceKm != null ? { distanceKm: fields.distanceKm } : {}),
      ...(fields.targetTimeSec !== undefined ? { targetTimeSec: fields.targetTimeSec } : {}),
      ...(fields.date != null ? { date: fields.date } : {}),
      ...(fields.terrain != null ? { terrain: fields.terrain } : {}),
      ...(fields.enabled != null ? { enabled: fields.enabled } : {}),
      ...(fields.priority != null
        ? { priority: fields.priority === PRIORITY.PRIMARY ? 1 : 2 } : {}),
    });
    const i = arr.findIndex(g => g.id === id);
    const overlay = { id, kind: GOAL_KIND.RACE, ...overlayOf(fields), updatedAt: now };
    if (i >= 0) arr[i] = { ...arr[i], ...overlay }; else arr.push(overlay);
    writeRaw(arr);
    return findRunGoal(id);
  }

  if (fields.id) {
    const i = arr.findIndex(g => g.id === fields.id);
    if (i >= 0) {
      arr[i] = stripDerived({ ...arr[i], ...fields, updatedAt: now });
      writeRaw(arr);
      return hydrate(arr[i]);
    }
  }
  const goal = stripDerived({
    id: `rg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    kind: GOAL_KIND.RACE, name: '', distanceKm: null, targetTimeSec: null,
    date: null, windowStart: null, windowEnd: null,
    outcomeAvgHr: null, continuous: false, effort: null, recoveryCriterion: false,
    terrain: 'road', priority: PRIORITY.SECONDARY, enabled: true,
    createdAt: now, updatedAt: now,
    ...fields,
  });
  arr.unshift(goal);
  writeRaw(arr);
  return hydrate(goal);
}

export function deleteRunGoal(id) {
  writeRaw((readRaw() || []).filter(g => g.id !== id));
  // Was het een wedstrijd, dan moet hij ook uit het racemodel weg — anders
  // komt hij bij de volgende render gewoon weer tevoorschijn.
  if (loadRaceGoals().some(g => g.id === id)) deleteRaceGoal(id);
}

// Afgeleide velden nooit terugschrijven.
function stripDerived(g) {
  const {
    targetPaceSecPerKm, targetPaceLabel, targetTimeLabel, targetMinutes,
    targetPace, kindLabel, windowLabel, criteria, ...rest
  } = g;
  return rest;
}

// ── Invoer ──────────────────────────────────────────────────────
// Wat moet je invullen voor deze vorm, en klopt het?
export function fieldsFor(kind) {
  return KIND_META[kind]?.velden || KIND_META.RACE.velden;
}

export function validateRunGoal(goal) {
  const problems = [];
  const velden = fieldsFor(goal.kind);

  if (!goal.name || !goal.name.trim()) problems.push({ field: 'name', text: 'Geef het doel een naam.' });
  if (!(goal.distanceKm > 0)) problems.push({ field: 'distanceKm', text: 'Vul een afstand in.' });

  if (velden.includes('targetTimeSec') && goal.kind !== GOAL_KIND.ENDURANCE
      && goal.targetTimeSec == null) {
    problems.push({ field: 'targetTimeSec', text: 'Vul een streeftijd in.' });
  }
  if (goal.kind === GOAL_KIND.ECONOMY && goal.outcomeAvgHr == null) {
    problems.push({ field: 'outcomeAvgHr',
      text: 'Een economiedoel heeft juist die hartslag nodig — dat is het halve doel.' });
  }
  if (goal.kind === GOAL_KIND.RACE && !goal.date) {
    problems.push({ field: 'date', text: 'Een wedstrijd heeft een datum.' });
  }
  if (goal.windowStart && goal.windowEnd && goal.windowEnd < goal.windowStart) {
    problems.push({ field: 'windowEnd', text: 'Het venster eindigt vóór het begint.' });
  }
  // Een streeftijd die sneller is dan het wereldrecord is geen ambitie maar
  // een typefout. Grof, maar het vangt de nul die er per ongeluk bij ging.
  if (goal.targetTimeSec != null && goal.distanceKm > 0) {
    const pace = goal.targetTimeSec / goal.distanceKm;
    if (pace < 150) problems.push({ field: 'targetTimeSec',
      text: 'Dat tempo is sneller dan het wereldrecord — klopt de tijd?' });
    if (pace > 1800) problems.push({ field: 'targetTimeSec',
      text: 'Dat is langzamer dan wandelen; bedoelde je minuten of uren?' });
  }
  if (goal.outcomeAvgHr != null && (goal.outcomeAvgHr < 80 || goal.outcomeAvgHr > 200)) {
    problems.push({ field: 'outcomeAvgHr', text: 'Die hartslag lijkt niet te kloppen.' });
  }
  return problems;
}

export function parseTargetTime(input) { return parseTime(input); }

// ── De grens die niet overschreden mag worden ───────────────────
// Eén functie die expliciet zegt wat een doel NIET mag doen. Hij bestaat om
// aangeroepen te worden in tests, en om in de code aanwijsbaar te maken dat
// dit een keuze is en geen vergetelheid.
export function hrCeilingFromGoals() {
  // Bewust altijd null. Een doelhartslag is een uitkomst; de dagelijkse
  // sturing komt uit hrModel en nergens anders vandaan.
  return null;
}

export const STORAGE_KEY = KEY;

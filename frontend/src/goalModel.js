// Het generieke doelmodel — alles behalve races.
//
// Waarom er twee doelmodellen zijn en dat zo blijft: een racedoel heeft
// eigenschappen die nergens anders voorkomen. Een afstand, een streeftijd,
// een daaruit berekend racetempo, een datum die vastligt omdat er die dag
// een startschot klinkt, een terreintype. Dat model staat in raceGoalModel.js
// en blijft daar. Wie racedoelen terugduwt in een generiek
// { metric, target_value } verliest precies de dingen die een race een race
// maken.
//
// Dit bestand is voor al het andere: gewicht, taille, slaap, kracht, huid,
// gewoontes, tijd. Daar is een doel wél een getal met een richting en een
// datum, en juist daar was het model tot nu toe té dun — een metric, een
// waarde, een datum. Geen richting, geen niveau, geen afhankelijkheden,
// geen onderscheid tussen wat jij wilt en wat de coach voorstelt.
//
// De opslag blijft `gc_goals`, dezelfde sleutel als voorheen. Die staat al in
// de cloud, en een nieuwe sleutel zou een nieuwe silo zijn.

import { USER } from './config';
import { todayLocal } from './datetime';

const KEY = 'gc_goals';
const MILESTONE_KEY = 'gc_goal_milestones';

// ── Domeinen ────────────────────────────────────────────────────
// RUN staat hier voor generieke loopdoelen — "twintig minuten aaneengesloten",
// "drie loopdagen per week". Een wedstrijd hoort in RaceGoal.
export const DOMAIN = {
  RUN_GENERIC: 'RUN_GENERIC',
  BODY: 'BODY',
  SHAPE: 'SHAPE',
  SLEEP: 'SLEEP',
  FRESHNESS: 'FRESHNESS',
  GLOW: 'GLOW',
  RECOVERY: 'RECOVERY',
  HABITS: 'HABITS',
  NUTRITION: 'NUTRITION',
  TIME: 'TIME',
  LIFE_WORK: 'LIFE_WORK',
  MONEY: 'MONEY',
};

export const DOMAIN_META = {
  RUN_GENERIC: { emoji: '🏃', label: 'Run',        short: 'Run' },
  BODY:        { emoji: '⚖️', label: 'Body',       short: 'Body' },
  SHAPE:       { emoji: '💪', label: 'Shape',      short: 'Kracht' },
  SLEEP:       { emoji: '🌙', label: 'Slaap',      short: 'Slaap' },
  FRESHNESS:   { emoji: '🌿', label: 'Energie',    short: 'Energie' },
  GLOW:        { emoji: '✨', label: 'Glow',       short: 'Glow' },
  RECOVERY:    { emoji: '🛌', label: 'Herstel',    short: 'Herstel' },
  HABITS:      { emoji: '🔁', label: 'Gewoontes',  short: 'Gewoontes' },
  NUTRITION:   { emoji: '🥗', label: 'Voeding',    short: 'Voeding' },
  TIME:        { emoji: '🕐', label: 'Tijd',       short: 'Tijd' },
  LIFE_WORK:   { emoji: '💼', label: 'Werk',       short: 'Werk' },
  MONEY:       { emoji: '💰', label: 'Geld',       short: 'Geld' },
};

// Oude domeinnamen naar nieuwe. RUN werd gebruikt voor zowel generieke
// loopdoelen als voor een als-doel-vermomde race; die laatste zijn eerder
// al naar RaceGoal verhuisd.
const LEGACY_DOMAIN = { RUN: 'RUN_GENERIC', SHAPE: 'SHAPE', FRESHNESS: 'FRESHNESS' };

export const DIRECTION = {
  INCREASE: 'increase',
  DECREASE: 'decrease',
  MAINTAIN: 'maintain',
  ACHIEVE: 'achieve',
};

export const TARGET_LEVEL = { PRIMARY: 'primary', PERFORMANCE: 'performance', STRETCH: 'stretch' };
export const PRIORITY = ['primary', 'secondary', 'someday'];
export const STATUS = ['active', 'paused', 'achieved', 'expired', 'revised', 'dropped'];
export const SOURCE = { USER: 'user', COACH: 'coach' };

// ── Metrics ─────────────────────────────────────────────────────
// Per metric: waar de huidige waarde vandaan komt, welke kant "beter" op is,
// en hoe betrouwbaar de meting is. Dat laatste is geen detail — een
// tailleomtrek die je zelf met een lintje meet heeft een heel andere
// foutmarge dan het aantal krachtsessies dat je hebt geregistreerd.
//
// `quality`:
//   COUNTED    geteld uit registraties; nauwkeurig zolang je invult
//   TREND      alleen als voortschrijdend gemiddelde te lezen, niet per meting
//   STANDARD   alleen vergelijkbaar bij gestandaardiseerde meting
//   SUBJECTIVE eigen inschatting; uitkomstmaat, geen meetwaarde
export const QUALITY = {
  COUNTED: 'COUNTED', TREND: 'TREND', STANDARD: 'STANDARD', SUBJECTIVE: 'SUBJECTIVE',
};

export const METRICS = {
  // ── Run (generiek; races staan in RaceGoal) ────────────────────
  continuous_min:   { domain: 'RUN_GENERIC', label: 'Aaneengesloten lopen', unit: 'min',
                      dir: 'increase', quality: 'COUNTED', source: 'runningEngine' },
  distance_km:      { domain: 'RUN_GENERIC', label: 'Afstand uitlopen', unit: 'km',
                      dir: 'increase', quality: 'COUNTED', source: 'runningEngine' },
  run_walk_minutes: { domain: 'RUN_GENERIC', label: 'Comfortabele run/walk-duur', unit: 'min',
                      dir: 'increase', quality: 'COUNTED', source: 'runningEngine' },
  run_days_week:    { domain: 'RUN_GENERIC', label: 'Hardloopdagen per week', unit: 'dagen',
                      dir: 'maintain', quality: 'COUNTED', source: 'runningEngine',
                      note: 'Een plafond, geen streefgetal.' },
  max_session_min:  { domain: 'RUN_GENERIC', label: 'Max duur per sessie', unit: 'min',
                      dir: 'maintain', quality: 'COUNTED', source: 'runningEngine' },

  // ── Body ───────────────────────────────────────────────────────
  weight:      { domain: 'BODY', label: 'Gewicht', unit: 'kg', dir: 'decrease',
                 quality: 'TREND', source: 'measurements',
                 note: 'Beoordeeld op voortschrijdend gemiddelde, niet op losse weegmomenten.' },
  weight_min:  { domain: 'BODY', label: 'Ondergrens gewicht', unit: 'kg', dir: 'maintain',
                 quality: 'TREND', source: 'measurements', constraint: true,
                 note: 'Harde grens die jij zelf zet. Hieronder adviseert de coach nooit verder.' },
  waist:       { domain: 'BODY', label: 'Taille', unit: 'cm', dir: 'decrease',
                 quality: 'STANDARD', source: 'measurements',
                 note: 'Alleen vergelijkbaar bij dezelfde meetplek, hetzelfde moment van de dag.' },
  hip:         { domain: 'BODY', label: 'Heup', unit: 'cm', dir: 'decrease',
                 quality: 'STANDARD', source: 'measurements' },
  body_fat:    { domain: 'BODY', label: 'Vetpercentage', unit: '%', dir: 'decrease',
                 quality: 'TREND', source: 'measurements',
                 note: 'Elke thuismeting heeft een ruime foutmarge. Alleen de richting zegt iets.' },
  clothing:    { domain: 'BODY', label: 'Kledingmaat', unit: '', dir: 'achieve',
                 quality: 'SUBJECTIVE', source: 'user',
                 note: 'Uitkomstmaat: hoe kleding valt. Niet te berekenen, wel te merken.' },

  // ── Shape / kracht ─────────────────────────────────────────────
  sessions_week:  { domain: 'SHAPE', label: 'Krachtsessies per week', unit: '×',
                    dir: 'increase', quality: 'COUNTED', source: 'strength' },
  strength_score: { domain: 'SHAPE', label: 'Krachtcapaciteit', unit: 'punten',
                    dir: 'increase', quality: 'COUNTED', source: 'strength' },
  squat_kg:       { domain: 'SHAPE', label: 'Squat', unit: 'kg', dir: 'increase',
                    quality: 'COUNTED', source: 'benchmarks' },
  hinge_kg:       { domain: 'SHAPE', label: 'Deadlift/hinge', unit: 'kg', dir: 'increase',
                    quality: 'COUNTED', source: 'benchmarks' },
  glutes_kg:      { domain: 'SHAPE', label: 'Hip thrust', unit: 'kg', dir: 'increase',
                    quality: 'COUNTED', source: 'benchmarks' },
  push_reps:      { domain: 'SHAPE', label: 'Push-ups', unit: 'reps', dir: 'increase',
                    quality: 'COUNTED', source: 'benchmarks' },
  strength_focus: { domain: 'SHAPE', label: 'Krachtfocus', unit: '', dir: 'achieve',
                    quality: 'SUBJECTIVE', source: 'user' },

  // ── Slaap ──────────────────────────────────────────────────────
  sleep_hours:       { domain: 'SLEEP', label: 'Slaapuren', unit: 'u', dir: 'increase',
                       quality: 'TREND', source: 'logs',
                       note: 'Gemiddelde én mediaan én spreiding — één korte nacht is geen trend.' },
  sleep_consistency: { domain: 'SLEEP', label: 'Nachten op streefduur', unit: '%',
                       dir: 'increase', quality: 'COUNTED', source: 'logs',
                       note: 'Regelmaat weegt bij jou zwaarder dan het gemiddelde.' },

  // ── Herstel en energie ─────────────────────────────────────────
  pem_days_month: { domain: 'RECOVERY', label: 'PEM-dagen per maand', unit: 'dagen',
                    dir: 'decrease', quality: 'COUNTED', source: 'symptoms' },
  headache_days:  { domain: 'RECOVERY', label: 'Hoofdpijndagen per maand', unit: 'dagen',
                    dir: 'decrease', quality: 'COUNTED', source: 'symptoms' },
  energy_level:   { domain: 'FRESHNESS', label: 'Ervaren energie', unit: '/4',
                    dir: 'increase', quality: 'TREND', source: 'logs' },
  routines_auto:  { domain: 'FRESHNESS', label: 'Automatische routines', unit: '',
                    dir: 'achieve', quality: 'SUBJECTIVE', source: 'user' },

  // ── Glow ───────────────────────────────────────────────────────
  skin_routine:   { domain: 'GLOW', label: 'Routineconsistentie', unit: '%',
                    dir: 'increase', quality: 'COUNTED', source: 'routine' },
  spf_days:       { domain: 'GLOW', label: 'Dagen met SPF', unit: '%',
                    dir: 'increase', quality: 'COUNTED', source: 'routine' },

  // ── Gewoontes en voeding ───────────────────────────────────────
  protein_days:   { domain: 'NUTRITION', label: 'Dagen met genoeg eiwit', unit: '%',
                    dir: 'increase', quality: 'COUNTED', source: 'logs' },
  alcohol_free:   { domain: 'NUTRITION', label: 'Alcoholvrije dagen', unit: '%',
                    dir: 'increase', quality: 'COUNTED', source: 'logs' },
  meal_regularity:{ domain: 'NUTRITION', label: 'Regelmaat in eten', unit: '%',
                    dir: 'increase', quality: 'COUNTED', source: 'logs' },
  habit_streak:   { domain: 'HABITS', label: 'Gewoonte volhouden', unit: 'dagen',
                    dir: 'increase', quality: 'COUNTED', source: 'logs' },

  // ── Tijd, werk, geld ───────────────────────────────────────────
  protected_hours: { domain: 'TIME', label: 'Beschermde uren per week', unit: 'u',
                     dir: 'increase', quality: 'COUNTED', source: 'dayplan' },
  free_evenings:   { domain: 'TIME', label: 'Vrije avonden per week', unit: '',
                     dir: 'increase', quality: 'COUNTED', source: 'dayplan' },
  active_projects: { domain: 'LIFE_WORK', label: 'Max actieve projecten', unit: '',
                     dir: 'maintain', quality: 'COUNTED', source: 'projects' },
  buffer:          { domain: 'MONEY', label: 'Buffer', unit: '€', dir: 'increase',
                     quality: 'COUNTED', source: 'user' },
};

export function metricInfo(metric, domain = null) {
  const m = METRICS[metric];
  if (m) return { id: metric, ...m };
  return { id: metric, domain: domain || 'FRESHNESS', label: metric, unit: '',
    dir: 'achieve', quality: 'SUBJECTIVE', source: 'user' };
}

export function metricsForDomain(domain) {
  return Object.entries(METRICS)
    .filter(([, m]) => m.domain === domain)
    .map(([id, m]) => ({ id, ...m }));
}

// ── Opslag ──────────────────────────────────────────────────────
function readRaw() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeRaw(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }

// ── Migratie ────────────────────────────────────────────────────
// Het oude model had zeven velden. Het nieuwe heeft er meer, maar geen enkel
// oud doel mag daardoor veranderen van betekenis. Alles wat ontbreekt wordt
// afgeleid, nooit geraden: de richting komt uit de metric, het niveau uit de
// prioriteit, de bron is "user" omdat de coach vroeger geen doelen maakte.
export function migrate(goal) {
  const domain = LEGACY_DOMAIN[goal.domain] || goal.domain || 'FRESHNESS';
  const info = metricInfo(goal.metric, domain);
  return {
    // identiteit
    id: goal.id,
    domain,
    metric: goal.metric,
    name: goal.name ?? null,
    description: goal.description ?? null,

    // waarden
    current_value: goal.current_value ?? null,
    target_value: goal.target_value ?? null,
    unit: goal.unit || info.unit || '',
    direction: goal.direction || info.dir,

    // tijd
    target_date: goal.target_date ?? null,
    target_window_start: goal.target_window_start ?? null,
    target_window_end: goal.target_window_end ?? null,

    // ordening
    priority: goal.priority || 'secondary',
    target_level: goal.target_level || (goal.priority === 'primary' ? 'primary' : 'performance'),
    goal_type: goal.goal_type || null,
    status: goal.status || 'active',
    source: goal.source || SOURCE.USER,

    // samenhang
    parent_goal_id: goal.parent_goal_id ?? null,
    comparison_goal_id: goal.comparison_goal_id ?? null,
    constraints: Array.isArray(goal.constraints) ? goal.constraints : [],
    dependencies: Array.isArray(goal.dependencies) ? goal.dependencies : [],

    notes: goal.notes || '',
    created_at: goal.created_at || new Date().toISOString(),
    updated_at: goal.updated_at || goal.created_at || new Date().toISOString(),
  };
}

// Eenmalige seed, alleen als er werkelijk niets staat. Niet-destructief:
// bestaat er al één doel, dan gebeurt hier niets.
function seedIfEmpty() {
  const existing = readRaw();
  if (existing.length) return existing;
  const now = new Date().toISOString();
  const seeded = [
    { domain: 'BODY', metric: 'weight', target_value: USER.goalWeight, unit: 'kg',
      priority: 'primary', direction: 'decrease' },
    { domain: 'BODY', metric: 'weight_min', target_value: USER.minWeight, unit: 'kg',
      priority: 'primary', direction: 'maintain',
      notes: 'Absolute ondergrens — nooit onder, ongeacht tempo.' },
    { domain: 'RUN_GENERIC', metric: 'distance_km', target_value: 5, unit: 'km',
      priority: 'primary', direction: 'increase' },
    { domain: 'MONEY', metric: 'buffer', target_value: 15000, unit: '€',
      priority: 'secondary', direction: 'increase' },
  ].map((g, i) => ({
    id: `g_seed_${i}`, current_value: null, target_date: null, status: 'active',
    source: SOURCE.USER, created_at: now, updated_at: now, ...g,
  }));
  writeRaw(seeded);
  return seeded;
}

export function loadGoals() {
  return seedIfEmpty().map(migrate);
}

export function activeGoals() {
  return loadGoals().filter(g => g.status === 'active');
}

export function goalsByDomain(domain) {
  return loadGoals().filter(g => g.domain === domain && g.status !== 'dropped');
}

export function findGoal(id) {
  return loadGoals().find(g => g.id === id) || null;
}

export function activeGoal(domain, metric) {
  return loadGoals().find(g =>
    g.domain === domain && g.metric === metric && g.status === 'active') || null;
}

export function goalTarget(domain, metric, fallback = null) {
  const v = activeGoal(domain, metric)?.target_value;
  return v == null || v === '' ? fallback : v;
}

// Harde grenzen die de gebruiker zelf heeft gezet. De coach mag hier nooit
// overheen adviseren, ook niet als een ander doel dat sneller zou halen.
export function userConstraints() {
  return loadGoals()
    .filter(g => g.status === 'active' && METRICS[g.metric]?.constraint)
    .map(g => ({ metric: g.metric, value: g.target_value, unit: g.unit,
      label: metricInfo(g.metric).label, notes: g.notes }));
}

// ── Schrijven ───────────────────────────────────────────────────
// Elke wijziging houdt bij wie hem maakte. Dat is niet administratie: het is
// het verschil tussen "ik heb dit besloten" en "de coach heeft dit veranderd",
// en zonder dat verschil kan de coach ongemerkt jouw doel verzetten.
export function saveGoal(fields, { by = SOURCE.USER } = {}) {
  const arr = readRaw();
  const now = new Date().toISOString();

  if (fields.id) {
    const i = arr.findIndex(g => g.id === fields.id);
    if (i >= 0) {
      const before = arr[i];
      // Een coach mag geen doelwaarde of datum van de gebruiker wijzigen.
      // Voorstellen daarvoor lopen via een suggestie die jij accepteert.
      if (by === SOURCE.COACH && (before.source || SOURCE.USER) === SOURCE.USER) {
        const verboden = ['target_value', 'target_date', 'target_window_start',
          'target_window_end', 'direction', 'metric', 'domain'];
        for (const f of verboden) {
          if (f in fields && fields[f] !== before[f]) {
            throw new Error(
              `De coach mag ${f} van een eigen doel niet wijzigen; gebruik een voorstel.`);
          }
        }
      }
      arr[i] = { ...before, ...fields, updated_at: now };
      writeRaw(arr);
      return migrate(arr[i]);
    }
  }

  const goal = {
    id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    domain: 'FRESHNESS', metric: '', current_value: null, target_value: null,
    target_date: null, priority: 'secondary', status: 'active',
    unit: '', notes: '', source: by, created_at: now, updated_at: now,
    ...fields,
  };
  arr.unshift(goal);
  writeRaw(arr);
  return migrate(goal);
}

export function deleteGoal(id) {
  writeRaw(readRaw().filter(g => g.id !== id));
}

// ── Coach milestones ────────────────────────────────────────────
// Een tussenstap die het systeem voorstelt. Zichtbaar, uitlegbaar,
// automatisch bij te stellen — en nooit vermomd als jouw doel.
//
// Ze staan apart van de doelen zelf, want anders zou een lijst met "mijn
// doelen" volstromen met stappen die jij nooit hebt gekozen.
export function loadMilestones() {
  try {
    const arr = JSON.parse(localStorage.getItem(MILESTONE_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function saveMilestone(ms) {
  const arr = loadMilestones();
  const now = new Date().toISOString();
  const i = arr.findIndex(m => m.id === ms.id);
  const rec = {
    id: ms.id || `ms_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    goal_id: null, label: '', target_value: null, target_date: null,
    status: 'open', source: SOURCE.COACH, rationale: '',
    created_at: now, ...ms, updated_at: now,
  };
  if (i >= 0) arr[i] = { ...arr[i], ...rec };
  else arr.unshift(rec);
  localStorage.setItem(MILESTONE_KEY, JSON.stringify(arr.slice(0, 200)));
  return rec;
}

export function milestonesFor(goalId) {
  return loadMilestones().filter(m => m.goal_id === goalId);
}

export function deleteMilestone(id) {
  localStorage.setItem(MILESTONE_KEY,
    JSON.stringify(loadMilestones().filter(m => m.id !== id)));
}

// De sleutels die dit bestand gebruikt, zodat een opslagtest ze kan vinden.
export const STORAGE_KEYS = { goals: KEY, milestones: MILESTONE_KEY };

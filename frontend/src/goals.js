// Centrale doelenstore — één bron voor alle aanpasbare doelen.
// Vervangt verspreide hardcoded targets. Coachlogica leest hier.
//
// Goal = { id, domain, metric, current_value, target_value, target_date,
//          priority, status, unit, notes, strategy, constraints,
//          created_at, updated_at }

import { USER } from './config';
import { loadWorkouts, paceToMin } from './workouts';

const KEY = 'gc_goals';

export const GOAL_DOMAINS = [
  { id: 'RUN',       emoji: '🏃', label: 'Run' },
  { id: 'BODY',      emoji: '⚖️', label: 'Body' },
  { id: 'SHAPE',     emoji: '💪', label: 'Shape' },
  { id: 'FRESHNESS', emoji: '🌿', label: 'Freshness' },
  { id: 'MONEY',     emoji: '💰', label: 'Money' },
  { id: 'TIME',      emoji: '🕐', label: 'Time' },
  { id: 'LIFE_WORK', emoji: '💼', label: 'Life/Work' },
];

export const GOAL_PRIORITIES = ['primary', 'secondary', 'someday'];
export const GOAL_STATUSES = ['active', 'achieved', 'paused', 'dropped'];

// Metrics per domein — bepalen invoertype en eenheid
export const GOAL_METRICS = {
  RUN: [
    { id: 'run_walk_minutes', label: 'Comfortabele run/walk-duur', unit: 'min' },
    { id: 'continuous_min',   label: 'Aaneengesloten lopen',       unit: 'min' },
    { id: 'distance_km',      label: 'Afstand uitlopen',           unit: 'km' },
    { id: 'time_5k',          label: '5 km tijd',                  unit: 'min' },
    { id: 'pace_easy',        label: 'Easy tempo',                 unit: 'min/km' },
    { id: 'run_days_week',    label: 'Max hardloopdagen per week', unit: 'dagen' },
    { id: 'max_session_min',  label: 'Max duur per sessie',        unit: 'min' },
  ],
  BODY: [
    { id: 'weight',      label: 'Gewicht',        unit: 'kg' },
    { id: 'weight_min',  label: 'Ondergrens gewicht', unit: 'kg' },
    { id: 'waist',       label: 'Taille',         unit: 'cm' },
    { id: 'hip',         label: 'Heup',           unit: 'cm' },
    { id: 'body_fat',    label: 'Vetpercentage',  unit: '%' },
    { id: 'clothing',    label: 'Kledingmaat',    unit: '' },
  ],
  SHAPE: [
    { id: 'strength_focus', label: 'Krachtfocus',            unit: '' },
    { id: 'squat_kg',       label: 'Squat',                  unit: 'kg' },
    { id: 'hinge_kg',       label: 'Deadlift/hinge',         unit: 'kg' },
    { id: 'glutes_kg',      label: 'Hip thrust',             unit: 'kg' },
    { id: 'push_reps',      label: 'Push-ups',               unit: 'reps' },
    { id: 'sessions_week',  label: 'Krachtsessies per week', unit: 'x' },
  ],
  FRESHNESS: [
    { id: 'sleep_hours',    label: 'Slaapuren',            unit: 'u' },
    { id: 'pem_days_month', label: 'PEM-dagen per maand',  unit: 'dagen' },
    { id: 'routines_auto',  label: 'Automatische routines', unit: '' },
  ],
  MONEY:     [{ id: 'buffer', label: 'Buffer', unit: '€' }],
  TIME:      [{ id: 'free_evenings', label: 'Vrije avonden per week', unit: '' },
              { id: 'protected_hours', label: 'Beschermde uren per week', unit: 'u' }],
  LIFE_WORK: [{ id: 'active_projects', label: 'Max actieve projecten', unit: '' }],
};

export function metricInfo(domain, metric) {
  return (GOAL_METRICS[domain] || []).find(m => m.id === metric)
    || { id: metric, label: metric, unit: '' };
}

// ── Opslag ──────────────────────────────────────────────────────
function readRaw() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function persist(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }

// Eenmalige, niet-destructieve seed uit de bestaande lichaamsconfig.
// Zo blijven de huidige waarden behouden en worden ze bewerkbaar.
function seedIfEmpty() {
  const existing = readRaw();
  if (existing.length) return existing;
  const now = new Date().toISOString();
  const seeded = [
    { domain: 'BODY', metric: 'weight', current_value: null,
      target_value: USER.goalWeight, unit: 'kg', priority: 'primary' },
    { domain: 'BODY', metric: 'weight_min', current_value: null,
      target_value: USER.minWeight, unit: 'kg', priority: 'primary',
      notes: 'Absolute ondergrens — nooit onder, ongeacht tempo.' },
    { domain: 'RUN', metric: 'distance_km', current_value: null,
      target_value: 5, unit: 'km', priority: 'primary' },
    { domain: 'MONEY', metric: 'buffer', current_value: null,
      target_value: 15000, unit: '€', priority: 'secondary' },
  ].map((g, i) => ({
    id: `g_seed_${i}`, target_date: null, status: 'active',
    created_at: now, updated_at: now, ...g,
  }));
  persist(seeded);
  return seeded;
}

export function loadGoals() { return seedIfEmpty(); }

export function goalsByDomain(domain) {
  return loadGoals().filter(g => g.domain === domain && g.status !== 'dropped');
}

// Actief doel voor één metric — de canonieke waarde voor coachlogica
export function activeGoal(domain, metric) {
  return loadGoals().find(g => g.domain === domain && g.metric === metric && g.status === 'active') || null;
}

export function goalTarget(domain, metric, fallback = null) {
  const g = activeGoal(domain, metric);
  const v = g?.target_value;
  return v == null || v === '' ? fallback : v;
}

export function saveGoal(fields) {
  const arr = loadGoals();
  const now = new Date().toISOString();
  if (fields.id) {
    const i = arr.findIndex(g => g.id === fields.id);
    if (i >= 0) { arr[i] = { ...arr[i], ...fields, updated_at: now }; persist(arr); return arr[i]; }
  }
  const goal = {
    id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    domain: 'RUN', metric: '', current_value: null, target_value: null,
    target_date: null, priority: 'secondary', status: 'active',
    unit: '', notes: '', created_at: now, updated_at: now, ...fields,
  };
  arr.unshift(goal);
  persist(arr);
  return goal;
}

export function deleteGoal(id) { persist(loadGoals().filter(g => g.id !== id)); }

// ── Hartslag- en RPE-kaders — instelbaar, met veilige defaults ──
const HR_KEY = 'gc_hr_settings';
const HR_DEFAULTS = {
  easyLow: USER.hrZone?.low ?? 106,
  easyHigh: USER.hrZone?.high ?? 132,
  walkTrigger: 130,      // hierboven: overgaan op wandelen
  resumeBelow: 105,      // hervatten zodra HR hieronder zakt
  recoveryHR: null,      // optioneel
  rpeEasy: 4,
  rpeThreshold: 6,
};

export function loadHrSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(HR_KEY) || 'null');
    return saved ? { ...HR_DEFAULTS, ...saved } : HR_DEFAULTS;
  } catch { return HR_DEFAULTS; }
}
export function saveHrSettings(patch) {
  const next = { ...loadHrSettings(), ...patch };
  localStorage.setItem(HR_KEY, JSON.stringify(next));
  return next;
}
export const HR_DEFAULT_VALUES = HR_DEFAULTS;

// Leesbare zone-omschrijving voor sessiekaarten
export function hrZoneText() {
  const h = loadHrSettings();
  return `Easy HR: ${h.easyLow}–${h.easyHigh} bpm`;
}

// ── Goal feasibility check ──────────────────────────────────────
// Beoordeelt of een doel haalbaar is binnen de deadline, gegeven de
// werkelijke belastbaarheid. Bouwt NOOIT sneller op door een kortere
// deadline — een strak doel leidt tot een eerlijker oordeel, niet tot
// een agressiever schema.
const SAFE_WEEKLY_GROWTH = 0.08;   // 8% per week bij goede tolerantie
const CAUTIOUS_GROWTH    = 0.05;   // 5% bij wisselend herstel

export function feasibilityCheck(goal, logs = {}) {
  if (!goal || goal.domain !== 'RUN') return null;
  const target = parseFloat(goal.target_value);
  if (!target || !goal.target_date) {
    return { verdict: 'onbekend', reason: 'Zonder streefdatum kan ik geen haalbaarheid berekenen.' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const weeks = Math.max(0, (new Date(goal.target_date) - new Date(today)) / (7 * 86400000));
  if (weeks < 0.5) {
    return { verdict: 'te kort', reason: 'De streefdatum is (bijna) verstreken.' };
  }

  // Huidige capaciteit uit echte workoutdata
  const runs = loadWorkouts().filter(w => (w.activityType === 'run' || w.activityType == null));
  const isDistance = goal.metric === 'distance_km';
  const current = isDistance
    ? runs.reduce((m, w) => Math.max(m, parseFloat(w.distance) || 0), 0)
    : runs.reduce((m, w) => Math.max(m, parseFloat(w.duration) || 0), 0);

  if (!current) {
    return { verdict: 'onbekend',
      reason: 'Nog geen geregistreerde sessies — log een paar runs, dan kan ik dit beoordelen.' };
  }

  // Herstelcapaciteit: recente PEM-signalen en slecht verdragen sessies
  const recent = Object.values(logs).filter(l => l.date >= addDaysStr(today, -28));
  const pem = recent.filter(l => l.symptom_pem || l.delayed_fatigue || l.recovery_check === 'bad').length;
  const tolerated = recent.filter(l => l.recovery_check === 'good').length;
  const cautious = pem > 1 || tolerated < 2;
  const allowedGrowth = cautious ? CAUTIOUS_GROWTH : SAFE_WEEKLY_GROWTH;

  const requiredGrowth = Math.pow(target / current, 1 / weeks) - 1;
  const unit = isDistance ? 'km' : 'min';

  let verdict, reason;
  if (requiredGrowth <= allowedGrowth * 0.7) {
    verdict = 'haalbaar';
    reason = `Je zit nu op ${round1(current)} ${unit}. Naar ${target} ${unit} in ${Math.round(weeks)} weken vraagt ${pct(requiredGrowth)}/week — ruim binnen wat je herstel toelaat (${pct(allowedGrowth)}).`;
  } else if (requiredGrowth <= allowedGrowth) {
    verdict = 'ambitieus';
    reason = `Van ${round1(current)} naar ${target} ${unit} in ${Math.round(weeks)} weken vraagt ${pct(requiredGrowth)}/week. Dat kan, maar alleen als je herstel goed blijft — bij één slechte delayed response schuift de datum op.`;
  } else {
    const realisticWeeks = Math.ceil(Math.log(target / current) / Math.log(1 + allowedGrowth));
    verdict = 'nu niet verantwoord';
    reason = `Dit vraagt ${pct(requiredGrowth)} groei per week; jouw data laat nu ${pct(allowedGrowth)} toe${cautious ? ' (recente PEM-signalen)' : ''}. Realistisch heb je ~${realisticWeeks} weken nodig. Ik pas het schema niet sneller aan — de datum schuift, de opbouw niet.`;
  }

  return {
    verdict, reason,
    current: round1(current), target, unit,
    weeks: Math.round(weeks),
    requiredGrowth: pct(requiredGrowth),
    allowedGrowth: pct(allowedGrowth),
    cautious,
  };
}

function pct(x) { return `${(x * 100).toFixed(1)}%`; }
function round1(x) { return Math.round(x * 10) / 10; }
function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Body composition-oordeel ────────────────────────────────────
// Herkent positieve recompositie: gewicht stabiel, taille omlaag,
// kracht omhoog telt als vooruitgang.
export function bodyCompositionVerdict({ weights = [], measurements = [], strengthTrend = null }) {
  if (weights.length < 2) return null;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const wStart = sorted[0].weight, wNow = sorted[sorted.length - 1].weight;
  const dW = wNow - wStart;

  const waists = measurements.filter(m => m.waist).sort((a, b) => a.date.localeCompare(b.date));
  const dWaist = waists.length >= 2 ? waists[waists.length - 1].waist - waists[0].waist : null;

  const strongerUp = strengthTrend === 'up';
  const stable = Math.abs(dW) < 1;

  if (stable && dWaist != null && dWaist < -1 && strongerUp) {
    return { type: 'recomposition', text:
      `Gewicht stabiel (${dW >= 0 ? '+' : ''}${round1(dW)} kg), taille ${round1(Math.abs(dWaist))} cm kleiner en je lifts gaan omhoog. Dat is positieve recompositie — de weegschaal vertelt hier niet het hele verhaal.` };
  }
  if (dW < -0.5 && dWaist != null && dWaist < 0) {
    return { type: 'fatloss', text:
      `${round1(Math.abs(dW))} kg lichter én ${round1(Math.abs(dWaist))} cm van je taille. Trend en maten wijzen dezelfde kant op.` };
  }
  if (stable && dWaist != null && dWaist < -1) {
    return { type: 'recomposition', text:
      `Gewicht vrijwel gelijk maar je taille is ${round1(Math.abs(dWaist))} cm kleiner. Vorm verandert ook zonder dat de weegschaal beweegt.` };
  }
  if (dW > 1 && strongerUp) {
    return { type: 'gain', text:
      `Gewicht ${round1(dW)} kg omhoog terwijl je kracht toeneemt. Kijk naar taille en foto's voordat je dit als terugval leest.` };
  }
  return null;
}

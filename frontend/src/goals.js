// Verenigbaarheidslaag over het generieke doelmodel.
//
// Het model zelf staat in goalModel.js; hier staat wat de rest van de app al
// jaren aanroept. Dat is geen dubbeling maar een vertaalslag: het oude model
// kende `domain: 'RUN'` voor generieke loopdoelen, het nieuwe noemt dat
// RUN_GENERIC. Wie hier binnenkomt met de oude naam krijgt gewoon antwoord.
//
// Wat hier is gebleven omdat het bewezen werkt en getest is:
// `feasibilityCheck` (met zijn expliciete weigering om tijd- en tempodoelen
// te beoordelen) en `bodyCompositionVerdict`.

import { USER } from './config';
import { loadWorkouts } from './workouts';
import { todayLocal } from './datetime';
import {
  DOMAIN_META, METRICS, metricsForDomain,
  metricInfo as modelMetricInfo,
  loadGoals as modelLoadGoals,
  saveGoal as modelSaveGoal,
  deleteGoal as modelDeleteGoal,
  PRIORITY, STATUS,
} from './goalModel';

// Oude domeinnaam → nieuwe. Alleen RUN is hernoemd.
const toModelDomain = (d) => (d === 'RUN' ? 'RUN_GENERIC' : d);
// En terug, zodat bestaande schermen hun eigen naam blijven zien.
const toLegacyDomain = (d) => (d === 'RUN_GENERIC' ? 'RUN' : d);

export const GOAL_DOMAINS = [
  { id: 'RUN',       emoji: DOMAIN_META.RUN_GENERIC.emoji, label: 'Run' },
  { id: 'BODY',      emoji: DOMAIN_META.BODY.emoji,      label: 'Body' },
  { id: 'SHAPE',     emoji: DOMAIN_META.SHAPE.emoji,     label: 'Shape' },
  { id: 'SLEEP',     emoji: DOMAIN_META.SLEEP.emoji,     label: 'Slaap' },
  { id: 'FRESHNESS', emoji: DOMAIN_META.FRESHNESS.emoji, label: 'Freshness' },
  { id: 'RECOVERY',  emoji: DOMAIN_META.RECOVERY.emoji,  label: 'Herstel' },
  { id: 'GLOW',      emoji: DOMAIN_META.GLOW.emoji,      label: 'Glow' },
  { id: 'NUTRITION', emoji: DOMAIN_META.NUTRITION.emoji, label: 'Voeding' },
  { id: 'HABITS',    emoji: DOMAIN_META.HABITS.emoji,    label: 'Gewoontes' },
  { id: 'MONEY',     emoji: DOMAIN_META.MONEY.emoji,     label: 'Money' },
  { id: 'TIME',      emoji: DOMAIN_META.TIME.emoji,      label: 'Time' },
  { id: 'LIFE_WORK', emoji: DOMAIN_META.LIFE_WORK.emoji, label: 'Life/Work' },
];

export const GOAL_PRIORITIES = PRIORITY;
export const GOAL_STATUSES = STATUS.filter(s => s !== 'revised' && s !== 'expired');

// Metrics per domein, in de vorm die de bestaande schermen verwachten.
export const GOAL_METRICS = Object.fromEntries(
  GOAL_DOMAINS.map(d => [d.id,
    metricsForDomain(toModelDomain(d.id)).map(m => ({ id: m.id, label: m.label, unit: m.unit }))]));

export function metricInfo(domain, metric) {
  const m = modelMetricInfo(metric, toModelDomain(domain));
  return { id: m.id, label: m.label, unit: m.unit || '' };
}

// ── Opslag: één bron, in goalModel ──────────────────────────────
export function loadGoals() {
  return modelLoadGoals().map(g => ({ ...g, domain: toLegacyDomain(g.domain) }));
}

export function goalsByDomain(domain) {
  const d = toLegacyDomain(toModelDomain(domain));
  return loadGoals().filter(g => g.domain === d && g.status !== 'dropped');
}

export function activeGoal(domain, metric) {
  const d = toLegacyDomain(toModelDomain(domain));
  return loadGoals().find(g =>
    g.domain === d && g.metric === metric && g.status === 'active') || null;
}

export function goalTarget(domain, metric, fallback = null) {
  const v = activeGoal(domain, metric)?.target_value;
  return v == null || v === '' ? fallback : v;
}

export function saveGoal(fields) {
  const patch = { ...fields };
  if (patch.domain) patch.domain = toModelDomain(patch.domain);
  const saved = modelSaveGoal(patch);
  return { ...saved, domain: toLegacyDomain(saved.domain) };
}

export function deleteGoal(id) { return modelDeleteGoal(id); }

// ── Hartslag- en RPE-kaders — instelbaar, met veilige defaults ──
const HR_KEY = 'gc_hr_settings';
// De easy-band en de RPE-ankers. Meer niet.
//
// Hier stond ook `walkTrigger: 130` — een vaste hartslag waarboven je moest
// gaan wandelen, ingesteld vanuit het doelenscherm. Dat is precies het soort
// grens dat hier niet hoort: een getal in de doelenlaag dat het actuele
// tolerantiemodel overruled. Wat er op een gegeven dag mag hangt af van de
// CPET-context, recente goed verdragen runs, tempo bij gelijke hartslag,
// drift, RPE, de vertraagde respons en de actuele intensity release — en dat
// staat allemaal in hrModel.js. Een wandelinstructie hoort bij een sessie,
// niet bij een doel.
const HR_DEFAULTS = {
  easyLow: USER.hrZone?.low ?? 106,
  easyHigh: USER.hrZone?.high ?? 132,
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

  const today = todayLocal();
  const weeks = Math.max(0, (new Date(goal.target_date) - new Date(today)) / (7 * 86400000));
  if (weeks < 0.5) {
    return { verdict: 'te kort', reason: 'De streefdatum is (bijna) verstreken.' };
  }

  // Huidige capaciteit uit echte workoutdata.
  //
  // Let op de metric. Deze functie rekende voor élke niet-afstandsmetric met
  // de langste sessieduur. Voor een tempodoel zette hij daarmee 37,7 minuten
  // naast 7 min/km — minuten naast minuten-per-kilometer — en concludeerde
  // uit dat verschil "haalbaar". Tijd- en tempodoelen horen hier niet: die
  // gaan via het RaceGoal-model en raceFeasibility, waar dezelfde eenheid
  // aan beide kanten staat.
  const TIME_METRICS = ['time_5k', 'pace_easy'];
  if (TIME_METRICS.includes(goal.metric)) {
    return { verdict: 'onbekend',
      reason: 'Tijd- en tempodoelen worden beoordeeld via je racedoelen, waar de voorspelde ' +
        'finishtijd naast je doeltijd staat. Zet dit doel om naar een racedoel met een afstand ' +
        'en een gewenste eindtijd.' };
  }

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

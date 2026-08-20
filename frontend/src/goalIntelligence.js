// Goal Intelligence — de laag die doelen laat meedoen aan het besluit.
//
// Tot nu toe waren doelen decoratie. Ze bepaalden wélke domeinen de coach
// bekeek, maar niet wat hij koos: de hefboom-engine keek naar drivers, niet
// naar afstanden tot een streefwaarde of naar hoeveel weken er nog zijn.
// Je kon je gewichtsdoel van 78 naar 72 zetten en er veranderde niets aan wat
// je te doen kreeg.
//
// Wat dit bestand toevoegt is de rekenkundige brug: van doel naar afstand,
// van afstand naar benodigd tempo, van benodigd tempo naar een oordeel, en
// van dat oordeel naar gewicht in de keuze van vandaag.
//
// Wat het NIET doet — en dat is even belangrijk:
//
//   · het rekent geen enkel domein na. Hardlopen komt uit de running-engine,
//     kracht uit de strength-engine, symptomen uit de symptomen-engine.
//     Er komt hier geen tweede waarheid bij;
//   · het maakt racedoelen niet generiek. Een RaceGoal blijft een RaceGoal;
//     er is een adapter die er een leesbare doelvorm van maakt, meer niet;
//   · het kan geen poort openzetten. Scoren gebeurt ná de harde poort, op
//     wat er dan nog overblijft. Een urgent doel is geen argument tegen
//     herstel.

import { todayLocal, addDays, daysBetween } from './datetime';
import {
  activeGoals, loadGoals, metricInfo, METRICS, DOMAIN_META,
  saveMilestone, milestonesFor, userConstraints, SOURCE,
} from './goalModel';
import { baselineFor, CONFIDENCE } from './goalBaseline';
import { loadRaceGoals } from './raceGoalModel';
import { raceFeasibility, FEASIBILITY as RACE_FEASIBILITY } from './raceFeasibility';
import { runningState, raceReadiness } from './raceGoals';
import { recoveryBudget, BAND, COST } from './recoveryBudget';

// ── Haalbaarheidsklassen ────────────────────────────────────────
export const FEASIBILITY = {
  ON_TRACK: 'ON_TRACK',                   // op dit tempo haal je het
  PROBABLE: 'PROBABLE',                   // waarschijnlijk, met de huidige aanpak
  STRETCH: 'STRETCH',                     // kan, maar alles moet meezitten
  CURRENTLY_UNLIKELY: 'CURRENTLY_UNLIKELY', // niet op dit tempo, binnen deze datum
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA', // te weinig om iets te zeggen
  NOT_SAFE_TO_CHASE: 'NOT_SAFE_TO_CHASE', // haalbaar of niet: nu niet nastreven
};

export const FEASIBILITY_META = {
  ON_TRACK:           { label: 'Op koers',        tone: 'good',    emoji: '✓' },
  PROBABLE:           { label: 'Waarschijnlijk',  tone: 'good',    emoji: '↗' },
  STRETCH:            { label: 'Ambitieus',       tone: 'warn',    emoji: '⚡' },
  CURRENTLY_UNLIKELY: { label: 'Nu niet op koers', tone: 'bad',    emoji: '·' },
  INSUFFICIENT_DATA:  { label: 'Te weinig data',  tone: 'neutral', emoji: '?' },
  NOT_SAFE_TO_CHASE:  { label: 'Nu niet nastreven', tone: 'bad',   emoji: '⚠' },
};

// Hoe snel een metric realistisch kan bewegen, per week, bij goede
// omstandigheden. Deze getallen zijn geen ambitie maar een rem: ze bepalen
// wanneer de coach zegt "dit vraagt meer dan verantwoord is" in plaats van
// het schema te versnellen.
//
// Voor gewicht staat er bewust een percentage van het lichaamsgewicht en
// geen vast aantal kilo's: een halve kilo per week is iets heel anders bij
// 60 dan bij 90 kilo.
const SAFE_RATE = {
  weight:            { pctOfValue: 0.005, min: 0.15, max: 0.6, unit: 'kg' },
  waist:             { abs: 0.35, unit: 'cm' },
  hip:               { abs: 0.3, unit: 'cm' },
  body_fat:          { abs: 0.25, unit: '%' },
  sleep_hours:       { abs: 0.2, unit: 'u' },
  sleep_consistency: { abs: 5, unit: '%' },
  sessions_week:     { abs: 0.35, unit: '×' },
  strength_score:    { abs: 2.5, unit: 'punten' },
  squat_kg:          { abs: 1.5, unit: 'kg' },
  hinge_kg:          { abs: 2, unit: 'kg' },
  glutes_kg:         { abs: 2, unit: 'kg' },
  push_reps:         { abs: 0.6, unit: 'reps' },
  distance_km:       { pctOfValue: 0.08, min: 0.2, max: 1.0, unit: 'km' },
  continuous_min:    { pctOfValue: 0.08, min: 1, max: 5, unit: 'min' },
  run_walk_minutes:  { pctOfValue: 0.08, min: 1, max: 5, unit: 'min' },
  protein_days:      { abs: 6, unit: '%' },
  alcohol_free:      { abs: 6, unit: '%' },
  meal_regularity:   { abs: 6, unit: '%' },
  skin_routine:      { abs: 8, unit: '%' },
  spf_days:          { abs: 8, unit: '%' },
  pem_days_month:    { abs: 0.5, unit: 'dagen' },
  headache_days:     { abs: 0.5, unit: 'dagen' },
  energy_level:      { abs: 0.08, unit: '/4' },
  protected_hours:   { abs: 0.5, unit: 'u' },
  free_evenings:     { abs: 0.3, unit: '' },
};

function safeRateFor(metric, currentValue) {
  const r = SAFE_RATE[metric];
  if (!r) return null;
  if (r.abs != null) return r.abs;
  const v = Math.abs(currentValue ?? 0);
  return Math.min(r.max, Math.max(r.min, v * r.pctOfValue));
}

const round1 = (x) => x == null ? null : Math.round(x * 10) / 10;
const round2 = (x) => x == null ? null : Math.round(x * 100) / 100;

// ── De adapter voor racedoelen ──────────────────────────────────
// Een RaceGoal komt hier binnen als leesbaar doel, zonder ook maar iets van
// zijn eigen model te verliezen. `raceGoal` blijft er integraal in zitten, en
// het oordeel komt van raceFeasibility — de bestaande, bewezen engine.
export function raceGoalToGoalIntelligenceInput(raceGoal) {
  if (!raceGoal) return null;
  return {
    id: `race:${raceGoal.id}`,
    kind: 'race',
    domain: 'RUN_GENERIC',
    metric: 'race_time',
    name: raceGoal.name,
    unit: 'tijd',
    direction: 'decrease',
    target_value: raceGoal.targetTimeSec,
    target_label: raceGoal.targetTimeLabel,
    target_date: raceGoal.date,
    priority: raceGoal.type === 'STRETCH' ? 'secondary' : 'primary',
    target_level: raceGoal.type === 'STRETCH' ? 'stretch'
      : raceGoal.type === 'CHECKPOINT' ? 'primary' : 'performance',
    status: raceGoal.enabled === false ? 'paused' : 'active',
    source: SOURCE.USER,
    // Het oorspronkelijke model blijft compleet beschikbaar.
    raceGoal,
  };
}

// ── Eén doel beoordelen ─────────────────────────────────────────
export function assessGoal(goal, ctx = {}) {
  const { logs = {}, currentDate = todayLocal(), state = null, budget = null } = ctx;

  // Racedoelen gaan langs hun eigen engine. Die weet van terrein, van
  // run/walk-verhoudingen en van racetempo; dat willen we hier niet nadoen.
  if (goal.kind === 'race') return assessRaceGoal(goal, { logs, currentDate, state, budget });

  const info = metricInfo(goal.metric, goal.domain);
  const base = baselineFor(goal.metric, { logs, currentDate });
  const target = parseFloat(goal.target_value);
  const hasTarget = isFinite(target);

  const out = {
    goal, kind: 'generic', domain: goal.domain, metric: goal.metric,
    label: goal.name || info.label,
    unit: goal.unit || info.unit,
    quality: info.quality,
    baseline: base,
    current: base.available ? base.value : null,
    target: hasTarget ? target : goal.target_value ?? null,
    direction: goal.direction || info.dir,
    confidence: base.confidence,
    milestones: milestonesFor(goal.id),
  };

  // Zonder meting geen oordeel. Dat is geen tekortkoming die weggepoetst moet
  // worden — het is de eerlijke uitkomst, en meestal ook meteen de actie.
  if (!base.available || base.value == null) {
    return { ...out, feasibility: FEASIBILITY.INSUFFICIENT_DATA,
      reason: base.reason || 'Nog geen betrouwbare meting voor dit doel.',
      needs: base.reason, gap: null, weeks: null };
  }

  if (!hasTarget) {
    return { ...out, feasibility: FEASIBILITY.INSUFFICIENT_DATA,
      reason: 'Dit doel heeft nog geen streefwaarde.', gap: null, weeks: null };
  }

  const dir = out.direction;
  const current = base.value;
  const gap = target - current;
  const towards = dir === 'decrease' ? -gap : gap;   // positief = nog te gaan
  const reached = dir === 'maintain'
    ? true
    : dir === 'decrease' ? current <= target : current >= target;

  // ── Onderhoudsdoelen ──────────────────────────────────────────
  // Een plafond ("hooguit drie loopdagen") is gehaald zolang je eronder zit.
  if (dir === 'maintain') {
    const within = current <= target;
    return { ...out, gap: round2(gap), weeks: null,
      feasibility: within ? FEASIBILITY.ON_TRACK : FEASIBILITY.CURRENTLY_UNLIKELY,
      reason: within
        ? `Je zit op ${round1(current)} ${out.unit}, binnen je grens van ${target}.`
        : `Je zit op ${round1(current)} ${out.unit}, boven je eigen grens van ${target}.`,
      maintain: true };
  }

  if (reached) {
    return { ...out, gap: 0, weeks: null, reached: true,
      feasibility: FEASIBILITY.ON_TRACK,
      reason: `Gehaald: ${round1(current)} ${out.unit} tegenover een doel van ${target}.` };
  }

  // ── Tijd tot het doel ─────────────────────────────────────────
  const deadline = goal.target_date || goal.target_window_end || null;
  const weeks = deadline
    ? Math.max(0, daysBetween(currentDate, deadline) / 7)
    : null;

  const safeRate = safeRateFor(goal.metric, current);
  const trendPerWeek = base.trend?.perWeek ?? null;
  // De trend in de goede richting, ongeacht of het doel omhoog of omlaag moet.
  const trendTowards = trendPerWeek == null ? null
    : (dir === 'decrease' ? -trendPerWeek : trendPerWeek);

  // Zonder datum: hoe lang duurt het op het huidige tempo?
  if (!deadline) {
    if (trendTowards != null && trendTowards > 0) {
      const wk = Math.ceil(towards / trendTowards);
      return { ...out, gap: round2(towards), weeks: null, etaWeeks: wk,
        trendPerWeek: round2(trendPerWeek),
        feasibility: FEASIBILITY.PROBABLE,
        reason: `Nog ${round1(towards)} ${out.unit} te gaan. Op je huidige tempo van ` +
          `${round2(Math.abs(trendPerWeek))} ${out.unit}/week is dat ongeveer ${wk} weken.`,
        note: 'Zonder streefdatum beoordeel ik alleen de richting, niet de haalbaarheid.' };
    }
    return { ...out, gap: round2(towards), weeks: null,
      trendPerWeek: round2(trendPerWeek),
      feasibility: trendTowards != null && trendTowards < 0
        ? FEASIBILITY.CURRENTLY_UNLIKELY : FEASIBILITY.INSUFFICIENT_DATA,
      reason: trendTowards != null && trendTowards < 0
        ? `Je beweegt op dit moment van dit doel af (${round2(trendPerWeek)} ${out.unit}/week).`
        : `Nog ${round1(towards)} ${out.unit} te gaan. Zonder trend en zonder datum kan ik ` +
          'geen haalbaarheid berekenen.' };
  }

  if (weeks < 0.5) {
    return { ...out, gap: round2(towards), weeks: 0,
      feasibility: FEASIBILITY.CURRENTLY_UNLIKELY,
      reason: 'De streefdatum is verstreken of ligt binnen een paar dagen.',
      expired: true };
  }

  const requiredRate = towards / weeks;

  // ── Het oordeel ───────────────────────────────────────────────
  let feasibility, reason;
  if (safeRate == null) {
    feasibility = FEASIBILITY.INSUFFICIENT_DATA;
    reason = 'Voor deze metric weet ik niet hoe snel verandering realistisch is.';
  } else if (requiredRate <= safeRate * 0.5) {
    feasibility = FEASIBILITY.ON_TRACK;
    reason = `Van ${round1(current)} naar ${target} ${out.unit} in ${Math.round(weeks)} weken vraagt ` +
      `${round2(requiredRate)} ${out.unit}/week — ruim binnen wat gezond kan (${round2(safeRate)}).`;
  } else if (requiredRate <= safeRate) {
    feasibility = FEASIBILITY.PROBABLE;
    reason = `Dit vraagt ${round2(requiredRate)} ${out.unit}/week; ${round2(safeRate)} is haalbaar ` +
      'als het herstel goed blijft.';
  } else if (requiredRate <= safeRate * 1.5) {
    feasibility = FEASIBILITY.STRETCH;
    reason = `Dit vraagt ${round2(requiredRate)} ${out.unit}/week terwijl ${round2(safeRate)} ` +
      'realistisch is. Kan, maar dan moet alles meezitten.';
  } else {
    const realistic = Math.ceil(towards / safeRate);
    feasibility = FEASIBILITY.CURRENTLY_UNLIKELY;
    reason = `Dit vraagt ${round2(requiredRate)} ${out.unit}/week; realistisch is ${round2(safeRate)}. ` +
      `Op een gezond tempo heb je ongeveer ${realistic} weken nodig — de datum schuift, de opbouw niet.`;
  }

  // Weinig data verlaagt de uitspraak, nooit de veiligheid.
  if (base.confidence === CONFIDENCE.LOW || base.confidence === CONFIDENCE.NONE) {
    if (feasibility === FEASIBILITY.ON_TRACK) feasibility = FEASIBILITY.PROBABLE;
    reason += ' (Weinig metingen — dit oordeel is voorlopig.)';
  }

  // ── De veiligheidsklep ────────────────────────────────────────
  // Haalbaar of niet: er zijn omstandigheden waarin een doel niet hoort te
  // worden nagejaagd. Dan is dit het antwoord, en niet "ambitieus".
  const unsafe = notSafeToChase(goal, { logs, currentDate, budget, current, target, dir });
  if (unsafe) {
    feasibility = FEASIBILITY.NOT_SAFE_TO_CHASE;
    reason = unsafe;
  }

  return {
    ...out,
    gap: round2(towards),
    weeks: Math.round(weeks),
    requiredRate: round2(requiredRate),
    safeRate: round2(safeRate),
    trendPerWeek: round2(trendPerWeek),
    onTrackByTrend: trendTowards != null && requiredRate != null
      ? trendTowards >= requiredRate : null,
    feasibility, reason,
  };
}

// ── Wanneer is een doel niet veilig om na te jagen? ─────────────
// Bewust kort en bewust hard. Dit zijn geen adviezen maar grenzen.
function notSafeToChase(goal, { logs, currentDate, budget, current, target, dir }) {
  // Een eigen ondergrens is een eigen ondergrens.
  for (const c of userConstraints()) {
    if (c.metric === 'weight_min' && goal.metric === 'weight'
        && target != null && c.value != null && target < c.value) {
      return `Je eigen ondergrens staat op ${c.value} kg. Een doel van ${target} kg ligt daaronder; ` +
        'die grens gaat voor.';
    }
  }

  // Gewichtsverlies terwijl het herstel het al niet trekt.
  if (goal.metric === 'weight' && dir === 'decrease') {
    const recent = Object.values(logs || {}).filter(l =>
      l?.date >= addDays(currentDate, -28) && l.date <= currentDate);
    const pem = recent.filter(l =>
      l.symptom_pem || l.recovery_check === 'bad' || l.training_recovery === 2).length;
    if (pem >= 3) {
      return `Drie of meer PEM-signalen in vier weken. Een energietekort erbovenop maakt herstel ` +
        'moeilijker, niet makkelijker — dit doel staat even stil.';
    }
  }

  // Meer krachtvolume terwijl de pot al leeg is.
  if (goal.metric === 'sessions_week' && dir === 'increase'
      && budget && budget.band === BAND.NONE && !budget.hardBlock) {
    return 'Je herstelruimte is op dit moment op. Meer sessies per week erbij is nu geen ' +
      'progressie maar een risico.';
  }

  return null;
}

// ── Racedoelen ──────────────────────────────────────────────────
function assessRaceGoal(goal, { logs, currentDate, state, budget }) {
  const rg = goal.raceGoal;
  const feas = raceFeasibility(rg, { logs, currentDate, state });
  const readiness = state ? raceReadiness(
    { id: rg.id, name: rg.name, date: rg.date, distanceKm: rg.distanceKm,
      terrain: rg.terrain, targetMinutes: rg.targetTimeSec / 60 },
    { logs, currentDate, state }) : null;

  // De klassen van raceFeasibility vertalen naar de gedeelde taal, zodat een
  // dashboard racedoelen en andere doelen naast elkaar kan zetten. De
  // berekening zelf blijft van raceFeasibility.
  const MAP = {
    ON_TRACK: FEASIBILITY.ON_TRACK,
    CLOSE: FEASIBILITY.PROBABLE,
    AMBITIOUS: FEASIBILITY.STRETCH,
    OUT_OF_REACH: FEASIBILITY.CURRENTLY_UNLIKELY,
    UNKNOWN: FEASIBILITY.INSUFFICIENT_DATA,
  };

  return {
    goal, kind: 'race', domain: 'RUN_GENERIC', metric: 'race_time',
    label: rg.name,
    unit: 'tijd',
    current: feas.currentLabel ?? null,
    target: rg.targetTimeLabel,
    direction: 'decrease',
    weeks: feas.weeks ?? (rg.date ? Math.round(daysBetween(currentDate, rg.date) / 7) : null),
    feasibility: MAP[feas.verdict] || FEASIBILITY.INSUFFICIENT_DATA,
    reason: feas.reason || feas.note || 'Nog geen oordeel.',
    confidence: feas.confidence || readiness?.confidence || CONFIDENCE.LOW,
    readiness,
    raceFeasibility: feas,
    milestones: [],
    // Duidelijk merken waar dit vandaan komt, zodat niemand later gaat zoeken
    // naar een tweede racemodel dat hier zou staan.
    engine: 'raceFeasibility',
  };
}

// ── Alles beoordelen ────────────────────────────────────────────
export function assessAll({ logs = {}, currentDate = todayLocal(),
  runGate = null, strengthGate = null, log = {} } = {}) {
  const state = runningState({ logs, currentDate });
  const budget = recoveryBudget({ log, logs, currentDate, runGate, strengthGate });

  const generic = activeGoals().map(g => assessGoal(g, { logs, currentDate, state, budget }));
  const races = loadRaceGoals()
    .filter(r => r.enabled !== false)
    .map(raceGoalToGoalIntelligenceInput)
    .map(g => assessGoal(g, { logs, currentDate, state, budget }));

  const all = [...races, ...generic];
  return { all, generic, races, state, budget, currentDate };
}

// ── Milestones ──────────────────────────────────────────────────
// Een tussenstap die de coach voorstelt. Nooit vermomd als jouw doel: de
// bron staat erbij en de reden ook, en hij verdwijnt zodra hij gehaald is.
export function nextMilestone(assessment, { currentDate = todayLocal() } = {}) {
  const a = assessment;
  if (!a || a.kind === 'race') return null;
  if (a.feasibility === FEASIBILITY.INSUFFICIENT_DATA) {
    return {
      goal_id: a.goal.id,
      label: `Meet ${a.label.toLowerCase()} — zonder beginwaarde is er geen koers`,
      rationale: a.reason,
      target_value: null, target_date: addDays(currentDate, 7),
      kind: 'measure', source: SOURCE.COACH,
    };
  }
  if (a.reached || a.gap == null || a.gap <= 0) return null;
  if (a.feasibility === FEASIBILITY.NOT_SAFE_TO_CHASE) return null;

  // De eerstvolgende stap is vier weken vooruit tegen een veilig tempo — of
  // het doel zelf, als dat eerder komt.
  const rate = a.safeRate ?? (a.gap / Math.max(1, a.weeks || 8));
  const step = Math.min(a.gap, rate * 4);
  const dir = a.direction === 'decrease' ? -1 : 1;
  const value = round2(a.current + dir * step);

  return {
    goal_id: a.goal.id,
    label: `${a.label}: ${value} ${a.unit} over vier weken`,
    rationale: `Tussenstap op een tempo dat je herstel toelaat (${round2(rate)} ${a.unit}/week). ` +
      'Dit is een voorstel van de coach, geen wijziging van je doel.',
    target_value: value,
    target_date: addDays(currentDate, 28),
    kind: 'step', source: SOURCE.COACH,
  };
}

// Milestones vastleggen zodat ze zichtbaar blijven en bijgesteld kunnen
// worden. Bestaande open milestones voor hetzelfde doel worden vervangen,
// niet opgestapeld.
export function refreshMilestones(assessments, { currentDate = todayLocal() } = {}) {
  const made = [];
  for (const a of assessments) {
    const next = nextMilestone(a, { currentDate });
    if (!next) continue;
    const existing = milestonesFor(a.goal.id).find(m => m.status === 'open');
    made.push(saveMilestone({ ...next, id: existing?.id, status: 'open' }));
  }
  return made;
}

// ── Conflicten en synergie ──────────────────────────────────────
export const RELATION = {
  SYNERGY: 'synergy', NEUTRAL: 'neutral', TENSION: 'tension', CONFLICT: 'conflict',
};

// Vaste paren die elkaar aantoonbaar helpen of hinderen. Bewust een korte
// lijst: liever vijf herkenbare gevallen dan vijftig verzonnen regels.
const PAIRS = [
  { a: 'weight', b: 'distance_km', rel: RELATION.TENSION,
    when: (x, y) => x.direction === 'decrease' && y.direction === 'increase',
    text: 'Afvallen en loopvolume opbouwen tegelijk vraagt van dezelfde herstelcapaciteit. ' +
      'Eén van de twee mag leidend zijn; de ander loopt mee.' },
  { a: 'weight', b: 'sessions_week', rel: RELATION.TENSION,
    when: (x, y) => x.direction === 'decrease' && y.direction === 'increase',
    text: 'In perimenopauze kost een energietekort spier. Meer krachtsessies beschermen dat, ' +
      'maar alleen als er genoeg te eten en te herstellen is.' },
  { a: 'sessions_week', b: 'distance_km', rel: RELATION.TENSION,
    when: (x, y) => x.direction === 'increase' && y.direction === 'increase',
    text: 'Kracht en loopvolume tegelijk verhogen zet twee assen tegelijk in beweging. ' +
      'Dat is precies het patroon dat een terugslag uitlokt.' },
  { a: 'sleep_hours', b: 'weight', rel: RELATION.SYNERGY,
    text: 'Beter slapen maakt afvallen makkelijker, niet andersom. Slaap eerst.' },
  { a: 'sleep_hours', b: 'distance_km', rel: RELATION.SYNERGY,
    text: 'Slaap is de plek waar looptraining wordt omgezet in vooruitgang.' },
  { a: 'sleep_hours', b: 'skin_routine', rel: RELATION.SYNERGY,
    text: 'Slaap doet voor je huid meer dan welke routine ook — die twee wijzen dezelfde kant op.' },
  { a: 'sessions_week', b: 'weight', rel: RELATION.SYNERGY,
    when: (x, y) => x.direction === 'increase' && y.direction === 'decrease',
    text: 'Kracht beschermt spier terwijl je vorm verandert. Dat is wat de weegschaal niet laat zien.' },
  { a: 'protein_days', b: 'weight', rel: RELATION.SYNERGY,
    text: 'Genoeg eiwit is wat het verschil maakt tussen gewicht verliezen en spier verliezen.' },
  { a: 'pem_days_month', b: 'distance_km', rel: RELATION.TENSION,
    when: (x) => x.direction === 'decrease',
    text: 'Minder PEM-dagen én meer kilometers is mogelijk, maar niet tegelijk hard. ' +
      'De volgorde is: eerst rustig, dan meer.' },
];

export function goalRelations(assessments) {
  const byMetric = {};
  for (const a of assessments) if (a.metric) byMetric[a.metric] = a;

  const out = [];
  for (const p of PAIRS) {
    const x = byMetric[p.a], y = byMetric[p.b];
    if (!x || !y) continue;
    if (p.when && !p.when(x, y)) continue;
    out.push({
      relation: p.rel,
      between: [x.label, y.label],
      metrics: [p.a, p.b],
      text: p.text,
      // Een spanning wordt een conflict als beide doelen ook nog eens
      // ambitieus zijn: dan vragen ze allebei het maximum van dezelfde pot.
      escalated: p.rel === RELATION.TENSION &&
        [FEASIBILITY.STRETCH, FEASIBILITY.CURRENTLY_UNLIKELY].includes(x.feasibility) &&
        [FEASIBILITY.STRETCH, FEASIBILITY.CURRENTLY_UNLIKELY].includes(y.feasibility),
    });
  }

  // Twee primaire doelen in hetzelfde domein met tegengestelde richting is
  // altijd een conflict, ongeacht de vaste paren.
  const primaries = assessments.filter(a => a.goal?.priority === 'primary');
  for (let i = 0; i < primaries.length; i++) {
    for (let j = i + 1; j < primaries.length; j++) {
      const x = primaries[i], y = primaries[j];
      if (x.domain === y.domain && x.metric !== y.metric
          && x.direction && y.direction && x.direction !== y.direction
          && x.direction !== 'maintain' && y.direction !== 'maintain') {
        out.push({ relation: RELATION.CONFLICT, between: [x.label, y.label],
          metrics: [x.metric, y.metric],
          text: `Twee primaire doelen binnen ${DOMAIN_META[x.domain]?.label || x.domain} ` +
            'wijzen tegengesteld. Kies er één als leidend.' });
      }
    }
  }

  return out.map(r => ({ ...r,
    relation: r.escalated ? RELATION.CONFLICT : r.relation }));
}

// ── Wat een actie oplevert ──────────────────────────────────────
// Eén handeling dient meestal meer dan één doel. Slapen helpt herstel, huid,
// gewicht en hardlopen tegelijk. Dat is waarom de coach niet per doel kiest
// maar per actie: welke zet levert samen het meeste op?
//
// De koppeling driver → metric is expliciet. Impliciet raden welk doel een
// actie dient levert overtuigende maar verzonnen verbanden op.
const DRIVER_SERVES = {
  sleep:                ['sleep_hours', 'sleep_consistency', 'energy_level', 'weight',
                         'skin_routine', 'distance_km', 'pem_days_month'],
  recovery:             ['pem_days_month', 'headache_days', 'energy_level', 'distance_km'],
  stress:               ['energy_level', 'sleep_hours', 'protected_hours'],
  protein:              ['protein_days', 'weight', 'strength_score', 'sessions_week'],
  strength_consistency: ['sessions_week', 'strength_score', 'squat_kg', 'hinge_kg',
                         'glutes_kg', 'push_reps', 'weight', 'waist'],
  pattern_coverage:     ['strength_score', 'sessions_week'],
  aerobic_volume:       ['distance_km', 'continuous_min', 'run_walk_minutes', 'energy_level'],
  run_economy:          ['distance_km', 'continuous_min'],
  tolerance:            ['distance_km', 'continuous_min', 'pem_days_month'],
  daylight:             ['sleep_hours', 'energy_level', 'skin_routine'],
  skin_routine:         ['skin_routine', 'spf_days'],
  alcohol:              ['alcohol_free', 'sleep_hours', 'skin_routine', 'weight'],
  protected_time:       ['protected_hours', 'free_evenings', 'energy_level'],
};

// Hoe zwaar telt een doel mee? Urgentie (weinig weken), prioriteit, en of het
// doel achterloopt. Een doel dat op koers ligt heeft minder aandacht nodig
// dan een doel dat dreigt te ontsporen.
function goalWeight(a) {
  if (!a) return 0;
  if (a.feasibility === FEASIBILITY.NOT_SAFE_TO_CHASE) return 0;
  let w = a.goal?.priority === 'primary' ? 3
    : a.goal?.priority === 'someday' ? 0.5 : 1.5;
  if (a.goal?.target_level === 'stretch') w *= 0.6;

  // Urgentie: hoe dichterbij de datum, hoe zwaarder — maar alleen als het
  // doel ook echt nog wat te gaan heeft.
  if (a.weeks != null && a.gap) {
    if (a.weeks <= 4) w *= 1.8;
    else if (a.weeks <= 10) w *= 1.35;
  }

  // Achterlopen weegt zwaarder dan voorlopen.
  if (a.feasibility === FEASIBILITY.CURRENTLY_UNLIKELY) w *= 1.4;
  else if (a.feasibility === FEASIBILITY.STRETCH) w *= 1.2;
  else if (a.feasibility === FEASIBILITY.ON_TRACK) w *= 0.7;
  else if (a.feasibility === FEASIBILITY.INSUFFICIENT_DATA) w *= 1.1;  // meten is ook waarde

  return w;
}

export function goalContribution(driverId, assessments) {
  const metrics = DRIVER_SERVES[driverId] || [];
  const served = [];
  let value = 0;
  for (const a of assessments) {
    if (!metrics.includes(a.metric)) continue;
    const w = goalWeight(a);
    if (w <= 0) continue;
    value += w;
    served.push({ label: a.label, metric: a.metric, weight: Math.round(w * 10) / 10,
      feasibility: a.feasibility });
  }
  served.sort((x, y) => y.weight - x.weight);
  return { value: Math.round(value * 10) / 10, served, metrics };
}

// ── De prioriteitsstapel ────────────────────────────────────────
// De volgorde waarin de coach afweegt. Herstel staat bovenaan en kan niet
// worden weggescoord; alles daaronder is een afweging.
export const PRIORITY_STACK = [
  { id: 'safety',      label: 'Harde herstel- en veiligheidsgrenzen' },
  { id: 'user',        label: 'Wat jij als primair hebt gemarkeerd' },
  { id: 'deadline',    label: 'Hoe dichtbij de streefdatum is' },
  { id: 'dependency',  label: 'Wat andere doelen deblokkeert' },
  { id: 'limiter',     label: 'Wat op dit moment de beperkende factor is' },
  { id: 'adaptation',  label: 'Wat de meeste aanpassing oplevert' },
  { id: 'opportunity', label: 'Wat het minst in de weg zit van de rest' },
  { id: 'capacity',    label: 'Wat er binnen het herstelbudget past' },
];

/**
 * Kandidaat-acties scoren. Dit gebeurt uitdrukkelijk NA de harde poort:
 * `candidates` bevat alleen wat al is toegestaan.
 *
 * De formule staat hier expliciet zodat het na te rekenen is:
 *
 *   waarde = doelbijdrage + limiterrelevantie + verwachte prikkel
 *          − herstelkosten − stapelrisico − conflictkosten
 */
export function scoreCandidates(candidates, { assessments = [], budget = null,
  relations = [] } = {}) {
  const conflictMetrics = new Set();
  for (const r of relations) {
    if (r.relation === RELATION.CONFLICT) for (const m of r.metrics) conflictMetrics.add(m);
  }

  return candidates.map(c => {
    const contrib = goalContribution(c.driverId, assessments);

    // Limiterrelevantie: een driver die als bottleneck is aangemerkt telt
    // zwaarder dan een driver die alleen "ook nuttig" is.
    const limiter = c.status === 'poor' ? 6 : c.status === 'thin' ? 3
      : c.status === 'unknown' ? 2 : 0;

    const stimulus = c.expectedStimulus ?? (c.action?.minutes ? Math.min(4, c.action.minutes / 10) : 1);

    const cost = c.recoveryCost ?? estimateCost(c);
    const affordable = !budget || budget.affords(cost);
    const spikeRisk = spikeRiskFor(c, budget);

    const conflictCost = c.metricsTouched?.some(m => conflictMetrics.has(m)) ? 3 : 0;

    const value = contrib.value + limiter + stimulus
      - cost / 10 - spikeRisk - conflictCost;

    return {
      ...c,
      contribution: contrib,
      score: Math.round(value * 10) / 10,
      affordable,
      recoveryCost: cost,
      blockedByBudget: !affordable,
      breakdown: {
        goalContribution: contrib.value, limiter, stimulus,
        recoveryCost: -Math.round(cost / 10 * 10) / 10,
        spikeRisk: -spikeRisk, conflictCost: -conflictCost,
      },
    };
  })
    // Wat niet binnen het budget past valt eruit; het wordt niet
    // "toch maar wel" omdat de score hoog is.
    .filter(c => c.affordable)
    .sort((a, b) => b.score - a.score);
}

function estimateCost(c) {
  const m = c.action?.minutes ?? 0;
  if (c.driverId === 'aerobic_volume' || c.driverId === 'run_economy') {
    return m >= 25 ? COST.easyRun : COST.walk;
  }
  if (c.driverId === 'strength_consistency' || c.driverId === 'pattern_coverage') {
    return m >= 25 ? COST.strengthFull : COST.strengthShort;
  }
  if (m === 0) return COST.rest;
  if (m <= 3) return COST.micro;
  if (m <= 10) return COST.admin;
  return COST.walk;
}

// Niet twee assen tegelijk. Frequentie, duur en intensiteit mogen niet in
// dezelfde week allemaal omhoog — dat is het patroon waar het in 2024 misging.
function spikeRiskFor(c, budget) {
  if (!budget) return 0;
  const i = budget.inputs || {};
  const adds = ['aerobic_volume', 'run_economy', 'strength_consistency', 'pattern_coverage']
    .includes(c.driverId);
  if (!adds) return 0;
  let risk = 0;
  if ((i.runDays7 ?? 0) >= 3) risk += 2;
  if ((i.strengthWeek ?? 0) >= 2) risk += 1.5;
  if (budget.band === BAND.LOW) risk += 2;
  return risk;
}

// ── DO / MAINTAIN / DON'T PUSH ──────────────────────────────────
// Per doel drie zinnen. Wat je oppakt, wat je gewoon vasthoudt, en waar je
// nu juist níet harder aan trekt — dat laatste is bij haar het belangrijkst.
export function doMaintainDontPush(assessment, { budget = null, relations = [] } = {}) {
  const a = assessment;
  if (!a) return null;
  const rel = relations.filter(r => r.metrics?.includes(a.metric));
  const tension = rel.find(r => r.relation === RELATION.TENSION || r.relation === RELATION.CONFLICT);

  if (a.feasibility === FEASIBILITY.NOT_SAFE_TO_CHASE) {
    return {
      do: 'Zet dit doel tijdelijk op pauze en herstel eerst.',
      maintain: 'Houd vast wat er al staat; niets afbouwen is hier winst.',
      dontPush: a.reason,
    };
  }
  if (a.feasibility === FEASIBILITY.INSUFFICIENT_DATA) {
    return {
      do: `Meet ${a.label.toLowerCase()} — één betrouwbare beginwaarde is genoeg om te starten.`,
      maintain: 'Verander nog niets aan je aanpak zolang er geen nulpunt is.',
      dontPush: 'Niet sturen op een getal dat er nog niet is.',
    };
  }

  const byMetric = {
    weight: {
      do: 'Houd eiwit en krachttraining op peil; die twee bepalen wat er van je afgaat.',
      maintain: 'Je huidige loopfrequentie. Extra cardio erbij is hier niet de hefboom.',
      dontPush: 'Geen extra tekort erbovenop. Onder je eigen ondergrens gaat het nooit.',
    },
    waist: {
      do: 'Kracht en eiwit; taille beweegt mee met samenstelling, niet met de weegschaal.',
      maintain: 'Meet steeds op dezelfde plek en hetzelfde moment, anders meet je ruis.',
      dontPush: 'Niet dagelijks meten. Dat levert alleen schommeling op.',
    },
    distance_km: {
      do: 'Bouw op via de running-engine: eerst tijd op de benen, dan afstand.',
      maintain: 'Je hartslagband. Die is de instructie, tempo is de uitkomst.',
      dontPush: 'Niet frequentie én afstand én intensiteit in dezelfde week.',
    },
    continuous_min: {
      do: 'Verleng het loopblok, niet de hele sessie.',
      maintain: 'Dezelfde rustige inspanning; langer mag alleen als het even makkelijk voelt.',
      dontPush: 'Geen sprong van meer dan een paar minuten per stap.',
    },
    sessions_week: {
      do: 'Kort telt volledig mee. Twee keer vijftien minuten verslaat één keer vijftig.',
      maintain: 'De bandniveaus die je nu gebruikt.',
      dontPush: 'Geen derde sessie erbij zolang de tweede nog niet vanzelf gaat.',
    },
    sleep_hours: {
      do: 'Zet een vaste stoptijd; de start van de nacht is stuurbaar, de duur niet.',
      maintain: 'Je opstaanstijd, ook in het weekend — regelmaat weegt zwaarder dan lengte.',
      dontPush: 'Niet compenseren met lang uitslapen; dat verplaatst het probleem.',
    },
    skin_routine: {
      do: 'SPF, elke dag. Dat is de enige stap met onbetwist effect over jaren.',
      maintain: 'Wat je al doet. Meer producten is niet meer resultaat.',
      dontPush: 'Niet drie dingen tegelijk beginnen; dan houdt geen van drieën stand.',
    },
    protein_days: {
      do: 'Eén stevige eiwitbron per hoofdmaaltijd. Dat is het hele plan.',
      maintain: 'Je huidige eetmomenten.',
      dontPush: 'Geen tellen tot op de gram. Regelmaat verslaat precisie.',
    },
    pem_days_month: {
      do: 'Vul de herstelcheck na elke sessie in — zonder die data stuurt niemand iets.',
      maintain: 'Het niveau waarop je nu goed reageert.',
      dontPush: 'Niet opbouwen zolang het aantal signalen niet daalt.',
    },
  };

  const base = byMetric[a.metric] || {
    do: `Werk aan ${a.label.toLowerCase()} met de kleinste stap die je volhoudt.`,
    maintain: 'Wat er al goed gaat.',
    dontPush: 'Geen twee veranderingen tegelijk.',
  };

  if (tension) base.dontPush = tension.text;
  if (budget?.band === BAND.NONE && !budget.hardBlock) {
    base.dontPush = 'Je herstelruimte is vandaag op. Wat je nu forceert, betaal je morgen terug.';
  }
  return base;
}

// ── Salience: welk doel verdient vandaag aandacht? ──────────────
// Niet alles elke dag. Een doel komt alleen naar voren als er iets te
// beslissen valt, iets verandert, of iets ontbreekt.
export const SALIENCE_REASON = {
  DEADLINE: 'deadline nabij',
  OFF_TRACK: 'raakt van koers',
  CONFLICT: 'botst met een ander doel',
  MISSING_DATA: 'cruciale meting ontbreekt',
  MILESTONE: 'tussenstap bereikt of verlopen',
  UNSAFE: 'nu niet verantwoord',
  DECISION: 'er valt iets te kiezen',
};

export function salientGoals(assessments, { relations = [], currentDate = todayLocal(),
  limit = 3 } = {}) {
  const conflictMetrics = new Set();
  for (const r of relations) {
    if (r.relation === RELATION.CONFLICT) for (const m of r.metrics) conflictMetrics.add(m);
  }

  const scored = [];
  for (const a of assessments) {
    const reasons = [];
    let s = 0;
    if (a.feasibility === FEASIBILITY.NOT_SAFE_TO_CHASE) { s += 10; reasons.push(SALIENCE_REASON.UNSAFE); }
    if (a.weeks != null && a.weeks <= 4 && a.gap) { s += 6; reasons.push(SALIENCE_REASON.DEADLINE); }
    if (a.feasibility === FEASIBILITY.CURRENTLY_UNLIKELY) { s += 5; reasons.push(SALIENCE_REASON.OFF_TRACK); }
    if (conflictMetrics.has(a.metric)) { s += 4; reasons.push(SALIENCE_REASON.CONFLICT); }
    if (a.feasibility === FEASIBILITY.INSUFFICIENT_DATA) { s += 3; reasons.push(SALIENCE_REASON.MISSING_DATA); }
    const ms = (a.milestones || []).find(m => m.status === 'open'
      && m.target_date && m.target_date <= currentDate);
    if (ms) { s += 3; reasons.push(SALIENCE_REASON.MILESTONE); }
    if (a.goal?.priority === 'primary') s += 1;

    if (s > 0) scored.push({ assessment: a, score: s, reasons });
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, limit);
}

// ── Wekelijkse review ───────────────────────────────────────────
export function weeklyGoalReview({ logs = {}, currentDate = todayLocal(),
  runGate = null, strengthGate = null, log = {} } = {}) {
  const { all, budget, state } = assessAll({ logs, currentDate, runGate, strengthGate, log });
  const relations = goalRelations(all);

  const forward = [], steady = [], changed = [], missing = [];
  for (const a of all) {
    if (a.feasibility === FEASIBILITY.INSUFFICIENT_DATA) { missing.push(a); continue; }
    if (a.onTrackByTrend === true || a.feasibility === FEASIBILITY.ON_TRACK) forward.push(a);
    else if (a.feasibility === FEASIBILITY.CURRENTLY_UNLIKELY
      || a.feasibility === FEASIBILITY.NOT_SAFE_TO_CHASE) changed.push(a);
    else steady.push(a);
  }

  const salient = salientGoals(all, { relations, currentDate, limit: 3 });

  return {
    currentDate, budget, state, relations,
    forward, steady, changed, missing,
    priorities: salient.map(s => ({
      label: s.assessment.label,
      why: s.reasons.join(' · '),
      action: doMaintainDontPush(s.assessment, { budget, relations })?.do || null,
    })),
    summary: summaryLine({ forward, steady, changed, missing }),
  };
}

function summaryLine({ forward, steady, changed, missing }) {
  const parts = [];
  if (forward.length) parts.push(`${forward.length} vooruit`);
  if (steady.length) parts.push(`${steady.length} stabiel`);
  if (changed.length) parts.push(`${changed.length} van koers`);
  if (missing.length) parts.push(`${missing.length} zonder meting`);
  return parts.length ? parts.join(' · ') : 'Nog geen doelen om te beoordelen.';
}

// ── Voorstellen die de gebruiker moet goedkeuren ────────────────
// De coach mag alles voorstellen en niets stilletjes doorvoeren. Deze functie
// levert voorstellen; accepteren gebeurt in de UI, door haar.
export const ADJUSTMENT = {
  MOVE_DATE: 'move_date', SOFTEN_TARGET: 'soften_target',
  DEMOTE_STRETCH: 'demote_stretch', ADD_MILESTONE: 'add_milestone',
  CHANGE_PRIORITY: 'change_priority', PAUSE: 'pause',
};

export function adjustmentSuggestions(assessments, { currentDate = todayLocal() } = {}) {
  const out = [];
  for (const a of assessments) {
    if (a.kind === 'race') continue;      // racedoelen hebben hun eigen advies
    if (a.feasibility === FEASIBILITY.NOT_SAFE_TO_CHASE) {
      out.push({ goal_id: a.goal.id, type: ADJUSTMENT.PAUSE,
        label: `${a.label} tijdelijk pauzeren`, rationale: a.reason, apply: { status: 'paused' } });
      continue;
    }
    if (a.feasibility !== FEASIBILITY.CURRENTLY_UNLIKELY) continue;

    if (a.gap != null && a.safeRate) {
      const wk = Math.ceil(a.gap / a.safeRate);
      out.push({
        goal_id: a.goal.id, type: ADJUSTMENT.MOVE_DATE,
        label: `Streefdatum van ${a.label.toLowerCase()} naar ${addDays(currentDate, wk * 7)}`,
        rationale: `Op een tempo dat je herstel toelaat duurt dit ongeveer ${wk} weken. ` +
          'De opbouw versnellen is geen optie; de datum verzetten wel.',
        apply: { target_date: addDays(currentDate, wk * 7) },
      });
      if (a.weeks) {
        const reachable = round2(a.current +
          (a.direction === 'decrease' ? -1 : 1) * a.safeRate * a.weeks);
        out.push({
          goal_id: a.goal.id, type: ADJUSTMENT.SOFTEN_TARGET,
          label: `Doel bijstellen naar ${reachable} ${a.unit} op dezelfde datum`,
          rationale: 'Zelfde datum, een waarde die binnen bereik ligt.',
          apply: { target_value: reachable },
        });
      }
    }
    if (a.goal?.target_level !== 'stretch') {
      out.push({ goal_id: a.goal.id, type: ADJUSTMENT.DEMOTE_STRETCH,
        label: `${a.label} markeren als stretch`,
        rationale: 'Dan blijft het staan als ambitie zonder dat het de planning stuurt.',
        apply: { target_level: 'stretch' } });
    }
  }
  return out;
}

// ── Hardloop-limiters ───────────────────────────────────────────
// Welke eigenschap houdt het hardlopen op dit moment tegen? Dit leest de
// running-engine; het rekent niets zelf uit.
export const RUN_LIMITER = {
  RECOVERY: 'RECOVERY',
  DISTANCE_TOLERANCE: 'DISTANCE_TOLERANCE',
  TIME_ON_FEET: 'TIME_ON_FEET',
  CONTINUITY: 'CONTINUITY',
  AEROBIC_ECONOMY: 'AEROBIC_ECONOMY',
  PACE_AT_HR: 'PACE_AT_HR',
  SPEED: 'SPEED',
  THRESHOLD: 'THRESHOLD',
  RACE_SPECIFIC_ENDURANCE: 'RACE_SPECIFIC_ENDURANCE',
  RUNNING_ECONOMY: 'RUNNING_ECONOMY',
  LOAD_TOLERANCE: 'LOAD_TOLERANCE',
  UNKNOWN: 'UNKNOWN',
};

export const LIMITER_LABEL = {
  RECOVERY: 'Herstel',
  DISTANCE_TOLERANCE: 'Afstandstolerantie',
  TIME_ON_FEET: 'Tijd op de benen',
  CONTINUITY: 'Aaneengesloten kunnen lopen',
  AEROBIC_ECONOMY: 'Aerobe basis',
  PACE_AT_HR: 'Tempo bij gelijke hartslag',
  SPEED: 'Snelheid',
  THRESHOLD: 'Drempel',
  RACE_SPECIFIC_ENDURANCE: 'Race-specifiek uithoudingsvermogen',
  RUNNING_ECONOMY: 'Loopeconomie',
  LOAD_TOLERANCE: 'Belastbaarheid',
  UNKNOWN: 'Nog niet vast te stellen',
};

/**
 * De afstandsdekking voor een race.
 *
 *   dekking = langste GOED VERDRAGEN relevante afstand / raceafstand
 *
 * Nadrukkelijk niet: de langste ooit, een wandeling, of een sessie waarvan
 * de respons slecht was. Die drie uitsluitingen zitten al in
 * runningState.longestTolerated — daarom leest deze functie dat veld en
 * berekent hij niets opnieuw.
 */
export function distanceCoverage({ raceDistanceKm, state }) {
  if (!raceDistanceKm || !state) return { available: false };
  const tolerated = state.longestTolerated || 0;
  if (!tolerated) {
    return { available: false, tolerated: 0, raceDistanceKm,
      reason: 'Nog geen goed verdragen run met een gemeten afstand.' };
  }
  const ratio = tolerated / raceDistanceKm;
  return {
    available: true,
    tolerated, raceDistanceKm,
    ratio: Math.round(ratio * 100) / 100,
    pct: Math.round(ratio * 100),
    note: `Langste goed verdragen loopafstand ${tolerated} km van ${raceDistanceKm} km ` +
      `(${Math.round(ratio * 100)}%).`,
    // Ter vergelijking wat er wél is gelopen, zodat het verschil zichtbaar is.
    completed: state.longestCompleted || null,
  };
}

export function runLimiter({ state, budget = null, raceDistanceKm = null }) {
  if (!state) return { id: RUN_LIMITER.UNKNOWN, label: LIMITER_LABEL.UNKNOWN };

  // Herstel eerst — altijd.
  if (budget?.hardBlock || budget?.band === BAND.NONE) {
    return { id: RUN_LIMITER.RECOVERY, label: LIMITER_LABEL.RECOVERY,
      note: budget.note };
  }
  if ((state.pemFreeWeeks ?? 0) < 2) {
    return { id: RUN_LIMITER.RECOVERY, label: LIMITER_LABEL.RECOVERY,
      note: `Nog geen twee PEM-vrije weken (${state.pemFreeWeeks ?? 0}).` };
  }

  if (raceDistanceKm) {
    const cov = distanceCoverage({ raceDistanceKm, state });
    if (cov.available && cov.ratio < 0.6) {
      return { id: RUN_LIMITER.DISTANCE_TOLERANCE, label: LIMITER_LABEL.DISTANCE_TOLERANCE,
        note: cov.note };
    }
    if (!cov.available) {
      return { id: RUN_LIMITER.DISTANCE_TOLERANCE, label: LIMITER_LABEL.DISTANCE_TOLERANCE,
        note: cov.reason };
    }
  }

  if ((state.longestContinuousMin ?? 0) < 10 && (state.longestRunBlockMin ?? 0) < 6) {
    return { id: RUN_LIMITER.CONTINUITY, label: LIMITER_LABEL.CONTINUITY,
      note: `Langste aaneengesloten loopblok is ${state.longestRunBlockMin ?? 0} minuten.` };
  }
  if ((state.runMin7 ?? 0) < 45) {
    return { id: RUN_LIMITER.TIME_ON_FEET, label: LIMITER_LABEL.TIME_ON_FEET,
      note: `${state.runMin7 ?? 0} loopminuten deze week.` };
  }
  if (state.economyGainSec != null && state.economyGainSec < 0) {
    return { id: RUN_LIMITER.PACE_AT_HR, label: LIMITER_LABEL.PACE_AT_HR,
      note: 'Tempo bij gelijke hartslag is achteruitgegaan.' };
  }
  if (state.runPace == null) {
    return { id: RUN_LIMITER.PACE_AT_HR, label: LIMITER_LABEL.PACE_AT_HR,
      note: 'Nog geen betrouwbaar looptempo bij gelijke hartslag.' };
  }
  if (raceDistanceKm) {
    return { id: RUN_LIMITER.RACE_SPECIFIC_ENDURANCE,
      label: LIMITER_LABEL.RACE_SPECIFIC_ENDURANCE,
      note: 'Afstand en basis staan; het gaat nu om het volhouden op racetempo.' };
  }
  return { id: RUN_LIMITER.AEROBIC_ECONOMY, label: LIMITER_LABEL.AEROBIC_ECONOMY,
    note: 'Rustige minuten blijven de grootste hefboom.' };
}

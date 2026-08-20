// Waar sta ik nu — per doelmetric, uit de bestaande engines.
//
// Dit bestand rekent zelf zo min mogelijk uit. Voor hardlopen vraagt het de
// running-engine, voor kracht de strength-engine, voor symptomen de
// symptomen-engine. Wat het wél doet is de vertaalslag maken van "wat die
// engines weten" naar "waar staat dit doel", inclusief het eerlijke antwoord
// dat sommige dingen simpelweg niet betrouwbaar te meten zijn.
//
// Dat laatste is geen bescheidenheid maar noodzaak. Een tailleomtrek die je
// zelf met een lintje meet heeft een foutmarge van een centimeter of meer;
// een vetpercentage uit een weegschaal is nog veel grover. Als de coach zulke
// getallen als exacte metingen behandelt, gaat hij sturen op ruis — en dan is
// een doel gehaald of gemist op basis van waar je het lintje hield.
//
// Vandaar per metric drie dingen: de waarde, hoe hij gemeten is, en hoeveel
// vertrouwen de meting verdient.

import { todayLocal, addDays } from './datetime';
import { METRICS, metricInfo, QUALITY } from './goalModel';
import { loadWorkouts, toleranceFor } from './workouts';
import { trainingLoad, longestToleratedRun } from './restday';
import { runningState } from './raceGoals';
import { strengthStats, scoreTrend, benchmarkProgress, findBenchmark } from './strength';
import { headacheTrend } from './symptoms';

export const CONFIDENCE = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', NONE: 'NONE' };

const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : null; };
const round1 = (x) => x == null ? null : Math.round(x * 10) / 10;

function readJson(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; }
  catch { return fallback; }
}

function logsIn(logs, currentDate, days) {
  const from = addDays(currentDate, -(days - 1));
  return Object.values(logs || {})
    .filter(l => l?.date && l.date >= from && l.date <= currentDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function measurements() {
  const arr = readJson('gc_measurements', []);
  return Array.isArray(arr) ? [...arr].sort((a, b) => a.date.localeCompare(b.date)) : [];
}

// ── Voortschrijdend gemiddelde ──────────────────────────────────
// Voor gewicht en vetpercentage is de losse meting bijna betekenisloos: één
// zoute maaltijd of een dag eerder in de cyclus verzet de weegschaal meer dan
// een week goed eten hem verzet. De trend is het signaal, het punt is de ruis.
function rollingTrend(points, { window = 7, minPoints = 4 } = {}) {
  const clean = points.filter(p => p.value != null && isFinite(p.value));
  if (clean.length < 2) return { available: false, n: clean.length };

  const smooth = clean.map((p, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = clean.slice(from, i + 1);
    return { date: p.date, value: slice.reduce((a, b) => a + b.value, 0) / slice.length };
  });

  const first = smooth[0], last = smooth[smooth.length - 1];
  const days = Math.max(1, (new Date(last.date) - new Date(first.date)) / 86400000);
  const perWeek = ((last.value - first.value) / days) * 7;

  return {
    available: true,
    n: clean.length,
    enough: clean.length >= minPoints,
    value: last.value,
    first: first.value,
    delta: last.value - first.value,
    perWeek,
    days: Math.round(days),
    spanFrom: first.date,
    spanTo: last.date,
  };
}

function confidenceFrom({ quality, n, days = null }) {
  if (!n) return CONFIDENCE.NONE;
  if (quality === QUALITY.SUBJECTIVE) return CONFIDENCE.LOW;
  if (quality === QUALITY.STANDARD) {
    // Gestandaardiseerde metingen zijn pas vergelijkbaar als er een paar zijn.
    return n >= 4 ? CONFIDENCE.MEDIUM : n >= 2 ? CONFIDENCE.LOW : CONFIDENCE.NONE;
  }
  if (quality === QUALITY.TREND) {
    if (n >= 10 && (days == null || days >= 21)) return CONFIDENCE.HIGH;
    if (n >= 5) return CONFIDENCE.MEDIUM;
    return CONFIDENCE.LOW;
  }
  // COUNTED
  if (n >= 8) return CONFIDENCE.HIGH;
  if (n >= 3) return CONFIDENCE.MEDIUM;
  return CONFIDENCE.LOW;
}

const none = (metric, reason) => ({
  available: false, metric, value: null, confidence: CONFIDENCE.NONE,
  quality: metricInfo(metric).quality, reason,
});

// ── De baseline per metric ──────────────────────────────────────
export function baselineFor(metric, { logs = {}, currentDate = todayLocal() } = {}) {
  const info = metricInfo(metric);
  const q = info.quality;

  switch (metric) {
    // ── Hardlopen: alles via de running-engine ───────────────────
    case 'distance_km': {
      // Niet de langste afstand ooit, maar de langste die goed verdragen is.
      // Dat onderscheid is de kern van het hele model: een sessie die drie
      // dagen nawerkt is geen bewijs van capaciteit.
      const km = longestToleratedRun(logs);
      if (!km) return none(metric, 'Nog geen goed verdragen run met een afstand.');
      return {
        available: true, metric, value: round1(km), unit: 'km', quality: q,
        confidence: CONFIDENCE.MEDIUM,
        note: 'Langste run die je goed verdroeg — niet de langste ooit.',
        source: 'restday.longestToleratedRun',
      };
    }

    case 'continuous_min':
    case 'run_walk_minutes': {
      const st = runningState({ logs, currentDate });
      const runs = loadWorkouts()
        .filter(w => (w.activityType === 'run' || w.activityType == null)
          && w.date >= addDays(currentDate, -56) && w.date <= currentDate);
      const good = runs.filter(w => toleranceFor(w, logs) === 'good');
      if (!good.length) return none(metric, 'Nog geen goed verdragen loopsessies.');
      const longest = good.reduce((m, w) => Math.max(m, num(w.duration) || 0), 0);
      return {
        available: true, metric, value: round1(longest), unit: 'min', quality: q,
        confidence: confidenceFrom({ quality: q, n: good.length }),
        n: good.length,
        note: `Langste goed verdragen sessie van ${good.length} in acht weken.`,
        extra: { runs: st.runs, runKm7: st.runKm7 },
        source: 'workouts + toleranceFor',
      };
    }

    case 'run_days_week': {
      const load = trainingLoad(logs, currentDate);
      return {
        available: true, metric, value: load.runDays7 ?? 0, unit: 'dagen', quality: q,
        confidence: CONFIDENCE.HIGH,
        note: `${load.runDays7 ?? 0} loopdagen in de afgelopen zeven dagen.`,
        source: 'restday.trainingLoad',
      };
    }

    case 'max_session_min': {
      const load = trainingLoad(logs, currentDate);
      return {
        available: true, metric, value: load.longestRun ?? null, unit: 'min', quality: q,
        confidence: load.longestRun ? CONFIDENCE.MEDIUM : CONFIDENCE.NONE,
        note: 'Langste sessie in de recente periode.',
        source: 'restday.trainingLoad',
      };
    }

    // ── Lichaam ──────────────────────────────────────────────────
    case 'weight':
    case 'weight_min': {
      const pts = measurements()
        .filter(m => num(m.weight) != null)
        .map(m => ({ date: m.date, value: num(m.weight) }));
      const t = rollingTrend(pts, { window: 7, minPoints: 4 });
      if (!t.available) return none(metric, 'Minstens twee wegingen nodig voor een trend.');
      return {
        available: true, metric, value: round1(t.value), unit: 'kg', quality: q,
        raw: round1(pts[pts.length - 1].value),
        trend: { perWeek: Math.round(t.perWeek * 100) / 100, days: t.days, delta: round1(t.delta) },
        n: t.n,
        confidence: confidenceFrom({ quality: q, n: t.n, days: t.days }),
        note: t.enough
          ? `Voortschrijdend gemiddelde over ${t.n} wegingen; laatste losse meting ${round1(pts[pts.length - 1].value)} kg.`
          : `Nog maar ${t.n} wegingen — de trend is nog onbetrouwbaar.`,
        source: 'gc_measurements (rolling)',
      };
    }

    case 'waist':
    case 'hip': {
      const field = metric;
      const pts = measurements()
        .filter(m => num(m[field]) != null)
        .map(m => ({ date: m.date, value: num(m[field]) }));
      if (pts.length < 2) return none(metric, 'Minstens twee metingen nodig om te vergelijken.');
      const last = pts[pts.length - 1], first = pts[0];
      const days = Math.max(1, (new Date(last.date) - new Date(first.date)) / 86400000);
      return {
        available: true, metric, value: round1(last.value), unit: 'cm', quality: q,
        trend: { perWeek: Math.round(((last.value - first.value) / days) * 7 * 100) / 100,
          days: Math.round(days), delta: round1(last.value - first.value) },
        n: pts.length,
        confidence: confidenceFrom({ quality: q, n: pts.length }),
        note: 'Alleen vergelijkbaar bij dezelfde meetplek en hetzelfde moment van de dag.',
        source: 'gc_measurements',
      };
    }

    case 'body_fat': {
      const pts = measurements()
        .filter(m => num(m.body_fat ?? m.bodyFat) != null)
        .map(m => ({ date: m.date, value: num(m.body_fat ?? m.bodyFat) }));
      const t = rollingTrend(pts, { window: 5, minPoints: 4 });
      if (!t.available) return none(metric, 'Minstens twee metingen nodig.');
      return {
        available: true, metric, value: round1(t.value), unit: '%', quality: q,
        trend: { perWeek: Math.round(t.perWeek * 100) / 100, days: t.days },
        n: t.n,
        // Nooit hoger dan MEDIUM: elke thuismeting van vetpercentage heeft
        // een marge die groter is dan de verandering die je wilt zien.
        confidence: t.n >= 6 ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW,
        note: 'Trendmaat. De absolute waarde is onbetrouwbaar; alleen de richting zegt iets.',
        source: 'gc_measurements (rolling)',
      };
    }

    case 'clothing':
    case 'strength_focus':
    case 'routines_auto': {
      return {
        available: true, metric, value: null, unit: info.unit, quality: q,
        confidence: CONFIDENCE.LOW, subjective: true,
        note: 'Uitkomstmaat die jij zelf beoordeelt — hier valt niets uit te rekenen.',
        source: 'user',
      };
    }

    // ── Kracht ───────────────────────────────────────────────────
    case 'sessions_week': {
      const s = strengthStats(currentDate, 28);
      return {
        available: true, metric, value: s.perWeek, unit: '×', quality: q,
        n: s.training,
        confidence: confidenceFrom({ quality: q, n: s.training }),
        note: `${s.training} sessies in 28 dagen.`,
        source: 'strength.strengthStats',
      };
    }

    case 'strength_score': {
      const t = scoreTrend(currentDate, 12);
      const pts = (t.points || t.weeks || []).filter(p => p && p.score != null);
      if (!pts.length) return none(metric, 'Nog geen krachtsessies om te scoren.');
      const last = pts[pts.length - 1];
      return {
        available: true, metric, value: Math.round(last.score), unit: 'punten', quality: q,
        n: pts.length,
        confidence: confidenceFrom({ quality: q, n: pts.length }),
        note: `Laatste capaciteitsscore uit ${pts.length} gemeten weken.`,
        source: 'strength.scoreTrend',
      };
    }

    case 'squat_kg': case 'hinge_kg': case 'glutes_kg': case 'push_reps': {
      const map = { squat_kg: 'squat', hinge_kg: 'hinge', glutes_kg: 'glutes', push_reps: 'push' };
      const prog = benchmarkProgress() || [];
      const row = prog.find(p => p.id === map[metric] || p.benchmark?.id === map[metric]
        || p.id === metric);
      const v = num(row?.latest?.value ?? row?.current ?? row?.value);
      if (v == null) return none(metric, 'Nog geen benchmark geregistreerd.');
      return {
        available: true, metric, value: v, unit: info.unit, quality: q,
        n: row?.entries?.length ?? 1,
        confidence: confidenceFrom({ quality: q, n: row?.entries?.length ?? 1 }),
        note: findBenchmark?.(map[metric])?.label || 'Laatste geregistreerde waarde.',
        source: 'strength.benchmarkProgress',
      };
    }

    // ── Slaap ────────────────────────────────────────────────────
    case 'sleep_hours': {
      const rows = logsIn(logs, currentDate, 28).filter(l => num(l.sleep_hours) != null);
      if (rows.length < 3) return none(metric, 'Minstens drie ingevulde nachten nodig.');
      const vals = rows.map(l => num(l.sleep_hours)).sort((a, b) => a - b);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const median = vals[Math.floor(vals.length / 2)];
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
      return {
        available: true, metric, value: round1(mean), unit: 'u', quality: q,
        median: round1(median), variability: round1(sd), n: rows.length,
        confidence: confidenceFrom({ quality: q, n: rows.length, days: 28 }),
        // De spreiding staat er bewust naast het gemiddelde: zeven uur elke
        // nacht is iets heel anders dan vijf en negen om en om.
        note: `Gemiddeld ${round1(mean)} u, mediaan ${round1(median)} u, spreiding ${round1(sd)} u over ${rows.length} nachten.`,
        source: 'logs',
      };
    }

    case 'sleep_consistency': {
      const rows = logsIn(logs, currentDate, 28).filter(l => num(l.sleep_hours) != null);
      if (rows.length < 5) return none(metric, 'Te weinig ingevulde nachten.');
      const target = 7;
      const hit = rows.filter(l => num(l.sleep_hours) >= target).length;
      return {
        available: true, metric, value: Math.round((hit / rows.length) * 100), unit: '%',
        quality: q, n: rows.length,
        confidence: confidenceFrom({ quality: q, n: rows.length }),
        note: `${hit} van ${rows.length} nachten op of boven ${target} uur.`,
        source: 'logs',
      };
    }

    // ── Herstel ──────────────────────────────────────────────────
    case 'pem_days_month': {
      const rows = logsIn(logs, currentDate, 28);
      const answered = rows.filter(l => l.training_recovery != null || l.recovery_check).length;
      if (answered < 3) return none(metric, 'Te weinig herstelchecks ingevuld.');
      const pem = rows.filter(l =>
        l.symptom_pem || l.recovery_check === 'bad' || l.training_recovery === 2).length;
      return {
        available: true, metric, value: pem, unit: 'dagen', quality: q, n: answered,
        confidence: confidenceFrom({ quality: q, n: answered }),
        note: `${pem} PEM-signalen op ${answered} beantwoorde checks in 28 dagen.`,
        source: 'logs + symptoms',
      };
    }

    case 'headache_days': {
      const t = headacheTrend({ logs, currentDate, weeks: 4 });
      if (!t || t.enough === false) return none(metric, t?.note || 'Te weinig data.');
      const v = t.recentDays ?? t.days ?? t.count ?? null;
      if (v == null) return none(metric, 'Geen hoofdpijndagen te tellen.');
      return {
        available: true, metric, value: v, unit: 'dagen', quality: q,
        confidence: CONFIDENCE.MEDIUM,
        note: t.note || `${v} hoofdpijndagen in vier weken.`,
        source: 'symptoms.headacheTrend',
      };
    }

    case 'energy_level': {
      const rows = logsIn(logs, currentDate, 28).filter(l => num(l.energy) != null);
      if (rows.length < 5) return none(metric, 'Te weinig dagen met energie ingevuld.');
      const mean = rows.reduce((a, l) => a + num(l.energy), 0) / rows.length;
      return {
        available: true, metric, value: round1(mean), unit: '/4', quality: q, n: rows.length,
        confidence: confidenceFrom({ quality: q, n: rows.length, days: 28 }),
        note: `Gemiddeld ${round1(mean)} over ${rows.length} dagen.`,
        source: 'logs',
      };
    }

    // ── Glow ─────────────────────────────────────────────────────
    case 'skin_routine':
    case 'spf_days': {
      const r = readJson('gc_glow_routine', {});
      const days = Object.keys(r).filter(d =>
        d >= addDays(currentDate, -27) && d <= currentDate);
      if (!days.length) return none(metric, 'Routine niet bijgehouden.');
      const done = metric === 'spf_days'
        ? days.filter(d => r[d]?.spf).length
        : days.filter(d => r[d]?.spf || r[d]?.evening).length;
      return {
        available: true, metric, value: Math.round((done / 28) * 100), unit: '%',
        quality: q, n: days.length,
        confidence: confidenceFrom({ quality: q, n: days.length }),
        note: `${done} van 28 dagen bijgehouden en gedaan.`,
        source: 'gc_glow_routine',
      };
    }

    // ── Voeding en gewoontes ─────────────────────────────────────
    case 'protein_days': {
      const rows = logsIn(logs, currentDate, 28)
        .filter(l => l.protein_ok != null || l.protein != null || l.eiwit != null);
      if (!rows.length) return none(metric, 'Eiwit wordt niet bijgehouden.');
      const ok = rows.filter(l => l.protein_ok || num(l.protein) >= 90 || num(l.eiwit) >= 90).length;
      return {
        available: true, metric, value: Math.round((ok / rows.length) * 100), unit: '%',
        quality: q, n: rows.length,
        confidence: confidenceFrom({ quality: q, n: rows.length }),
        note: `${ok} van ${rows.length} bijgehouden dagen genoeg eiwit.`,
        source: 'logs',
      };
    }

    case 'alcohol_free': {
      const rows = logsIn(logs, currentDate, 28).filter(l => l.alcohol != null || l.alcohol_had != null);
      if (!rows.length) return none(metric, 'Alcohol wordt niet bijgehouden.');
      const free = rows.filter(l => !num(l.alcohol) && !l.alcohol_had).length;
      return {
        available: true, metric, value: Math.round((free / rows.length) * 100), unit: '%',
        quality: q, n: rows.length,
        confidence: confidenceFrom({ quality: q, n: rows.length }),
        note: `${free} van ${rows.length} bijgehouden dagen alcoholvrij.`,
        source: 'logs',
      };
    }

    case 'meal_regularity': {
      const rows = logsIn(logs, currentDate, 28).filter(l => l.meals_regular != null);
      if (!rows.length) return none(metric, 'Eetregelmaat wordt niet bijgehouden.');
      const ok = rows.filter(l => l.meals_regular).length;
      return {
        available: true, metric, value: Math.round((ok / rows.length) * 100), unit: '%',
        quality: q, n: rows.length,
        confidence: confidenceFrom({ quality: q, n: rows.length }),
        note: `${ok} van ${rows.length} dagen regelmatig gegeten.`,
        source: 'logs',
      };
    }

    // ── Tijd ─────────────────────────────────────────────────────
    case 'protected_hours':
    case 'free_evenings': {
      let blocks = 0, checked = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(currentDate, -i);
        const plan = readJson(`gc_day_plan_${d}`, null);
        if (plan) { checked++; blocks += (plan.freeBlocks || []).length; }
      }
      if (!checked) return none(metric, 'Geen dagplanning gevonden.');
      return {
        available: true, metric, value: blocks, unit: info.unit, quality: q, n: checked,
        confidence: confidenceFrom({ quality: q, n: checked }),
        note: `${blocks} beschermde blokken op ${checked} geplande dagen.`,
        source: 'gc_day_plan_*',
      };
    }

    case 'active_projects': {
      const p = readJson('gc_projecten', []);
      const open = Array.isArray(p) ? p.filter(x => x.status !== 'done' && !x.done).length : 0;
      return {
        available: true, metric, value: open, unit: '', quality: q,
        confidence: CONFIDENCE.HIGH,
        note: `${open} lopende projecten.`, source: 'gc_projecten',
      };
    }

    default:
      return none(metric, 'Voor deze metric is nog geen automatische meting.');
  }
}

// Alles in één keer, met een cache per aanroep zodat een dashboard met
// twintig doelen niet twintig keer dezelfde engine aanroept.
export function baselines(metrics, opts = {}) {
  const out = {};
  for (const m of new Set(metrics)) out[m] = baselineFor(m, opts);
  return out;
}

// Welke metrics kan de app werkelijk meten? Handig voor de invoer: een doel
// op een metric zonder meting kan wel, maar dan zonder haalbaarheidsoordeel.
export function measurableMetrics() {
  return Object.keys(METRICS).filter(m => {
    const info = METRICS[m];
    return info.source !== 'user';
  });
}

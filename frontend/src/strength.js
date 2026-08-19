// Krachttraining: één canoniek sessiemodel, één progressiescore.
//
// strengthSession = {
//   id, date, type: 'weights' | 'bands_mat' | 'coach_class',
//   classId?, videoUrl?, spotifyUrl?, duration,
//   exercises?: [{ id, pattern, name, bandResistance?, weight?, sets, reps,
//                  holdSeconds?, tempo?, unilateral?, romFull?, rir? }],
//   bandResistance?, rpe, rir?, couldDoMore, completed: 'full'|'partial'|'no',
//   notes, delayedResponse?, recoveryStatus?, createdAt, updatedAt
// }
//
// ── Waarom een eigen score ──────────────────────────────────────
// Zonder gewichten is er geen kilogram om vooruitgang aan af te lezen.
// Toch is er wel degelijk progressive overload: een zwaardere band, meer
// herhalingen, een langere hold, een eenbenige variant, een groter
// bewegingsbereik, een rustiger tempo, meer reserve bij dezelfde les.
// De Strength Progression Score vat die samen in één getal.
//
// De score claimt geen fysiologische exactheid. Hij claimt consistentie:
// dezelfde handeling levert altijd hetzelfde getal op, en elke factor is
// hieronder na te lezen. Dat is genoeg om vooruitgang te zien.

import { loadStrengthSessions, saveStrengthSessions, findExercise } from './data/strengthSchema';
import { bandIndex, PATTERNS, resolveClass, findClass, BENCHMARK_CLASS } from './data/strengthClasses';
import { todayLocal, addDays, daysBetween, startOfWeek } from './datetime';

const SESSIONS_KEY = 'gc_strength_sessions';
const BENCH_KEY = 'gc_strength_benchmarks';

// ── Schaalfactoren ──────────────────────────────────────────────
// Alles is zo geijkt dat één STRONG 30 met een medium band, volledig
// afgemaakt, op RPE 6 precies 100 punten oplevert. Dat maakt de score
// leesbaar: 120 betekent "anderhalve stap boven je referentieles".
export const REFERENCE_SCORE = 100;

// Werk per minuut les × bandindex; ijkpunt: 30 × 1,6 = 48 werkeenheden.
const CLASS_WORK_PER_MIN = 1.0;
// Gewichtentraining rekent in kg-herhalingen; gedeeld door deze factor
// komen die op dezelfde schaal uit als een les.
const WEIGHT_WORK_DIVISOR = 40;
// Banden/mat rekent in weerstand-herhalingen; zelfde bedoeling.
const BAND_WORK_DIVISOR = 12;
// Van werkeenheden naar punten, zodat het ijkpunt op 100 uitkomt.
const SCORE_SCALE = REFERENCE_SCORE / (30 * 1.6 / 1.2);   // = 2.5

export const COMPLETION_FACTOR = { full: 1, partial: 0.6, no: 0 };

// Inspanning: RPE 5 is neutraal. Dezelfde les op een lágere RPE betekent
// méér capaciteit, dus die deelt gunstiger uit. Begrensd zodat een
// extreem lage RPE bij weinig werk de score niet laat ontploffen.
function effortFactor(rpe) {
  if (rpe == null) return 1.15;      // onbekend: licht conservatief
  return Math.max(0.7, Math.min(1.7, Number(rpe) / 5));
}

// Reserve telt mee als extra bewijs van capaciteit, los van de RPE.
function reserveFactor(rir, couldDoMore) {
  if (rir != null) {
    const r = Number(rir);
    if (r >= 4) return 1.12;
    if (r >= 2) return 1.05;
    if (r <= 0) return 0.92;
    return 1.0;
  }
  if (couldDoMore === 'ja') return 1.10;
  if (couldDoMore === 'beetje') return 1.0;
  if (couldDoMore === 'nee') return 0.93;
  return 1.0;
}

// ── Werk per oefening ───────────────────────────────────────────
// De zeven knoppen waar progressive overload zonder gewichten aan draait.
export function exerciseWork(ex) {
  const sets = Math.max(0, parseInt(ex.sets, 10) || 0);
  const reps = Math.max(0, parseInt(ex.reps, 10) || 0);
  const hold = Math.max(0, parseFloat(ex.holdSeconds) || 0);

  // Een isometrische hold telt als herhalingen: drie seconden ≈ één rep.
  const effectiveReps = reps || (hold ? hold / 3 : 0);
  if (!sets || !effectiveReps) return 0;

  const weight = parseFloat(ex.weight) || 0;
  const resistance = weight > 0 ? weight : bandIndex(ex.bandResistance);

  // Eenbenig/eenarmig is zwaarder per kant dan tweebenig.
  const unilateral = ex.unilateral ? 1.3 : 1.0;
  // Volledig bewegingsbereik telt zwaarder dan een ingekorte versie.
  const rom = ex.romFull === false ? 0.85 : ex.romFull ? 1.1 : 1.0;
  // Langzaam tempo verlengt de tijd onder spanning.
  const tempo = ex.tempo === 'slow' ? 1.15 : ex.tempo === 'fast' ? 0.92 : 1.0;
  // Korte rust maakt dezelfde reeks zwaarder.
  const rest = ex.restSeconds != null && Number(ex.restSeconds) <= 30 ? 1.08 : 1.0;

  const raw = resistance * sets * effectiveReps * unilateral * rom * tempo * rest;
  return weight > 0 ? raw / WEIGHT_WORK_DIVISOR : raw / BAND_WORK_DIVISOR;
}

// ── Werk per sessie ─────────────────────────────────────────────
export function sessionWork(session) {
  if (!session) return 0;
  const done = COMPLETION_FACTOR[session.completed] ?? 1;
  if (!done) return 0;

  const exercises = (session.exercises || []).filter(e => e.done !== false);
  if (exercises.length) {
    return exercises.reduce((s, e) => s + exerciseWork(e), 0) * done;
  }

  // Een gevolgde videoles logt geen losse sets. Duur × bandweerstand is
  // dan het eerlijkste wat er te zeggen valt.
  const cls = session.classId ? resolveClass(session.classId) : null;
  const minutes = Number(session.duration) || cls?.duration || 0;
  const band = session.bandResistance || cls?.defaultBand;
  const resistance = band ? bandIndex(band) : 1.0;
  return minutes * CLASS_WORK_PER_MIN * resistance * done;
}

// De score van één sessie.
export function sessionScore(session) {
  const work = sessionWork(session);
  if (!work) return 0;
  const score = (work / effortFactor(session.rpe))
    * reserveFactor(session.rir, session.couldDoMore) * SCORE_SCALE;
  return Math.round(score);
}

// Uitleg bij die score — de gebruiker moet kunnen zien waar hij vandaan komt.
export function explainScore(session) {
  const parts = [];
  const cls = session.classId ? resolveClass(session.classId) : null;
  if (session.exercises?.length) {
    parts.push(`${session.exercises.filter(e => e.done !== false).length} oefeningen`);
  } else if (cls || session.duration) {
    parts.push(`${Number(session.duration) || cls?.duration} min`);
  }
  if (session.bandResistance) parts.push(`${session.bandResistance.replace('_', ' ')} band`);
  if (session.rpe != null) parts.push(`RPE ${session.rpe}`);
  if (session.completed && session.completed !== 'full') {
    parts.push(session.completed === 'partial' ? 'gedeeltelijk' : 'niet afgemaakt');
  }
  return parts.join(' · ');
}

// ── Opslag ──────────────────────────────────────────────────────
export function loadSessions() {
  const arr = loadStrengthSessions();
  return arr.map(migrate).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// Oude sessies (programma A/B met alleen `program` en `exercises`) passen
// zonder aanpassing in het nieuwe model. Er wordt niets weggegooid.
function migrate(s) {
  if (s.type) return s;
  return {
    ...s,
    type: s.program === 'snack' ? 'bands_mat' : 'weights',
    duration: s.duration ?? (s.program === 'snack' ? 8 : 35),
    completed: s.completed ?? 'full',
    exercises: (s.exercises || []).map(e => ({
      ...e,
      pattern: e.pattern || findExercise(e.id)?.pattern || null,
      name: e.name || findExercise(e.id)?.name || e.id,
    })),
  };
}

export function saveSession(session) {
  const all = loadStrengthSessions();
  const now = new Date().toISOString();
  const entry = {
    id: session.id || `st_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    type: 'coach_class',
    completed: 'full',
    createdAt: session.createdAt || now,
    ...session,
    updatedAt: now,
  };
  const i = all.findIndex(s => s.id === entry.id);
  if (i >= 0) all[i] = { ...all[i], ...entry };
  else all.unshift(entry);
  all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  saveStrengthSessions(all);
  return entry;
}

export function deleteSession(id) {
  saveStrengthSessions(loadStrengthSessions().filter(s => s.id !== id));
}

// Herstelsessies tellen niet mee als trainingsprikkel.
const isTrainingSession = (s) => {
  const cls = s.classId ? resolveClass(s.classId) : null;
  return !cls?.isRecovery && s.completed !== 'no';
};

export function trainingSessions() {
  return loadSessions().filter(isTrainingSession);
}

export function lastSession(beforeDate = null) {
  return trainingSessions().find(s => !beforeDate || s.date <= beforeDate) || null;
}

export function sessionsBetween(from, to) {
  return trainingSessions().filter(s => s.date >= from && s.date <= to);
}

// ── Scoretrend ──────────────────────────────────────────────────
// Per week het gemiddelde van de sessies in die week; losse uitschieters
// zeggen weinig, de lijn wel.
export function scoreTrend(currentDate = todayLocal(), weeks = 12) {
  const sessions = trainingSessions();
  const monday = startOfWeek(currentDate);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = addDays(monday, -i * 7);
    const to = addDays(from, 6);
    const inWeek = sessions.filter(s => s.date >= from && s.date <= to);
    const scores = inWeek.map(sessionScore).filter(x => x > 0);
    out.push({
      week: from,
      label: from.slice(5),
      sessions: inWeek.length,
      score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      best: scores.length ? Math.max(...scores) : null,
    });
  }
  return out;
}

// Capaciteitsverandering tussen twee periodes, in procenten.
export function capacityChange(currentDate = todayLocal(), windowDays = 28) {
  const now = sessionsBetween(addDays(currentDate, -(windowDays - 1)), currentDate);
  const before = sessionsBetween(addDays(currentDate, -(windowDays * 2 - 1)), addDays(currentDate, -windowDays));
  const avg = (arr) => {
    const v = arr.map(sessionScore).filter(x => x > 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const a = avg(before), b = avg(now);
  if (!a || !b) {
    return { enough: false, current: b, previous: a,
      note: `Nog te weinig sessies om twee periodes van ${windowDays} dagen te vergelijken.` };
  }
  return {
    enough: true,
    previous: Math.round(a), current: Math.round(b),
    changePct: Math.round(((b - a) / a) * 100),
    sessionsNow: now.length, sessionsBefore: before.length,
  };
}

// ── Bandprogressie ──────────────────────────────────────────────
// Het hoogste bandniveau dat je bij een aanvaardbare inspanning aankon.
export function bandProgression(maxRpe = 7) {
  const rows = trainingSessions()
    .filter(s => s.bandResistance && (s.rpe == null || Number(s.rpe) <= maxRpe))
    .map(s => ({ date: s.date, band: s.bandResistance, index: bandIndex(s.bandResistance), rpe: s.rpe }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return { enough: false, points: [] };
  const first = rows[0], last = rows[rows.length - 1];
  const best = rows.reduce((m, r) => (r.index > m.index ? r : m), rows[0]);
  return {
    enough: true, points: rows,
    start: first, current: last, best,
    improved: last.index > first.index,
  };
}

// ── Bewegingspatronen ───────────────────────────────────────────
// Bewaakt dat het niet alleen buik en billen wordt.
export function patternCoverage(currentDate = todayLocal(), days = 28) {
  const from = addDays(currentDate, -(days - 1));
  const sessions = sessionsBetween(from, currentDate);
  const counts = Object.fromEntries(PATTERNS.map(p => [p.id, 0]));

  for (const s of sessions) {
    const seen = new Set();
    for (const e of s.exercises || []) {
      const p = e.pattern || findExercise(e.id)?.pattern;
      if (p && counts[p] != null) seen.add(p);
    }
    if (!seen.size && s.classId) {
      const cls = resolveClass(s.classId);
      for (const p of cls?.patterns || cls?.focus || []) if (counts[p] != null) seen.add(p);
    }
    for (const p of seen) counts[p]++;
  }

  const rows = PATTERNS.map(p => ({
    ...p, count: counts[p.id],
    covered: counts[p.id] > 0,
    thin: counts[p.id] > 0 && counts[p.id] < 2,
  }));
  const missing = rows.filter(r => !r.covered);
  const thin = rows.filter(r => r.thin);

  // Dekkingsgraad naar belang gewogen: een ontbrekende hinge weegt zwaarder
  // dan ontbrekende kuiten.
  const totalWeight = PATTERNS.reduce((s, p) => s + p.weight, 0);
  const covered = rows.filter(r => r.covered).reduce((s, r) => s + r.weight, 0);

  return {
    days, sessions: sessions.length, rows, missing, thin,
    pct: Math.round((covered / totalWeight) * 100),
    advice: missing.length
      ? `${missing.map(m => m.label.toLowerCase()).join(', ')} ${missing.length > 1 ? 'ontbreken' : 'ontbreekt'} in de afgelopen ${days} dagen. ${missing[0].why}`
      : thin.length
        ? `Alle patronen zijn aan bod gekomen; ${thin.map(t => t.label.toLowerCase()).join(' en ')} nog maar één keer.`
        : 'Volledige dekking van alle zeven patronen — precies zoals bedoeld.',
  };
}

// ── Benchmarks ──────────────────────────────────────────────────
// Bewust een handjevol. Tientallen tests leveren geen inzicht op, alleen
// werk.
export const BENCHMARKS = [
  { id: 'band_level',   label: 'Bandniveau',            unit: '',     kind: 'band',
    hint: 'De zwaarste band waarmee je een hele les afmaakt.' },
  { id: 'squat_reps',   label: 'Squat/lunge reps',      unit: 'reps', kind: 'number', higherBetter: true,
    hint: 'Herhalingen bij dezelfde band en dezelfde RPE.' },
  { id: 'glute_bridge', label: 'Glute bridge',          unit: 'reps', kind: 'number', higherBetter: true,
    hint: 'Eenbenig telt zwaarder — noteer welke variant.' },
  { id: 'side_plank',   label: 'Side plank',            unit: 'sec',  kind: 'number', higherBetter: true,
    hint: 'Per kant, tot de vorm inzakt — niet tot je erbij neervalt.' },
  { id: 'push_reps',    label: 'Push-variant',          unit: 'reps', kind: 'number', higherBetter: true,
    hint: 'Noteer de variant: knieën, verhoogd of vlak.' },
  { id: 'pull_reps',    label: 'Pull / houding',        unit: 'reps', kind: 'number', higherBetter: true,
    hint: 'Band row of pull-apart bij gelijke bandweerstand.' },
  { id: 'strong30_rpe', label: 'STRONG 30 — RPE',       unit: '/10',  kind: 'number', higherBetter: false,
    hint: 'Dezelfde les die lichter voelt is de duidelijkste winst die er is.' },
];

export const findBenchmark = (id) => BENCHMARKS.find(b => b.id === id) || null;

export function loadBenchmarkEntries() {
  try {
    const arr = JSON.parse(localStorage.getItem(BENCH_KEY) || '[]');
    return Array.isArray(arr) ? arr.sort((a, b) => (b.date || '').localeCompare(a.date || '')) : [];
  } catch { return []; }
}

export function saveBenchmarkEntry(entry) {
  const arr = loadBenchmarkEntries();
  const e = {
    id: entry.id || `bm_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    date: entry.date || todayLocal(),
    benchmarkId: entry.benchmarkId,
    value: entry.value,
    rpe: entry.rpe ?? null,
    variant: entry.variant || null,
    note: entry.note || '',
  };
  const i = arr.findIndex(x => x.id === e.id);
  if (i >= 0) arr[i] = e; else arr.unshift(e);
  localStorage.setItem(BENCH_KEY, JSON.stringify(arr));
  return e;
}

export function deleteBenchmarkEntry(id) {
  localStorage.setItem(BENCH_KEY,
    JSON.stringify(loadBenchmarkEntries().filter(x => x.id !== id)));
}

// START → NU per benchmark. De STRONG 30-RPE komt uit de sessies zelf,
// zodat je die niet apart hoeft bij te houden.
export function benchmarkProgress() {
  const entries = loadBenchmarkEntries();
  return BENCHMARKS.map(b => {
    let rows = entries.filter(e => e.benchmarkId === b.id)
      .sort((a, b2) => a.date.localeCompare(b2.date));

    if (b.id === 'strong30_rpe' && !rows.length) {
      rows = trainingSessions()
        .filter(s => s.classId === BENCHMARK_CLASS.id && s.rpe != null)
        .map(s => ({ date: s.date, value: Number(s.rpe), derived: true }))
        .sort((a, b2) => a.date.localeCompare(b2.date));
    }
    if (b.id === 'band_level' && !rows.length) {
      const bp = bandProgression();
      rows = bp.enough
        ? bp.points.map(p => ({ date: p.date, value: p.band, derived: true })) : [];
    }
    if (!rows.length) return { ...b, hasData: false, rows: [] };

    const start = rows[0], current = rows[rows.length - 1];
    const numeric = b.kind === 'number';
    const delta = numeric ? Number(current.value) - Number(start.value) : null;
    const improved = numeric
      ? (b.higherBetter === false ? delta < 0 : delta > 0)
      : bandIndex(current.value) > bandIndex(start.value);

    return {
      ...b, hasData: true, rows, start, current,
      delta, improved,
      derived: !!current.derived,
      changed: numeric ? Math.abs(delta) > 0 : current.value !== start.value,
    };
  });
}

// ── Frequentie en afmaakpercentage ──────────────────────────────
export function strengthStats(currentDate = todayLocal(), days = 28) {
  const from = addDays(currentDate, -(days - 1));
  const all = loadSessions().filter(s => s.date >= from && s.date <= currentDate);
  const training = all.filter(isTrainingSession);
  const full = training.filter(s => s.completed === 'full').length;
  const rpes = training.map(s => Number(s.rpe)).filter(x => !isNaN(x));

  return {
    days,
    total: all.length,
    training: training.length,
    recovery: all.length - training.length,
    perWeek: +(training.length / (days / 7)).toFixed(1),
    completionPct: training.length ? Math.round((full / training.length) * 100) : null,
    avgRpe: rpes.length ? +(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : null,
    avgScore: training.length
      ? Math.round(training.map(sessionScore).reduce((a, b) => a + b, 0) / training.length) : null,
    lastDate: training[0]?.date || null,
    daysSince: training[0] ? daysBetween(training[0].date, currentDate) : null,
  };
}

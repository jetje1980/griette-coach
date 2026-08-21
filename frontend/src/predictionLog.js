// Wat de coach dácht dat er zou gebeuren.
//
// Tot nu toe bewaarde de app wel de uitkomsten — je herstelcheck, je
// hoofdpijnscore, hoe een sessie viel — maar niet de voorspelling die eraan
// voorafging. Het herstelbudget rekende elke ochtend een capaciteit en een
// band uit, en gooide die daarna weg.
//
// Dat maakt calibratie onmogelijk. Over een week heb je dan wel de antwoorden
// maar niet de vragen, en zit je te reconstrueren uit je geheugen. Precies het
// soort bewijs waar je terecht niet in gelooft.
//
// Twee dingen zijn hier belangrijk:
//
//   HET MOMENT   De voorspelling die telt is die van vóór de sessie. Zodra je
//                een run afvinkt verandert het budget, en dan meet je je eigen
//                uitkomst. Daarom wordt de eerste stand van de dag bevroren en
//                daarna niet meer overschreven.
//   DE GETALLEN  De aftrekposten gaan mee, niet alleen de uitkomst. Als blijkt
//                dat de coach structureel te voorzichtig is, wil je kunnen zien
//                wélke aftrek dat veroorzaakte — niet alleen dát het misging.

import { todayLocal, addDays } from './datetime';
import { exertionalResponse, readSymptoms } from './symptoms';
import { recoveryBudget, BAND } from './recoveryBudget';
import { restDayDecision } from './restday';

const KEY = 'gc_predictions';

// De vorm van een record. Bij een verandering hier moet dit omhoog, anders
// vergelijk je straks appels met peren zonder het te merken.
export const SCHEMA = 2;

// Hoeveel dagen we bewaren. Ruim: dit is klein en het is de enige bron voor
// calibratie over een langere periode.
const MAX_DAYS = 400;

function read() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function write(arr) {
  const sorted = [...arr].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_DAYS);
  localStorage.setItem(KEY, JSON.stringify(sorted));
  return sorted;
}

export function loadPredictions() { return read(); }
export function predictionFor(date) { return read().find(p => p.date === date) || null; }

// ── Vastleggen ──────────────────────────────────────────────────
/**
 * De voorspelling van vandaag bevriezen.
 *
 * Idempotent per dag: bestaat er al een record, dan gebeurt er niets. Dat is
 * geen optimalisatie maar de kern — een voorspelling die meebeweegt met de
 * uitkomst voorspelt niets.
 *
 * `source` beschrijft waar de opname vandaan kwam ('live' als je de app opent,
 * 'backfill' als hij achteraf uit je geschiedenis is gereconstrueerd). Die twee
 * horen bij de calibratie nooit op één hoop.
 */
export function recordPrediction(decision, {
  currentDate = todayLocal(), source = 'live', force = false,
} = {}) {
  if (!decision) return null;
  const existing = predictionFor(currentDate);
  if (existing && !force) return existing;

  const g = decision.detail?.goals || {};
  const b = g.budget || null;
  const rec = {
    schema: SCHEMA,
    date: currentDate,
    recordedAt: new Date().toISOString(),
    source,

    // Wat het herstelbudget zei
    budget: b ? {
      capacity: b.capacity, spent: b.spent, remaining: b.remaining,
      band: b.band, hardBlock: b.hardBlock,
      // De aftrekposten met naam, zodat een systematische fout te herleiden is
      // tot de regel die hem veroorzaakt.
      penalties: (b.penalties || []).map(p => ({ what: p.what, cost: p.cost })),
      inputs: b.inputs || null,
    } : null,

    // Wat de poorten zeiden
    gates: {
      run: decision.detail?.runGate?.action || null,
      strength: decision.detail?.strength?.action
        || (decision.detail?.strength?.mayTrain ? 'MAY_TRAIN' : null),
    },

    // Wat de coach koos
    action: {
      source: decision.action?.source || null,
      headline: decision.action?.headline || null,
      minutes: decision.action?.minutes ?? null,
    },
    status: decision.status?.decision || null,
    limiter: g.limiter?.id || null,

    // De uitkomst komt later; hier alvast de plek ervoor.
    outcome: null,
    scoredAt: null,
  };

  write([...read().filter(p => p.date !== currentDate), rec]);
  return rec;
}

// ── De uitkomst erbij zoeken ────────────────────────────────────
// Een voorspelling over dag D wordt beoordeeld op wat er op D, D+1 en D+2
// gebeurde — hetzelfde venster dat de hardloopengine gebruikt voor de
// vertraagde respons, want dat is bij jou het signaal dat telt.
export function outcomeFor(date, { logs = {}, currentDate = todayLocal() } = {}) {
  const day = logs?.[date] || null;
  const trained = !!(day?.run_done || day?.strength_done || day?.core_done);

  // Is het venster al voorbij? Zo niet, dan is er nog geen oordeel te vellen.
  const closed = addDays(date, 2) <= currentDate;

  // De respons op wat er die dag gedaan is.
  const resp = trained
    ? exertionalResponse({ workoutDate: date, logs, currentDate })
    : null;

  // Ook zonder training kan een dag slecht aflopen. Dan kijken we naar de
  // dagen erna: nieuwe PEM-signalen, stevige hoofdpijn.
  const after = [1, 2].map(i => logs?.[addDays(date, i)]).filter(Boolean);
  const laterPem = after.some(l =>
    l.symptom_pem || l.recovery_check === 'bad' || l.training_recovery === 2);
  const laterHeadache = after.some(l => (readSymptoms(l).headache.severity ?? 0) >= 2);

  // Jouw eigen oordeel weegt hier zwaarder dan het afgeleide.
  //
  // De hardloopengine telt symptoomgewichten op en noemt een losse "slecht
  // hersteld" mild, omdat er verder niets is aangevinkt. Voor het sturen van
  // de opbouw is dat verdedigbaar. Voor calibratie niet: als jij aankruist dat
  // je slecht herstelde, dan ging die dag slecht — wat de weegschaal er ook
  // van vindt. We meten hier of de coach jóúw ervaring voorspelde, niet of
  // hij zijn eigen formule voorspelde.
  const eigenOordeel = laterPem;

  let state;
  if (resp) {
    state = resp.status === 'red' ? 'bad'
      : resp.status === 'poor' ? 'bad'
      : eigenOordeel ? 'bad'
      : resp.status === 'mild' ? 'mild'
      : resp.status === 'good' ? 'good'
      : closed ? 'unanswered' : 'pending';
  } else if (!closed) {
    state = 'pending';
  } else if (laterPem) {
    state = 'bad';
  } else if (laterHeadache) {
    state = 'mild';
  } else if (after.length) {
    state = 'good';
  } else {
    state = 'unanswered';
  }

  return {
    date, trained, closed, state,
    // Het afgeleide oordeel blijft ernaast staan, zodat zichtbaar is wanneer
    // de twee uit elkaar liepen. Dat verschil is zelf een bevinding.
    responseStatus: resp?.status || null,
    ownVerdictOverrode: !!(resp && eigenOordeel && resp.status !== 'poor' && resp.status !== 'red'),
    laterPem, laterHeadache,
    answeredDays: after.length,
  };
}

// ── Het oordeel over de voorspelling ────────────────────────────
// Vier uitkomsten, en de twee fouten zijn nadrukkelijk níét hetzelfde:
//
//   TOO_EAGER    de coach gaf ruimte en het viel slecht. Dit is de dure fout;
//                die kost je dagen.
//   TOO_CAUTIOUS de coach hield de rem erop en er was niets aan de hand. Ook
//                een fout — bij long COVID is te voorzichtig geen veilige
//                keuze maar een verloren maand.
//   AGREED       voorspelling en uitkomst wezen dezelfde kant op.
//   UNKNOWN      geen uitkomst ingevuld, of het venster loopt nog.
export const VERDICT = {
  AGREED: 'AGREED',
  TOO_EAGER: 'TOO_EAGER',
  TOO_CAUTIOUS: 'TOO_CAUTIOUS',
  UNKNOWN: 'UNKNOWN',
};

export const VERDICT_LABEL = {
  AGREED: 'klopte',
  TOO_EAGER: 'gaf te veel ruimte',
  TOO_CAUTIOUS: 'was te voorzichtig',
  UNKNOWN: 'nog geen uitkomst',
};

export function judge(prediction, outcome) {
  if (!prediction?.budget || !outcome) return { verdict: VERDICT.UNKNOWN, reason: 'geen gegevens' };
  if (outcome.state === 'pending') {
    return { verdict: VERDICT.UNKNOWN, reason: 'het 24–48u-venster loopt nog' };
  }
  if (outcome.state === 'unanswered') {
    return { verdict: VERDICT.UNKNOWN, reason: 'geen herstelcheck ingevuld' };
  }

  const ruim = prediction.budget.band === BAND.GOOD || prediction.budget.band === BAND.MODERATE;
  const krap = prediction.budget.band === BAND.NONE || prediction.budget.hardBlock;

  // Ruimte gegeven, slecht afgelopen.
  if (ruim && outcome.state === 'bad') {
    return { verdict: VERDICT.TOO_EAGER,
      reason: `Budget stond op ${prediction.budget.band} (${prediction.budget.remaining} over) ` +
        'en de respons was slecht.' };
  }
  // Rem erop, niets aan de hand — maar alleen als er ook echt getraind kón
  // worden. Een dag waarop je toch al niets van plan was zegt niets.
  if (krap && outcome.state === 'good' && outcome.trained) {
    return { verdict: VERDICT.TOO_CAUTIOUS,
      reason: 'Budget stond op geen ruimte, je trainde toch, en het viel goed.' };
  }
  if (krap && outcome.state === 'good' && !outcome.trained) {
    return { verdict: VERDICT.UNKNOWN,
      reason: 'Geen ruimte gegeven en niet getraind — dan is er niets te toetsen.' };
  }
  return { verdict: VERDICT.AGREED,
    reason: `Budget ${prediction.budget.band}, uitkomst ${outcome.state}.` };
}

// De uitkomsten vastschrijven bij de voorspellingen. Doet niets aan records
// waarvan het venster nog loopt — die blijven open tot er iets te zeggen valt.
export function scorePredictions({ logs = {}, currentDate = todayLocal() } = {}) {
  const arr = read();
  let scored = 0;
  for (const p of arr) {
    if (p.outcome && p.outcome.state !== 'pending') continue;
    const o = outcomeFor(p.date, { logs, currentDate });
    if (o.state === 'pending') continue;
    p.outcome = o;
    p.judgement = judge(p, o);
    p.scoredAt = new Date().toISOString();
    scored++;
  }
  if (scored) write(arr);
  return { scored, total: arr.length };
}

// ── De calibratie zelf ──────────────────────────────────────────
export function calibrationReport({ logs = {}, currentDate = todayLocal(), days = 90 } = {}) {
  scorePredictions({ logs, currentDate });
  const from = addDays(currentDate, -(days - 1));
  const rows = read().filter(p => p.date >= from && p.date <= currentDate);

  const counts = { AGREED: 0, TOO_EAGER: 0, TOO_CAUTIOUS: 0, UNKNOWN: 0 };
  for (const p of rows) counts[p.judgement?.verdict || VERDICT.UNKNOWN]++;

  const judged = counts.AGREED + counts.TOO_EAGER + counts.TOO_CAUTIOUS;
  const misses = rows.filter(p =>
    p.judgement?.verdict === VERDICT.TOO_EAGER ||
    p.judgement?.verdict === VERDICT.TOO_CAUTIOUS);

  // Welke aftrekpost komt het vaakst voor op dagen waar het misging? Dat is de
  // regel die als eerste bijstelling verdient.
  const blame = {};
  for (const m of misses) {
    for (const p of m.budget?.penalties || []) {
      blame[p.what] = blame[p.what] || { what: p.what, eager: 0, cautious: 0, totalCost: 0 };
      if (m.judgement.verdict === VERDICT.TOO_EAGER) blame[p.what].eager++;
      else blame[p.what].cautious++;
      blame[p.what].totalCost += p.cost || 0;
    }
  }
  const suspects = Object.values(blame)
    .sort((a, b) => (b.eager + b.cautious) - (a.eager + a.cautious));

  return {
    from, to: currentDate, days,
    total: rows.length,
    judged,
    counts,
    accuracy: judged ? Math.round((counts.AGREED / judged) * 100) : null,
    misses: misses.map(m => ({
      date: m.date, verdict: m.judgement.verdict, reason: m.judgement.reason,
      band: m.budget?.band, remaining: m.budget?.remaining,
      action: m.action?.headline, source: m.source,
    })),
    suspects,
    // Eerlijk over hoeveel dit waard is. Onder de tien beoordeelde dagen is
    // elk percentage een anekdote met een decimaal erachter.
    confidence: judged >= 30 ? 'HIGH' : judged >= 10 ? 'MEDIUM' : 'LOW',
    note: judged === 0
      ? 'Nog geen enkele dag met zowel een voorspelling als een uitkomst.'
      : judged < 10
        ? `${judged} beoordeelde dagen — te weinig om een percentage serieus te nemen. ` +
          'De losse missers hieronder zijn wel al leerzaam.'
        : `${judged} beoordeelde dagen.`,
  };
}

// ── Achteraf reconstrueren ──────────────────────────────────────
// Je hebt al maanden check-ins en activiteiten. Het herstelbudget kan daar
// retrospectief overheen lopen, zodat de calibratie niet vanaf nul begint.
//
// Deze records krijgen source 'backfill' en worden nooit door elkaar gehaald
// met de echte, live vastgelegde voorspellingen. Ze missen namelijk één ding:
// het bewijs dat de coach dit ook werkelijk gezégd zou hebben. Ze zijn met de
// engine van vandaag gemaakt, niet met die van toen.
export function backfillFromHistory({ logs = {}, currentDate = todayLocal(),
  days = 120, overwrite = false } = {}) {
  const existing = new Set(read().map(p => p.date));
  const made = [];

  for (let i = days - 1; i >= 1; i--) {
    const date = addDays(currentDate, -i);
    const log = logs?.[date];
    if (!log) continue;                       // geen check-in: niets te voorspellen
    if (existing.has(date) && !overwrite) continue;

    // Alleen dagen waarop er iets te beslissen viel.
    const heeftIets = log.sleep_hours != null || log.energy != null
      || log.run_done || log.strength_done;
    if (!heeftIets) continue;

    const runGate = safeGate(log, logs, date);
    const budget = recoveryBudget({ log, logs, currentDate: date, runGate });

    made.push({
      schema: SCHEMA,
      date,
      recordedAt: new Date().toISOString(),
      source: 'backfill',
      budget: {
        capacity: budget.capacity, spent: budget.spent, remaining: budget.remaining,
        band: budget.band, hardBlock: budget.hardBlock,
        penalties: budget.penalties.map(p => ({ what: p.what, cost: p.cost })),
        inputs: budget.inputs,
      },
      gates: { run: runGate?.action || null, strength: null },
      action: { source: null, headline: null, minutes: null },
      status: null,
      limiter: null,
      outcome: null, scoredAt: null,
    });
  }

  if (made.length) {
    const keep = read().filter(p => !made.some(m => m.date === p.date));
    write([...keep, ...made]);
  }
  const res = scorePredictions({ logs, currentDate });
  return { reconstructed: made.length, ...res };
}

// De hardloopoort kan op oude data struikelen; een mislukte poort mag de
// hele reconstructie niet tegenhouden.
function safeGate(log, logs, date) {
  try { return restDayDecision({ log, logs, currentDate: date, coach: {} }); }
  catch { return null; }
}

export function clearPredictions() { localStorage.removeItem(KEY); }
export const STORAGE_KEY = KEY;

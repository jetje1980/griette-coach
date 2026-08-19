// "Verandert mijn lijf zichtbaar, en word ik sterker?"
//
// Dat is de vraag waar de hele Strength-pijler op uitkomt. Dit bestand
// regelt de bewijsvoering: gestandaardiseerde foto's op vaste momenten,
// de vergelijking start / vorige / nu, en het oordeel over
// lichaamssamenstelling.
//
// Twee regels die nergens gebroken worden:
//   · uit een foto komt geen vetpercentage, geen kilo's, geen centimeters;
//     beeld levert kwalitatieve observaties, meer niet.
//   · de weegschaal is niet de hoofdindicator. Gewicht stabiel + taille
//     omlaag + kracht omhoog is vooruitgang, ook zonder één kilo verschil.

import { USER } from './config';
import { todayLocal, addDays, daysBetween, formatNLLong } from './datetime';
import { trainingSessions, sessionScore, bandProgression, benchmarkProgress } from './strength';

export const PHOTO_VIEWS = [
  { key: 'voor',   label: 'Voor',   en: 'front' },
  { key: 'zij',    label: 'Zij',    en: 'side' },
  { key: 'achter', label: 'Achter', en: 'back' },
];

// Vaste ijkpunten. Vier weken is de eerste zinnige vergelijking, twaalf
// weken de eerste betrouwbare.
export const CHECKPOINT_DAYS = [0, 28, 56, 84];

export const CHECKPOINT_LABELS = {
  0: 'Start', 28: '4 weken', 56: '8 weken', 84: '12 weken',
};

// Binnen deze marge rondom een ijkpunt telt een foto nog mee. Strak op de
// dag is niet haalbaar en ook niet nodig.
const WINDOW_DAYS = 3;

// ── Standaardisatie ─────────────────────────────────────────────
// Zonder deze instructies vergelijk je licht en houding in plaats van je
// lichaam. Ze staan hier zodat ze overal identiek getoond worden.
export const PHOTO_INSTRUCTIONS = [
  'Zelfde plek in huis, met dezelfde achtergrond.',
  'Zelfde licht — bij voorkeur daglicht, niet tegenlicht.',
  'Camera op dezelfde hoogte, ongeveer op heuphoogte.',
  'Zelfde afstand tot de camera; markeer desnoods de plek op de vloer.',
  'Vergelijkbare kleding, strak genoeg om de contour te zien.',
  'Ontspannen staan — niet aanspannen, niet inhouden.',
  'Ongeveer hetzelfde tijdstip; \'s ochtends vóór het eten is het meest constant.',
];

// ── Startdatum van het fototraject ──────────────────────────────
// De eerste serie is dag 0. Zolang die er niet is, geldt de startdatum
// van het programma, zodat het eerste ijkpunt "vandaag" is.
export function photoStartDate(sessions = []) {
  const withPhotos = sessions
    .filter(s => Object.keys(s.views || {}).length)
    .map(s => s.date).sort();
  return withPhotos[0] || USER.startDate || todayLocal();
}

// ── De ijkpunten met hun status ─────────────────────────────────
export function checkpoints(sessions = [], currentDate = todayLocal()) {
  const start = photoStartDate(sessions);
  return CHECKPOINT_DAYS.map(day => {
    const target = addDays(start, day);
    const daysAway = daysBetween(currentDate, target);

    // De serie die het dichtst bij dit ijkpunt ligt, binnen de marge
    let match = null, bestGap = Infinity;
    for (const s of sessions) {
      const gap = Math.abs(daysBetween(target, s.date));
      if (gap <= WINDOW_DAYS && gap < bestGap) { match = s; bestGap = gap; }
    }

    const views = match?.views || {};
    const complete = PHOTO_VIEWS.every(v => views[v.key]);

    return {
      day, label: CHECKPOINT_LABELS[day], date: target,
      daysAway,
      due: daysAway <= 0 && daysAway >= -WINDOW_DAYS,
      upcoming: daysAway > 0 && daysAway <= 7,
      overdue: daysAway < -WINDOW_DAYS && !match,
      session: match,
      views,
      viewCount: PHOTO_VIEWS.filter(v => views[v.key]).length,
      complete,
      partial: !complete && Object.keys(views).length > 0,
    };
  });
}

// Moet er vandaag om een fotomoment gevraagd worden?
export function dueCheckpoint(sessions = [], currentDate = todayLocal()) {
  const cps = checkpoints(sessions, currentDate);
  // Eerst een ijkpunt dat nú open staat, dan een gemist ijkpunt inhalen.
  return cps.find(c => c.due && !c.complete)
    || cps.find(c => c.overdue && !c.complete && c.day > 0)
    || null;
}

export function checkpointPrompt(cp) {
  if (!cp) return null;
  if (cp.day === 0) {
    return {
      title: '📷 Startfoto\'s',
      text: 'Leg je uitgangspunt vast: voor, zij en achter. Zonder startpunt is er over twaalf weken niets te vergelijken.',
    };
  }
  return {
    title: '📷 Progressiemoment',
    text: `${cp.label} sinds je startfoto. Maak opnieuw voor, zij en achter — zelfde plek, zelfde licht, zelfde afstand.`,
  };
}

// ── Start / vorige / nu ─────────────────────────────────────────
// Drie series die iets te vertellen hebben. "Vorige" is bewust het
// voorlaatste ijkpunt en niet de vorige willekeurige foto: anders
// vergelijk je twee dagen die te dicht op elkaar liggen.
export function comparisonSet(sessions = [], currentDate = todayLocal()) {
  const withPhotos = sessions
    .filter(s => Object.keys(s.views || {}).length)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!withPhotos.length) return { available: false, count: 0 };

  const start = withPhotos[0];
  const current = withPhotos[withPhotos.length - 1];
  const previous = withPhotos.length >= 3 ? withPhotos[withPhotos.length - 2] : null;

  const spanDays = daysBetween(start.date, current.date);
  return {
    available: withPhotos.length >= 1,
    count: withPhotos.length,
    start, previous, current,
    sameSeries: start.date === current.date,
    spanDays,
    spanLabel: spanDays >= 7 ? `${Math.round(spanDays / 7)} weken` : `${spanDays} dagen`,
    // Onder de vier weken heeft vergelijken weinig zin; dat zeggen we ook.
    meaningful: spanDays >= 21,
    note: spanDays < 21
      ? `Er zit ${spanDays} dagen tussen je eerste en laatste serie. Onder de drie weken zie je vooral licht en houding, nog geen verandering.`
      : null,
  };
}

// ── Kwalitatieve observaties bij beeld ──────────────────────────
// Bewust geen getallen. Dit zijn de dingen waar je zelf naar kunt kijken,
// niet dingen die de app uit de pixels afleidt.
export const VISUAL_OBSERVATIONS = [
  { id: 'waist', label: 'Taillecontour', hint: 'Lijkt de lijn tussen ribben en heup anders te lopen?' },
  { id: 'posture', label: 'Houding', hint: 'Sta je rechter, schouders meer naar achteren?' },
  { id: 'definition', label: 'Spierdefinitie', hint: 'Tekenen benen, billen of schouders zich duidelijker af?' },
  { id: 'clothing', label: 'Kleding', hint: 'Valt dezelfde kleding anders?' },
];

const OBS_KEY = 'gc_photo_observations';

export function loadObservations() {
  try { return JSON.parse(localStorage.getItem(OBS_KEY) || '{}'); } catch { return {}; }
}
export function saveObservation(date, obsId, value) {
  const all = loadObservations();
  all[date] = { ...(all[date] || {}), [obsId]: value };
  localStorage.setItem(OBS_KEY, JSON.stringify(all));
  return all;
}

// ── Objectieve maten naast het beeld ────────────────────────────
// Alleen de metingen die er in dit verhaal toe doen. Vetpercentage
// verschijnt uitsluitend als er een échte meting is ingevoerd — nooit als
// schatting, en dan nog als trend.
export function bodyMetrics(measurements = [], logs = {}, currentDate = todayLocal()) {
  const sorted = [...measurements].filter(m => m.date).sort((a, b) => a.date.localeCompare(b.date));
  const weights = Object.values(logs)
    .filter(l => l.weight && l.date && l.date <= currentDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const pick = (field, arr = sorted) => {
    const rows = arr.filter(m => m[field] != null && m[field] !== '');
    if (!rows.length) return null;
    return {
      start: { date: rows[0].date, value: parseFloat(rows[0][field]) },
      current: { date: rows[rows.length - 1].date, value: parseFloat(rows[rows.length - 1][field]) },
      count: rows.length,
      rows: rows.map(r => ({ date: r.date, value: parseFloat(r[field]) })),
    };
  };

  const waist = pick('waist');
  const hip = pick('hip');
  const bodyFat = pick('body_fat');
  const weight = weights.length ? {
    start: { date: weights[0].date, value: parseFloat(weights[0].weight) },
    current: { date: weights[weights.length - 1].date, value: parseFloat(weights[weights.length - 1].weight) },
    count: weights.length,
    rows: weights.map(w => ({ date: w.date, value: parseFloat(w.weight) })),
  } : null;

  const delta = (m) => m ? +(m.current.value - m.start.value).toFixed(1) : null;

  return {
    waist, hip, weight, bodyFat,
    waistDelta: delta(waist), hipDelta: delta(hip),
    weightDelta: delta(weight), bodyFatDelta: delta(bodyFat),
    // Vetpercentage alleen tonen bij minstens twee échte metingen
    bodyFatUsable: !!(bodyFat && bodyFat.count >= 2),
  };
}

// ── Recompositie ────────────────────────────────────────────────
// Gewicht stabiel + taille omlaag + kracht omhoog is de uitkomst waar
// deze gebruiker naartoe werkt. Dat moet expliciet als winst benoemd
// worden, want de weegschaal zegt in dat geval niets.
export function recompositionVerdict({ measurements = [], logs = {}, currentDate = todayLocal() } = {}) {
  const m = bodyMetrics(measurements, logs, currentDate);
  const strengthUp = strengthTrendUp();

  const dW = m.weightDelta;
  const dWaist = m.waistDelta;
  const dHip = m.hipDelta;

  const weightStable = dW != null && Math.abs(dW) < 1;
  const waistDown = dWaist != null && dWaist <= -1;
  const waistSlight = dWaist != null && dWaist < 0 && dWaist > -1;

  const signals = [];
  if (dW != null) signals.push(`gewicht ${dW > 0 ? '+' : ''}${dW} kg`);
  if (dWaist != null) signals.push(`taille ${dWaist > 0 ? '+' : ''}${dWaist} cm`);
  if (dHip != null) signals.push(`heup ${dHip > 0 ? '+' : ''}${dHip} cm`);
  if (strengthUp.enough) signals.push(`kracht ${strengthUp.changePct > 0 ? '+' : ''}${strengthUp.changePct}%`);

  if (!signals.length) {
    return { type: 'unknown', title: 'Nog geen oordeel mogelijk', signals,
      text: 'Voer je taille, heup en gewicht in — zonder minstens twee metingen valt er over lichaamssamenstelling niets te zeggen.' };
  }

  if (weightStable && waistDown && strengthUp.up) {
    return { type: 'recomposition', positive: true, signals,
      title: 'Positieve recompositie',
      text: `Je gewicht staat vrijwel stil (${dW > 0 ? '+' : ''}${dW} kg), je taille is ${Math.abs(dWaist)} cm kleiner en je krachtcapaciteit is met ${strengthUp.changePct}% gestegen. Dat is precies het patroon waar je naartoe werkt: minder omtrek, meer weefsel dat iets doet. De weegschaal vertelt hier niet het hele verhaal.` };
  }
  if (weightStable && waistDown) {
    return { type: 'recomposition', positive: true, signals,
      title: 'Vorm verandert zonder gewichtsverlies',
      text: `Gewicht vrijwel gelijk, taille ${Math.abs(dWaist)} cm kleiner. Je lichaam verandert van samenstelling. Log je krachtsessies consequent, dan kan ik dat ook aan de krachtkant laten zien.` };
  }
  if (dW != null && dW <= -1 && waistDown) {
    return { type: 'fatloss', positive: true, signals,
      title: 'Gewicht én omtrek omlaag',
      text: `${Math.abs(dW)} kg lichter en ${Math.abs(dWaist)} cm van je taille. Trend en maten wijzen dezelfde kant op. Blijf de kracht erin houden — dat bepaalt hóe je lichter wordt.` };
  }
  if (dW != null && dW >= 1 && strengthUp.up) {
    return { type: 'gain', positive: true, signals,
      title: 'Zwaarder én sterker',
      text: `Je gewicht is ${dW} kg gestegen terwijl je krachtcapaciteit toenam. Kijk naar je taille en je foto's voordat je dit als terugval leest — bij krachttraining is dit vaak weefsel dat je juist wilt.` };
  }
  if (waistSlight || (strengthUp.up && dWaist == null)) {
    return { type: 'early', positive: true, signals,
      title: 'Vroege signalen',
      text: strengthUp.up
        ? `Je kracht gaat omhoog (${strengthUp.changePct}%). Lichaamsverandering loopt daar meestal enkele weken op achter — blijf meten.`
        : 'Kleine beweging in je taille. Nog te vroeg voor een oordeel; over vier weken zegt dit meer.' };
  }
  return { type: 'flat', positive: false, signals,
    title: 'Nog geen duidelijke trend',
    text: `Huidige stand: ${signals.join(', ')}. Dat is nog binnen de normale schommeling. Consistentie in krachtsessies en metingen is nu belangrijker dan bijsturen.` };
}

// Krachttrend als los signaal, ook bruikbaar buiten het recompositie-oordeel.
export function strengthTrendUp(currentDate = todayLocal()) {
  const sessions = trainingSessions().filter(s => s.date <= currentDate);
  if (sessions.length < 4) {
    return { enough: false, up: false, changePct: null,
      note: `Nog ${4 - sessions.length} krachtsessie(s) nodig voor een trend.` };
  }
  const half = Math.floor(sessions.length / 2);
  const recent = sessions.slice(0, half).map(sessionScore).filter(x => x > 0);
  const older = sessions.slice(half).map(sessionScore).filter(x => x > 0);
  if (!recent.length || !older.length) return { enough: false, up: false, changePct: null };
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const r = avg(recent), o = avg(older);
  const pct = Math.round(((r - o) / o) * 100);
  return { enough: true, up: pct >= 5, changePct: pct, recent: Math.round(r), older: Math.round(o) };
}

// ── Het complete verhaal voor "Mijn verandering" ────────────────
export function changeStory({ sessions = [], measurements = [], logs = {}, currentDate = todayLocal() } = {}) {
  const comp = comparisonSet(sessions, currentDate);
  const metrics = bodyMetrics(measurements, logs, currentDate);
  const recomp = recompositionVerdict({ measurements, logs, currentDate });
  const benchmarks = benchmarkProgress().filter(b => b.hasData && b.changed);
  const band = bandProgression();
  const strength = strengthTrendUp(currentDate);
  const cps = checkpoints(sessions, currentDate);

  // De regels onder de fotovergelijking: alleen wat écht veranderd is.
  const rows = [];
  if (metrics.waist && metrics.waistDelta != null) {
    rows.push({ label: 'Taille', from: `${metrics.waist.start.value} cm`,
      to: `${metrics.waist.current.value} cm`, delta: metrics.waistDelta,
      good: metrics.waistDelta < 0 });
  }
  if (metrics.hip && metrics.hipDelta != null) {
    rows.push({ label: 'Heup', from: `${metrics.hip.start.value} cm`,
      to: `${metrics.hip.current.value} cm`, delta: metrics.hipDelta,
      good: metrics.hipDelta < 0 });
  }
  if (metrics.weight && metrics.weightDelta != null) {
    rows.push({ label: 'Gewicht', from: `${metrics.weight.start.value} kg`,
      to: `${metrics.weight.current.value} kg`, delta: metrics.weightDelta,
      neutral: true });
  }
  if (metrics.bodyFatUsable) {
    rows.push({ label: 'Vetpercentage', from: `${metrics.bodyFat.start.value}%`,
      to: `${metrics.bodyFat.current.value}%`, delta: metrics.bodyFatDelta,
      good: metrics.bodyFatDelta < 0, measured: true });
  }
  if (band.enough && band.improved) {
    rows.push({ label: 'Band', from: band.start.band.replace('_', ' '),
      to: band.current.band.replace('_', ' '), good: true, text: true });
  }
  for (const b of benchmarks.slice(0, 3)) {
    rows.push({
      label: b.label,
      from: `${b.start.value}${b.unit}`, to: `${b.current.value}${b.unit}`,
      good: b.improved, text: b.kind !== 'number',
    });
  }
  if (strength.enough) {
    rows.push({ label: 'Krachtcapaciteit', from: `${strength.older}`, to: `${strength.recent}`,
      delta: strength.changePct, good: strength.changePct > 0, pct: true });
  }

  return {
    comparison: comp, metrics, recomposition: recomp, rows,
    checkpoints: cps,
    nextCheckpoint: cps.find(c => c.daysAway > 0) || null,
    dueCheckpoint: dueCheckpoint(sessions, currentDate),
    headline: recomp.title,
    // Eén zin die de twee vragen samen beantwoordt.
    verdict: (() => {
      const bodyMoved = (metrics.waistDelta != null && metrics.waistDelta <= -1)
        || (metrics.hipDelta != null && metrics.hipDelta <= -1);
      if (bodyMoved && strength.up) {
        return 'Je lichaam verandert terwijl je prestaties stijgen — dat is de combinatie die telt.';
      }
      if (strength.up) return 'Je wordt aantoonbaar sterker. De lichaamsverandering loopt daar meestal enkele weken op achter.';
      if (bodyMoved) return 'Je maten bewegen de goede kant op. Meer krachtsessies loggen maakt zichtbaar of je ook sterker wordt.';
      return 'Nog te vroeg voor een oordeel. Blijf meten en loggen — over vier weken is er iets te vergelijken.';
    })(),
  };
}

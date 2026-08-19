// Drie tempo's, en ze zijn nadrukkelijk niet hetzelfde.
//
//   RUN PACE      tempo in de hardloopblokken
//   WALK PACE     tempo in de wandelblokken
//   SESSION PACE  gemiddelde over de hele sessie, wandelen inbegrepen
//
// Session pace wordt nergens gepresenteerd als hardloopsnelheid. Dat is de
// belangrijkste regel in dit bestand. Wie 2 minuten loopt en 1,5 minuut
// wandelt heeft een sessietempo dat ergens tussen haar loop- en
// wandeltempo in ligt; dat getal zegt iets over de sessie, niets over hoe
// hard ze loopt.
//
// Historische context: circa twee jaar geleden 5 km in 25–30 minuten,
// ongeveer 5:00–6:00/km. Dat is context om te weten waar ze vandaan komt,
// geen norm voor vandaag.

import { loadWorkouts, paceToMin, fmtPace } from './workouts';
import { loadHrSettings } from './goals';
import { todayLocal, addDays } from './datetime';
import { RUNS } from './data/runningSchema';

const CORRECTION_KEY = 'gc_pace_corrections';

// Een lap of split telt als hardlopen of als wandelen. Absolute
// tempogrenzen werken hier niet: wie in de opbouwfase 10:00/km loopt en
// stevig wandelt op 9:00/km valt met elke vaste drempel aan de verkeerde
// kant. De classificatie kijkt daarom naar de verdeling bínnen één sessie:
// de snellere blokken zijn de loopblokken, de tragere de wandelblokken.
// De hartslag bevestigt of ontkracht dat.
//
// Losse segmenten zonder vergelijking vallen terug op de hartslagband.

// Onder dit verschil tussen snelste en traagste blok is er geen structuur
// om op te splitsen — dan is de sessie doorlopend.
const MIN_SPREAD = 0.12;

export const SEGMENT = { RUN: 'run', WALK: 'walk', UNKNOWN: 'unknown' };

// Classificatie van één segment zonder context. Alleen bruikbaar als er
// niets is om mee te vergelijken; dan is de hartslag het enige houvast.
export function classifySegment(segment, { hrSettings = null } = {}) {
  const hr = hrSettings || loadHrSettings();
  const pace = segmentPace(segment);
  if (pace == null) return { kind: SEGMENT.UNKNOWN, auto: true, reason: 'geen tempo bekend' };

  if (segment.avgHr != null) {
    const kind = segment.avgHr >= hr.easyLow + 6 ? SEGMENT.RUN : SEGMENT.WALK;
    return { kind, auto: true, confidence: 'medium',
      reason: `hartslag ${segment.avgHr} wijst richting ${kind === SEGMENT.RUN ? 'lopen' : 'wandelen'}` };
  }
  // Zonder hartslag en zonder vergelijking is een absolute grens de enige
  // optie die overblijft, en die is bewust ruim: 9:00/km.
  return { kind: pace <= 9 ? SEGMENT.RUN : SEGMENT.WALK, auto: true, confidence: 'low',
    reason: `${fmtPace(pace)}/km, geen hartslag en geen vergelijking binnen de sessie` };
}

// ── De classificatievolgorde ────────────────────────────────────
// In deze volgorde, want elke stap is betrouwbaarder dan de volgende:
//
//   1. de geplande intervalstructuur  — je wéét wat je zou doen
//   2. jouw correctie                 — jij hebt het laatste woord
//   3. cadans, tempo en hartslag      — meetbaar bewijs
//   4. relatief binnen de sessie      — alleen als terugval
//
// De relatieve methode is robuust maar blind: hij weet alleen dat het ene
// blok sneller was dan het andere, niet wat de bedoeling was.

// Stap 1: past het aantal segmenten op de geplande structuur? Bij
// "2 min lopen / 1,5 min wandelen × 6" verwachten we twaalf blokken die
// om en om lopen en wandelen, met herkenbare duren.
function classifyByPlan(segments, run) {
  const structure = runWalkStructure(run);
  if (!structure?.reps || structure.runMin == null || structure.walkMin == null) return null;
  const expected = structure.reps * 2;
  // Eén blok speling voor een warmlopen of uitlopen aan het begin of eind.
  if (segments.length < expected - 1 || segments.length > expected + 2) return null;

  // Controleren of de duren kloppen: loopblokken rond runMin, wandelblokken
  // rond walkMin. Wijkt meer dan een kwart af, dan klopt de aanname niet.
  const tol = 0.35;
  const fits = (mins, target) => target > 0 && Math.abs(mins - target) / target <= tol;

  // Twee mogelijke fasen: begint de reeks met lopen of met wandelen?
  for (const offset of [0, 1]) {
    let ok = 0, total = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg.minutes) continue;
      total++;
      const isRunSlot = (i + offset) % 2 === 0;
      if (fits(seg.minutes, isRunSlot ? structure.runMin : structure.walkMin)) ok++;
    }
    if (total >= 4 && ok / total >= 0.7) {
      return segments.map((seg, i) => ({
        ...seg,
        kind: (i + offset) % 2 === 0 ? SEGMENT.RUN : SEGMENT.WALK,
        auto: true, confidence: 'high', source: 'plan',
        reason: `past op de geplande structuur ${structure.label}`,
      }));
    }
  }
  return null;
}

// Stap 3: bewijs per segment. Cadans is het sterkste signaal dat er is —
// hardlopen ligt rond 150–180 stappen per minuut, wandelen rond 100–120.
function classifyByEvidence(segments, hr) {
  const withCadence = segments.filter(s => s.cadence != null);
  if (withCadence.length < segments.length * 0.6) return null;

  return segments.map(seg => {
    if (seg.cadence == null) {
      return { ...seg, kind: SEGMENT.UNKNOWN, auto: true, confidence: 'low',
        source: 'evidence', reason: 'geen cadans voor dit blok' };
    }
    // Strava geeft cadans per been; verdubbelen als het getal laag uitvalt.
    const spm = seg.cadence < 110 ? seg.cadence * 2 : seg.cadence;
    const kind = spm >= 140 ? SEGMENT.RUN : spm <= 125 ? SEGMENT.WALK : SEGMENT.UNKNOWN;
    return { ...seg, kind, auto: true,
      confidence: kind === SEGMENT.UNKNOWN ? 'low' : 'high', source: 'evidence',
      reason: `${Math.round(spm)} stappen per minuut — ${kind === SEGMENT.RUN ? 'hardlooptempo' : kind === SEGMENT.WALK ? 'wandeltempo' : 'grensgebied'}` };
  });
}

// Stap 4: relatief binnen de sessie. Alleen als de stappen hierboven niets
// opleverden.
function classifyWithin(segments, hr) {
  const usable = segments.filter(s => s.pace != null);
  if (usable.length < 2) {
    return segments.map(s => ({ ...s, ...classifySegment(
      { pace: s.pace, avgHr: s.avgHr, distance: s.distanceKm * 1000, movingTime: s.minutes * 60 },
      { hrSettings: hr }) }));
  }

  const paces = usable.map(s => s.pace).sort((a, b) => a - b);
  const fastest = paces[0], slowest = paces[paces.length - 1];
  const spread = (slowest - fastest) / fastest;

  if (spread < MIN_SPREAD) {
    // Geen structuur: alles even snel. Dan bepaalt de hartslag of dit een
    // doorlopende run of een wandeling was.
    const meanHr = avgOf(usable.map(s => s.avgHr));
    const kind = meanHr == null ? SEGMENT.UNKNOWN
      : meanHr >= hr.easyLow + 6 ? SEGMENT.RUN : SEGMENT.WALK;
    return segments.map(s => ({ ...s, kind, auto: true, confidence: 'medium',
      reason: `blokken liggen dicht bij elkaar (${Math.round(spread * 100)}% spreiding) — doorlopende inspanning` }));
  }

  // Splitspunt halverwege de twee uitersten. Simpel, uitlegbaar, en robuust
  // ongeacht of iemand 6:00 of 12:00 per kilometer loopt.
  const split = fastest + (slowest - fastest) / 2;

  // Controle met hartslag: de snelle groep hoort een hogere hartslag te
  // hebben. Zo niet, dan is de classificatie onzeker.
  const fast = usable.filter(s => s.pace <= split);
  const slow = usable.filter(s => s.pace > split);
  const fastHr = avgOf(fast.map(s => s.avgHr));
  const slowHr = avgOf(slow.map(s => s.avgHr));
  const hrAgrees = fastHr == null || slowHr == null || fastHr >= slowHr;
  const confidence = hrAgrees ? (fastHr != null ? 'high' : 'medium') : 'low';

  return segments.map(s => {
    if (s.pace == null) {
      return { ...s, kind: SEGMENT.UNKNOWN, auto: true, confidence: 'low',
        reason: 'geen tempo bekend' };
    }
    const kind = s.pace <= split ? SEGMENT.RUN : SEGMENT.WALK;
    return { ...s, kind, auto: true, confidence,
      reason: `${fmtPace(s.pace)}/km tegenover een splitspunt van ${fmtPace(split)}/km binnen deze sessie`
        + (hrAgrees ? '' : '; de hartslag bevestigt dit niet') };
  });
}

// Ronden komen ruw uit Strava (snake_case) of uit handmatige invoer
// (camelCase). Beide moeten hier hetzelfde uitkomen, anders levert een echte
// Strava-sessie stilzwijgend nul segmenten op en verdwijnt het looptempo.
const firstNumber = (...vals) => {
  for (const v of vals) {
    if (v == null) continue;
    const n = Number(v);
    if (!isNaN(n)) return n;
  }
  return null;
};

export function normalizeSegment(seg) {
  if (!seg) return null;
  return {
    distance: firstNumber(seg.distance, seg.distanceMeters),          // meters
    movingTime: firstNumber(seg.movingTime, seg.moving_time,
      seg.elapsedTime, seg.elapsed_time),                             // seconden
    avgHr: firstNumber(seg.avgHr, seg.average_heartrate,
      seg.averageHeartrate, seg.hr),
    cadence: firstNumber(seg.cadence, seg.average_cadence,
      seg.averageCadence),
    pace: seg.pace ?? null,
  };
}

function segmentPace(seg) {
  if (!seg) return null;
  const n = seg.distance !== undefined && seg.movingTime !== undefined
    ? seg : normalizeSegment(seg);
  if (n.pace != null) return paceToMin(n.pace);
  const dist = Number(n.distance) || 0;            // meters
  const time = Number(n.movingTime) || 0;          // seconden
  if (!dist || !time) return null;
  return (time / 60) / (dist / 1000);
}

// ── Correcties bewaren zodat de coach leert ─────────────────────
// key = `${workoutId}:${index}` → 'run' | 'walk'
export function loadCorrections() {
  try { return JSON.parse(localStorage.getItem(CORRECTION_KEY) || '{}'); } catch { return {}; }
}

export function correctSegment(workoutId, index, kind) {
  const all = loadCorrections();
  if (kind == null) delete all[`${workoutId}:${index}`];
  else all[`${workoutId}:${index}`] = kind;
  localStorage.setItem(CORRECTION_KEY, JSON.stringify(all));
  return all;
}

// ── De drie tempo's van één workout ─────────────────────────────
export function paceBreakdown(workout, { hrSettings = null, plannedRun = null } = {}) {
  if (!workout) return { available: false, reason: 'geen sessie' };

  const totalDist = Number(workout.distance) || null;      // km
  const totalTime = Number(workout.duration) || null;      // minuten
  const sessionPace = totalDist && totalTime ? totalTime / totalDist : null;

  // Segmenten: laps hebben de voorkeur boven splits, want die volgen de
  // structuur van de sessie in plaats van elke kilometer.
  const raw = (workout.laps?.length ? workout.laps : workout.splits) || [];
  const corrections = loadCorrections();

  const hr = hrSettings || loadHrSettings();
  const base = raw.map((rawSeg, i) => {
    const seg = normalizeSegment(rawSeg);
    const pace = segmentPace(seg);
    return {
      index: i,
      distanceKm: (Number(seg.distance) || 0) / 1000,
      minutes: (Number(seg.movingTime) || 0) / 60,
      pace,
      paceLabel: pace ? fmtPace(pace) : null,
      avgHr: seg.avgHr,
      cadence: seg.cadence,
    };
  });
  // De volgorde: plan → correctie → bewijs → relatief. Correcties komen
  // hieronder, zodat ze elke automatische uitkomst overrulen.
  const planned = plannedRun || (workout.plannedSessionId
    ? RUNS.find(r => r.nr === Number(workout.plannedSessionId)) : null);
  const classified = classifyByPlan(base, planned)
    || classifyByEvidence(base, hr)
    || classifyWithin(base, hr);

  const segments = classified.map((s, i) => {
    const corrected = corrections[`${workout.id}:${i}`];
    return { ...s, kind: corrected || s.kind, auto: !corrected, corrected: !!corrected,
      source: corrected ? 'correction' : (s.source || 'relative') };
  });

  const usable = segments.filter(s => s.pace && s.distanceKm > 0);
  const runSegs = usable.filter(s => s.kind === SEGMENT.RUN);
  const walkSegs = usable.filter(s => s.kind === SEGMENT.WALK);

  // Gewogen naar afstand: een blok van 800 m telt zwaarder dan een van 200.
  const weighted = (arr) => {
    if (!arr.length) return null;
    const dist = arr.reduce((s, x) => s + x.distanceKm, 0);
    const time = arr.reduce((s, x) => s + x.minutes, 0);
    return dist > 0 ? time / dist : null;
  };

  const runPace = weighted(runSegs);
  const walkPace = weighted(walkSegs);

  // Zonder segmenten valt er niets te splitsen. Dat zeggen we dan ook,
  // in plaats van het sessietempo als looptempo door te schuiven.
  const derived = segments.length === 0;

  return {
    available: true,
    derived,
    segments,
    segmentCount: segments.length,
    correctedCount: segments.filter(s => s.corrected).length,
    method: segments[0]?.source || null,
    methodLabel: {
      plan: 'uit de geplande structuur',
      correction: 'door jou gecorrigeerd',
      evidence: 'uit cadans',
      relative: 'afgeleid uit de sessie zelf',
    }[segments[0]?.source] || null,
    unknownCount: segments.filter(s => s.kind === SEGMENT.UNKNOWN).length,

    runPace, walkPace, sessionPace,
    runPaceLabel: runPace ? fmtPace(runPace) : null,
    walkPaceLabel: walkPace ? fmtPace(walkPace) : null,
    sessionPaceLabel: sessionPace ? fmtPace(sessionPace) : null,

    runMinutes: runSegs.reduce((s, x) => s + x.minutes, 0) || null,
    walkMinutes: walkSegs.reduce((s, x) => s + x.minutes, 0) || null,
    runKm: +runSegs.reduce((s, x) => s + x.distanceKm, 0).toFixed(2) || null,
    walkKm: +walkSegs.reduce((s, x) => s + x.distanceKm, 0).toFixed(2) || null,

    runHr: avgOf(runSegs.map(s => s.avgHr)),
    walkHr: avgOf(walkSegs.map(s => s.avgHr)),

    note: derived
      ? 'Deze sessie heeft geen ronden of kilometersplits, dus loop- en wandeltempo zijn niet te scheiden. Alleen het sessietempo is bekend — en dat is niet je hardloopsnelheid.'
      : runSegs.length && walkSegs.length
        ? null
        : runSegs.length
          ? 'Alleen loopblokken herkend; er is geen wandeltempo af te leiden.'
          : 'Alleen wandelblokken herkend; er is geen looptempo af te leiden.',
  };
}

function avgOf(arr) {
  const v = arr.filter(x => x != null && !isNaN(x));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

// ── Handmatige invoer ───────────────────────────────────────────
// Wie zonder horloge loopt kan de structuur zelf opgeven: hoeveel minuten
// lopen, hoeveel wandelen, en de totale afstand. Daaruit volgt hetzelfde
// drietal, mits het wandeltempo bekend is of geschat mag worden.
export function breakdownFromStructure({ runMinutes, walkMinutes, totalKm, walkPace = null }) {
  const rt = Number(runMinutes) || 0;
  const wt = Number(walkMinutes) || 0;
  const km = Number(totalKm) || 0;
  if (!rt || !km) return { available: false, reason: 'loopminuten en afstand zijn nodig' };

  const total = rt + wt;
  const sessionPace = total / km;
  if (!wt) {
    return { available: true, runPace: sessionPace, walkPace: null, sessionPace,
      runPaceLabel: fmtPace(sessionPace), walkPaceLabel: null, sessionPaceLabel: fmtPace(sessionPace),
      note: 'Geen wandelblokken: looptempo en sessietempo zijn hier hetzelfde.' };
  }

  const wp = walkPace || observedWalkPace();
  if (!wp || wp <= sessionPace) {
    return { available: true, runPace: null, walkPace: wp, sessionPace,
      runPaceLabel: null, walkPaceLabel: wp ? fmtPace(wp) : null, sessionPaceLabel: fmtPace(sessionPace),
      note: `Het aangenomen wandeltempo (${wp ? fmtPace(wp) : '—'}/km) is niet langzamer dan je sessietempo, dus de blokken zijn niet te scheiden. Registreer één wandelsessie met afstand en tijd, dan lukt het wel.` };
  }

  const walkKm = wt / wp;
  const runKm = km - walkKm;
  if (runKm <= 0.05) {
    return { available: true, runPace: null, walkPace: wp, sessionPace,
      runPaceLabel: null, walkPaceLabel: fmtPace(wp), sessionPaceLabel: fmtPace(sessionPace),
      note: 'De wandelblokken verklaren de hele afstand; het looptempo is zo niet te bepalen.' };
  }
  const runPace = rt / runKm;
  return {
    available: true, runPace, walkPace: wp, sessionPace,
    runPaceLabel: fmtPace(runPace), walkPaceLabel: fmtPace(wp), sessionPaceLabel: fmtPace(sessionPace),
    runKm: +runKm.toFixed(2), walkKm: +walkKm.toFixed(2),
    estimatedWalk: !walkPace,
    note: !walkPace
      ? `Looptempo afgeleid met een geschat wandeltempo van ${fmtPace(wp)}/km.`
      : null,
  };
}

// Wandeltempo uit eigen wandelsessies; anders het schema-uitgangspunt.
export function observedWalkPace() {
  const walks = loadWorkouts().filter(w => w.activityType === 'walk');
  const paces = walks.map(w => {
    const p = paceToMin(w.averagePace);
    if (p) return p;
    const d = Number(w.distance), t = Number(w.duration);
    return d && t ? t / d : null;
  }).filter(Boolean).sort((a, b) => a - b);
  // Terugval als er geen wandelsessies zijn. Bewust 9:30/km en niet de
  // 6:30–7:00 uit het oorspronkelijke schema: dat komt neer op bijna
  // 9 km/u wandelen, wat sneller is dan waar de loopblokken in deze fase
  // zitten. Een stevige wandeling ligt rond 9:00–10:00/km.
  if (!paces.length) return 9.5;
  return paces[Math.floor(paces.length / 2)];
}

const isRun = (w) => w.activityType === 'run' || w.activityType == null;

// ── Alle sessies met hun drietal ────────────────────────────────
export function allBreakdowns({ limit = 20, currentDate = todayLocal() } = {}) {
  const hr = loadHrSettings();
  return loadWorkouts()
    .filter(w => isRun(w) && w.date <= currentDate)
    .slice(0, limit)
    .map(w => ({ workout: w, ...paceBreakdown(w, { hrSettings: hr }) }));
}

// ── Running economy: zelfde hartslag, sneller looptempo ─────────
// Dit is de kernvisual van de hele hardloopcoach. Hij gebruikt
// uitdrukkelijk het RUN pace, niet het sessietempo — anders meet je
// vooral hoeveel je gewandeld hebt.
export function runEconomyTrend({ currentDate = todayLocal(), minObservations = 3 } = {}) {
  const hr = loadHrSettings();
  const points = allBreakdowns({ limit: 40, currentDate })
    .map(b => {
      // Hartslag van de loopblokken zelf, niet van de hele sessie.
      const heart = b.runHr ?? (b.workout.averageHR != null ? Number(b.workout.averageHR) : null);
      if (!b.runPace || heart == null) return null;
      return { date: b.workout.date, runPace: b.runPace, hr: heart,
        derived: b.derived, source: b.workout.source || 'manual' };
    })
    .filter(Boolean)
    .filter(p => p.hr >= hr.easyLow - 6 && p.hr <= hr.easyHigh + 8)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < minObservations) {
    return {
      enough: false, count: points.length, points,
      note: points.length === 0
        ? 'Nog geen sessie waarin loop- en wandelblokken te scheiden waren. Zodra er ronden of splits met hartslag binnenkomen, verschijnt hier de lijn die er echt toe doet: sneller lopen bij dezelfde hartslag.'
        : `Nog ${minObservations - points.length} sessie(s) met een af te leiden looptempo nodig voor een trendlijn.`,
    };
  }

  const third = Math.max(1, Math.floor(points.length / 3));
  const early = points.slice(0, third);
  const late = points.slice(-third);
  const avg = (a, k) => a.reduce((s, p) => s + p[k], 0) / a.length;

  const earlyPace = avg(early, 'runPace'), latePace = avg(late, 'runPace');
  const earlyHr = Math.round(avg(early, 'hr')), lateHr = Math.round(avg(late, 'hr'));

  // Alleen een eerlijke winst als de hartslag niet meegestegen is.
  const hrDrift = lateHr - earlyHr;
  const gainSec = Math.round((earlyPace - latePace) * 60);

  return {
    enough: true, count: points.length, points,
    early: { pace: earlyPace, hr: earlyHr, from: early[0].date },
    late: { pace: latePace, hr: lateHr, to: late[late.length - 1].date },
    gainSec, hrDrift,
    honest: hrDrift <= 2,
    verdict: gainSec > 5 && hrDrift <= 2
      ? `Bij vrijwel dezelfde hartslag (${earlyHr} → ${lateHr}) loop je ${gainSec} sec/km sneller. Dat is echte loopeconomie: hetzelfde werk voor je hart levert meer snelheid op.`
      : gainSec > 5
        ? `Je looptempo is ${gainSec} sec/km sneller, maar je hartslag ging ook ${hrDrift} slagen omhoog. Dat is harder werken, niet per se economischer worden.`
        : gainSec < -5
          ? `Je looptempo is ${Math.abs(gainSec)} sec/km langzamer geworden bij hartslag ${lateHr}. Kijk naar herstel, slaap en of de sessies zwaarder werden.`
          : `Looptempo en hartslag zijn stabiel (${lateHr} bpm, ${fmtPace(latePace)}/km). Consistentie is in deze fase de winst.`,
  };
}

// ── Verwachting voor de volgende sessie ─────────────────────────
// Drie tempo's apart, met een expliciete waarschuwing dat het
// hartslagplafond leidend is en het tempo een uitkomst.
export function pacePrediction({ run = null, currentDate = todayLocal() } = {}) {
  const hr = loadHrSettings();
  const econ = runEconomyTrend({ currentDate });
  const walkPace = observedWalkPace();

  const recent = allBreakdowns({ limit: 8, currentDate });
  const withRun = recent.filter(b => b.runPace);
  const median = (arr) => {
    const v = arr.filter(x => x != null).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };

  const medRun = median(withRun.map(b => b.runPace));
  const medWalk = median(recent.map(b => b.walkPace).filter(Boolean)) || walkPace;
  const medSession = median(recent.map(b => b.sessionPace).filter(Boolean));

  // Bandbreedte: minimaal 4%, want twee identieke sessies betekenen niet
  // dat de derde exact hetzelfde wordt.
  const band = (mid, pct = 0.05) => mid == null ? null
    : { low: mid * (1 - pct), high: mid * (1 + pct), mid };

  // Uit de geplande structuur volgt het verwachte sessietempo, gegeven de
  // loop- en wandeltempo's hierboven.
  const structure = run ? runWalkStructure(run) : null;
  const predictedSession = (structure && medRun && medWalk)
    ? (structure.runMinutes + structure.walkMinutes) /
      (structure.runMinutes / medRun + structure.walkMinutes / medWalk)
    : medSession;

  const observations = withRun.length;
  const confidence = observations >= 5 && econ.enough ? 'HIGH'
    : observations >= 2 ? 'MEDIUM' : 'LOW';

  return {
    structure,
    runPace: band(medRun),
    walkPace: band(medWalk, 0.06),
    sessionPace: band(predictedSession),
    targetHrCeiling: hr.walkTrigger,
    targetHr: { low: hr.easyLow, high: hr.easyHigh },
    expectedAvgHr: median(recent.map(b => b.runHr ?? Number(b.workout.averageHR)).filter(Boolean)),
    expectedDistanceKm: (structure && predictedSession)
      ? +((structure.runMinutes + structure.walkMinutes) / predictedSession).toFixed(2) : null,
    confidence,
    observations,
    missing: [
      !medRun ? 'nog geen af te leiden looptempo — daarvoor zijn ronden of splits nodig' : null,
      !recent.some(b => b.walkPace) ? 'nog geen gemeten wandeltempo — nu geschat' : null,
      !econ.enough ? 'nog te weinig punten voor een economie-trendlijn' : null,
    ].filter(Boolean),
    // De zin die overal moet blijven staan.
    caveat: 'Hartslag is de instructie, tempo is de uitkomst. Boven ' +
      `${hr.walkTrigger} bpm ga je wandelen, ook als het tempo dan wegzakt.`,
    sessionPaceWarning: 'Het sessietempo telt de wandelblokken mee. Het is dus lager dan je hardloopsnelheid en zegt daar niets over.',
  };
}

// Structuur van een geplande sessie in minuten lopen en wandelen.
export function runWalkStructure(run) {
  if (!run) return null;
  const reps = run.reps || null;
  const rm = run.runMin ?? null, wm = run.walkMin ?? null;
  if (reps && rm != null && wm != null) {
    return { reps, runMin: rm, walkMin: wm,
      runMinutes: reps * rm, walkMinutes: reps * wm,
      label: `${rm} min lopen / ${wm} min wandelen × ${reps}` };
  }
  if (rm != null && wm != null && run.duration) {
    const cycles = run.duration / (rm + wm);
    return { reps: Math.round(cycles), runMin: rm, walkMin: wm,
      runMinutes: cycles * rm, walkMinutes: cycles * wm,
      label: `${rm} min lopen / ${wm} min wandelen, ${run.duration} min totaal` };
  }
  return { reps: null, runMin: null, walkMin: null,
    runMinutes: run.duration || 0, walkMinutes: 0,
    label: run.description || 'doorlopend' };
}

// ── Historische context ─────────────────────────────────────────
// Waar ze vandaan komt, uitdrukkelijk niet als norm voor vandaag.
export const HISTORICAL_CONTEXT = {
  distanceKm: 5,
  timeRangeMin: [25, 30],
  paceRange: [5.0, 6.0],
  yearsAgo: 2,
  note: 'Twee jaar geleden liep je 5 km in ongeveer 25–30 minuten, zo\'n 5:00–6:00/km. Dat is waar je vandaan komt, niet waar je vandaag aan moet voldoen. Het is bewijs dat je lichaam dit kan; het tempo van nu wordt bepaald door je hartslag en je herstel.',
};

// Waar staat ze nu ten opzichte van toen — feitelijk, zonder oordeel.
export function historicalComparison({ currentDate = todayLocal() } = {}) {
  const econ = runEconomyTrend({ currentDate });
  if (!econ.enough) return { available: false, ...HISTORICAL_CONTEXT };
  const now = econ.late.pace;
  const then = (HISTORICAL_CONTEXT.paceRange[0] + HISTORICAL_CONTEXT.paceRange[1]) / 2;
  return {
    available: true,
    thenPace: fmtPace(then), nowPace: fmtPace(now),
    gapSec: Math.round((now - then) * 60),
    ...HISTORICAL_CONTEXT,
  };
}

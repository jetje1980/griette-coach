// Waar sta ik voor elk loopdoel?
//
// Eén rij per doel: status, huidige schatting, zekerheid, wat je tegenhoudt,
// afstandsdekking, tempo bij gelijke hartslag, langste goed verdragen
// afstand, en de eerstvolgende tussenstap.
//
// Dit bestand rekent bijna niets zelf uit. De schattingen komen uit
// racePerformance, de dekking uit runningState, de limiter uit
// goalIntelligence, het tempo uit pace. Wat hier gebeurt is: per soort doel
// bepalen wélk criterium beslist of je op koers ligt.
//
// Want dat verschilt echt. Bij een wedstrijd is dat de voorspelde eindtijd.
// Bij een afstandsdoel is het of je die afstand aaneengesloten aankunt én
// er goed van herstelt — tijd doet er niet toe. Bij een economiedoel moeten
// tijd én hartslag allebei kloppen, en dat is het lastigste van de vier,
// want je kunt sneller worden door harder te werken en dan is het doel juist
// verder weg.

import { todayLocal, daysBetween, addDays } from './datetime';
import { GOAL_KIND } from './runGoalModel';
import { runningState } from './raceGoals';
import { racePerformanceEstimate, capacityVersusPerformance } from './racePerformance';
import { easyRunPace, CONFIDENCE } from './easyPace';
import { runEconomyTrend } from './pace';
import { longestToleratedRun } from './restday';
import { pemFreeWeeks } from './symptoms';
import { runLimiter, distanceCoverage, LIMITER_LABEL } from './goalIntelligence';
import { fmtSec, fmtPaceSec, paceToSec } from './sessionMath';

// ── Statussen ───────────────────────────────────────────────────
export const STATUS = {
  ON_TRACK: 'ON_TRACK',
  CLOSE: 'CLOSE',
  STRETCH: 'STRETCH',
  OUT_OF_REACH: 'OUT_OF_REACH',
  NOT_ENOUGH_DATA: 'NOT_ENOUGH_DATA',
  ACHIEVED: 'ACHIEVED',
};

export const STATUS_META = {
  ON_TRACK:        { label: 'Op koers',        tone: 'good' },
  CLOSE:           { label: 'Dichtbij',        tone: 'good' },
  STRETCH:         { label: 'Ambitieus',       tone: 'warn' },
  OUT_OF_REACH:    { label: 'Nu niet in bereik', tone: 'bad' },
  NOT_ENOUGH_DATA: { label: 'Te weinig data',  tone: 'neutral' },
  ACHIEVED:        { label: 'Gehaald',         tone: 'good' },
};

// De zin die bij een lage zekerheid hoort. Niet verbergen, wel benoemen —
// een voorspelling met twee meetpunten is geen voorspelling maar een schets.
export const LOW_CONFIDENCE_NOTE =
  'Voorlopige schatting — onvoldoende afzonderlijke run/walk-laps.';

/**
 * Eén doel beoordelen.
 *
 * `state` (runningState) mag worden meegegeven zodat een dashboard met zeven
 * doelen niet zeven keer dezelfde geschiedenis doorrekent.
 */
export function runGoalStatus(goal, {
  logs = {}, currentDate = todayLocal(), state = null, budget = null,
} = {}) {
  const st = state || runningState({ logs, currentDate });
  const weeks = goal.windowEnd
    ? Math.max(0, daysBetween(currentDate, goal.windowEnd) / 7) : null;

  // Wat er voor elk soort doel gelijk is.
  const dekking = distanceCoverage({ raceDistanceKm: goal.distanceKm, state: st });
  const limiter = runLimiter({ state: st, budget, raceDistanceKm: goal.distanceKm });
  const econ = runEconomyTrend({ currentDate });
  const easy = easyRunPace({ logs, currentDate });

  const gedeeld = {
    goal,
    kind: goal.kind,
    weeks: weeks == null ? null : Math.round(weeks),
    coverage: dekking,
    limiter,
    longestTolerated: st.longestTolerated || 0,
    longestContinuousMin: st.longestContinuousMin || 0,
    pemFreeWeeks: st.pemFreeWeeks ?? 0,
    paceAtHr: econ.enough ? {
      pace: econ.late.pace, hr: econ.late.hr,
      label: `${fmtPaceSec(paceToSec(econ.late.pace))}/km bij HR ${econ.late.hr}`,
      gainSec: econ.gainSec, honest: econ.honest,
    } : null,
    easyPace: easy.available ? { label: easy.paceLabel, atHr: easy.atHr } : null,
  };

  const beoordeeld = goal.kind === GOAL_KIND.ENDURANCE
    ? beoordeelAfstand(goal, gedeeld, { logs, currentDate, st })
    : goal.kind === GOAL_KIND.ECONOMY
      ? beoordeelEconomie(goal, gedeeld, { logs, currentDate, st })
      : beoordeelTijd(goal, gedeeld, { logs, currentDate, st });

  return {
    ...gedeeld,
    ...beoordeeld,
    nextMilestone: nextMilestone(goal, { ...gedeeld, ...beoordeeld }),
  };
}

// ── Tijdgebonden doelen: wedstrijd, snelheid ────────────────────
// De voorspelde eindtijd tegenover de streeftijd. Beide in seconden, altijd
// — hier is ooit een minutenwaarde naast een tempowaarde beland.
function beoordeelTijd(goal, gedeeld, { logs, currentDate }) {
  const perf = racePerformanceEstimate({ goal, logs, currentDate });
  if (!perf.available) {
    return {
      status: STATUS.NOT_ENOUGH_DATA,
      confidence: CONFIDENCE.NONE,
      currentEstimate: null, currentLabel: null,
      reason: perf.reason || perf.limits?.[0]
        || 'Nog geen sessie waarin loop- en wandelblokken te scheiden waren.',
      basis: perf.basis || [],
    };
  }

  // racePerformance levert het waarschijnlijke scenario apart aan; dat is de
  // bedoelde ingang. Zoeken op sleutel ging mis omdat die sleutel de Dutch
  // labelnaam is, en het veld heet finishSec — niet finishMinutes.
  const waarschijnlijk = perf.likely || perf.scenarios?.[0];
  if (!waarschijnlijk?.finishSec) {
    return {
      status: STATUS.NOT_ENOUGH_DATA, confidence: perf.confidence || CONFIDENCE.NONE,
      currentEstimate: null, currentLabel: null,
      reason: 'Er kwam geen bruikbare finishtijd uit de schatting.',
      basis: perf.basis || [],
    };
  }
  const voorspeldSec = waarschijnlijk.finishSec;
  const doelSec = goal.targetTimeSec;
  const verschilSec = voorspeldSec - doelSec;

  // Hoeveel sneller moet je worden, per week, om het te halen?
  const perKm = verschilSec / goal.distanceKm;
  const REALISTISCH_SEC_PER_KM_PER_WEEK = 4;
  const wekenNodig = perKm > 0 ? Math.ceil(perKm / REALISTISCH_SEC_PER_KM_PER_WEEK) : 0;

  let status;
  if (verschilSec <= 0) status = STATUS.ON_TRACK;
  else if (gedeeld.weeks == null) status = STATUS.STRETCH;
  else if (wekenNodig <= gedeeld.weeks * 0.6) status = STATUS.CLOSE;
  else if (wekenNodig <= gedeeld.weeks) status = STATUS.STRETCH;
  else status = STATUS.OUT_OF_REACH;

  return {
    status,
    confidence: perf.confidence,
    currentEstimate: voorspeldSec,
    currentLabel: fmtSec(voorspeldSec),
    gapSec: verschilSec,
    gapLabel: verschilSec > 0 ? `${fmtSec(verschilSec)} te langzaam` : 'binnen doel',
    weeksNeeded: wekenNodig,
    scenarios: perf.scenarios,
    basis: perf.basis || [],
    limits: perf.limits || [],
    reason: verschilSec <= 0
      ? `De voorspelling (${fmtSec(voorspeldSec)}) ligt binnen je doel van ${fmtSec(doelSec)}.`
      : gedeeld.weeks == null
        ? `Nog ${fmtSec(verschilSec)} te winnen. Zonder datum beoordeel ik alleen de richting.`
        : `Nog ${fmtSec(verschilSec)} te winnen in ${gedeeld.weeks} weken; op een ` +
          `realistisch tempo kost dat er ongeveer ${wekenNodig}.`,
  };
}

// ── Afstandsdoelen: uitlopen, aaneengesloten, goed herstellen ───
// Tijd telt niet mee. Wat telt: haal je de afstand, kun je hem aaneengesloten
// lopen als dat gevraagd is, en blijf je er schoon van.
function beoordeelAfstand(goal, gedeeld, { logs, currentDate, st }) {
  const verdragen = gedeeld.longestTolerated;
  const dekkingPct = gedeeld.coverage.available ? gedeeld.coverage.pct : 0;

  if (!verdragen) {
    return {
      status: STATUS.NOT_ENOUGH_DATA, confidence: CONFIDENCE.NONE,
      currentEstimate: null, currentLabel: null,
      reason: 'Nog geen goed verdragen run met een gemeten afstand.',
    };
  }

  // Aaneengesloten kunnen lopen is een aparte vaardigheid van afstand aankunnen.
  const continuMin = gedeeld.longestContinuousMin;
  const continuOk = !goal.continuous || continuMin >= 20;

  // Herstel als criterium: hoeveel PEM-vrije weken staan er?
  const herstelOk = !goal.recoveryCriterion || gedeeld.pemFreeWeeks >= 2;

  let status;
  if (verdragen >= goal.distanceKm && continuOk && herstelOk) status = STATUS.ACHIEVED;
  else if (dekkingPct >= 80 && continuOk) status = STATUS.CLOSE;
  else if (dekkingPct >= 50) status = STATUS.STRETCH;
  else status = STATUS.OUT_OF_REACH;

  // Bij een afstandsdoel telt de betrouwbaarheid van de afstandsmeting, niet
  // die van een tempovoorspelling. Dat is een ander soort zekerheid.
  const confidence = st.toleratedCount >= 5 ? CONFIDENCE.MEDIUM
    : st.toleratedCount >= 2 ? CONFIDENCE.LOW : CONFIDENCE.NONE;

  const redenen = [
    `Langste goed verdragen afstand: ${verdragen} km van ${goal.distanceKm} km (${dekkingPct}%).`,
  ];
  if (goal.continuous) {
    redenen.push(continuOk
      ? `Aaneengesloten lopen: ${continuMin} min gehaald.`
      : `Aaneengesloten lopen is nog de beperking — nu ${continuMin} min.`);
  }
  if (goal.recoveryCriterion) {
    redenen.push(herstelOk
      ? `${gedeeld.pemFreeWeeks} PEM-vrije weken.`
      : `Herstel telt mee als criterium en staat op ${gedeeld.pemFreeWeeks} PEM-vrije weken.`);
  }

  return {
    status, confidence,
    currentEstimate: verdragen,
    currentLabel: `${verdragen} km verdragen`,
    continuousOk: continuOk, recoveryOk: herstelOk,
    reason: redenen.join(' '),
    // Bij dit soort doel is tijd nadrukkelijk bijzaak, en dat zeggen we ook.
    timeIsSecondary: true,
  };
}

// ── Economiedoelen: tijd én hartslag ────────────────────────────
// Het lastigste soort, want de twee criteria kunnen tegen elkaar in werken.
// Sneller worden door harder te werken brengt de tijd dichterbij en de
// hartslag verder weg — en dan is het doel niet dichterbij gekomen.
function beoordeelEconomie(goal, gedeeld, { logs, currentDate }) {
  const perf = racePerformanceEstimate({ goal, logs, currentDate });
  const paceAtHr = gedeeld.paceAtHr;

  if (!perf.available || !paceAtHr) {
    return {
      status: STATUS.NOT_ENOUGH_DATA,
      confidence: CONFIDENCE.NONE,
      currentEstimate: null, currentLabel: null,
      reason: !paceAtHr
        ? 'Voor een economiedoel is tempo bij gelijke hartslag nodig, en dat is er nog niet.'
        : (perf.reason || 'Nog te weinig sessies met te scheiden loopblokken.'),
    };
  }

  // Het doel vertaald naar wat het écht vraagt: dit tempo, bij deze hartslag.
  const doelTempoSec = goal.targetPaceSecPerKm;
  const huidigTempoSec = paceToSec(paceAtHr.pace);
  const huidigeHr = paceAtHr.hr;

  const tempoOk = huidigTempoSec <= doelTempoSec;
  const hrOk = goal.outcomeAvgHr == null || huidigeHr <= goal.outcomeAvgHr;

  let status;
  if (tempoOk && hrOk) status = STATUS.ACHIEVED;
  else if (tempoOk || hrOk) status = STATUS.CLOSE;
  else {
    const tempoGat = huidigTempoSec - doelTempoSec;
    const hrGat = goal.outcomeAvgHr != null ? huidigeHr - goal.outcomeAvgHr : 0;
    status = (tempoGat <= 60 && hrGat <= 10) ? STATUS.STRETCH : STATUS.OUT_OF_REACH;
  }

  const stukken = [
    `Je loopt nu ${fmtPaceSec(huidigTempoSec)}/km bij HR ${huidigeHr}.`,
    `Het doel vraagt ${fmtPaceSec(doelTempoSec)}/km` +
      (goal.outcomeAvgHr != null ? ` bij HR ≤ ${goal.outcomeAvgHr}.` : '.'),
  ];
  if (!hrOk && tempoOk) {
    stukken.push('Het tempo staat, de hartslag nog niet — dat is precies wat een ' +
      'economiedoel meet: hetzelfde werk voor minder.');
  }

  return {
    status,
    confidence: paceAtHr.honest === false ? CONFIDENCE.LOW : perf.confidence,
    currentEstimate: huidigTempoSec,
    currentLabel: `${fmtPaceSec(huidigTempoSec)}/km @ HR ${huidigeHr}`,
    paceOk: tempoOk, hrOk,
    reason: stukken.join(' '),
    // De hartslag in dit doel is een uitkomst. Deze markering reist mee naar
    // het scherm, zodat er nooit "houd je hartslag onder 140" van wordt.
    hrIsOutcomeOnly: true,
  };
}

// ── De eerstvolgende tussenstap ─────────────────────────────────
// Één concrete stap die dichterbij ligt dan het doel zelf. Geen belofte dat
// hij automatisch komt — dat hangt aan de 24–48u-respons.
export function nextMilestone(goal, s) {
  if (s.status === STATUS.ACHIEVED) return null;

  if (s.status === STATUS.NOT_ENOUGH_DATA) {
    return {
      label: 'Eén run met te scheiden loop- en wandelblokken',
      why: 'Zonder die blokken is er alleen sessietempo, en dat is iets anders dan looptempo.',
    };
  }

  // Afstand is bijna altijd de eerste beperking bij haar.
  const verdragen = s.longestTolerated || 0;
  if (goal.distanceKm && verdragen < goal.distanceKm) {
    // Een stap van ongeveer een halve kilometer, of het doel zelf als dat
    // dichterbij is. Nooit een sprong.
    const stap = Math.min(goal.distanceKm, Math.round((verdragen + 0.5) * 2) / 2);
    return {
      label: `${stap} km goed verdragen`,
      why: `Nu staat er ${verdragen} km. De volgende stap is klein met opzet: ` +
        'wat telt is dat de respons schoon blijft.',
    };
  }

  if (goal.continuous && (s.longestContinuousMin || 0) < 20) {
    return {
      label: `${Math.min(20, (s.longestContinuousMin || 0) + 3)} min aaneengesloten lopen`,
      why: 'Aaneengesloten kunnen lopen is een andere vaardigheid dan de afstand aankunnen.',
    };
  }

  if (goal.recoveryCriterion && (s.pemFreeWeeks ?? 0) < 2) {
    return {
      label: 'Twee PEM-vrije weken',
      why: 'Herstel is onderdeel van dit doel, dus het telt mee als tussenstap.',
    };
  }

  if (s.gapSec > 0 && s.weeksNeeded) {
    const perKmPerWeek = 4;
    return {
      label: `${fmtPaceSec(paceToSec(s.paceAtHr?.pace ?? 0) - perKmPerWeek)}/km bij dezelfde hartslag`,
      why: 'Sneller worden bij gelijke hartslag is de winst die telt; sneller door harder ' +
        'werken is dat niet.',
    };
  }

  if (goal.kind === GOAL_KIND.ECONOMY && s.hrOk === false) {
    return {
      label: `Dezelfde afstand bij HR ${Math.max(goal.outcomeAvgHr, (s.paceAtHr?.hr ?? 0) - 5)}`,
      why: 'Dat is de kern van dit doel: hetzelfde werk voor minder.',
    };
  }

  return null;
}

// ── Alles tegelijk, met de prioriteitsvolgorde van de Head Coach ─
// Niet elk doel levert een training op. De volgorde bepaalt welk doel de
// planning stuurt; de rest loopt mee.
export function allRunGoalStatuses({ goals = [], logs = {}, currentDate = todayLocal(),
  budget = null } = {}) {
  const state = runningState({ logs, currentDate });
  const rijen = goals.map(g => runGoalStatus(g, { logs, currentDate, state, budget }));

  // Sorteren zoals de coach afweegt: eerst wat je zelf primair noemde, dan
  // hoe dichtbij de deadline is, dan hoe ver het nog af ligt.
  const rang = { primary: 0, secondary: 1, someday: 2 };
  const gesorteerd = [...rijen].sort((a, b) => {
    const p = (rang[a.goal.priority] ?? 1) - (rang[b.goal.priority] ?? 1);
    if (p !== 0) return p;
    const wa = a.weeks ?? 9999, wb = b.weeks ?? 9999;
    if (wa !== wb) return wa - wb;
    return (a.goal.windowEnd || '9999').localeCompare(b.goal.windowEnd || '9999');
  });

  return {
    rows: gesorteerd,
    state,
    // Het doel dat de planning stuurt. De rest bestaat gewoon door.
    driving: gesorteerd.find(r => r.status !== STATUS.ACHIEVED) || gesorteerd[0] || null,
  };
}

// ── Welk doel dient de training van vandaag? ────────────────────
// Per doel een gewicht, met een reden. Geen "draagt bij aan je doelen" maar
// "dit doel, zoveel, hierom".
//
// De koppeling is expliciet per sessiedoel. Impliciet raden welk doel een
// sessie dient levert overtuigende maar verzonnen verbanden op — en dan staat
// er bij een rustige duurloop dat hij je vijf-kilometertijd verbetert.
const STEUN = {
  // sessiedoel → wat het vooral oplevert
  EASY_ECONOMY:    { aerobic: 'HIGH', distance: 'MEDIUM', speed: 'LOW',    economy: 'HIGH' },
  DURABILITY:      { aerobic: 'HIGH', distance: 'HIGH',   speed: 'LOW',    economy: 'MEDIUM' },
  QUALITY_LITE:    { aerobic: 'MEDIUM', distance: 'LOW',  speed: 'MEDIUM', economy: 'MEDIUM' },
  FIVE_K_SPECIFIC: { aerobic: 'LOW',  distance: 'MEDIUM', speed: 'HIGH',   economy: 'LOW' },
  TEN_K_SPECIFIC:  { aerobic: 'MEDIUM', distance: 'HIGH', speed: 'HIGH',   economy: 'LOW' },
  TAPER:           { aerobic: 'LOW',  distance: 'LOW',    speed: 'LOW',    economy: 'LOW' },
  RECOVERY:        { aerobic: 'LOW',  distance: 'LOW',    speed: 'LOW',    economy: 'LOW' },
};

// Waar draait dit doel eigenlijk om? Dat bepaalt welke kolom telt.
function assenVoor(goal) {
  if (goal.kind === GOAL_KIND.ENDURANCE) return ['distance', 'aerobic'];
  if (goal.kind === GOAL_KIND.ECONOMY) return ['economy', 'aerobic'];
  if (goal.kind === GOAL_KIND.PERFORMANCE) return ['speed', 'economy'];
  return ['speed', 'distance'];                       // race
}

const RANG = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export function sessionSupport(purpose, statuses = []) {
  const tabel = STEUN[purpose] || STEUN.RECOVERY;
  const uit = statuses.map(s => {
    const assen = assenVoor(s.goal);
    const niveau = assen
      .map(a => tabel[a])
      .sort((x, y) => RANG[y] - RANG[x])[0] || 'LOW';
    return {
      goalId: s.goal.id,
      label: s.goal.name,
      when: s.goal.windowEnd,
      level: niveau,
      // Waarom juist zoveel: de as die het gewicht bepaalde.
      axis: assen[0],
    };
  });

  // De aerobe basis dient elk doel en verdient een eigen regel, want anders
  // lijkt een rustige sessie nergens voor te dienen.
  uit.push({
    goalId: '_aerobic', label: 'aerobe basis', when: null,
    level: tabel.aerobic, axis: 'aerobic',
  });

  return uit.sort((a, b) => RANG[b.level] - RANG[a.level]);
}

// ── Waarom vandaag niet sneller of langer? ──────────────────────
// Eén of twee zinnen, en alleen als er werkelijk iets in de weg staat. Een
// lege uitleg is beter dan een verzonnen reden.
export function whyNotMore({ plan, budget, limiter, statuses = [] }) {
  const zinnen = [];

  if (budget?.hardBlock) {
    zinnen.push('De poort staat dicht; vandaag is er geen prikkel te geven.');
    return zinnen;
  }
  if (plan?.mayBuild === false) {
    zinnen.push('De vorige sessie is nog niet schoon bevestigd, dus vandaag houd je het niveau vast in plaats van op te bouwen.');
  }
  if (budget && budget.band === 'LOW') {
    zinnen.push('Je herstelruimte is beperkt; korter is vandaag de betere investering.');
  }
  if (limiter?.id === 'DISTANCE_TOLERANCE' && zinnen.length < 2) {
    zinnen.push('Afstand is nu de beperking, niet snelheid — daar wint tempo-werk niets.');
  }
  if (limiter?.id === 'RECOVERY' && zinnen.length < 2) {
    zinnen.push('Herstel is de beperkende factor; opbouwen kost nu meer dan het oplevert.');
  }
  if (!zinnen.length && statuses.some(s => s.status === 'OUT_OF_REACH')) {
    zinnen.push('Een doel ligt buiten bereik op dit tempo. Dat verandert de datum, niet de opbouw.');
  }
  return zinnen.slice(0, 2);
}

// ── Wat moet deze training bewijzen? ────────────────────────────
// Nadrukkelijk als voorwaarde geformuleerd, niet als belofte. Progressie
// gebeurt niet automatisch; hij hangt aan de respons van 24 tot 48 uur later.
export function whatThisProves({ plan, limiter, statuses = [] }) {
  const p = plan?.purpose;
  const verdragen = statuses[0]?.longestTolerated ?? null;

  if (!plan?.run) return null;

  if (p === 'DURABILITY') {
    return `Als deze sessie schoon wordt verdragen, kan de afstandstolerantie bij de ` +
      `volgende beoordeling omhoog${verdragen ? ` — nu ${verdragen} km` : ''}.`;
  }
  if (p === 'EASY_ECONOMY') {
    return 'Als deze sessie schoon wordt verdragen én je loopt hem binnen je hartslagband, ' +
      'levert hij een meetpunt voor je tempo bij gelijke hartslag.';
  }
  if (p === 'QUALITY_LITE' || p === 'FIVE_K_SPECIFIC' || p === 'TEN_K_SPECIFIC') {
    return 'Als de respons hierna schoon is, is dat het bewijs dat er ruimte is voor ' +
      'intensiteit — dat is nu de open vraag.';
  }
  if (p === 'TAPER') {
    return 'Deze sessie hoeft niets te bewijzen. Hij houdt de vorm vast terwijl de ' +
      'vermoeidheid zakt.';
  }
  return 'Wat deze sessie oplevert blijkt pas uit je herstelcheck van morgen.';
}

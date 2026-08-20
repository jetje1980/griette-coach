// Haalbaarheid van een racedoel: voorspelling tegen doeltijd.
//
// De oude berekening vergeleek twee dingen die niets met elkaar te maken
// hadden. Voor het doel "easy tempo 7 min/km" nam hij als huidige stand de
// langste séssieduur — 37,7 minuten — en zette die naast 7. Minuten naast
// minuten-per-kilometer. Daar kwam letterlijk uit:
//
//   "Je zit nu op 37.7 min. Naar 7 min in 6 weken vraagt -23,1%/week —
//    ruim binnen wat je herstel toelaat."
//
// Een negatief groeipercentage tussen twee verschillende eenheden, en op
// grond daarvan het oordeel "haalbaar". Dat is geen strenge coach en geen
// milde coach; dat is een rekenfout die zich voordoet als een oordeel.
//
// Wat er hoort te gebeuren: de voorspelde finishtijd op deze afstand naast
// de gewenste finishtijd. Zelfde eenheid, zelfde afstand, zelfde vraag.

import { todayLocal, daysBetween } from './datetime';
import { racePerformanceEstimate } from './racePerformance';
import { runningState } from './raceGoals';
import { fmtSec, fmtPaceSec } from './sessionMath';

// Hoeveel seconden per kilometer je realistisch per week wint bij deze
// opbouw. Bewust laag: dit is een loper die uit een terugval komt, niet een
// student die een blok bouwt.
export const REALISTIC_GAIN_SEC_PER_KM_PER_WEEK = 4;

export const FEASIBILITY = {
  ON_TRACK: { id: 'ON_TRACK', label: 'Op koers',
    meaning: 'De voorspelling ligt op of onder je doeltijd.' },
  CLOSE: { id: 'CLOSE', label: 'Binnen bereik',
    meaning: 'Het gat is te overbruggen met de winst die je nu laat zien.' },
  AMBITIOUS: { id: 'AMBITIOUS', label: 'Ambitieus',
    meaning: 'Het kan, maar alleen als alles meezit en je herstel schoon blijft.' },
  OUT_OF_REACH: { id: 'OUT_OF_REACH', label: 'Nu niet realistisch',
    meaning: 'Het gat is groter dan de tijd toelaat. De datum schuift, de opbouw niet.' },
  UNKNOWN: { id: 'UNKNOWN', label: 'Nog niet te zeggen',
    meaning: 'Te weinig data om een finishtijd te voorspellen.' },
};

// Een RaceGoal omzetten naar de vorm die de forecast verwacht.
function asRace(goal) {
  return {
    id: goal.id, name: goal.name, date: goal.date,
    distanceKm: goal.distanceKm,
    targetMinutes: goal.targetTimeSec / 60,
    targetPace: goal.targetPaceSecPerKm / 60,
    terrain: goal.terrain || 'road',
    kind: goal.kind,
  };
}

export function raceFeasibility(goal, { logs = {}, currentDate = todayLocal(),
  state = null } = {}) {
  if (!goal?.distanceKm || !goal?.targetTimeSec) {
    return { goal, verdict: FEASIBILITY.UNKNOWN.id, ...FEASIBILITY.UNKNOWN,
      reason: 'Dit doel mist een afstand of een eindtijd.' };
  }

  const race = asRace(goal);
  const st = state || runningState({ logs, currentDate });
  // De voorspelling komt uit het raceprestatiemodel, niet uit een
  // sessietempo-anker: dat laatste rekende met wandelingen mee.
  const forecast = racePerformanceEstimate({ goal, logs, currentDate, state: st });
  const weeks = Math.max(0, daysBetween(currentDate, goal.date) / 7);

  const likely = forecast?.likely || null;

  if (!forecast?.available || !likely?.finishSec) {
    return {
      goal, race, weeks: +weeks.toFixed(1),
      verdict: FEASIBILITY.UNKNOWN.id, ...FEASIBILITY.UNKNOWN,
      forecast,
      reason: forecast?.reason ||
        'Nog geen voorspelling mogelijk — daarvoor zijn een paar goed verdragen runs met hartslag nodig.',
      basis: forecast?.basis || [], limits: forecast?.limits || [],
    };
  }

  // Dezelfde eenheid, dezelfde afstand: seconden op deze race.
  const currentSec = likely.finishSec;
  const targetSec = goal.targetTimeSec;
  const gapSec = currentSec - targetSec;
  const gapPct = targetSec ? gapSec / targetSec : null;

  // Wat het gat per week vraagt, uitgedrukt in seconden per kilometer —
  // want dát is de eenheid waarin loopeconomie vooruitgaat.
  const requiredGainSecPerKm = goal.distanceKm ? gapSec / goal.distanceKm : null;
  const requiredPerWeek = weeks > 0 && requiredGainSecPerKm != null
    ? requiredGainSecPerKm / weeks : null;

  // Wat je nu werkelijk laat zien.
  const observedPerWeek = st.economyGainSec != null && st.economyHonest
    ? st.economyGainSec / 8 : null;      // de trend loopt over ~8 weken

  const coverage = goal.distanceKm && st.longestTolerated
    ? st.longestTolerated / goal.distanceKm : 0;

  // ── Het oordeel ───────────────────────────────────────────────
  let verdict;
  if (gapSec <= 0) {
    verdict = FEASIBILITY.ON_TRACK.id;
  } else if (requiredPerWeek == null) {
    verdict = FEASIBILITY.UNKNOWN.id;
  } else if (requiredPerWeek <= REALISTIC_GAIN_SEC_PER_KM_PER_WEEK * 0.6) {
    verdict = FEASIBILITY.CLOSE.id;
  } else if (requiredPerWeek <= REALISTIC_GAIN_SEC_PER_KM_PER_WEEK) {
    verdict = FEASIBILITY.AMBITIOUS.id;
  } else {
    verdict = FEASIBILITY.OUT_OF_REACH.id;
  }

  // Herstel en dekking kunnen een gunstig oordeel altijd terugzetten,
  // nooit andersom. Tempo winnen op een lichaam dat niet herstelt is geen
  // vooruitgang maar uitstel van de rekening.
  const blockers = [];
  if (st.pemFreeWeeks < 4) {
    blockers.push(`nog ${4 - st.pemFreeWeeks} PEM-vrije week(en) nodig`);
  }
  if (coverage < 0.6) {
    blockers.push(`je verdraagt nu ${st.longestTolerated || 0} km van de ${goal.distanceKm}`);
  }
  if (st.warnings?.signals?.length >= 2) {
    blockers.push('twee of meer waarschuwingssignalen tegelijk');
  }
  if (blockers.length && verdict === FEASIBILITY.ON_TRACK.id) verdict = FEASIBILITY.CLOSE.id;
  if (blockers.length >= 2 && verdict === FEASIBILITY.CLOSE.id) verdict = FEASIBILITY.AMBITIOUS.id;

  // Wanneer zou het wél kunnen, bij realistische winst?
  const weeksNeeded = requiredGainSecPerKm > 0
    ? Math.ceil(requiredGainSecPerKm / REALISTIC_GAIN_SEC_PER_KM_PER_WEEK) : 0;

  const info = FEASIBILITY[verdict];
  return {
    goal, race, forecast,
    basis: forecast.basis, limits: forecast.limits,
    forecastSource: forecast.source, forecastConfidence: forecast.confidence,
    weeks: +weeks.toFixed(1),
    verdict, label: info.label, meaning: info.meaning,

    currentSec, currentLabel: fmtSec(currentSec),
    targetSec, targetLabel: fmtSec(targetSec),
    gapSec, gapLabel: gapSec > 0 ? fmtSec(gapSec) : null,
    gapPct: gapPct != null ? +(gapPct * 100).toFixed(1) : null,

    currentPaceSecPerKm: goal.distanceKm ? Math.round(currentSec / goal.distanceKm) : null,
    targetPaceSecPerKm: goal.targetPaceSecPerKm,

    requiredGainSecPerKm: requiredGainSecPerKm != null
      ? Math.round(requiredGainSecPerKm) : null,
    requiredPerWeek: requiredPerWeek != null ? +requiredPerWeek.toFixed(1) : null,
    observedPerWeek: observedPerWeek != null ? +observedPerWeek.toFixed(1) : null,
    weeksNeeded,
    coverage: Math.round(coverage * 100),
    blockers,

    // De zin die op het scherm hoort, in de eenheid die klopt.
    summary: gapSec <= 0
      ? `Voorspelling ${fmtSec(currentSec)} tegen een doel van ${fmtSec(targetSec)} — je zit er al onder.`
      : `Voorspelling ${fmtSec(currentSec)} · doel ${fmtSec(targetSec)} · verschil ${fmtSec(gapSec)} (${(gapPct * 100).toFixed(1)}%).`,

    detail: gapSec <= 0
      ? 'Het gat zit niet in je tempo maar in je herstel en je verdragen afstand.'
      : `Dat is ${Math.round(requiredGainSecPerKm)} sec/km over ${goal.distanceKm} km. ` +
        (weeks > 0
          ? `In ${Math.round(weeks)} weken vraagt dat ${requiredPerWeek.toFixed(1)} sec/km per week; ` +
            `realistisch is ongeveer ${REALISTIC_GAIN_SEC_PER_KM_PER_WEEK}. ` +
            (weeksNeeded > weeks
              ? `Op dit tempo heb je er ~${weeksNeeded} weken voor nodig.`
              : 'Dat past binnen de tijd die er nog is.')
          : 'De datum is er al.'),

    advice: verdict === FEASIBILITY.OUT_OF_REACH.id
      ? 'De datum blijft staan; wat die dag haalbaar is past zich aan. Er komt geen inhaaltraining.'
      : blockers.length
        ? `Eerst dit: ${blockers.join(', ')}.`
        : 'Blijf bij één progressievariabele per week.',
  };
}

export function allFeasibility(goals, opts = {}) {
  const state = opts.state || runningState({ logs: opts.logs || {},
    currentDate: opts.currentDate || todayLocal() });
  return goals.map(g => raceFeasibility(g, { ...opts, state }));
}

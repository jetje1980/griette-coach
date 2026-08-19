// Mag er vandaag kracht, en zo ja welke les?
//
// Het gevaarlijkste denkfoutje in een coach met twee pijlers is dit:
// hardlopen staat op slot, dus "dan maar kracht". Bij long COVID is dat
// precies verkeerd. Als de rustdagpoort volledige rust voorschrijft, dan
// is dat een uitspraak over je systeem — niet over hardlopen.
//
// Volledige rust blijft hier dus volledige rust. Kracht komt alleen in
// beeld als lopen om een *belastingsreden* niet doorgaat (te kort geleden
// gelopen, weekplafond bereikt), niet om een herstelreden.
//
// Vijf besluiten:
//   STRENGTH_TODAY  volledige krachtles
//   LIGHT_STRENGTH  korte les, lagere band
//   RECOVERY_FLOW   mobiliteit, geen trainingsprikkel
//   WAIT            eerst de 24-48u-respons van de vorige sessie
//   FULL_REST       niets

import { COACH_CLASSES, findClass, classesWithin, bandIndex, nextBand, prevBand,
  BAND_LEVELS, BENCHMARK_CLASS, resolveClass } from './data/strengthClasses';
import { trainingSessions, loadSessions, sessionScore, strengthStats,
  patternCoverage, bandProgression, capacityChange } from './strength';
import { todayLocal, addDays, daysBetween } from './datetime';
import { loadWorkouts, workoutWasHeavy, toleranceFor } from './workouts';

// Minimaal één dag tussen twee volledige krachtsessies: spierherstel duurt
// bij long COVID langer dan de vermoeidheid doet vermoeden.
export const MIN_DAYS_BETWEEN_STRENGTH = 2;
export const MAX_STRENGTH_PER_WEEK = 3;

const ACTIONS = {
  STRENGTH_TODAY: { emoji: '🏋️', label: 'Kracht vandaag', color: '#7A5AA8',
    headline: 'Een volledige krachtles is vrijgegeven.' },
  LIGHT_STRENGTH: { emoji: '🪶', label: 'Lichte kracht', color: '#8C7BB0',
    headline: 'Kracht mag, maar korter en lichter dan normaal.' },
  RECOVERY_FLOW: { emoji: '🧘', label: 'Recovery flow', color: '#4A6FA5',
    headline: 'Mobiliteit en doorbloeding — geen trainingsprikkel.' },
  WAIT: { emoji: '⏳', label: 'Wachten op je respons', color: '#C9963E',
    headline: 'Eerst weten hoe je vorige sessie is geland.' },
  FULL_REST: { emoji: '🛌', label: 'Volledige rust', color: '#B85B3E',
    headline: 'Vandaag is rust de training — ook geen kracht.' },
};

// Is de 24-48u-respons op deze sessie bekend?
function responseKnown(session, logs) {
  if (!session?.date) return true;
  for (let i = 1; i <= 2; i++) {
    const l = logs?.[addDays(session.date, i)];
    if (l && (l.recovery_check === 'good' || l.recovery_check === 'bad' ||
      l.training_recovery != null || l.energy != null)) return true;
  }
  return false;
}

function responseWasBad(session, logs) {
  if (!session?.date) return false;
  for (let i = 1; i <= 2; i++) {
    const l = logs?.[addDays(session.date, i)];
    if (l && (l.recovery_check === 'bad' || l.training_recovery === 2 ||
      l.symptom_pem || l.delayed_fatigue)) return true;
  }
  return false;
}

/**
 * @param {object} opts
 *   log, logs, currentDate
 *   runGate     resultaat van restDayDecision (de hardlooppoort)
 *   coach       resultaat van computeHeadCoach (decision GREEN/AMBER/BLUE/RED)
 *   minutes     beschikbare tijd, optioneel
 */
export function strengthDecision({
  log = {}, logs = {}, currentDate = todayLocal(),
  runGate = null, coach = null, minutes = null,
} = {}) {
  const stats = strengthStats(currentDate, 28);
  const sessions = trainingSessions();
  const last = sessions.find(s => s.date <= currentDate) || null;
  const daysSince = last ? daysBetween(last.date, currentDate) : null;
  const week = sessions.filter(s => s.date >= addDays(currentDate, -6) && s.date <= currentDate);

  const decision = coach?.decision || null;
  const blockers = [];
  const released = [];
  let action = 'STRENGTH_TODAY';

  const symptomCount = [log.symptom_pem, log.symptom_exhaustion, log.symptom_breathless,
    log.symptom_brainfog, log.symptom_pain].filter(Boolean).length;

  // ── 1. Volledige rust blijft volledige rust ──────────────────
  // Deze tak is het hele bestaansrecht van dit bestand: kracht wordt hier
  // nooit als troostprijs aangeboden.
  if (log.symptom_pem || log.training_recovery === 2) {
    action = 'FULL_REST';
    blockers.push('PEM-signaal vandaag — dit gaat over je systeem, niet over hardlopen');
  } else if (decision === 'RED') {
    action = 'FULL_REST';
    blockers.push('Coachbesluit staat op rood — geen enkele trainingsvorm vandaag');
  } else if (symptomCount >= 3) {
    action = 'FULL_REST';
    blockers.push(`${symptomCount} actieve symptomen — eerst omlaag, dan pas belasting`);
  } else if (runGate?.action === 'FULL_REST') {
    action = 'FULL_REST';
    blockers.push('De hersteldagpoort schrijft volledige rust voor; dat geldt ook voor kracht');
  }

  // ── 2. Vertraagde respons van de vorige krachtsessie ─────────
  if (action === 'STRENGTH_TODAY' && last && daysSince != null) {
    if (responseWasBad(last, logs)) {
      action = 'RECOVERY_FLOW';
      blockers.push(`Je krachtsessie van ${last.date.slice(5)} werd niet goed verdragen`);
    } else if (daysSince === 0) {
      action = 'RECOVERY_FLOW';
      blockers.push('Vandaag al kracht gedaan');
    } else if (daysSince < MIN_DAYS_BETWEEN_STRENGTH && !responseKnown(last, logs)) {
      action = 'WAIT';
      blockers.push(`Nog geen herstelcheck na je sessie van ${last.date.slice(5)} — spierherstel duurt hier langer dan het voelt`);
    } else if (daysSince < MIN_DAYS_BETWEEN_STRENGTH) {
      action = 'LIGHT_STRENGTH';
      blockers.push(`Pas ${daysSince} dag sinds je vorige krachtsessie — vandaag lichter`);
    }
  }

  // ── 3. Weekbelasting ─────────────────────────────────────────
  if (action === 'STRENGTH_TODAY' && week.length >= MAX_STRENGTH_PER_WEEK) {
    action = 'RECOVERY_FLOW';
    blockers.push(`Al ${week.length} krachtsessies in 7 dagen — dat is het plafond`);
  }

  // ── 4. Wat de benen van het hardlopen nog moeten verwerken ───
  const lastRun = loadWorkouts().find(w =>
    (w.activityType === 'run' || w.activityType == null) && w.date <= currentDate);
  const runDaysAgo = lastRun ? daysBetween(lastRun.date, currentDate) : null;
  if (action === 'STRENGTH_TODAY' && lastRun && runDaysAgo === 0) {
    action = 'LIGHT_STRENGTH';
    blockers.push('Vandaag al gelopen — kracht kan, maar niet bovenop een volledige les');
  } else if (action === 'STRENGTH_TODAY' && lastRun && runDaysAgo === 1 && workoutWasHeavy(lastRun)) {
    action = 'LIGHT_STRENGTH';
    blockers.push('Gisteren een zware run — benen krijgen vandaag geen tweede zware prikkel');
  } else if (action === 'STRENGTH_TODAY' && lastRun && toleranceFor(lastRun, logs) === 'poor') {
    action = 'RECOVERY_FLOW';
    blockers.push('Je laatste run werd niet goed verdragen — geen nieuwe belasting stapelen');
  }

  // ── 5. Ochtendsignalen ───────────────────────────────────────
  if (action === 'STRENGTH_TODAY' && decision === 'BLUE') {
    action = 'RECOVERY_FLOW';
    blockers.push('Herstelkleur blauw — bewegen mag, belasten niet');
  }
  if (action === 'STRENGTH_TODAY' && decision === 'AMBER') {
    action = 'LIGHT_STRENGTH';
    blockers.push('Gemengde ochtendsignalen — kortere les is de veiligste keuze');
  }
  if (action === 'STRENGTH_TODAY' && log.day_capacity === 'herstel') {
    action = 'RECOVERY_FLOW';
    blockers.push('Je hebt vandaag zelf als hersteldag gemarkeerd');
  }
  if (action === 'STRENGTH_TODAY' && log.day_capacity === 'minimum') {
    action = 'LIGHT_STRENGTH';
    blockers.push('Minimumdag — de korte les telt vandaag als volwaardig');
  }

  // ── Wat kracht vrijgeeft ─────────────────────────────────────
  if (action === 'STRENGTH_TODAY' || action === 'LIGHT_STRENGTH') {
    if (daysSince == null) released.push('Nog geen eerdere krachtsessie geregistreerd');
    else released.push(`${daysSince} dagen sinds je vorige krachtsessie`);
    released.push(`${week.length}/${MAX_STRENGTH_PER_WEEK} krachtsessies deze week`);
    if (decision === 'GREEN') released.push('Ochtendsignalen groen');
    if (runGate && runGate.action !== 'RUN_TODAY' && runGate.action !== 'FULL_REST') {
      released.push('Lopen staat op slot om een belastingsreden, niet om een herstelreden');
    }
  } else {
    released.push(`Minstens ${MIN_DAYS_BETWEEN_STRENGTH} dagen na een volledige krachtsessie`);
    released.push('Een ingevulde herstelcheck 24–48u na die sessie, zonder vertraagde klachten');
    released.push('Geen PEM-signaal, geen blauwe of rode ochtend');
    released.push(`Onder ${MAX_STRENGTH_PER_WEEK} krachtsessies in 7 dagen`);
  }

  // ── Welke les hoort bij dit besluit? ─────────────────────────
  const cls = pickClass({ action, minutes, stats, coverage: patternCoverage(currentDate) });

  return {
    action, ...ACTIONS[action],
    blockers, released,
    recommendedClass: cls.cls,
    classReason: cls.reason,
    targetBand: cls.band,
    lastSession: last,
    daysSince,
    weekCount: week.length,
    maxPerWeek: MAX_STRENGTH_PER_WEEK,
    stats,
    summary: blockers[0] || ACTIONS[action].headline,
    mayTrain: action === 'STRENGTH_TODAY' || action === 'LIGHT_STRENGTH',
  };
}

// De les kiezen: eerst wat het besluit toelaat, dan wat er aan tijd is, en
// binnen die ruimte de les die het gat in de patroondekking het beste dicht.
function pickClass({ action, minutes, stats, coverage }) {
  if (action === 'FULL_REST') return { cls: null, band: null, reason: null };
  if (action === 'WAIT') return { cls: null, band: null, reason: null };
  if (action === 'RECOVERY_FLOW') {
    return { cls: findClass('recovery15'), band: null,
      reason: 'Herstelvariant — telt niet mee als krachtsessie voor de opbouw.' };
  }

  const available = minutes ?? 30;
  const options = classesWithin(available, { includeRecovery: false });
  if (!options.length) {
    return { cls: findClass('strong15'), band: 'light',
      reason: `Met ${available} minuten past alleen de korte les.` };
  }

  if (action === 'LIGHT_STRENGTH') {
    const cls = options.find(c => c.id === 'strong15') || options[0];
    return { cls, band: prevBand(cls.defaultBand)?.id || cls.defaultBand,
      reason: 'Kortere les met een lichtere band — bewust onder je normale prikkel.' };
  }

  // Volledige kracht: de langste les die past, maar niet zwaarder dan wat
  // je frequentie draagt. STRONG 35 alleen bij een echt stabiele basis.
  let cls = options[options.length - 1];
  if (cls.id === 'strong35' && (stats.perWeek < 1.5 || (stats.avgRpe ?? 9) > 6.5)) {
    cls = options.find(c => c.id === 'strong30') || options[options.length - 2] || cls;
  }

  // Ontbreekt er een patroon, kies dan de les die het wél dekt.
  if (coverage?.missing?.length) {
    const missing = coverage.missing.map(m => m.id);
    const better = options.find(c => missing.every(m => (c.patterns || []).includes(m)));
    if (better && better.duration <= available) cls = better;
  }

  return {
    cls, band: cls.defaultBand,
    reason: coverage?.missing?.length
      ? `Deze les dekt ${coverage.missing.map(m => m.label.toLowerCase()).join(' en ')}, wat de afgelopen ${coverage.days} dagen ontbrak.`
      : 'Volledige dekking van alle bewegingspatronen.',
  };
}

// ── Forecast voor de eerstvolgende krachtsessie ─────────────────
// Zelfde principe als bij hardlopen: wat er waarschijnlijk gebeurt, apart
// van wat verstandig is.
export function nextStrengthForecast({
  logs = {}, currentDate = todayLocal(), gate = null, minutes = null,
} = {}) {
  const g = gate || strengthDecision({ logs, currentDate, minutes });
  const cls = g.recommendedClass;
  if (!cls) {
    return { available: false, reason: g.summary, gate: g };
  }

  const sessions = trainingSessions();
  // Dezelfde les weegt het zwaarst, maar één sessie is te weinig bewijs om
  // een band op te baseren. Onder de drie vullen we aan met lessen van
  // vergelijkbare duur — dat is nog steeds appels met appels.
  const sameClass = sessions.filter(s => s.classId === cls.id);
  const nearby = sessions.filter(s => s.classId !== cls.id &&
    Math.abs((Number(s.duration) || 0) - cls.duration) <= 8);
  const comps = [...sameClass, ...nearby].slice(0, 6);
  // De vorige keer is de meest recente vergelijkbare sessie, ongeacht of
  // dat exact dezelfde les was.
  const previous = comps.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null;

  const median = (arr) => {
    const v = arr.filter(x => x != null && !isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };

  const rpes = comps.map(s => Number(s.rpe)).filter(x => !isNaN(x));
  const medRpe = median(rpes);
  const scores = comps.map(sessionScore).filter(x => x > 0);
  const medScore = median(scores);

  // Bandvoorstel: omhoog alleen als de vorige keer de les werd afgemaakt
  // met een RPE onder het doel én reserve over.
  const prevBandId = previous?.bandResistance || g.targetBand || cls.defaultBand;
  const target = cls.expectedRpe?.[1] ?? 6;
  const readyForMore = previous
    && previous.completed === 'full'
    && previous.rpe != null && Number(previous.rpe) <= target - 1
    && (previous.couldDoMore === 'ja' || (previous.rir != null && Number(previous.rir) >= 3));
  const tooHard = previous
    && (previous.completed !== 'full'
      || (previous.rpe != null && Number(previous.rpe) >= target + 2)
      || previous.couldDoMore === 'nee');

  const suggestedBand = g.action === 'LIGHT_STRENGTH'
    ? (prevBand(prevBandId)?.id || prevBandId)
    : readyForMore ? (nextBand(prevBandId)?.id || prevBandId)
    : tooHard ? (prevBand(prevBandId)?.id || prevBandId)
    : prevBandId;

  // Verwachte RPE: bij dezelfde les en dezelfde band mag hij zakken;
  // met een zwaardere band gaat hij juist even omhoog.
  const bandStep = bandIndex(suggestedBand) - bandIndex(prevBandId);
  const rpeShift = bandStep > 0 ? +1 : bandStep < 0 ? -1 : (comps.length >= 3 ? -0.5 : 0);
  const baseRpe = medRpe ?? (cls.expectedRpe?.[0] ?? 5);
  const expectedRpe = {
    low: Math.max(1, Math.round((baseRpe + rpeShift - 0.5) * 2) / 2),
    high: Math.min(10, Math.round((baseRpe + rpeShift + 0.5) * 2) / 2),
  };

  const expectedScore = medScore
    ? { low: Math.round(medScore * 0.9), high: Math.round(medScore * 1.15), mid: Math.round(medScore) }
    : null;

  const confidence = comps.length >= 4 && sameClass.length >= 2 ? 'HIGH'
    : comps.length >= 2 ? 'MEDIUM' : 'LOW';

  const CONF_TEXT = {
    HIGH: 'Genoeg vergelijkbare lessen om dit met vertrouwen te zeggen.',
    MEDIUM: 'Een paar vergelijkbare lessen — de bandbreedte is nog ruim.',
    LOW: 'Nog te weinig vergelijkbare lessen; dit is wat de les voorschrijft, geen voorspelling uit je eigen data.',
  };

  // De verwachting in gewone taal, alleen als er iets te zeggen valt.
  let expectation = null;
  if (previous) {
    // Alleen naar een vorige RPE verwijzen als die er ook is; "RPE ?" is
    // geen vergelijking maar een gat in de data.
    const prevRpe = previous.rpe != null ? `RPE ${previous.rpe}` : null;
    if (bandStep > 0) {
      expectation = prevRpe
        ? `Met een zwaardere band voelt dezelfde les waarschijnlijk één punt zwaarder dan ${previous.date.slice(5)} (${prevRpe}). Dat is de bedoeling — het is de stap omhoog.`
        : 'Met een zwaardere band voelt de les waarschijnlijk zwaarder dan de vorige keer. Dat is de bedoeling — het is de stap omhoog.';
    } else if (bandStep < 0) {
      expectation = 'Bewust een stap terug in bandweerstand; deze les hoort duidelijk lichter te voelen dan de vorige keer.';
    } else if (comps.length >= 3 && prevRpe) {
      expectation = `Zelfde les, zelfde band als ${previous.date.slice(5)} (${prevRpe}). Bij normaal herstel zou hij nu lichter moeten voelen.`;
    } else if (!prevRpe) {
      expectation = `Bij je vorige vergelijkbare sessie (${previous.date.slice(5)}) is geen RPE ingevuld. Doe je dat deze keer wel, dan kan ik vanaf de volgende les zeggen of het lichter gaat voelen.`;
    } else {
      expectation = `Zelfde les en band als ${previous.date.slice(5)} (${prevRpe}). Nog te vroeg om te zeggen of hij lichter gaat voelen.`;
    }
  }

  return {
    available: true,
    gate: g,
    cls,
    duration: cls.duration,
    band: suggestedBand,
    previousBand: prevBandId,
    bandChanged: bandStep !== 0,
    patterns: cls.patterns || cls.focus || [],
    targetRir: g.action === 'LIGHT_STRENGTH' ? '3–4' : '2–3',
    expectedRpe,
    expectedScore,
    confidence,
    confidenceText: CONF_TEXT[confidence],
    observations: comps.length,
    previous: previous ? {
      date: previous.date,
      band: previous.bandResistance || null,
      rpe: previous.rpe ?? null,
      completed: previous.completed,
      score: sessionScore(previous),
      duration: previous.duration ?? null,
    } : null,
    expectation,
    // Het veilige advies staat los van de verwachting hierboven.
    safe: {
      headline: g.mayTrain
        ? 'Stop bij vormverlies, niet bij spierfalen.'
        : g.headline,
      lines: g.mayTrain ? [
        `Houd ${g.action === 'LIGHT_STRENGTH' ? '3–4' : '2–3'} herhalingen in reserve — de laatste rep hoort er nog in te zitten.`,
        `Doel-RPE voor deze les is ${cls.expectedRpe?.[0]}–${cls.expectedRpe?.[1]}. Zit je daar duidelijk boven, dan is de band te zwaar.`,
        'Bij een les die je niet afmaakt telt wat je wél deed; afbreken is data, geen falen.',
        'De vertraagde respons van morgen bepaalt of de volgende stap omhoog mag.',
      ] : [g.summary],
    },
  };
}

// ── 4 / 8 / 12 weken vooruit ────────────────────────────────────
// Alleen ranges en voorwaarden, nooit een exact getal — en nooit een
// belofte over kilo's of centimeters.
export const HORIZONS = [4, 8, 12];

// Wekelijkse capaciteitsgroei naar consistentie en herstel. De banden zijn
// bewust breed: dit is een verwachting, geen berekening.
function weeklyGrowthRange({ perWeek, completionPct, pemCount, rpeTrend }) {
  let low, high;
  if (perWeek >= 2 && pemCount === 0) { low = 0.025; high = 0.04; }
  else if (perWeek >= 1.5) { low = 0.018; high = 0.03; }
  else if (perWeek >= 1) { low = 0.01; high = 0.02; }
  else { low = 0.003; high = 0.012; }

  if (pemCount >= 2) { low *= 0.4; high *= 0.5; }
  else if (pemCount === 1) { low *= 0.7; high *= 0.8; }

  if (completionPct != null && completionPct < 70) { low *= 0.8; high *= 0.85; }
  if (rpeTrend === 'down') { high *= 1.1; }        // zelfde werk voelt lichter
  if (rpeTrend === 'up') { low *= 0.8; high *= 0.85; }

  return { low, high };
}

export function strengthOutlook({ logs = {}, currentDate = todayLocal() } = {}) {
  const stats = strengthStats(currentDate, 28);
  const cap = capacityChange(currentDate, 28);
  const band = bandProgression();

  const pemCount = Object.values(logs)
    .filter(l => l.date >= addDays(currentDate, -27) && l.date <= currentDate &&
      (l.symptom_pem || l.recovery_check === 'bad' || l.training_recovery === 2)).length;

  // Verandert de ervaren zwaarte bij vergelijkbaar werk?
  const rpeTrend = (() => {
    const s = trainingSessions().filter(x => x.rpe != null).slice(0, 8);
    if (s.length < 4) return null;
    const half = Math.floor(s.length / 2);
    const recent = s.slice(0, half).map(x => Number(x.rpe));
    const older = s.slice(half).map(x => Number(x.rpe));
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const d = avg(recent) - avg(older);
    return d <= -0.5 ? 'down' : d >= 0.5 ? 'up' : 'flat';
  })();

  const growth = weeklyGrowthRange({
    perWeek: stats.perWeek, completionPct: stats.completionPct, pemCount, rpeTrend,
  });

  const dataPoints = stats.training;
  const confidence = dataPoints >= 8 && cap.enough ? 'HIGH'
    : dataPoints >= 4 ? 'MEDIUM' : 'LOW';

  const NARRATIVE = {
    4: {
      title: 'Routine wordt stabiel',
      expect: [
        'De les gaat vertrouwd voelen; minder nadenken, minder startdrempel.',
        'Dezelfde les zou bij gelijke band iets lichter moeten voelen.',
        'Eerste fotovergelijking is mogelijk — verwacht subtiel verschil, geen transformatie.',
      ],
      body: 'Op vier weken zie je op foto meestal houding en spanning veranderen, nog niet de omtrek.',
    },
    8: {
      title: 'Duidelijke krachtprogressie waarschijnlijk',
      expect: [
        'Een stap in bandweerstand of duidelijk meer herhalingen bij dezelfde RPE.',
        'Taille kan een meetbare trend gaan tonen als het gewicht stabiel blijft.',
        'Visueel verschil wordt beter te beoordelen dan op vier weken.',
      ],
      body: 'Acht weken is het eerste punt waarop kracht- en lichaamsverandering elkaar zichtbaar beginnen te bevestigen.',
    },
    12: {
      title: 'Betrouwbare evaluatie van lijf én kracht',
      expect: [
        'Start versus nu wordt een eerlijke vergelijking, op foto en in maten.',
        'Taille- en heuptrend zijn bruikbaar geworden in plaats van ruis.',
        'De wisselwerking met hardlopen wordt zichtbaar: sterker been, stabielere pas.',
      ],
      body: 'Twaalf weken is de eerste horizon waarop een oordeel over lichaamssamenstelling verdedigbaar is.',
    },
  };

  const horizons = HORIZONS.map(w => {
    const lo = Math.round((Math.pow(1 + growth.low, w) - 1) * 100);
    const hi = Math.round((Math.pow(1 + growth.high, w) - 1) * 100);
    const expectedSessions = {
      low: Math.round(stats.perWeek * w * 0.8),
      high: Math.round(stats.perWeek * w * 1.1),
    };
    return {
      weeks: w,
      date: addDays(currentDate, w * 7),
      capacityLow: lo, capacityHigh: hi,
      expectedSessions,
      ...NARRATIVE[w],
      conditions: [
        `Gemiddeld ${Math.max(1, Math.round(stats.perWeek * 10) / 10)} krachtsessies per week volhouden.`,
        'Geen PEM-terugval; één terugval schuift deze verwachting weken op.',
        'De 24–48u-respons blijven invullen — zonder die data stopt de opbouw.',
      ],
      confidence,
    };
  });

  return {
    stats, capacity: cap, band, pemCount, rpeTrend,
    growthPerWeek: { low: +(growth.low * 100).toFixed(1), high: +(growth.high * 100).toFixed(1) },
    horizons, confidence,
    dataNote: dataPoints < 4
      ? `Nog maar ${dataPoints} krachtsessies in 28 dagen — deze vooruitblik leunt vooral op algemene opbouwprincipes, nog niet op jouw data.`
      : `Gebaseerd op ${dataPoints} sessies in 28 dagen${cap.enough ? `, met een gemeten capaciteitsverandering van ${cap.changePct > 0 ? '+' : ''}${cap.changePct}%` : ''}.`,
    caution: 'Dit gaat over trainingscapaciteit, niet over kilo\'s of centimeters. Lichaamsverandering hangt ook af van slaap, voeding, herstel en hormonale fase.',
  };
}

// ── Verwacht versus werkelijk ───────────────────────────────────
// Terugkijken op een verstreken horizon: wat verwachtten we toen, en wat
// is het geworden? De verwachting wordt opnieuw berekend uit de stand van
// zaken aan het begin van die periode, zodat er niets bewaard hoeft te
// worden en er ook niets achteraf gladgestreken kan worden.
export function expectedVsActual({ logs = {}, currentDate = todayLocal(), weeks = 8 } = {}) {
  const from = addDays(currentDate, -weeks * 7);
  const sessionsBefore = trainingSessions().filter(s => s.date < from);
  if (sessionsBefore.length < 2) {
    return { available: false,
      reason: `Er zijn nog geen ${weeks} weken aan geschiedenis vóór vandaag om op terug te kijken.` };
  }

  // Frequentie zoals die er aan het begin van de periode uitzag
  const priorWindow = trainingSessions()
    .filter(s => s.date >= addDays(from, -27) && s.date < from);
  const priorPerWeek = priorWindow.length / 4;
  const pemBefore = Object.values(logs)
    .filter(l => l.date >= addDays(from, -27) && l.date < from &&
      (l.symptom_pem || l.recovery_check === 'bad')).length;

  const growth = weeklyGrowthRange({
    perWeek: priorPerWeek, completionPct: null, pemCount: pemBefore, rpeTrend: null,
  });
  const expectedLow = Math.round((Math.pow(1 + growth.low, weeks) - 1) * 100);
  const expectedHigh = Math.round((Math.pow(1 + growth.high, weeks) - 1) * 100);
  const expectedSessions = {
    low: Math.round(priorPerWeek * weeks * 0.8),
    high: Math.round(priorPerWeek * weeks * 1.1),
  };

  const actualSessions = trainingSessions()
    .filter(s => s.date >= from && s.date <= currentDate).length;

  const avgScore = (list) => {
    const v = list.map(sessionScore).filter(x => x > 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const before = avgScore(trainingSessions().filter(s => s.date >= addDays(from, -27) && s.date < from));
  const after = avgScore(trainingSessions().filter(s => s.date >= addDays(currentDate, -27) && s.date <= currentDate));
  const actualPct = before && after ? Math.round(((after - before) / before) * 100) : null;

  return {
    available: true, weeks, from,
    expected: { sessionsLow: expectedSessions.low, sessionsHigh: expectedSessions.high,
      capacityLow: expectedLow, capacityHigh: expectedHigh },
    actual: { sessions: actualSessions, capacityPct: actualPct,
      scoreBefore: before ? Math.round(before) : null, scoreNow: after ? Math.round(after) : null },
    verdict: actualPct == null
      ? 'Nog te weinig scores om de werkelijke verandering te berekenen.'
      : actualPct >= expectedLow && actualSessions >= expectedSessions.low
        ? 'Binnen of boven de verwachting — de opbouw doet wat hij hoort te doen.'
        : actualSessions < expectedSessions.low
          ? 'Minder sessies gedaan dan verwacht; dat verklaart het grootste deel van het verschil.'
          : 'Wel de sessies gedaan, minder capaciteitswinst dan verwacht. Kijk naar herstel, slaap en of de band wel meebewoog.',
  };
}

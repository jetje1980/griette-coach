// Trainingsfrequentie en rustdagen — de poort vóór elk hardloopadvies.
//
// Uitgangspunt: een goede hersteldag is niet automatisch een hardloopdag.
// Deze module beantwoordt eerst de vraag "mag er vandaag überhaupt
// gelopen worden?" en pas daarna kijkt de rest van de coach naar wélke
// sessie dat zou zijn. Zonder deze poort adviseerde de coach elke groene
// ochtend opnieuw een run, ongeacht hoeveel er die week al gelopen was.
//
// Vijf mogelijke besluiten:
//   RUN_TODAY          hardlopen is vrijgegeven
//   STRENGTH_TODAY     lopen zit op slot, kracht kan wel
//   ACTIVE_RECOVERY    wandelen/mobiliteit — geen trainingsprikkel
//   FULL_REST          niets vandaag
//   WAIT_FOR_RESPONSE  de vertraagde respons van de vorige sessie is nog
//                      niet bekend; wachten is hier de beslissing

import { RUNS } from './data/runningSchema';
import { loadWorkouts, toleranceFor, workoutWasHeavy } from './workouts';
import { exertionalResponse, readSymptoms, RED_FLAG_IDS } from './symptoms';
import { loadStrengthSessions } from './data/strengthSchema';
import { goalTarget } from './goals';

// ── Kaders ──────────────────────────────────────────────────────
// Minimaal één volledige niet-loopdag tussen twee runs. Bij long COVID
// verschijnt de rekening pas 24–48u later; twee opeenvolgende loopdagen
// betekent dat de tweede sessie plaatsvindt vóór het oordeel over de
// eerste binnen is.
export const MIN_REST_DAYS_BETWEEN_RUNS = 1;

// Zonder eigen doel: 3 loopdagen per week — het kader van het T1–T35-schema.
export const DEFAULT_RUN_DAYS_PER_WEEK = 3;

// Volume mag met hooguit een tiende per week groeien, en alleen als er
// niets anders tegelijk omhoog gaat.
export const MAX_WEEKLY_VOLUME_GROWTH = 0.10;

// ...maar alleen als de sprong ook in absolute zin iets voorstelt. Onder
// deze grens is het verschil kleiner dan de variatie tussen twee sessies.
export const MIN_MEANINGFUL_GROWTH_MIN = 10;

// ── Datumhulp ───────────────────────────────────────────────────
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T12:00:00');
  const b = new Date(toStr + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

function isRun(w) {
  return w.activityType === 'run' || w.activityType == null;
}

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ── Belastingsbeeld ─────────────────────────────────────────────
// Alles wat de poort nodig heeft, in één opzoekslag. Dagen zonder
// registratie tellen als rustdagen — dat is de veilige aanname niet, maar
// wel de eerlijke: er is geen bewijs van belasting.
export function trainingLoad(logs, currentDate) {
  const workouts = loadWorkouts().filter(w => w.date && w.date <= currentDate);
  const runs = workouts.filter(isRun);

  const win = (n) => {
    const from = addDays(currentDate, -(n - 1));
    return (arr) => arr.filter(w => w.date >= from && w.date <= currentDate);
  };
  const in7 = win(7), in28 = win(28), in14 = win(14);

  const runs7 = in7(runs);
  const runs28 = in28(runs);
  const runs14 = in14(runs);

  // Belasting van vóór deze week, als vergelijkingsbasis voor groei.
  const prior4wFrom = addDays(currentDate, -34);
  const prior4wTo = addDays(currentDate, -7);
  const priorRuns = runs.filter(w => w.date >= prior4wFrom && w.date <= prior4wTo);
  const priorWeeks = 4;

  const last = runs[0] || null;   // loadWorkouts sorteert nieuw → oud
  const daysSinceLastRun = last ? daysBetween(last.date, currentDate) : null;

  // Uren sinds de laatste run: alleen echt bekend als er een tijdstip is.
  // Anders rekenen we met het middaguur, en zeggen we dat er geschat is.
  const hoursSinceLastRun = (() => {
    if (!last) return null;
    const stamp = last.startedAt || last.startTime || null;
    if (stamp) {
      const h = (new Date(currentDate + 'T12:00:00') - new Date(stamp)) / 3600000;
      return h >= 0 ? Math.round(h) : null;
    }
    return daysSinceLastRun != null ? daysSinceLastRun * 24 : null;
  })();
  const hoursAreEstimated = !(last?.startedAt || last?.startTime);

  const strength = loadStrengthSessions()
    .filter(s => s.date && s.date <= currentDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  const strength7 = strength.filter(s => s.date >= addDays(currentDate, -6));
  const lastStrength = strength[0] || null;
  const daysSinceStrength = lastStrength ? daysBetween(lastStrength.date, currentDate) : null;

  // Loopdagen, niet loopsessies: twee runs op één dag is één belaste dag.
  const runDays = (arr) => new Set(arr.map(w => w.date)).size;

  const sum = (arr, f) => arr.reduce((s, w) => s + f(w), 0);

  // Aantal dagen in de afgelopen 7 waarop níets is geregistreerd
  const loadedDays = new Set([
    ...runs7.map(w => w.date),
    ...strength7.map(s => s.date),
    ...Object.values(logs || {})
      .filter(l => l.date >= addDays(currentDate, -6) && l.date <= currentDate &&
        (l.run_done || l.strength_done || l.core_done))
      .map(l => l.date),
  ]);

  return {
    lastRun: last,
    lastRunDate: last?.date || null,
    daysSinceLastRun,
    hoursSinceLastRun,
    hoursAreEstimated,

    runDays7: runDays(runs7),
    runDays14: runDays(runs14),
    runSessions7: runs7.length,
    runKm7: +sum(runs7, w => num(w.distance)).toFixed(1),
    runMin7: Math.round(sum(runs7, w => num(w.duration))),
    runKm28: +sum(runs28, w => num(w.distance)).toFixed(1),
    runMin28: Math.round(sum(runs28, w => num(w.duration))),

    // Gemiddelde week uit de vier weken vóór deze — de vergelijkingsbasis
    baselineRunMinPerWeek: priorRuns.length
      ? Math.round(sum(priorRuns, w => num(w.duration)) / priorWeeks) : null,
    baselineRunKmPerWeek: priorRuns.length
      ? +(sum(priorRuns, w => num(w.distance)) / priorWeeks).toFixed(1) : null,
    baselineRunDaysPerWeek: priorRuns.length
      ? +(runDays(priorRuns) / priorWeeks).toFixed(1) : null,

    strengthDays7: new Set(strength7.map(s => s.date)).size,
    daysSinceStrength,
    lastStrength,

    restDays7: Math.max(0, 7 - loadedDays.size),
    loadedDays7: loadedDays.size,

    // Zware sessies in de afgelopen week
    heavySessions7: runs7.filter(workoutWasHeavy).length,

    // Hoe zijn de laatste runs verdragen?
    tolerance14: runs14.map(w => ({ date: w.date, verdict: toleranceFor(w, logs) })),
  };
}

// ── Weekplafond ─────────────────────────────────────────────────
export function runDayCeiling() {
  const g = parseFloat(goalTarget('RUN', 'run_days_week', DEFAULT_RUN_DAYS_PER_WEEK));
  return !g || isNaN(g) ? DEFAULT_RUN_DAYS_PER_WEEK : Math.max(1, Math.min(6, g));
}

// ── Mag de frequentie omhoog? ───────────────────────────────────
// Een groene ochtend is nadrukkelijk géén grond om vaker te gaan lopen.
// Verhogen mag alleen na twee volle weken waarin élke sessie goed werd
// verdragen en er geen PEM-signaal was.
export function frequencyVerdict(load, logs, currentDate) {
  const ceiling = runDayCeiling();
  const current = load.runDays7;
  const blockers = [];

  const poor14 = load.tolerance14.filter(t => t.verdict === 'poor').length;
  const pending14 = load.tolerance14.filter(t => t.verdict === 'pending').length;
  const good14 = load.tolerance14.filter(t => t.verdict === 'good').length;

  const pem14 = Object.values(logs || {}).filter(l =>
    l.date >= addDays(currentDate, -13) && l.date <= currentDate &&
    (l.symptom_pem || l.recovery_check === 'bad' || l.training_recovery === 2)).length;

  if (current >= ceiling) blockers.push(`weekplafond bereikt (${current}/${ceiling} loopdagen)`);
  if (poor14 > 0) blockers.push(`${poor14} sessie${poor14 > 1 ? 's' : ''} slecht verdragen in 14 dagen`);
  if (pem14 > 0) blockers.push(`${pem14} PEM-signaal${pem14 > 1 ? 'en' : ''} in 14 dagen`);
  if (good14 < 4) blockers.push(`nog te weinig goed verdragen sessies (${good14} in 14 dagen, 4 nodig)`);
  if (pending14 > 1) blockers.push(`${pending14} sessies wachten nog op een herstelcheck`);

  return {
    current, ceiling,
    canRaise: blockers.length === 0 && current < ceiling,
    blockers,
    why: blockers.length === 0
      ? 'Twee weken schone tolerantie zonder PEM — een extra loopdag is verdedigbaar.'
      : `Frequentie blijft op ${Math.min(current || ceiling, ceiling)} loopdagen: ${blockers[0]}.`,
  };
}

// ── Eén knop tegelijk ───────────────────────────────────────────
// Frequentie, volume en intensiteit mogen nooit in dezelfde week samen
// omhoog. Volume gaat voor — dat is wat het T-schema doet. Intensiteit
// pas als volume stabiel is, frequentie als laatste.
export function progressionLevers(load, logs, currentDate, freq) {
  const poor14 = load.tolerance14.filter(t => t.verdict === 'poor').length;
  const clean = poor14 === 0 && load.heavySessions7 === 0;

  const volumeHeadroom = load.baselineRunMinPerWeek
    ? load.runMin7 < load.baselineRunMinPerWeek * (1 + MAX_WEEKLY_VOLUME_GROWTH)
    : true;

  const levers = { volume: false, intensity: false, frequency: false };
  let chosen = null, reason;

  if (!clean) {
    reason = poor14 > 0
      ? 'Een slecht verdragen sessie in de afgelopen twee weken — deze week gaat niets omhoog.'
      : 'Een zware sessie deze week — eerst laten landen, niets verhogen.';
  } else if (volumeHeadroom) {
    levers.volume = true; chosen = 'volume';
    reason = load.baselineRunMinPerWeek
      ? `Volume mag deze week naar hooguit ${Math.round(load.baselineRunMinPerWeek * (1 + MAX_WEEKLY_VOLUME_GROWTH))} min (nu ${load.runMin7}).`
      : 'Volume is de knop waar we deze fase aan draaien.';
  } else if (freq.canRaise) {
    levers.frequency = true; chosen = 'frequency';
    reason = 'Volume zit op het weekplafond; een extra loopdag is de volgende stap.';
  } else {
    reason = `Volume zit al op het weekplafond (${load.runMin7} min deze week) en frequentie mag nog niet omhoog — deze week consolideren.`;
  }

  return { levers, chosen, reason, cleanRecord: clean };
}

// ── De poort ────────────────────────────────────────────────────
// coach = het resultaat van computeHeadCoach (decision + adaptiveState).
export function restDayDecision({ log = {}, logs = {}, currentDate, coach = {} }) {
  const load = trainingLoad(logs, currentDate);
  const freq = frequencyVerdict(load, logs, currentDate);
  const levers = progressionLevers(load, logs, currentDate, freq);

  const blockers = [];   // waarom vandaag geen run
  const released = [];   // wat een run juist vrijgeeft
  let action = 'RUN_TODAY';
  let earliestRunDate = currentDate;

  const decision = coach.decision;
  const lastRun = load.lastRun;
  // De exertionele respons is preciezer dan de oude tolerantie: hij
  // onderscheidt hoofdpijn, diffuse spierpijn en rode vlaggen van gewone
  // spierpijn, en weet dat migraine geen PEM is.
  const lastResponse = lastRun
    ? exertionalResponse({ workoutDate: lastRun.date, logs, currentDate }) : null;
  const lastTol = lastResponse
    ? (lastResponse.status === 'good' ? 'good'
      : ['poor', 'red'].includes(lastResponse.status) ? 'poor' : 'pending')
    : (lastRun ? toleranceFor(lastRun, logs) : null);
  const lastHeavy = lastRun ? workoutWasHeavy(lastRun) : false;

  const symptomCount = [log.symptom_pem, log.symptom_exhaustion, log.symptom_breathless,
    log.symptom_brainfog, log.symptom_pain].filter(Boolean).length;

  // ── 1. Systemische stops ──────────────────────────────────────
  // Alarmsymptomen van vandaag zelf.
  //
  // Deze velden werden alleen gelezen als reactie op een vorige sessie. Wie ze
  // op een dag zonder recente training aanvinkt — borstklachten, neurologische
  // alarmsymptomen, een instortgevoel, koorts, hartkloppingen, koud zweet —
  // kreeg gewoon een looptraining voorgeschreven. Dat is nooit de bedoeling
  // geweest; het viel op toen de override-knop een harde stop nodig had en
  // bleek dat de coach zelf die stop niet had.
  //
  // Ziek of grieperig staat er bewust bij: er is geen apart ziektevakje, en dit
  // is het veld waarin dat terechtkomt.
  const alarmVandaag = readSymptoms(log).signs
    .filter(s => RED_FLAG_IDS.includes(s.id) || s.id === 'malaise');

  if (alarmVandaag.length) {
    action = 'FULL_REST';
    blockers.push(`${alarmVandaag.map(s => s.label.toLowerCase()).join(', ')} vandaag — geen belasting tot dit weg is`);
    earliestRunDate = addDays(currentDate, 2);
  } else if (lastResponse?.status === 'red') {
    action = 'FULL_REST';
    blockers.push(`Abnormale respons na je sessie van ${lastRun.date.slice(5)}: ${lastResponse.reason.toLowerCase()}`);
    earliestRunDate = addDays(currentDate, 3);
  } else if (decision === 'RED' || log.symptom_pem || log.training_recovery === 2) {
    action = 'FULL_REST';
    blockers.push(log.symptom_pem || log.training_recovery === 2
      ? 'PEM-signaal vandaag — trainen verlengt de terugslag'
      : 'Coachbesluit staat op rood');
    earliestRunDate = addDays(currentDate, 2);
  } else if (symptomCount >= 3) {
    action = 'FULL_REST';
    blockers.push(`${symptomCount} actieve symptomen — eerst omlaag, dan pas belasting`);
    earliestRunDate = addDays(currentDate, 2);
  }

  // ── 2. Vertraagde respons nog onbekend ────────────────────────
  // Dit is de kern van de PEM-logica: de vorige sessie is pas beoordeeld
  // als het 24–48u-venster is gepasseerd én er iets is ingevuld.
  if (action === 'RUN_TODAY' && lastRun && load.daysSinceLastRun != null) {
    const answered = (() => {
      for (let i = 1; i <= 2; i++) {
        const l = logs?.[addDays(lastRun.date, i)];
        if (l && (l.recovery_check === 'good' || l.recovery_check === 'bad' ||
          l.training_recovery != null || l.energy != null)) return true;
      }
      return false;
    })();

    if (load.daysSinceLastRun === 0) {
      action = 'FULL_REST';
      blockers.push('Vandaag al gelopen — twee loopsessies op één dag doen we niet');
      earliestRunDate = addDays(currentDate, MIN_REST_DAYS_BETWEEN_RUNS + 1);
    } else if (lastTol === 'poor') {
      action = 'ACTIVE_RECOVERY';
      blockers.push(lastResponse?.reason
        ? `De run van ${lastRun.date.slice(5)} werd slecht verdragen. ${lastResponse.reason}`
        : `De run van ${lastRun.date.slice(5)} werd slecht verdragen — die telt als te zwaar`);
      earliestRunDate = addDays(currentDate, 2);
    } else if (load.daysSinceLastRun < 2 && !answered) {
      action = 'WAIT_FOR_RESPONSE';
      blockers.push(`Nog geen herstelcheck na de run van ${lastRun.date.slice(5)} — het 24–48u-venster is de meetlat, niet je ochtendgevoel`);
      earliestRunDate = addDays(lastRun.date, MIN_REST_DAYS_BETWEEN_RUNS + 1);
    } else if (load.daysSinceLastRun <= MIN_REST_DAYS_BETWEEN_RUNS) {
      action = lastHeavy ? 'ACTIVE_RECOVERY' : 'STRENGTH_TODAY';
      blockers.push(`Gisteren gelopen — minstens één volle rustdag tussen twee runs`);
      earliestRunDate = addDays(lastRun.date, MIN_REST_DAYS_BETWEEN_RUNS + 1);
    } else if (lastHeavy && load.daysSinceLastRun < 3 && !answered) {
      action = 'WAIT_FOR_RESPONSE';
      blockers.push('Vorige sessie was zwaar en de respons is nog niet ingevuld');
      earliestRunDate = addDays(lastRun.date, 3);
    }
  }

  // ── 3. Weekplafond ────────────────────────────────────────────
  if (action === 'RUN_TODAY' && load.runDays7 >= freq.ceiling) {
    action = load.daysSinceStrength == null || load.daysSinceStrength >= 2
      ? 'STRENGTH_TODAY' : 'ACTIVE_RECOVERY';
    blockers.push(`Al ${load.runDays7} loopdagen in 7 dagen — dat is het plafond`);
    // Vrij zodra de oudste loopdag uit het venster van 7 dagen valt
    const oldest = load.tolerance14
      .filter(t => t.date >= addDays(currentDate, -6))
      .map(t => t.date).sort()[0];
    earliestRunDate = oldest ? addDays(oldest, 7) : addDays(currentDate, 1);
  }

  // ── 4. Weekvolume ─────────────────────────────────────────────
  if (action === 'RUN_TODAY' && load.baselineRunMinPerWeek) {
    const cap = load.baselineRunMinPerWeek * (1 + MAX_WEEKLY_VOLUME_GROWTH);
    // Een tiende van een klein getal is geen prikkel maar ruis. Bij 21
    // minuten basis is 10% nog geen twee en een halve minuut; daarop de
    // week sluiten zou opbouw onmogelijk maken zonder ook maar iets over
    // belastbaarheid te zeggen. Boven de relatieve grens moet er dus ook
    // een absolute sprong zitten voordat dit een blokkade wordt.
    if (load.runMin7 >= cap && load.runMin7 - load.baselineRunMinPerWeek >= MIN_MEANINGFUL_GROWTH_MIN) {
      action = 'ACTIVE_RECOVERY';
      blockers.push(`${load.runMin7} min gelopen deze week tegen een basis van ${load.baselineRunMinPerWeek} min — meer dan 10% groei`);
      earliestRunDate = addDays(currentDate, 2);
    }
  }

  // ── 5. Stapeling zonder rustdag ───────────────────────────────
  if (action === 'RUN_TODAY' && load.restDays7 === 0) {
    action = 'FULL_REST';
    blockers.push('Zeven dagen achter elkaar belast — een echte rustdag is nu de training');
    earliestRunDate = addDays(currentDate, 1);
  }

  // ── 6. Coachkleur dempt af ────────────────────────────────────
  if (action === 'RUN_TODAY' && decision === 'BLUE') {
    action = 'ACTIVE_RECOVERY';
    blockers.push('Herstelkleur blauw — vandaag geen trainingsprikkel');
    earliestRunDate = addDays(currentDate, 1);
  }
  if (action === 'RUN_TODAY' && log.day_capacity === 'herstel') {
    action = 'ACTIVE_RECOVERY';
    blockers.push('Je hebt vandaag zelf als hersteldag gemarkeerd — dat weegt zwaarder dan het schema');
    earliestRunDate = addDays(currentDate, 1);
  }

  // Kracht alleen aanbieden als dat ook echt kan
  if (action === 'STRENGTH_TODAY') {
    if (load.daysSinceStrength != null && load.daysSinceStrength < 2) {
      action = 'ACTIVE_RECOVERY';
      blockers.push('Kracht was er ook al binnen twee dagen');
    } else if (decision === 'BLUE' || decision === 'RED') {
      action = 'ACTIVE_RECOVERY';
    }
  }

  // ── Wat een run vrijgeeft ─────────────────────────────────────
  if (action === 'RUN_TODAY') {
    if (load.daysSinceLastRun == null) released.push('Nog geen eerdere run geregistreerd');
    else released.push(`${load.daysSinceLastRun} dagen sinds je laatste run — genoeg tussenruimte`);
    if (lastTol === 'good') released.push('Vorige sessie goed verdragen in het 24–48u-venster');
    released.push(`${load.runDays7}/${freq.ceiling} loopdagen deze week — nog ruimte`);
    if (decision === 'GREEN') released.push('Ochtendsignalen groen');
    else if (decision === 'AMBER') released.push('Ochtendsignalen gemengd — lopen mag, maar korter');
  } else {
    released.push(`Minstens ${MIN_REST_DAYS_BETWEEN_RUNS} volle rustdag na een run`);
    released.push('Een ingevulde herstelcheck 24–48u na die run, zonder vertraagde klachten');
    released.push(`Onder ${freq.ceiling} loopdagen in de afgelopen 7 dagen`);
    released.push('Geen PEM-signaal en geen blauwe/rode ochtend');
  }

  const META = {
    RUN_TODAY: {
      emoji: '🏃', label: 'Hardlopen vandaag',
      headline: 'Lopen is vrijgegeven.',
      color: '#2A7A4F',
    },
    STRENGTH_TODAY: {
      emoji: '🏋️', label: 'Kracht vandaag',
      headline: 'Geen run, wel kracht — andere prikkel, andere hersteltijd.',
      color: '#7A5AA8',
    },
    ACTIVE_RECOVERY: {
      emoji: '🚶', label: 'Actief herstel',
      headline: 'Bewegen mag, belasten niet. Wandelen of mobiliteit.',
      color: '#2563AB',
    },
    FULL_REST: {
      emoji: '🛌', label: 'Volledige rust',
      headline: 'Vandaag is rust de training.',
      color: '#C4622D',
    },
    WAIT_FOR_RESPONSE: {
      emoji: '⏳', label: 'Wachten op je respons',
      headline: 'Ik wacht op je 24–48u-respons voordat ik de volgende sessie vrijgeef.',
      color: '#B5831A',
    },
  };

  const daysUntilRun = earliestRunDate > currentDate
    ? daysBetween(currentDate, earliestRunDate) : 0;

  return {
    action, ...META[action],
    blockers, released,
    earliestRunDate: action === 'RUN_TODAY' ? currentDate : earliestRunDate,
    daysUntilRun,
    load, frequency: freq, progression: levers,
    // Korte samenvatting voor de compacte kaart op Vandaag
    summary: action === 'RUN_TODAY'
      ? `${load.runDays7 + 1}e loopdag van maximaal ${freq.ceiling} deze week.`
      : blockers[0] || META[action].headline,
  };
}

// ── Weekkalender: runs én rustdagen naast elkaar ────────────────
// Toont wat er werkelijk gebeurd is, niet wat gepland stond.
export function weekCalendar(logs, currentDate, days = 14) {
  const workouts = loadWorkouts();
  const strength = loadStrengthSessions();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(currentDate, -i);
    const run = workouts.find(w => w.date === date && isRun(w));
    const str = strength.find(s => s.date === date);
    const l = logs?.[date];
    let type = 'rest';
    if (run) type = 'run';
    else if (str || l?.strength_done) type = 'strength';
    else if (l?.core_done || (l?.training_zone && l.training_zone !== 'rust')) type = 'other';
    out.push({
      date,
      dow: ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][new Date(date + 'T12:00:00').getDay()],
      type,
      minutes: run ? num(run.duration) : 0,
      km: run ? num(run.distance) : 0,
      tolerance: run ? toleranceFor(run, logs) : null,
      isToday: date === currentDate,
    });
  }
  return out;
}

// Langst verdragen run — de bovengrens die de racevoorspelling gebruikt.
export function longestToleratedRun(logs, currentDate = null) {
  const runs = loadWorkouts().filter(isRun);
  let best = null;
  for (const w of runs) {
    // De datum moet mee: een override telt pas als het 24–48u-venster voorbij
    // is, en zonder deze parameter zou hier de echte systeemdatum gelden.
    if (toleranceFor(w, logs, currentDate) !== 'good') continue;
    if (!best || num(w.distance) > num(best.distance)) best = w;
  }
  return best;
}

// Het aantal sessies waar de coach nog geen oordeel over heeft.
export function pendingResponses(logs, currentDate) {
  return loadWorkouts()
    .filter(w => isRun(w) && w.date <= currentDate && w.date >= addDays(currentDate, -6))
    .filter(w => toleranceFor(w, logs) === 'pending')
    .map(w => ({ date: w.date, sessionNr: w.plannedSessionId || null }));
}

export const PLANNED_RUN_SESSIONS = RUNS.length;

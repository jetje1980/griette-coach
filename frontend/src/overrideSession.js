// "Ik wil toch trainen" — de bewuste keuze van de gebruiker.
//
// De coach adviseert soms geen looptraining. Dat advies is goed onderbouwd,
// maar het is een advies en geen slot. Er zijn dagen waarop zij, met alles wat
// ze over haar eigen lichaam weet, tóch wil lopen. Zonder deze knop zijn er
// twee slechte uitkomsten: ze doet het niet en voelt zich betutteld, of ze
// doet het buiten de app om en dan weet de coach van niets — en dan mist het
// herstelmodel precies de sessie die het het hardst had moeten meewegen.
//
// ─────────────────────────────────────────────────────────────────
// DRIE REGELS DIE DIT BESTAND BIJ ELKAAR HOUDEN
//
// 1. Het coachadvies verandert niet. Een override is een tweede,
//    afzonderlijk gelabelde uitkomst ernaast. Nergens in de app mag het
//    override-alternatief eruitzien alsof de coach dit had geadviseerd.
//
// 2. Bij een rode vlag is er geen alternatief. Niet een kortere, niet een
//    rustigere — geen. Een instortgevoel, borstklachten, koorts of een
//    bevestigde abnormale respons na inspanning zijn geen kwestie van
//    doseren. Daar stopt de knop.
//
// 3. Een override levert geen bewijs op. De sessie mag de verdragen afstand
//    niet verhogen, geen opbouw vrijgeven en de racevoorspelling niet
//    optimistischer maken — totdat het 24–48u-venster schoon beoordeeld is.
//    Die rem zit in workouts.js, bij toleranceFor(), zodat hij geldt voor
//    élke lezer en niet alleen voor het scherm dat hem toevallig aanroept.
// ─────────────────────────────────────────────────────────────────
//
// Er wordt hier geen tweede schema gebouwd. De vorm komt uit provenStructure
// (haar eigen verdragen sessies), het tempo uit easyPace, de hartslag uit
// hrModel en de afstand uit sessionMath. Wat dit bestand toevoegt is één
// ding: hoevéél daarvan, gegeven waarom de poort dichtstond.

import { todayLocal, addDays } from './datetime';
import { provenStructure } from './raceplan';
import { easyRunPace } from './easyPace';
import { loadHrModel, hrPrescription, intensityRelease } from './hrModel';
import { sessionMath, fmtPaceSec, paceToSec, secToPace } from './sessionMath';
import { readSymptoms, exertionalResponse, RED_FLAG_IDS } from './symptoms';
import { lastRunWorkout, toleranceFor } from './workouts';

export const STORAGE_KEY = 'gc_overrides';

// ── Mag er vandaag überhaupt een alternatief bestaan? ───────────
export const GATE = {
  OPEN: 'OPEN',             // coach zegt nee, maar een laag-risico sessie mag
  HARD_STOP: 'HARD_STOP',   // rode vlag: geen enkel loopalternatief
  NOT_NEEDED: 'NOT_NEEDED', // de coach geeft vandaag gewoon een run vrij
};

// Waarom de poort dicht staat, en hoeveel volume daar bij past.
//
// Dit is het enige nieuwe oordeel in dit bestand. Niet elke gesloten poort is
// even zwaar: wachten op een respons is iets anders dan een slecht verdragen
// vorige sessie, en een weekplafond is weer iets anders dan allebei. De
// opdracht vraagt 50–80% van de laatste goed verdragen easy sessie, afhankelijk
// van de reden — dit is die tabel, met de reden erbij zodat hij te lezen is.
const VOLUME_FACTOR = {
  // De vorige sessie werd slecht verdragen. Als er dan toch gelopen wordt is
  // het de helft, en niet meer.
  ACTIVE_RECOVERY: { factor: 0.50, why: 'je vorige sessie werd niet goed verdragen' },
  // Het 24–48u-venster loopt nog. Onbekend is niet hetzelfde als slecht, maar
  // je bouwt niet door op iets wat je nog niet weet.
  WAIT_FOR_RESPONSE: { factor: 0.55, why: 'de respons op je vorige sessie is nog niet bekend' },
  // Al genoeg loopdagen deze week, of te kort na de vorige run. Het lichaam
  // heeft niets gemeld; het is een frequentiegrens, geen symptoomgrens.
  STRENGTH_TODAY: { factor: 0.80, why: 'het gaat om je loopfrequentie deze week, niet om een symptoom' },
  FULL_REST: { factor: 0.50, why: 'de coach adviseert vandaag volledige rust' },
};
const DEFAULT_FACTOR = { factor: 0.60, why: 'de coach houdt vandaag de rem erop' };

// De harde stop.
//
// Bewust ruim: liever een keer te vaak geen alternatief dan een keer te weinig.
// Elke tak hier komt uit bestaande signalen — er wordt geen nieuwe
// symptoomlogica bedacht.
export function hardStopReason({ log = {}, logs = {}, currentDate = todayLocal() } = {}) {
  const sym = readSymptoms(log);

  // Medische alarmsymptomen vandaag: borstklachten, neurologisch, instorten,
  // hartkloppingen, koorts, koud zweet.
  const rood = sym.signs.filter(s => RED_FLAG_IDS.includes(s.id));
  if (rood.length) {
    return `je gaf vandaag ${rood.map(s => s.label.toLowerCase()).join(' en ')} aan`;
  }

  // Ziek of grieperig. Er bestaat geen apart ziektevakje in de app; dit is het
  // veld waarin dat terechtkomt.
  if (sym.signs.some(s => s.id === 'malaise')) {
    return 'je voelt je vandaag ziek of grieperig';
  }

  // PEM vandaag.
  if (log.symptom_pem || log.training_recovery === 2 || log.recovery_check === 'bad') {
    return 'je meldde vandaag een PEM-signaal';
  }

  // Een bevestigde abnormale respons op de vorige sessie.
  const laatste = lastRunWorkout(currentDate);
  if (laatste) {
    const resp = exertionalResponse({ workoutDate: laatste.date, logs, currentDate });
    if (resp.status === 'red') {
      return `de respons op je sessie van ${laatste.date.slice(5)} was abnormaal`;
    }
    // Twee loopsessies op één dag is geen doseringsvraag maar een tweede
    // sessie. Daar is de override niet voor.
    if (laatste.date === currentDate) {
      return 'je hebt vandaag al gelopen';
    }
  }
  return null;
}

// ── Is de knop beschikbaar, en wat staat eronder? ───────────────
export function overrideAvailability({
  log = {}, logs = {}, currentDate = todayLocal(), runGate = null, plan = null,
} = {}) {
  const coachGeeftRun = !!plan?.run;
  if (coachGeeftRun) {
    return { gate: GATE.NOT_NEEDED, hardStop: false, allowed: false };
  }

  const stop = hardStopReason({ log, logs, currentDate });
  const coachReden = runGate?.blockers?.[0] || plan?.why || plan?.reason
    || runGate?.headline || 'je herstel van dit moment';

  if (stop) {
    return {
      gate: GATE.HARD_STOP, hardStop: true, allowed: false,
      coachAction: runGate?.action || 'FULL_REST',
      coachReason: coachReden,
      stopReason: stop,
      // De enige zin die bij een rode vlag getoond mag worden.
      message: 'Voor dit signaal genereert de coach geen loopsessie.',
    };
  }

  return {
    gate: GATE.OPEN, hardStop: false, allowed: true,
    coachAction: runGate?.action || null,
    coachReason: coachReden,
  };
}

// ── Het alternatief zelf ────────────────────────────────────────
// Bewust smal: geen opbouw, geen racetempo, geen kwaliteit, geen extra
// afstand. Wat overblijft is de rustigste vorm die zij aantoonbaar aankan,
// ingekort.
export function buildOverrideSession({
  log = {}, logs = {}, currentDate = todayLocal(), runGate = null, plan = null,
} = {}) {
  const beschikbaar = overrideAvailability({ log, logs, currentDate, runGate, plan });
  if (!beschikbaar.allowed) return { ...beschikbaar, session: null };

  const proven = provenStructure({ logs, currentDate });
  const easy = easyRunPace({ logs, currentDate });

  // Zonder bewezen vorm én zonder gemeten tempo is er niets om op terug te
  // vallen behalve een verzinsel. Dan liever eerlijk niets.
  if (!proven || !easy?.available) {
    return {
      ...beschikbaar, session: null,
      message: 'Er is nog geen goed verdragen sessie met te scheiden loopblokken om een veilig alternatief op te baseren.',
    };
  }

  const schaal = VOLUME_FACTOR[runGate?.action] || DEFAULT_FACTOR;

  // Het plafond: nooit meer dan de laatste goed verdragen easy sessie.
  const plafondMin = proven.duration || 20;
  const doelMin = Math.max(10, Math.round(plafondMin * schaal.factor));

  // Dezelfde blokvorm, minder herhalingen. De blokken zelf worden niet langer
  // gemaakt — dat zou een prikkel zijn en geen inperking.
  const runMin = proven.runMin || 3;
  const walkMin = proven.walkMin || 2;
  const perRep = runMin + walkMin;
  const reps = Math.max(2, Math.min(proven.reps || 5, Math.floor(doelMin / perRep)));
  const duration = Math.round(reps * perRep);

  // Tempo: het gemeten easy-tempo, en bewust een fractie rustiger. Geen
  // racetempo, ook niet als er over vijf dagen een wedstrijd is.
  const easySec = easy.paceSecPerKm;
  const runPace = secToPace(easySec + 15);

  // Hartslag: precies wat hrModel voor een herstelsessie voorschrijft. Dit
  // bestand kent geen hartslaggrenzen en hoort ze niet te kennen.
  const model = loadHrModel();
  const release = intensityRelease({ logs, currentDate, model });
  const hr = hrPrescription({ purpose: 'RECOVERY', logs, currentDate, model, release });

  const math = sessionMath({
    runMin, walkMin, reps, duration,
    runPace, walkPace: secToPace(Math.round(easySec * 1.25)),
  });

  return {
    ...beschikbaar,
    session: {
      kind: 'USER_OVERRIDE',
      purpose: 'RECOVERY',
      description: `${fmtMin(runMin)} lopen / ${fmtMin(walkMin)} wandelen × ${reps}`,
      runMin, walkMin, reps, duration,
      runPace, runPaceLabel: `${fmtPaceSec(paceToSec(runPace))}/km`,
      walkPace: secToPace(Math.round(easySec * 1.25)),
      hrZone: hr.line || hr.label || null,
      hr,
      expectedRunMinutes: math ? Math.round(math.runMinutes) : null,
      expectedRunKm: math?.runKm != null ? +math.runKm.toFixed(1) : null,
      expectedTotalKm: math?.km != null ? +math.km.toFixed(1) : null,
      // Waar dit vandaan komt, zodat het naast het coachadvies te wegen is.
      basedOn: {
        provenDate: proven.date,
        provenDuration: plafondMin,
        provenSessions: proven.sessions,
        easySessions: easy.usable,
        factor: schaal.factor,
      },
      scaleWhy: schaal.why,
      // Wat dit alternatief bewust NIET doet.
      excluded: ['geen opbouw', 'geen racetempo', 'geen kwaliteitsblokken',
        'geen extra afstand', 'niet langer dan je laatste verdragen sessie'],
    },
  };
}

function fmtMin(min) {
  if (min == null) return '—';
  return Number.isInteger(min) ? `${min} min` : `${String(min).replace('.', ',')} min`;
}

// ── Vastleggen ──────────────────────────────────────────────────
// Wat er precies is opgeslagen bepaalt of hier ooit iets van te leren valt.
// Zonder het oorspronkelijke coachbesluit ernaast is een override achteraf
// niet te beoordelen: dan weet je wel dat ze liep, maar niet waartegen in.
export function loadOverrides() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function persist(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  return arr;
}

// ── Drie toestanden, want kijken is niet doen ───────────────────
//
// De eerste versie legde een override vast zodra je op "toon veiligste
// alternatief" klikte. Dat is verkeerd: dan telde nieuwsgierigheid als een
// gelopen training. Het herstelvenster ging lopen zonder dat er iets gelopen
// was, en de leerteller ging omhoog op een sessie die nooit bestond.
//
//   PREVIEW    je kijkt wat er zou kunnen. Wordt niet opgeslagen.
//   PLANNED    je zegt: deze ga ik doen. Vastgelegd, maar nog geen bewijs.
//   COMPLETED  gedaan — of een echte activiteit van die dag is eraan gekoppeld.
//              Pas hier begint het 24–48u-venster te tellen.
//   CANCELLED  toch niet.
//
// Alleen COMPLETED telt ergens voor mee. Dat is de hele regel.
export const OVERRIDE_STATUS = {
  PREVIEW: 'PREVIEW',
  PLANNED: 'PLANNED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

// Oudere records hebben geen status. Ze zijn ontstaan bij het bekijken, dus ze
// bewijzen niets — behalve als er een activiteit aan hangt. Ze worden gelezen
// als PLANNED en kunnen door de koppeling alsnog COMPLETED worden.
function statusOf(o) {
  if (o?.status) return o.status;
  return o?.workoutId ? OVERRIDE_STATUS.COMPLETED : OVERRIDE_STATUS.PLANNED;
}

export function overrideStatus(o) { return statusOf(o); }

function upsert(currentDate, patch) {
  const arr = loadOverrides();
  const i = arr.findIndex(o => o.date === currentDate);
  if (i >= 0) {
    arr[i] = { ...arr[i], ...patch, updatedAt: new Date().toISOString() };
    persist(arr);
    return arr[i];
  }
  const entry = { id: `ovr_${currentDate}`, date: currentDate, userOverride: true,
    createdAt: new Date().toISOString(), ...patch };
  arr.unshift(entry);
  persist(arr);
  return entry;
}

// PLANNED — "deze training ga ik doen".
export function planOverride({
  currentDate = todayLocal(), runGate = null, plan = null, availability = null,
  session = null,
} = {}) {
  return upsert(currentDate, {
    status: OVERRIDE_STATUS.PLANNED,
    plannedAt: new Date().toISOString(),
    completedAt: null,
    linkedActivityId: null,
    originalCoachDecision: runGate?.action || plan?.purpose || null,
    originalCoachHeadline: runGate?.headline || null,
    originalBlockReason: availability?.coachReason || runGate?.blockers?.[0] || null,
    overrideSession: session ? {
      description: session.description, duration: session.duration,
      runMin: session.runMin, walkMin: session.walkMin, reps: session.reps,
      runPace: session.runPace, hrZone: session.hrZone,
      expectedTotalKm: session.expectedTotalKm,
      factor: session.basedOn?.factor ?? null,
    } : null,
    outcome24h: null,
    outcome48h: null,
  });
}

// COMPLETED — gedaan. Vanaf hier telt de sessie mee.
export function completeOverride(currentDate = todayLocal(), { linkedActivityId = null } = {}) {
  const bestaand = overrideForDate(currentDate);
  if (!bestaand) return null;
  return upsert(currentDate, {
    status: OVERRIDE_STATUS.COMPLETED,
    completedAt: new Date().toISOString(),
    linkedActivityId: linkedActivityId || bestaand.linkedActivityId || null,
  });
}

export function cancelOverride(currentDate = todayLocal()) {
  const bestaand = overrideForDate(currentDate);
  if (!bestaand) return null;
  return upsert(currentDate, {
    status: OVERRIDE_STATUS.CANCELLED,
    completedAt: null,
  });
}

// Koppelen aan een echte activiteit.
//
// Komt de run later binnen via Strava of Garmin, dan hoort hij bij de override
// die je die dag had gepland — en niet als tweede gebeurtenis ernaast. Vandaar
// dat er op datum wordt gekoppeld en niet nieuw wordt aangemaakt.
export function linkActivities({ currentDate = todayLocal() } = {}) {
  const arr = loadOverrides();
  let veranderd = false;

  for (let i = 0; i < arr.length; i++) {
    const o = arr[i];
    const st = statusOf(o);
    if (st === OVERRIDE_STATUS.CANCELLED) continue;
    if (st === OVERRIDE_STATUS.COMPLETED && o.linkedActivityId) continue;

    const run = lastRunWorkout(o.date);
    if (!run || run.date !== o.date) continue;
    // Al aan een andere dag gekoppeld? Dan niet nog eens.
    if (arr.some(x => x.date !== o.date && x.linkedActivityId === run.id)) continue;

    arr[i] = { ...o,
      status: OVERRIDE_STATUS.COMPLETED,
      linkedActivityId: run.id,
      completedAt: o.completedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    veranderd = true;
  }
  if (veranderd) persist(arr);
  return arr;
}

// De uitkomst wordt afgeleid, niet apart ingevuld: hij komt uit dezelfde
// respons-analyse als elke andere sessie, zodat er geen tweede oordeel ontstaat.
export function overrideOutcome(entry, { logs = {}, currentDate = todayLocal() } = {}) {
  const resp = exertionalResponse({ workoutDate: entry.date, logs, currentDate });
  const dag = (n) => logs?.[addDays(entry.date, n)] || null;
  const beantwoord = (l) => !!l && (l.recovery_check === 'good' || l.recovery_check === 'bad' ||
    l.energy != null || l.training_recovery != null);

  return {
    status: resp.status,               // good / mild / poor / red / pending / unanswered
    reason: resp.reason || null,
    outcome24h: beantwoord(dag(1)) ? (dag(1).recovery_check === 'bad' ||
      dag(1).symptom_pem || dag(1).training_recovery === 2 ? 'bad' : 'good') : null,
    outcome48h: beantwoord(dag(2)) ? (dag(2).recovery_check === 'bad' ||
      dag(2).symptom_pem || dag(2).training_recovery === 2 ? 'bad' : 'good') : null,
    clean: resp.status === 'good',
    windowClosed: currentDate >= addDays(entry.date, 2),
  };
}

// ── Wat we ervan leren ──────────────────────────────────────────
// Bewust terughoudend. Eén override zegt niets, en een coach die na één
// meevaller de rem loslaat is geen coach. Onder de drempel wordt er geteld en
// verder niets beweerd.
export const LEARNING_MINIMUM = 4;

export const COACH_CALIBRATION = {
  TOO_CONSERVATIVE: 'te voorzichtig',
  APPROPRIATE: 'passend',
  TOO_PERMISSIVE: 'te ruim',
  UNKNOWN: 'nog niet te zeggen',
};

export function overrideLearning({ logs = {}, currentDate = todayLocal() } = {}) {
  const alle = loadOverrides();
  // Alleen uitgevoerde overrides. Een preview bestaat niet meer, een plan dat
  // je liet lopen zegt niets over of de coach te voorzichtig was, en een
  // geannuleerde al helemaal niet.
  const uitgevoerd = alle.filter(o => statusOf(o) === OVERRIDE_STATUS.COMPLETED);
  const beoordeeld = uitgevoerd
    .map(o => ({ entry: o, uitkomst: overrideOutcome(o, { logs, currentDate }) }))
    .filter(r => r.uitkomst.windowClosed);

  const schoon = beoordeeld.filter(r => r.uitkomst.clean).length;
  // 'mild' telt hier wél mee als naschok.
  //
  // Op de gewone schaal betekent mild "er was een reactie, maar je mag hem
  // herhalen". Bij een sessie die tegen het advies in is gedaan is juist die
  // reactie het antwoord op de vraag die je stelde: was de coach te
  // voorzichtig? Een milde naschok zegt van niet.
  const verslechterd = beoordeeld.filter(r =>
    ['mild', 'poor', 'red'].includes(r.uitkomst.status)).length;
  const onbeantwoord = beoordeeld.filter(r => r.uitkomst.status === 'unanswered').length;

  const genoeg = beoordeeld.length >= LEARNING_MINIMUM;
  let calibration = COACH_CALIBRATION.UNKNOWN;
  let note = `Nog te weinig beoordeelde overrides om iets over te zeggen (${beoordeeld.length} van ${LEARNING_MINIMUM}).`;

  if (genoeg) {
    const deel = schoon / beoordeeld.length;
    if (deel >= 0.8) {
      calibration = COACH_CALIBRATION.TOO_CONSERVATIVE;
      note = `${schoon} van ${beoordeeld.length} overrides werden schoon verdragen. Op deze dagen was de coach waarschijnlijk voorzichtiger dan nodig.`;
    } else if (verslechterd / beoordeeld.length >= 0.4) {
      calibration = COACH_CALIBRATION.TOO_PERMISSIVE;
      note = `${verslechterd} van ${beoordeeld.length} overrides gaven een duidelijke naschok. Het alternatief was op deze dagen nog te veel.`;
    } else {
      calibration = COACH_CALIBRATION.APPROPRIATE;
      note = `${schoon} schoon en ${verslechterd} met naschok van ${beoordeeld.length} overrides. Het beeld is gemengd — de rem stond ongeveer goed.`;
    }
  }

  return {
    total: alle.length,
    completed: uitgevoerd.length,
    planned: alle.filter(o => statusOf(o) === OVERRIDE_STATUS.PLANNED).length,
    assessed: beoordeeld.length,
    clean: schoon,
    delayedWorsening: verslechterd,
    unanswered: onbeantwoord,
    enough: genoeg,
    calibration, note,
    // Expliciet: dit verandert nog niets aan de poort.
    changesGate: false,
  };
}

// ── De rem op bewijs ────────────────────────────────────────────
// Wordt gelezen door workouts.js. Een override telt pas mee als het volledige
// 24–48u-venster voorbij is én er niets slechts in staat.
export function overrideDates() {
  // Alleen uitgevoerde overrides. Een plan dat je niet hebt gedaan hoort
  // nergens een strengere lat op te leggen.
  return new Set(loadOverrides()
    .filter(o => statusOf(o) === OVERRIDE_STATUS.COMPLETED)
    .map(o => o.date));
}

export function overrideCleared(workoutDate, logs, currentDate = todayLocal()) {
  if (currentDate < addDays(workoutDate, 2)) return false;
  const resp = exertionalResponse({ workoutDate, logs, currentDate });
  return resp.status === 'good';
}

// Overzicht voor het scherm: welke overrides staan nog open?
export function pendingOverrides({ logs = {}, currentDate = todayLocal() } = {}) {
  return loadOverrides()
    .filter(o => statusOf(o) === OVERRIDE_STATUS.COMPLETED)
    .map(o => ({ ...o, uitkomst: overrideOutcome(o, { logs, currentDate }) }))
    .filter(o => !o.uitkomst.windowClosed || o.uitkomst.status === 'pending');
}

// Alleen voor tests en voor "opnieuw beginnen".
export function clearOverrides() {
  localStorage.removeItem(STORAGE_KEY);
}

// Handig voor het scherm: is er vandaag al een override vastgelegd?
export function overrideForDate(date) {
  return loadOverrides().find(o => o.date === date) || null;
}

// Wordt gebruikt door de registratieflow: de zojuist opgeslagen workout is de
// uitvoering van de override van die dag.
export function attachWorkout(date, workoutId) {
  if (!overrideForDate(date)) return null;
  return completeOverride(date, { linkedActivityId: workoutId });
}

// Puur afgeleid, nooit opgeslagen: telt deze sessie al als bewijs?
export function countsAsEvidence(workout, logs, currentDate = todayLocal()) {
  if (!workout?.date) return false;
  if (!overrideDates().has(workout.date)) return toleranceFor(workout, logs) === 'good';
  return overrideCleared(workout.date, logs, currentDate);
}

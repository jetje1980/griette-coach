// Krachttraining: twee basisprogramma's (A/B) + strength snack.
// Bewegingspatronen: squat/lunge · hinge · glutes · push · pull · core/carry · calves/feet
// Historie per oefening in localStorage (gc_strength_sessions) + progressive-overloadadvies.

// ── De zeven soorten oefeningen, in het Nederlands ──────────────
//
// Hier stond "Squat/Lunge", "Hinge", "Push", "Pull", "Core/Carry". Dat zijn
// de namen die in een sportschool worden gebruikt, en als je ze niet kent
// zegt een label je niets — je ziet een woord en weet nog steeds niet welk
// deel van je lichaam je traint of waarvoor het dient.
//
// Elk soort heeft nu een gewone naam, een zin die zegt wat het is, en een
// zin die zegt waarom het voor jou op het lijstje staat.
export const PATTERN_LABELS = {
  squat:  'Zakken en staan',
  hinge:  'Scharnieren vanuit de heup',
  glutes: 'Bilspieren',
  push:   'Duwen',
  pull:   'Trekken',
  core:   'Romp stabiel houden',
  calves: 'Kuiten en voeten',
};

export const PATTERN_INFO = {
  squat: {
    label: 'Zakken en staan',
    wat: 'Door je knieën zakken en weer omhoog komen — squats, lunges, step-ups.',
    waarom: 'Dit is de beweging van traplopen en opstaan uit een stoel. Het draagt je hardlopen en geeft je botten een prikkel.',
  },
  hinge: {
    label: 'Scharnieren vanuit de heup',
    wat: 'Je heupen naar achteren duwen met een lange rug, terwijl je knieën bijna gestrekt blijven — deadlifts en good mornings.',
    waarom: 'Traint je hamstrings, billen en onderrug: de achterkant die je afzet bij elke pas.',
  },
  glutes: {
    label: 'Bilspieren',
    wat: 'Je heupen strekken tegen weerstand in — hip thrusts, bruggetjes, kickbacks.',
    waarom: 'Sterke billen houden je bekken recht en beschermen je knieën als je moe wordt.',
  },
  push: {
    label: 'Duwen',
    wat: 'Iets van je af duwen — push-ups, schouderdrukken.',
    waarom: 'Bovenlichaam en botdichtheid in je polsen en schouders, precies waar het in de perimenopauze om gaat.',
  },
  pull: {
    label: 'Trekken',
    wat: 'Iets naar je toe trekken — roeibewegingen, band pull-aparts.',
    waarom: 'Je rug en houding. Het tegengif voor zitten en voorovergebogen lopen.',
  },
  core: {
    label: 'Romp stabiel houden',
    wat: 'Je romp op zijn plek houden terwijl armen of benen bewegen — planks, dead bugs, dragen.',
    waarom: 'Houdt je vorm heel als je moe wordt, en bepaalt hoe je middel eruitziet bij hetzelfde gewicht.',
  },
  calves: {
    label: 'Kuiten en voeten',
    wat: 'Op je tenen komen en je voetboog aanspannen.',
    waarom: 'Je kuiten en voeten dragen elke stap. Ze zijn de meest vergeten schakel bij hardlopen.',
  },
};

export const patternInfo = (id) => PATTERN_INFO[id] || null;

export const PROGRAM_A = {
  id: 'A',
  name: 'Kracht A — Fundament',
  emoji: '🅰️',
  exercises: [
    { id: 'a_squat',  pattern: 'squat',  name: 'Goblet squat',            cue: 'Dumbbell voor de borst, diep en gecontroleerd', defaultSets: 3, defaultReps: 10, bodyweight: false },
    { id: 'a_hinge',  pattern: 'hinge',  name: 'Romanian deadlift (DB)',  cue: 'Heup naar achter, rug lang, stretch in hamstrings', defaultSets: 3, defaultReps: 10, bodyweight: false },
    { id: 'a_glutes', pattern: 'glutes', name: 'Hip thrust',              cue: 'Schouders op bank/verhoging, boven 1s knijpen', defaultSets: 3, defaultReps: 12, bodyweight: false },
    { id: 'a_push',   pattern: 'push',   name: 'Push-up',                 cue: 'Op knieën of tenen — volledige range', defaultSets: 3, defaultReps: 8, bodyweight: true },
    { id: 'a_pull',   pattern: 'pull',   name: 'Dumbbell row',            cue: 'Eén arm, steun op bank, elleboog langs het lijf', defaultSets: 3, defaultReps: 10, bodyweight: false },
    { id: 'a_core',   pattern: 'core',   name: 'Dead bug',                cue: 'Onderrug op de grond gedrukt houden', defaultSets: 3, defaultReps: 10, bodyweight: true },
    { id: 'a_calves', pattern: 'calves', name: 'Calf raise (staand)',     cue: 'Volledige range, boven 1s vasthouden', defaultSets: 3, defaultReps: 15, bodyweight: true },
  ],
};

export const PROGRAM_B = {
  id: 'B',
  name: 'Kracht B — Balans',
  emoji: '🅱️',
  exercises: [
    { id: 'b_lunge',  pattern: 'squat',  name: 'Split squat',             cue: 'Achterste knie richting grond, romp rechtop', defaultSets: 3, defaultReps: 8, bodyweight: false },
    { id: 'b_hinge',  pattern: 'hinge',  name: 'Kettlebell deadlift',     cue: 'KB tussen de voeten, heupen duwen door', defaultSets: 3, defaultReps: 10, bodyweight: false },
    { id: 'b_glutes', pattern: 'glutes', name: 'Single-leg glute bridge', cue: 'Eén been, heup hoog, bekken stabiel', defaultSets: 3, defaultReps: 10, bodyweight: true },
    { id: 'b_push',   pattern: 'push',   name: 'Shoulder press (DB)',     cue: 'Zittend of staand, core aangespannen', defaultSets: 3, defaultReps: 10, bodyweight: false },
    { id: 'b_pull',   pattern: 'pull',   name: 'Band pull-apart / row',   cue: 'Schouderbladen naar elkaar, langzaam terug', defaultSets: 3, defaultReps: 12, bodyweight: false },
    { id: 'b_carry',  pattern: 'core',   name: 'Farmer carry',            cue: 'Zwaar gewicht per hand, 30–40m rechtop lopen', defaultSets: 3, defaultReps: 1, bodyweight: false, repsLabel: 'lengtes' },
    { id: 'b_feet',   pattern: 'calves', name: 'Tenenheffen + voetboog',  cue: 'Voeten sterk maken voor het hardlopen', defaultSets: 3, defaultReps: 12, bodyweight: true },
  ],
};

// 5–10 min voor drukke dagen. GEEN vervanging van progressieve krachttraining.
export const STRENGTH_SNACK = {
  id: 'snack',
  name: 'Strength Snack — 5–10 min',
  emoji: '⚡',
  note: 'Voor drukke dagen. Dit vervangt geen volledige progressieve krachttraining.',
  exercises: [
    { id: 's_squat',  pattern: 'squat',  name: 'Squats (lichaamsgewicht)', cue: '15 herhalingen, rustig tempo', defaultSets: 1, defaultReps: 15, bodyweight: true },
    { id: 's_push',   pattern: 'push',   name: 'Push-ups',                 cue: '8 herhalingen (knie-variant ok)', defaultSets: 1, defaultReps: 8, bodyweight: true },
    { id: 's_glutes', pattern: 'glutes', name: 'Glute bridge',             cue: '15 herhalingen, boven knijpen', defaultSets: 1, defaultReps: 15, bodyweight: true },
    { id: 's_core',   pattern: 'core',   name: 'Plank',                    cue: '30–45 seconden', defaultSets: 1, defaultReps: 1, bodyweight: true, repsLabel: 'holds' },
  ],
};

// ── Het gat tussen tien minuten en een uur ──────────────────────
//
// Er stond een snack van 5–10 minuten en daarna meteen A of B: zeven
// oefeningen, drie sets, in de praktijk drie kwartier. Daar zit niets
// tussen, en dat is precies de maat die op de meeste dagen haalbaar is.
// Wie alleen kan kiezen tussen tien minuten en drie kwartier, doet op een
// drukke week niets.
//
// Twee dingen zijn hier bewust gedaan:
//
//   · De oefeningen komen uit dezelfde lijst als A en B, met dezelfde `id`.
//     Een goblet squat in de 15-minutenversie telt dus mee in dezelfde
//     historie en hetzelfde overloadadvies als een goblet squat in
//     programma A. Nieuwe id's zouden de progressie in stukken breken —
//     precies het soort splitsing dat hier al vaker is opgeruimd.
//   · Elke lengte heeft een A- en een B-variant, zodat afwisselen blijft
//     werken en je over een week alle bewegingspatronen raakt in plaats van
//     drie keer dezelfde vier.
//
// De tijdsinschatting is eerlijk gerekend: sets × (werktijd + rust) plus
// twee minuten opstarten. Vijftien minuten betekent hier dat het in vijftien
// minuten klaar is, niet dat het zo heet.

const ex = (lijst, id) => lijst.find(e => e.id === id);
const uitA = (id, over = {}) => ({ ...ex(PROGRAM_A.exercises, id), ...over });
const uitB = (id, over = {}) => ({ ...ex(PROGRAM_B.exercises, id), ...over });

export const KORT_15A = {
  id: '15A',
  name: 'Kort 15 min — A',
  emoji: '⏱️',
  minutes: 15,
  focus: 'Benen, achterkant en romp — het minimum dat je hardlopen draagt.',
  exercises: [
    uitA('a_squat',  { defaultSets: 2 }),
    uitA('a_hinge',  { defaultSets: 2 }),
    uitA('a_glutes', { defaultSets: 2 }),
    uitA('a_core',   { defaultSets: 2 }),
  ],
};

export const KORT_15B = {
  id: '15B',
  name: 'Kort 15 min — B',
  emoji: '⏱️',
  minutes: 15,
  focus: 'Eenbenig, houding en romp — de kant die A laat liggen.',
  exercises: [
    uitB('b_lunge',  { defaultSets: 2 }),
    uitB('b_glutes', { defaultSets: 2 }),
    uitB('b_pull',   { defaultSets: 2 }),
    uitB('b_carry',  { defaultSets: 2 }),
  ],
};

export const MIDDEL_30A = {
  id: '30A',
  name: 'Middel 30 min — A',
  emoji: '⏲️',
  minutes: 30,
  focus: 'Volledige ronde zonder de staart: squat, hinge, glutes, push, core.',
  exercises: [
    uitA('a_squat',  { defaultSets: 3 }),
    uitA('a_hinge',  { defaultSets: 3 }),
    uitA('a_glutes', { defaultSets: 3 }),
    uitA('a_push',   { defaultSets: 3 }),
    uitA('a_core',   { defaultSets: 3 }),
  ],
};

export const MIDDEL_30B = {
  id: '30B',
  name: 'Middel 30 min — B',
  emoji: '⏲️',
  minutes: 30,
  focus: 'Eenbenig en trekkend: split squat, deadlift, glutes, pull, voeten.',
  exercises: [
    uitB('b_lunge',  { defaultSets: 3 }),
    uitB('b_hinge',  { defaultSets: 3 }),
    uitB('b_glutes', { defaultSets: 3 }),
    uitB('b_pull',   { defaultSets: 3 }),
    uitB('b_feet',   { defaultSets: 2 }),
  ],
};

// Hoelang duurt een sessie werkelijk? Niet het etiket maar de som.
//
// De eerste versie hiervan rekende te optimistisch — 2,5 seconden per
// herhaling en overal een minuut rust. Daarmee kwam een sessie van dertig
// minuten uit op zeventien, en dat is geen schatting maar een belofte die je
// niet waarmaakt. Deze getallen komen dichter bij wat het werkelijk kost:
//
//   werktijd   3 s per herhaling — de cues vragen gecontroleerd tempo,
//              niet zo snel mogelijk
//   rust       90 s bij oefeningen met gewicht, 60 s bij lichaamsgewicht
//   wisselen   30 s tussen twee oefeningen: opruimen, verzetten, klaarzetten
//   opstarten  2 minuten
export const REST_LOADED_SEC = 90;
export const REST_BODYWEIGHT_SEC = 60;
export const SWITCH_SEC = 30;
export const WORK_SEC_PER_REP = 3;
export const HOLD_SEC = 40;          // carry of plank: vaste duur per set
export const SETUP_MIN = 2;

export function estimatedMinutes(program) {
  if (!program?.exercises?.length) return null;
  let sec = SETUP_MIN * 60;
  for (const e of program.exercises) {
    const sets = e.defaultSets || 1;
    const reps = e.defaultReps || 10;
    const werk = e.repsLabel ? HOLD_SEC : reps * WORK_SEC_PER_REP;
    const rust = e.bodyweight ? REST_BODYWEIGHT_SEC : REST_LOADED_SEC;
    sec += sets * werk + Math.max(0, sets - 1) * rust + SWITCH_SEC;
  }
  return Math.round(sec / 60);
}

export const PROGRAMS = {
  A: PROGRAM_A, B: PROGRAM_B, snack: STRENGTH_SNACK,
  '15A': KORT_15A, '15B': KORT_15B, '30A': MIDDEL_30A, '30B': MIDDEL_30B,
};

// De volgorde waarin ze in het scherm staan: van kort naar lang.
export const PROGRAM_ORDER = ['snack', '15A', '15B', '30A', '30B', 'A', 'B'];

// Welke kant hoort bij welke sessie, zodat afwisselen ook werkt als je
// wisselt tussen lengtes: een 15A en een A zijn dezelfde kant.
export const PROGRAM_SIDE = {
  A: 'A', '15A': 'A', '30A': 'A',
  B: 'B', '15B': 'B', '30B': 'B',
  snack: null,
};

export function allExercises() {
  return [...PROGRAM_A.exercises, ...PROGRAM_B.exercises, ...STRENGTH_SNACK.exercises];
}

export function findExercise(exId) {
  return allExercises().find(e => e.id === exId) || null;
}

// ── Opslag ──────────────────────────────────────────────────────
const SESSIONS_KEY = 'gc_strength_sessions';

export function loadStrengthSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; }
}

export function saveStrengthSessions(arr) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(arr));
}

// session = { id, date, program, exercises: [{ id, weight, sets, reps, rir, done }] }
export function upsertStrengthSession(session) {
  const sessions = loadStrengthSessions();
  const idx = sessions.findIndex(s => s.date === session.date && s.program === session.program);
  if (idx >= 0) sessions[idx] = { ...sessions[idx], ...session };
  else sessions.unshift(session);
  sessions.sort((a, b) => b.date.localeCompare(a.date));
  saveStrengthSessions(sessions);
  return sessions;
}

export function getSessionFor(date, program) {
  return loadStrengthSessions().find(s => s.date === date && s.program === program) || null;
}

// Laatste geregistreerde prestatie voor een oefening (nieuwste eerst)
export function lastPerformance(exId, beforeDate = null) {
  const sessions = loadStrengthSessions();
  for (const s of sessions) {
    if (beforeDate && s.date >= beforeDate) continue;
    const entry = (s.exercises || []).find(e => e.id === exId && (e.done || e.weight || e.reps));
    if (entry) return { ...entry, date: s.date };
  }
  return null;
}

export function exerciseHistory(exId, limit = 10) {
  const out = [];
  for (const s of loadStrengthSessions()) {
    const entry = (s.exercises || []).find(e => e.id === exId);
    if (entry && (entry.done || entry.weight || entry.reps)) out.push({ ...entry, date: s.date });
    if (out.length >= limit) break;
  }
  return out;
}

// Welk programma is aan de beurt? (A ↔ B afwisselend, snack telt niet mee)
export function suggestedProgram() {
  const last = loadStrengthSessions().find(s => s.program === 'A' || s.program === 'B');
  if (!last) return 'A';
  return last.program === 'A' ? 'B' : 'A';
}

// ── Progressive overload advies ─────────────────────────────────
// Vorige keer: goblet squat 8 kg, 3×10, RIR 3 → Voorstel: 9 kg 3×8–10 OF 8 kg 3×11.
// ── Het advies in gewone woorden ────────────────────────────────
//
// Hier stond RIR in elke zin: "RIR 2–3", "RIR 0 is te zwaar", "noteer je
// RIR". Dat is vaktaal, en wie hem niet kent leest een advies dat niet
// uitlegt wat er moet gebeuren. Drie letters die je moet opzoeken staan
// tussen jou en je training in.
//
// RIR betekent "reps in reserve": hoeveel herhalingen je er nog bij had
// gekund. Dat begrip is bruikbaar — alleen de afkorting niet. Dus staat er
// nu wat het is: "stop met twee of drie herhalingen over".
export const RESERVE_UITLEG =
  'Hoeveel herhalingen je er nog bij had gekund toen je stopte. Nul betekent: '
  + 'er kon er geen één meer bij. Twee of drie over is voor jou het doel — dan '
  + 'heb je genoeg geprikkeld zonder je herstel op te eten.';

// Hoe je een aantal "reps over" in gewone taal zegt.
export function reserveTekst(n) {
  if (n == null) return 'niet genoteerd';
  if (n === 0) return 'niets meer over — dit was tot het uiterste';
  if (n === 1) return 'één herhaling over';
  if (n >= 4) return `${n} herhalingen over — dit was licht`;
  return `${n} herhalingen over`;
}

export function overloadAdvice(exercise, last) {
  const vorm = (sets, reps) => `${sets} series van ${reps}`;

  if (!last) {
    return exercise.bodyweight
      ? `Eerste keer — begin met ${vorm(exercise.defaultSets, exercise.defaultReps)} en stop `
        + 'telkens met twee of drie herhalingen over.'
      : `Eerste keer — ${vorm(exercise.defaultSets, exercise.defaultReps)}. Kies een gewicht `
        + `waarmee die ${exercise.defaultReps} herhalingen lukken en je er nog twee of drie `
        + 'over hebt.';
  }
  const w    = parseFloat(last.weight) || 0;
  const reps = parseInt(last.reps, 10) || exercise.defaultReps;
  const sets = parseInt(last.sets, 10) || exercise.defaultSets;
  const rir  = last.rir != null ? Number(last.rir) : null;
  const prev = w > 0
    ? `Vorige keer: ${w} kg, ${vorm(sets, reps)}${rir != null ? `, ${reserveTekst(rir)}` : ''}.`
    : `Vorige keer: ${vorm(sets, reps)} met je eigen gewicht${rir != null ? `, ${reserveTekst(rir)}` : ''}.`;

  if (last.done === false) {
    return `${prev} Niet afgemaakt — doe hetzelfde nog eens, eventueel `
      + `${Math.max(5, reps - 2)} herhalingen per serie.`;
  }
  if (rir == null) {
    return `${prev} Doe hetzelfde nog eens en noteer hoeveel herhalingen je overhad — `
      + 'dan kan ik gericht adviseren.';
  }
  if (rir >= 3) {
    if (w > 0) {
      return `${prev} Je had er nog ruim wat over, dus er kan iets bij: `
        + `${w + 1} kg met ${vorm(sets, `${Math.max(6, reps - 2)}–${reps}`)}, `
        + `of ${w} kg met ${vorm(sets, reps + 1)}.`;
    }
    return `${prev} Er kan iets bij: ${vorm(sets, reps + 2)}, of een zwaardere variant `
      + '(bijvoorbeeld je voeten verhoogd of gewicht erbij).';
  }
  if (rir >= 1) {
    return `${prev} Dit zit goed — houd ${w > 0 ? 'hetzelfde gewicht' : 'dezelfde variant'} aan `
      + `en probeer alle series strak op ${reps}${rir === 2 ? ` of ${reps + 1}` : ''} herhalingen.`;
  }
  // Niets meer over: te zwaar voor goed herstel.
  if (w > 0) {
    return `${prev} Tot het uiterste gaan kost je meer herstel dan het oplevert — `
      + `terug naar ${Math.max(1, w - 1)} kg of ${Math.max(5, reps - 2)} herhalingen.`;
  }
  return `${prev} Tot het uiterste gaan kost je meer herstel dan het oplevert — `
    + `doe ${Math.max(5, reps - 3)} herhalingen of een lichtere variant.`;
}

// ── De opbouw over weken ────────────────────────────────────────
//
// Tot nu toe was progressie volledig reactief: overloadAdvice() keek naar de
// RIR van de vorige keer en stelde één stapje voor. Dat werkt per oefening,
// maar het is geen opbouw — er zit geen richting in, geen piek, en geen
// moment waarop je bewust terugneemt zodat het lichaam de winst kan opnemen.
// Wie alleen "ging het makkelijk? dan zwaarder" volgt, loopt vroeg of laat
// vast of gaat eroverheen.
//
// Hier staat een golf van vier weken. Drie weken opbouwen, één week
// terugnemen, en dan begint de volgende golf een tandje hoger dan de vorige.
// Dat is de standaardvorm, en hij is hier bewust klein gehouden: één set
// erbij of één herhaling, nooit allebei tegelijk.
//
// De vierde week is geen gemiste week. Dat is de week waarin het opgebouwde
// werk wordt omgezet — en voor iemand die uit een terugval opbouwt is het
// de belangrijkste van de vier.
export const BLOCK_WEEKS = 4;

export const BLOCK_PHASES = [
  { week: 1, id: 'basis',    label: 'Basis',
    setDelta: 0, repDelta: 0, targetRir: 3,
    note: 'Instappen op het niveau van de vorige golf. Het moet makkelijk voelen — dat hoort.' },
  { week: 2, id: 'opbouw',   label: 'Opbouw',
    setDelta: 0, repDelta: 1, targetRir: 2,
    note: 'Eén herhaling per set erbij. Zelfde gewicht, zelfde aantal sets.' },
  { week: 3, id: 'piek',     label: 'Piek',
    setDelta: 1, repDelta: 1, targetRir: 2,
    note: 'De zwaarste week van de golf: een set erbij bovenop de extra herhaling.' },
  { week: 4, id: 'terugnemen', label: 'Terugnemen',
    setDelta: -1, repDelta: 0, targetRir: 4,
    note: 'Bewust minder. Hier wordt de winst van de drie weken ervoor opgenomen — dit is geen gemiste week.' },
];

export const phaseOfWeek = (w) =>
  BLOCK_PHASES[((Math.max(1, w) - 1) % BLOCK_WEEKS)];

// In welke week van welke golf zit je? Geteld vanaf je eerste krachtsessie,
// zodat de golf meeloopt met wat je werkelijk hebt gedaan en niet met de
// kalender.
export function blockPosition({ startDate = null, currentDate = null, sessions = null } = {}) {
  const alle = sessions || loadStrengthSessions();
  const metDatum = (alle || []).filter(s => s?.date).map(s => s.date).sort();
  // Zonder een enkele krachtsessie is er geen golf. Terugvallen op vandaag
  // zou betekenen dat het scherm "golf 1, week 1" toont aan iemand die nog
  // nooit iets heeft gedaan — een opbouw voorwenden die niet bestaat.
  const start = startDate || metDatum[0] || null;
  if (!start || !currentDate) {
    return { known: false, week: 1, cycle: 1, phase: BLOCK_PHASES[0],
      note: 'Nog geen krachtsessies — de eerste golf begint zodra je er een opslaat.' };
  }
  const dagen = Math.floor(
    (new Date(`${currentDate}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000);
  const weekNr = Math.floor(Math.max(0, dagen) / 7) + 1;
  const cycle = Math.floor((weekNr - 1) / BLOCK_WEEKS) + 1;
  const inCycle = ((weekNr - 1) % BLOCK_WEEKS) + 1;
  const phase = BLOCK_PHASES[inCycle - 1];
  return {
    known: true,
    week: weekNr, weekInCycle: inCycle, cycle,
    phase,
    note: `Golf ${cycle}, week ${inCycle} van ${BLOCK_WEEKS} — ${phase.label.toLowerCase()}. ${phase.note}`,
  };
}

// Wat betekent die fase voor déze oefening? Het aantal sets en herhalingen
// dat er vandaag hoort te staan, met de reden erbij.
//
// De ondergrens van één set is er zodat de terugneemweek niets wegpoetst:
// minder doen is niet hetzelfde als overslaan.
export function phaseTarget(exercise, phase, { lastEntry = null } = {}) {
  if (!exercise) return null;
  const f = phase || BLOCK_PHASES[0];
  const basisSets = parseInt(lastEntry?.sets, 10) || exercise.defaultSets || 2;
  const basisReps = parseInt(lastEntry?.reps, 10) || exercise.defaultReps || 10;
  const sets = Math.max(1, basisSets + f.setDelta);
  const reps = Math.max(5, basisReps + f.repDelta);
  return {
    sets, reps, targetRir: f.targetRir, phase: f.id, phaseLabel: f.label,
    label: `${sets}×${reps}`,
    why: f.id === 'terugnemen'
      ? `Terugneemweek: ${sets}×${reps} in plaats van ${basisSets}×${basisReps}, en stop met 4 reps over.`
      : `${f.label}: ${sets}×${reps}, stop met ongeveer ${f.targetRir} reps over.`,
  };
}

// De golf mag niet doorlopen alsof er niets aan de hand is. Bij een slechte
// herstelrespons wordt de piekweek een terugneemweek — dezelfde regel die
// elders in deze app geldt: waarschuwen over zeven dagen.
export function adjustedPhase(phase, { recovered = true } = {}) {
  if (recovered !== false) return { phase, adjusted: false, reason: null };
  const terug = BLOCK_PHASES.find(p => p.id === 'terugnemen');
  if (phase?.id === 'terugnemen') {
    return { phase, adjusted: false, reason: null };
  }
  return {
    phase: terug, adjusted: true,
    reason: `Je herstelrespons was deze week niet schoon, dus de ${phase?.label?.toLowerCase() || 'geplande'}week wordt een terugneemweek. De golf schuift op; hij vervalt niet.`,
  };
}

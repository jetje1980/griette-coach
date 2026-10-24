// De 75 dagen bijhouden: wat is gedaan, wat is gefotografeerd, en hoe staat het.
//
// ─────────────────────────────────────────────────────────────────
// DE REGELS DIE DEZE REEKS EERLIJK HOUDEN
//
// Een reeks is een krachtig middel en een gevaarlijk middel. Bij haar — long
// COVID, PEM-historie — kan "elke dag, hoe dan ook" haar leren haar lichaam
// te overrulen. Dat is precies het patroon dat deze app moet voorkomen.
//
// Daarom drie regels:
//
//   1. EEN RODE DAG TELT MEE als ze de herstelversie doet. Vijf minuten
//      mobiliteit in plaats van het circuit, en de dag is af. Niet "gemist",
//      niet "reeks kwijt". Zo meet de reeks trouw aan haarzelf.
//   2. EEN GEMISTE DAG BREEKT DE REEKS NIET WEG. De teller telt afgeronde
//      dagen van de 75, niet opeenvolgende dagen. Wie op dag 34 één keer
//      overslaat, heeft 33 dagen gedaan — geen nul. Een teller die naar nul
//      springt, is de reden dat mensen op dag 35 stoppen.
//   3. EEN RACEDAG IS GEEN TRAININGSDAG. Op de Bereloop of de Adventure Run
//      telt de dag mee zonder circuit; het hardlopen ís de inspanning.
//
// Wat hier NIET gebeurt: pushen. De app vraagt, zij beslist, en de app
// rekent eerlijk wat er staat.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, daysBetween, addDays } from './datetime';
import { CHALLENGE, phaseForDay, MILESTONES, PHASES } from './data/challenge75';

const KEY = 'gc_challenge75';

function lees() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return (v && typeof v === 'object') ? v : null;
  } catch { return null; }
}

function schrijf(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* opslag vol */ }
  return state;
}

// ── Starten ─────────────────────────────────────────────────────
export function startChallenge({ startDate = todayLocal() } = {}) {
  const bestaand = lees();
  if (bestaand?.startDate) return bestaand;
  return schrijf({ id: CHALLENGE.id, startDate, days: {}, startedAt: new Date().toISOString() });
}

export function loadChallenge() { return lees(); }

export function resetChallenge() {
  try { localStorage.removeItem(KEY); } catch { /* opslag */ }
  return null;
}

// ── Welke dag is het? ───────────────────────────────────────────
export function dayNumber(datum, state = null) {
  const s = state || lees();
  if (!s?.startDate) return null;
  const n = daysBetween(s.startDate, datum) + 1;
  return n >= 1 ? n : null;
}

export function dateOfDay(n, state = null) {
  const s = state || lees();
  if (!s?.startDate || n < 1) return null;
  return addDays(s.startDate, n - 1);
}

// ── Een dag afvinken ────────────────────────────────────────────
//
// `kind` zegt wát er is gedaan, en dat verschil blijft bewaard. Later
// terugkijken op "hoeveel van mijn 75 dagen waren hersteldagen" is een
// eerlijker beeld dan 75 identieke vinkjes.
export const DONE_KIND = {
  CIRCUIT: 'circuit',       // de acht minuten
  EXTRA: 'extra',           // circuit plus een tweede workout
  RECOVERY: 'herstel',      // de herstelversie op een rode dag
  RACE: 'race',             // racedag, het hardlopen was de inspanning
};

export function markDay(datum, { kind = DONE_KIND.CIRCUIT, note = null,
  secondWorkout = null } = {}) {
  const s = lees();
  if (!s?.startDate) return null;
  const n = dayNumber(datum, s);
  if (!n || n > CHALLENGE.days) return s;
  const dagen = { ...(s.days || {}) };
  dagen[datum] = {
    ...(dagen[datum] || {}),
    day: n, kind, note: note || null,
    secondWorkout: secondWorkout || null,
    doneAt: new Date().toISOString(),
  };
  return schrijf({ ...s, days: dagen });
}

export function unmarkDay(datum) {
  const s = lees();
  if (!s?.days?.[datum]) return s;
  const dagen = { ...s.days };
  // De foto blijft staan: die hoort bij de dag, niet bij het vinkje.
  const foto = dagen[datum].photo;
  if (foto) dagen[datum] = { day: dagen[datum].day, photo: foto };
  else delete dagen[datum];
  return schrijf({ ...s, days: dagen });
}

// ── De foto van de dag ──────────────────────────────────────────
//
// De foto zelf gaat naar photoStore (IndexedDB plus cloud) — daar staat het
// fotosysteem al, en een tweede fotosysteem erbij bouwen zou betekenen dat
// er twee plekken zijn waar haar beeld kan zoekraken. Hier wordt alleen
// vastgelegd dát er een foto is, zodat de reeks het kan tonen.
// De standaard is 'dag' — photoStore.DAILY_TYPE. Hier stond 'front', het
// aanzicht van de wekelijkse progressiefoto's, en dat is precies de
// verwisseling waardoor de foto van dag 1 in de verkeerde reeks belandde.
// De waarde staat hier als tekst en niet als import, zodat deze module los
// van het fotosysteem te gebruiken en te testen blijft.
export function markPhoto(datum, { type = 'dag', photoId = null } = {}) {
  const s = lees();
  if (!s?.startDate) return null;
  const n = dayNumber(datum, s);
  if (!n) return s;
  const dagen = { ...(s.days || {}) };
  dagen[datum] = { ...(dagen[datum] || { day: n }), day: n,
    photo: { type, photoId, at: new Date().toISOString() } };
  return schrijf({ ...s, days: dagen });
}

// ── De stand ────────────────────────────────────────────────────
export function challengeStatus({ currentDate = todayLocal() } = {}) {
  const s = lees();
  if (!s?.startDate) {
    return { active: false, note: 'Nog niet gestart.' };
  }
  const vandaagNr = dayNumber(currentDate, s);
  const dagen = s.days || {};
  const gedaan = Object.values(dagen).filter(d => d.kind);
  const metFoto = Object.values(dagen).filter(d => d.photo);

  // Opeenvolgend vanaf vandaag terug. Deze teller is informatief, niet de
  // maat waarop iets afhangt — zie regel 2 bovenaan.
  let aanEenStuk = 0;
  for (let i = 0; i < CHALLENGE.days; i++) {
    const d = addDays(currentDate, -i);
    if (dagen[d]?.kind) aanEenStuk++;
    else if (i > 0) break;        // vandaag nog niet gedaan telt niet als breuk
  }

  // ── Een datum vóór de start is geen crash ─────────────────────
  //
  // dayNumber() geeft null voor elke dag vóór de startdatum, en dailyMessage
  // greep daarna naar fase.focus. Elke keer dat zij terugbladerde naar een
  // dag van vóór 24 oktober, sprong het hele scherm op wit — want een
  // TypeError in de render neemt de boom mee. Dat was mijn fout, en het is
  // het soort fout dat niet "een foutmelding" oplevert maar "de app is weg".
  //
  // Een dag buiten het venster is een normale toestand: terugbladeren hoort
  // te kunnen, en dan hoort er te staan dat de uitdaging toen nog niet liep.
  const klaar = vandaagNr != null && vandaagNr > CHALLENGE.days;
  const voorStart = vandaagNr == null;
  const dagNr = klaar ? CHALLENGE.days : vandaagNr;
  // Altijd een fase, ook buiten het venster: de eerste fase vóór de start,
  // de laatste erna. Zo hoeft geen enkele lezer op null te controleren.
  const fase = dagNr ? phaseForDay(dagNr) : PHASES[0];

  return {
    active: true,
    startDate: s.startDate,
    endDate: addDays(s.startDate, CHALLENGE.days - 1),
    day: dagNr,
    totalDays: CHALLENGE.days,
    finished: klaar,
    // Ligt deze datum vóór dag 1? Dan is er niets te doen en niets gemist.
    beforeStart: voorStart,
    doneToday: !!dagen[currentDate]?.kind,
    kindToday: dagen[currentDate]?.kind || null,
    photoToday: !!dagen[currentDate]?.photo,
    doneCount: gedaan.length,
    photoCount: metFoto.length,
    recoveryCount: gedaan.filter(d => d.kind === DONE_KIND.RECOVERY).length,
    extraCount: gedaan.filter(d => d.kind === DONE_KIND.EXTRA).length,
    streak: aanEenStuk,
    // Hoeveel van de dagen die al voorbij zijn, zijn afgerond?
    completionPct: dagNr ? Math.round(gedaan.length / Math.min(dagNr, CHALLENGE.days) * 100) : 0,
    remaining: dagNr ? Math.max(0, CHALLENGE.days - dagNr) : CHALLENGE.days,
    phase: fase,
    milestone: MILESTONES[dagNr] || null,
  };
}

// ── Wat zij vandaag te horen krijgt ─────────────────────────────
//
// Zij vroeg: vertel me elke dag wat er strakker wordt. Dat gebeurt hier, en
// het is gebonden aan de fase waarin ze zit — niet aan een willekeurige
// aanmoediging. Een compliment dat elke dag hetzelfde is, is geen informatie.
export function dailyMessage({ currentDate = todayLocal() } = {}) {
  const st = challengeStatus({ currentDate });
  if (!st.active) return null;

  // Vóór de startdatum valt er niets te melden en niets te missen. Hier
  // stond geen controle, en dan greep de regel hieronder naar fase.focus
  // van een fase die null was — witte pagina.
  if (st.beforeStart) {
    return {
      day: null, done: false, beforeStart: true,
      phaseLabel: null,
      lines: [`De uitdaging begon op ${st.startDate}; deze dag valt ervoor.`],
      photoAsked: false,
    };
  }

  const fase = st.phase;
  const regels = [];

  if (st.doneToday) {
    regels.push(st.milestone || `Dag ${st.day} staat. ${fase.label}.`);
    regels.push(fase.happening);
    regels.push(fase.visible);
    if (st.kindToday === DONE_KIND.RECOVERY) {
      regels.push('Je deed de herstelversie, en die telt volwaardig mee. Rust op een '
        + 'rode dag is geen uitzondering op het plan, het is het plan.');
    }
    if (st.kindToday === DONE_KIND.EXTRA) {
      regels.push('Met een tweede workout erbij. Let op je herstelcheck morgen: twee '
        + 'prikkels op één dag vraagt een antwoord van je lichaam, geen aanname.');
    }
  } else {
    regels.push(`Dag ${st.day} van ${st.totalDays}. Acht minuten.`);
    regels.push(fase.focus);
    if (st.streak >= 3) {
      regels.push(`Je hebt ${st.streak} dagen op rij gedaan.`);
    }
  }

  return {
    day: st.day,
    done: st.doneToday,
    phaseLabel: fase.label,
    lines: regels.filter(Boolean),
    photoAsked: !st.photoToday,
  };
}

// De tekst voor de coachprompt: één blok, dezelfde bron als het scherm.
export function challengeAsText({ currentDate = todayLocal() } = {}) {
  const st = challengeStatus({ currentDate });
  if (!st.active) return null;
  const L = [];
  L.push(`75-DAGENUITDAGING (${st.startDate} t/m ${st.endDate}):`);
  L.push(`  dag ${st.day} van ${st.totalDays} · ${st.doneCount} dagen afgerond (${st.completionPct}% van de dagen tot nu) · ${st.photoCount} foto's`);
  L.push(`  vandaag: ${st.doneToday ? `gedaan (${st.kindToday})` : 'nog niet gedaan'}${st.photoToday ? ' · foto gemaakt' : ' · nog geen foto'}`);
  L.push(`  fase: ${st.phase.label} — ${st.phase.happening}`);
  if (st.recoveryCount) L.push(`  waarvan ${st.recoveryCount} hersteldagen (die tellen volwaardig mee)`);
  L.push('  REGEL: dit is een dagelijkse gewoonte van acht minuten, geen prestatiereeks.');
  L.push('  Een rode dag met de herstelversie is een afgeronde dag. Push haar niet naar');
  L.push('  het circuit op een dag waarop haar herstelrespons dat niet toelaat, en reken');
  L.push('  een gemiste dag niet af — de teller telt afgeronde dagen, niet een streak.');
  return L.join('\n');
}

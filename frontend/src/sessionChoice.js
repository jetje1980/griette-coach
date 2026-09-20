// Welke sessie vandaag — geleerd, niet afgeteld.
//
// ─────────────────────────────────────────────────────────────────
// WAT ER MIS WAS
//
// De oorspronkelijke coach koos "hoogste gedane sessienummer + 1" uit een
// vaste lijst. raceplan.js heeft dat al vervangen door iets dat naar je
// bewezen vorm kijkt, maar twee dingen bleven staan:
//
//   · de bibliotheek was genummerd en kalendergebonden, dus "de volgende"
//     bleef een rij waar je doorheen loopt;
//   · er werd alleen naar de laatste verdragen sessie gekeken. Hoe het
//     twintig sessies geleden ging, bij dezelfde vorm, telde niet mee.
//
// Dit bestand kiest anders. Het kijkt naar álle trainingen en leert er drie
// dingen uit:
//
//   VERDRAAGZAAMHEID  hoe viel deze vorm de vorige keren? Een vorm die twee
//                     keer slecht viel gaat niet opnieuw op tafel omdat hij
//                     toevallig aan de beurt is.
//   VERZADIGING       heb je dit recent al gedaan? Drie keer dezelfde vorm
//                     in twee weken is geen opbouw maar een sleur.
//   RIJPHEID          zit je lang genoeg op dit niveau om een stap te
//                     verdienen? Eén goede sessie is geen bewijs.
//
// De uitkomst is altijd een vorm mét een reden. Een advies zonder reden is
// niet na te rekenen en dus niet te weerleggen.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, daysBetween } from './datetime';
import { SESSIONS, sessionsAtLevel, sessionsUpTo, findSession, MAX_LEVEL }
  from './data/sessionLibrary';
import { purposesFor } from './strategy';

// Hoeveel schone sessies op een niveau voordat een stap omhoog verdiend is.
export const SESSIONS_BEFORE_STEP = 2;

// Hoe lang telt een eerdere uitvoering mee voor verzadiging?
export const VARIETY_WINDOW_DAYS = 14;

// Hoeveel slechte responsen maken een vorm verdacht?
export const BAD_RESPONSES_TO_AVOID = 2;

// ── Wat elke vorm in het verleden deed ──────────────────────────
//
// `history` is een lijst van { sessionId, date, response } waarbij response
// 'good' | 'mild' | 'poor' | 'red' | 'unanswered' is. Die vorm komt uit de
// bestaande responslaag; hier wordt er alleen uit geleerd.
export function learnFromHistory(history = [], { currentDate = todayLocal() } = {}) {
  const perVorm = {};
  for (const h of history) {
    if (!h?.sessionId) continue;
    const v = perVorm[h.sessionId] || (perVorm[h.sessionId] = {
      id: h.sessionId, done: 0, good: 0, bad: 0, lastDate: null, lastResponse: null });
    v.done++;
    if (h.response === 'good') v.good++;
    if (h.response === 'poor' || h.response === 'red') v.bad++;
    if (!v.lastDate || h.date > v.lastDate) { v.lastDate = h.date; v.lastResponse = h.response; }
  }
  for (const v of Object.values(perVorm)) {
    v.daysAgo = v.lastDate ? daysBetween(v.lastDate, currentDate) : null;
    v.recent = v.daysAgo != null && v.daysAgo >= 0 && v.daysAgo <= VARIETY_WINDOW_DAYS;
    v.suspect = v.bad >= BAD_RESPONSES_TO_AVOID && v.bad > v.good;
  }
  return perVorm;
}

// Verdien je een stap omhoog? Twee schone sessies op het huidige niveau,
// en geen slechte respons in de laatste twee weken.
export function readyToStep(history = [], level, { currentDate = todayLocal() } = {}) {
  const opNiveau = new Set(sessionsUpTo(level).filter(s => s.level === level).map(s => s.id));
  const relevant = history.filter(h => opNiveau.has(h.sessionId));
  const schoon = relevant.filter(h => h.response === 'good').length;
  const recentSlecht = history.some(h =>
    ['poor', 'red'].includes(h.response) &&
    daysBetween(h.date, currentDate) <= VARIETY_WINDOW_DAYS);

  return {
    ready: schoon >= SESSIONS_BEFORE_STEP && !recentSlecht,
    cleanAtLevel: schoon,
    needed: SESSIONS_BEFORE_STEP,
    blockedByResponse: recentSlecht,
    note: recentSlecht
      ? 'Er zit een slechte respons in de laatste twee weken; eerst weer schoon draaien.'
      : schoon >= SESSIONS_BEFORE_STEP
        ? `${schoon} schone sessies op dit niveau — de volgende stap is verdiend.`
        : `${schoon} van ${SESSIONS_BEFORE_STEP} schone sessies op dit niveau.`,
  };
}

// ── De keuze ────────────────────────────────────────────────────
export function chooseSession({
  strategy,               // uit currentStrategy()
  history = [],           // alle eerdere sessies met hun respons
  currentDate = todayLocal(),
  avoidIds = [],
} = {}) {
  if (!strategy) return { available: false, reason: 'Geen strategie om uit te kiezen.' };

  const geleerd = learnFromHistory(history, { currentDate });
  const stap = readyToStep(history, strategy.level, { currentDate });

  // Het niveau waarop gekozen wordt: een stap hoger als die verdiend is en
  // de fase opbouwt, anders consolideren op het huidige.
  const doelNiveau = (strategy.builds && stap.ready && strategy.nextLevel)
    ? strategy.nextLevel : strategy.level;
  const consolideert = doelNiveau === strategy.level;

  const doelen = purposesFor(strategy.phase);
  const kandidaten = [];

  for (const purpose of doelen) {
    // Op het doelniveau, en anders alles eronder — een herstelvorm hoeft
    // niet op jouw niveau te staan om te passen.
    const opNiveau = sessionsAtLevel(doelNiveau, { purpose });
    const eronder = sessionsUpTo(doelNiveau, { purpose })
      .filter(s => s.level < doelNiveau);
    for (const s of [...opNiveau, ...eronder]) kandidaten.push({ s, purpose });
  }

  if (!kandidaten.length) {
    return { available: false,
      reason: `Geen vorm gevonden voor ${strategy.label.toLowerCase()} op niveau ${doelNiveau}.` };
  }

  // Scoren. Hoger is beter, en elk onderdeel is los uit te leggen.
  const gescoord = kandidaten.map(({ s, purpose }) => {
    const g = geleerd[s.id];
    let score = 100;
    const waarom = [];

    // Het doel dat het best bij de fase past telt het zwaarst.
    const doelRang = doelen.indexOf(purpose);
    score -= doelRang * 12;
    if (doelRang === 0) waarom.push(`past bij ${strategy.label.toLowerCase()}`);

    // Op niveau is beter dan eronder — maar eronder is geen diskwalificatie.
    score -= (doelNiveau - s.level) * 6;

    if (g) {
      if (g.suspect) { score -= 60; waarom.push(`viel ${g.bad}× slecht`); }
      if (g.recent) { score -= 25; waarom.push(`${g.daysAgo} dagen geleden nog gedaan`); }
      if (g.good > 0 && !g.suspect) { score += Math.min(10, g.good * 3); }
      if (g.lastResponse === 'good' && g.daysAgo > VARIETY_WINDOW_DAYS) {
        score += 8; waarom.push('viel de vorige keer goed');
      }
    } else {
      score += 5; waarom.push('nog niet eerder gedaan');
    }

    if (avoidIds.includes(s.id)) score -= 200;

    return { session: s, purpose, score, waarom };
  }).sort((a, b) => b.score - a.score);

  const beste = gescoord[0];

  return {
    available: true,
    session: beste.session,
    purpose: beste.purpose,
    level: doelNiveau,
    consolidating: consolideert,
    stepped: !consolideert,
    readiness: stap,
    alternatives: gescoord.slice(1, 4).map(x => ({
      id: x.session.id, label: x.session.label, purpose: x.purpose, score: x.score })),
    // De uitleg. Dit is geen versiering: zonder reden is een advies niet te
    // weerleggen, en zij hoort een advies te kunnen weerleggen.
    why: [
      `${strategy.label}: ${strategy.aim}`,
      consolideert
        ? `Niveau ${doelNiveau} vasthouden. ${stap.note}`
        : `Stap naar niveau ${doelNiveau}. ${stap.note}`,
      ...beste.waarom,
    ].join(' '),
    learned: {
      formsTried: Object.keys(geleerd).length,
      sessionsLearnedFrom: history.length,
      suspect: Object.values(geleerd).filter(v => v.suspect).map(v => v.id),
    },
  };
}

// Handig voor het scherm: wat ligt er nog vóór je op deze ladder?
export function roadAhead(level, phaseId, { steps = 4 } = {}) {
  const doelen = purposesFor(phaseId);
  const uit = [];
  for (let l = level + 1; l <= MAX_LEVEL && uit.length < steps; l++) {
    const kandidaat = SESSIONS.find(s => s.level === l && doelen.includes(s.purpose))
      || SESSIONS.find(s => s.level === l);
    if (kandidaat) uit.push({ level: l, label: kandidaat.label, purpose: kandidaat.purpose });
  }
  return uit;
}

export { findSession };

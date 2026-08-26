// Actief zoeken naar productieve progressie — en ondertraining herkennen.
//
// ─────────────────────────────────────────────────────────────────
// DE FOUT DIE HIER GEREPAREERD WORDT
//
// Een coach die bij twijfel altijd afremt, heeft nooit ongelijk op een manier
// die zichtbaar is. Rust levert geen incident op. Daardoor voelt afremmen
// altijd als de verstandige keuze, en drijft een systeem vanzelf naar
// stilstand.
//
// Maar stilstand heeft ook een prijs, die alleen later zichtbaar wordt: een
// doel dat niet gehaald wordt, spiermassa die in de perimenopauze wegzakt,
// een conditie die precies blijft waar hij was. Dat is geen veiligheid maar
// ondertraining, en het hoort met dezelfde stelligheid benoemd te worden als
// overbelasting (§26).
//
// Daarom detecteert dit bestand twee dingen, niet één:
//
//   overreaching risk   — je vraagt meer dan je verwerkt
//   undertraining risk  — je verwerkt meer dan je vraagt
//
// ─────────────────────────────────────────────────────────────────
// ÉÉN VARIABELE PER KEER
//
// De progressievoorstellen hieronder verhogen nooit twee dingen tegelijk
// (§25). Dat is niet uit voorzichtigheid maar uit meetbaarheid: wie duur én
// intensiteit tegelijk opvoert en daarna een slechte respons heeft, weet niet
// welke van de twee het deed — en moet allebei terugdraaien.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween } from './datetime';
import { series } from './timeline';
import { peseState, PESE, recentResponses, longCovidRisk } from './pese';
import { weeklyLimiter, LIMITER } from './limiter';
import { runEconomyTrend } from './pace';
import { loadWorkouts } from './workouts';
import { activeRunGoals } from './runGoalModel';

const rond = (x, n = 1) => (x == null ? null : +Number(x).toFixed(n));
const gem = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

// ── Het risico aan beide kanten ─────────────────────────────────
export const RISK = {
  OVERREACHING: 'overreaching',
  UNDERTRAINING: 'ondertraining',
  BALANCED: 'in balans',
  UNKNOWN: 'te weinig gegevens',
};

// Hoeveel weken groen herstel voordat gelijk blijven ondertraining heet?
// Drie: twee kan een rustige periode zijn, vanaf drie is het een keuze.
export const WEEKS_FOR_UNDERTRAINING = 3;

// Wekelijkse loopminuten, uit de sessies zelf.
export function weeklyVolume({ currentDate = todayLocal(), weeks = 6 } = {}) {
  const rijen = [];
  for (let w = 0; w < weeks; w++) {
    const tot = addDays(currentDate, -w * 7);
    const van = addDays(tot, -6);
    const sessies = loadWorkouts().filter(x => x?.date && x.date >= van && x.date <= tot);
    const minuten = sessies.reduce((s, x) => s + (Number(x.duration) || 0), 0);
    const km = sessies.reduce((s, x) => s + (Number(x.distance) || 0), 0);
    rijen.push({ weeksAgo: w, from: van, to: tot,
      sessions: sessies.length, minutes: Math.round(minuten), km: rond(km, 1) });
  }
  return rijen.reverse();
}

// ── Ondertrainingssignalen (§27) ────────────────────────────────
export function undertrainingSignals({ logs = {}, currentDate = todayLocal() } = {}) {
  const pese = peseState({ logs, currentDate });
  const volume = weeklyVolume({ currentDate, weeks: WEEKS_FOR_UNDERTRAINING + 1 });
  const econ = runEconomyTrend({ currentDate });
  const sessies = recentResponses({ logs, currentDate, days: 28 });
  const signalen = [];
  const ontbreekt = [];

  // 1. Meerdere weken groen herstel.
  const groen = pese.state === PESE.GREEN;
  if (groen) signalen.push(`herstel groen met ${pese.cleanStreak} schone sessies op rij`);

  // 2. Lage RPE.
  const rpes = sessies.map(s => s.rpe).filter(x => x != null);
  const rpeGem = gem(rpes);
  if (rpeGem != null && rpeGem <= 5) {
    signalen.push(`gemiddelde RPE ${rond(rpeGem, 1)} over ${rpes.length} sessies`);
  } else if (rpeGem == null) ontbreekt.push('RPE bij de recente sessies');

  // 3. Stabiele of dalende hartslag bij hetzelfde tempo.
  if (econ.enough) {
    if (econ.hrDrift <= 2) {
      signalen.push(`hartslag bij vergelijkbaar tempo ${econ.hrDrift >= 0 ? 'stabiel' : 'gedaald'} (${econ.early.hr} → ${econ.late.hr})`);
    }
  } else ontbreekt.push('looptempo bij hartslag (zet ronden aan op je horloge)');

  // 4. Geen vertraagde verslechtering.
  const vertraagd = sessies.some(s => ['red', 'poor'].includes(s.status));
  if (!vertraagd && sessies.length) signalen.push('geen vertraagde verslechtering in vier weken');

  // 5. Trainingsvolume onveranderd.
  const recent = volume.slice(-WEEKS_FOR_UNDERTRAINING);
  const minuten = recent.map(w => w.minutes).filter(m => m > 0);
  const vlak = minuten.length >= WEEKS_FOR_UNDERTRAINING &&
    (Math.max(...minuten) - Math.min(...minuten)) <= Math.max(10, Math.min(...minuten) * 0.12);
  if (vlak) {
    signalen.push(`trainingsvolume ${WEEKS_FOR_UNDERTRAINING} weken vrijwel gelijk (${minuten.join(', ')} min)`);
  }

  // 6. Het doel vraagt meer.
  let race = null;
  try {
    const doelen = activeRunGoals({ currentDate }) || [];
    race = doelen.find(g => g.date && g.date > currentDate) || null;
  } catch { race = null; }
  if (race) {
    signalen.push(`doel ${race.name || 'race'} op ${race.date}, over ${Math.round(daysBetween(currentDate, race.date) / 7)} weken`);
  }

  // Het oordeel. Groen herstel én vlak volume is de kern; de rest versterkt.
  const kern = groen && vlak;
  const zekerheid = ontbreekt.length === 0 && signalen.length >= 4 ? 'hoog'
    : signalen.length >= 3 ? 'redelijk' : 'laag';

  return {
    ready: kern,
    signals: signalen,
    missing: ontbreekt,
    confidence: zekerheid,
    weeklyMinutes: volume.map(w => w.minutes),
    flatVolume: vlak,
    greenRecovery: groen,
    goalDemandsMore: !!race,
    note: kern
      ? `Je herstel is al ${WEEKS_FOR_UNDERTRAINING} weken groen terwijl je belasting gelijk bleef. Chronisch dezelfde prikkel voorschrijven is dan geen veiligheid maar ondertraining.`
      : groen
        ? 'Herstel is groen, maar je volume beweegt al mee. Dat is precies goed — geen extra stap nodig deze week.'
        : 'Nog geen ondertrainingssignaal: het herstel geeft eerst antwoord.',
  };
}

// ── De richting: te veel, te weinig, of goed ────────────────────
export function trainingBalance({ logs = {}, currentDate = todayLocal() } = {}) {
  const pese = peseState({ logs, currentDate });
  const onder = undertrainingSignals({ logs, currentDate });
  const volume = weeklyVolume({ currentDate, weeks: 4 });
  const minuten = volume.map(w => w.minutes);
  const groei = minuten.length >= 2 && minuten[minuten.length - 2] > 0
    ? (minuten[minuten.length - 1] - minuten[minuten.length - 2]) / minuten[minuten.length - 2]
    : null;

  if (pese.state === PESE.RED) {
    return { risk: RISK.OVERREACHING, confidence: pese.confidence,
      weeklyMinutes: minuten, growth: groei,
      note: `Je vraagt op dit moment meer dan je verwerkt. ${pese.reason}` };
  }
  if (pese.state === PESE.ORANGE) {
    return { risk: RISK.UNKNOWN, confidence: pese.confidence,
      weeklyMinutes: minuten, growth: groei,
      note: `Het beeld is nog niet rond. ${pese.reason}` };
  }
  if (onder.ready) {
    return { risk: RISK.UNDERTRAINING, confidence: onder.confidence,
      weeklyMinutes: minuten, growth: groei,
      signals: onder.signals, missing: onder.missing,
      note: onder.note };
  }
  return { risk: RISK.BALANCED, confidence: pese.confidence,
    weeklyMinutes: minuten, growth: groei,
    note: groei != null && groei > 0
      ? `Je volume groeit met ${Math.round(groei * 100)}% en het herstel houdt het bij. Dit is het tempo waarop opbouw blijft plakken.`
      : 'Belasting en herstel zijn met elkaar in evenwicht.' };
}

// ── De hefbomen (§25) ───────────────────────────────────────────
// De volgorde is niet willekeurig. Duur voor intensiteit, continuïteit voor
// snelheid, en frequentie pas als de rest staat — dat is de volgorde waarin
// een lichaam met een PEM-historie aanpassingen het beste verdraagt.
export const LEVER = {
  CONTINUOUS: 'langere aaneengesloten blokken',
  RUNWALK: 'wandelpauzes verder afbouwen',
  DURATION: 'sessieduur uitbreiden',
  FREQUENCY: 'een loopdag erbij',
  STRIDES: 'strides',
  TEMPO: 'korte tempoblokken',
  STRENGTH: 'krachtvolume of -intensiteit',
};

const LEVER_ORDER = [LEVER.STRENGTH, LEVER.DURATION, LEVER.CONTINUOUS,
  LEVER.RUNWALK, LEVER.STRIDES, LEVER.FREQUENCY, LEVER.TEMPO];

// Wat is er de afgelopen weken al veranderd? Wie vorige week de duur verhoogde,
// verhoogt deze week niet ook de intensiteit.
export function recentChange({ currentDate = todayLocal(), weeks = 2 } = {}) {
  const volume = weeklyVolume({ currentDate, weeks: weeks + 1 });
  const m = volume.map(w => w.minutes);
  const s = volume.map(w => w.sessions);
  const duurOmhoog = m.length >= 2 && m[m.length - 1] > m[m.length - 2] * 1.05;
  const frequentieOmhoog = s.length >= 2 && s[s.length - 1] > s[s.length - 2];
  return {
    durationIncreased: duurOmhoog,
    frequencyIncreased: frequentieOmhoog,
    weeklyMinutes: m, weeklySessions: s,
    changedSomething: duurOmhoog || frequentieOmhoog,
  };
}

export function progressionProposal({ logs = {}, currentDate = todayLocal() } = {}) {
  const risico = longCovidRisk({ logs, currentDate });
  const balans = trainingBalance({ logs, currentDate });
  const lim = weeklyLimiter({ logs, currentDate });
  const recent = recentChange({ currentDate });
  const econ = runEconomyTrend({ currentDate });
  const krachtSessies = series('strength_volume',
    { asOf: currentDate, since: addDays(currentDate, -13) }).length;

  // Niet opbouwen is soms het voorstel. Dan hoort het ook zo te heten.
  if (!risico.allowsBuild) {
    return {
      build: false,
      lever: null,
      reason: risico.reason,
      advice: risico.advice,
      limiter: lim.primary,
      confidence: risico.confidence,
      note: balans.risk === RISK.OVERREACHING
        ? 'Eerst herstellen. Een stap nu kost twee stappen later.'
        : 'Herhaal het huidige niveau. Dat is geen stilstand maar het verzamelen van bewijs.',
    };
  }

  // Wél opbouwen. Welke hefboom, en waarom die?
  const kandidaten = [];
  const voeg = (lever, waarom, stap) => kandidaten.push({ lever, why: waarom, step: stap });

  // Kracht eerst als die achterloopt: spierbehoud is in deze levensfase de
  // duurste post om te laten liggen, en het kost het minste herstel.
  if (krachtSessies < 2) {
    voeg(LEVER.STRENGTH,
      `${krachtSessies} krachtsessie(s) in twee weken. Twee per week is de ondergrens die spiermassa vasthoudt.`,
      krachtSessies === 0 ? 'begin met één sessie deze week' : 'naar twee sessies per week');
  }

  // Duur, tenzij die vorige week al omhoog ging.
  if (!recent.durationIncreased) {
    const laatsteDuur = loadWorkouts()
      .filter(w => w?.date && w.date <= currentDate && w.duration)
      .sort((a, b) => a.date.localeCompare(b.date)).pop();
    const nu = laatsteDuur ? Math.round(Number(laatsteDuur.duration)) : null;
    voeg(LEVER.DURATION,
      'Duur is de goedkoopste prikkel: hij verhoogt het aerobe werk zonder de intensiteit aan te raken.',
      nu ? `van ${nu} naar ${Math.round(nu * 1.1)} minuten` : 'ongeveer tien procent langer');
  }

  // Continuïteit: langere loopblokken binnen dezelfde sessieduur.
  voeg(LEVER.CONTINUOUS,
    'Langer aaneengesloten lopen binnen dezelfde sessieduur verandert de prikkel zonder het volume te verhogen.',
    'één blok langer maken, de rest gelijk houden');

  // Wandelpauzes afbouwen, maar alleen als de blokken al staan.
  voeg(LEVER.RUNWALK,
    'De wandelpauze verkorten is een kleinere stap dan een blok toevoegen.',
    'de wandelpauze met dertig seconden inkorten');

  // Frequentie pas als er niets anders veranderde.
  if (!recent.changedSomething) {
    voeg(LEVER.FREQUENCY,
      'Een extra loopdag is de grootste stap van allemaal. Alleen zinvol als de rest al staat.',
      'één korte extra sessie, niet langer dan twintig minuten');
  }

  // Strides en tempo alleen bij aantoonbaar goede economie: intensiteit is de
  // duurste prikkel en de eerste die bij PEM misgaat.
  if (econ.enough && econ.honest && econ.gainSec > 0) {
    voeg(LEVER.STRIDES,
      `Je loopt ${econ.gainSec} sec/km sneller bij dezelfde hartslag. Dat is de ruimte waarin strides veilig passen.`,
      '4 × 15 seconden vlot, met volledige rust ertussen');
  }

  kandidaten.sort((a, b) => LEVER_ORDER.indexOf(a.lever) - LEVER_ORDER.indexOf(b.lever));
  const gekozen = kandidaten[0];

  return {
    build: true,
    lever: gekozen.lever,
    step: gekozen.step,
    why: gekozen.why,
    alternatives: kandidaten.slice(1, 3).map(k => ({ lever: k.lever, step: k.step })),
    limiter: lim.primary,
    confidence: balans.confidence,
    reason: risico.reason,
    // De regel die §25 expliciet vraagt.
    rule: 'Eén variabele tegelijk. Als de respons hierna niet schoon is, weet je precies wat je terugdraait.',
    note: balans.risk === RISK.UNDERTRAINING
      ? balans.note
      : 'Je herstel geeft ruimte voor een stap. Neem er één.',
  };
}

// ── Lichaamscompositie mag hardlopen niet remmen (§28) ──────────
//
// Dit is geen berekening maar een grens, en die hoort expliciet in de code te
// staan in plaats van als goede bedoeling in een prompt. Vier dingen mogen
// nooit uit een gewichtsdoel volgen, en één ding mag nooit uit één slechte
// training volgen.
export const FORBIDDEN_FOR_WEIGHT = [
  { id: 'punitive_cardio', label: 'extra cardio als straf',
    why: 'Cardio is een trainingsprikkel, geen boetedoening. Extra volume dat niet uit je trainingsplan volgt, kost herstel dat je voor je doelen nodig hebt.' },
  { id: 'fasted_training', label: 'nuchter trainen zonder aanleiding',
    why: 'Nuchter lopen levert bij jouw belasting geen aantoonbaar voordeel en kost wel kwaliteit en herstel.' },
  { id: 'low_carb_around_training', label: 'te weinig koolhydraten rond training',
    why: 'Koolhydraten zijn de brandstof waarmee je de sessie verdraagt. Ze wegnemen maakt de training zwaarder, niet effectiever.' },
  { id: 'aggressive_deficit', label: 'een agressief tekort',
    why: 'Sneller afvallen kost spiermassa en herstelvermogen — precies de twee dingen waar dit hele plan op steunt.' },
  { id: 'reduced_recovery', label: 'minder herstel inplannen',
    why: 'Herstel is waar de aanpassing plaatsvindt. Het inkorten maakt de training niet productiever maar alleen zwaarder.' },
];

export function compositionGuard({ logs = {}, currentDate = todayLocal() } = {}) {
  const lim = weeklyLimiter({ logs, currentDate });
  const sessies = recentResponses({ logs, currentDate, days: 14 });
  const laatste = sessies[sessies.length - 1] || null;

  // De omgekeerde fout: afvallen pauzeren omdat één training slechter liep.
  const eenSlechteSessie = laatste && ['poor', 'mild'].includes(laatste.status) &&
    sessies.filter(s => ['poor', 'red'].includes(s.status)).length <= 1;

  return {
    // Een gewichtsdoel mag nooit de limiter zijn waar training op wordt
    // teruggeschroefd. Dat is een harde regel, geen weging.
    weightMayLimitTraining: false,
    currentLimiter: lim.primary,
    limiterIsWeight: lim.primary === LIMITER.ENERGY_AVAILABILITY,
    forbidden: FORBIDDEN_FOR_WEIGHT,
    singleBadSession: eenSlechteSessie,
    rule: 'Het lichaamscompositiedoel is nooit een reden om harder te trainen, minder te eten of minder te herstellen. En één tegenvallende training is nooit een reden om het voedingsplan om te gooien.',
    note: eenSlechteSessie
      ? 'Je laatste sessie liep minder. Dat is één waarneming — geen aanleiding om je voeding aan te passen. Wacht de volgende respons af en kijk naar de trend.'
      : lim.primary === LIMITER.ENERGY_AVAILABILITY
        ? 'De beperking is hier energiebeschikbaarheid: er gaat te weinig in voor wat je vraagt. Dat los je op met méér eten, niet met meer trainen.'
        : null,
  };
}

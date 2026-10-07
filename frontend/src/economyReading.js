// Loopeconomie in context, nooit als kaal getal.
//
// ─────────────────────────────────────────────────────────────────
// WAT ER MIS WAS
//
// "Loopeconomie gaat achteruit — 16 sec/km trager bij vergelijkbare
// hartslag." Eén zin, afgeleid uit twee gemiddelden, gepresenteerd als een
// feit over haar lichaam.
//
// Maar tempo bij een gegeven hartslag beweegt mee met van alles dat niets
// met conditie te maken heeft: waar je in je cyclus zit, hoe je sliep, of
// het zand of asfalt was, hoe warm het was, hoe de sessies ervoor vielen.
// Wie die dingen niet meeweegt, meet omstandigheden en noemt het
// fysiologie. Zij merkte dat zelf op, en ze had gelijk.
//
// ─────────────────────────────────────────────────────────────────
// DE REGEL DIE HIER GELDT
//
// Een uitspraak over economie mag pas als er iets te vergelijken valt, en
// hij draagt altijd zijn verstorende factoren mee. Drie drempels:
//
//   1. GENOEG SESSIES     nooit uit één training, en nooit uit twee. Onder
//                         de zes vergelijkbare runs is er geen uitspraak,
//                         alleen een waarneming.
//   2. VERGELIJKBAAR      liep de ene helft in een andere cyclusfase, na
//                         slechtere nachten of op ander terrein, dan is dat
//                         de eerste verklaring en niet de laatste.
//   3. HAAR EIGEN LEZING  wat zij erbij heeft geschreven telt mee, en staat
//                         erbij.
//
// De uitkomst is daarom geen oordeel maar een gelaagde uitspraak: wat er te
// zien is, wat het kan verklaren, en pas als er niets overblijft de
// conclusie.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, daysBetween } from './datetime';
import { runEconomyTrend } from './pace';
import { cycleDayOf } from './bodyReview';
import { sessionContextFor, contextLines } from './sessionContext';

// Onder dit aantal vergelijkbare sessies doet de app geen uitspraak over
// economie. Twee reeksen van drie is geen trend maar twee weken.
export const MIN_SESSIONS_FOR_VERDICT = 6;

// Hoeveel verschil in cyclusdag maakt twee helften onvergelijkbaar?
// De fasen lopen in blokken van ongeveer een week; meer dan zeven dagen
// gemiddeld verschil betekent dat je andere fasen vergelijkt.
export const CYCLE_PHASE_SPREAD = 7;

// Hoeveel uur slaapverschil telt als verstorend?
export const SLEEP_DIFF_HOURS = 0.5;

const gem = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

// ── De verstorende factoren ─────────────────────────────────────
//
// Per helft wordt opgehaald wat eromheen speelde. Niet om het weg te
// verklaren, maar om te kunnen zeggen wat er nog overblijft als je het
// meeneemt.
export function confounders({ earlyDates = [], lateDates = [], logs = {},
  currentDate = todayLocal() } = {}) {
  const ctxVan = (datums) => datums.map(d => sessionContextFor(d, { logs, asOf: currentDate }));
  const vroeg = ctxVan(earlyDates);
  const laat = ctxVan(lateDates);

  const uit = [];

  // Cyclus. Alleen zinvol als beide helften een bekende dag hebben.
  const cycVroeg = gem(vroeg.map(c => c.cycleDay).filter(x => x != null));
  const cycLaat = gem(laat.map(c => c.cycleDay).filter(x => x != null));
  if (cycVroeg != null && cycLaat != null && Math.abs(cycLaat - cycVroeg) >= CYCLE_PHASE_SPREAD) {
    uit.push({
      id: 'cyclus',
      tekst: `De oudere sessies vielen rond cyclusdag ${Math.round(cycVroeg)}, de recente rond dag ${Math.round(cycLaat)}. Dat zijn verschillende fasen; tempo bij dezelfde hartslag beweegt daarmee mee.`,
      zwaarte: 'groot',
    });
  }

  // Slaap.
  const slVroeg = gem(vroeg.map(c => c.sleepHours).filter(x => x != null));
  const slLaat = gem(laat.map(c => c.sleepHours).filter(x => x != null));
  if (slVroeg != null && slLaat != null && slVroeg - slLaat >= SLEEP_DIFF_HOURS) {
    uit.push({
      id: 'slaap',
      tekst: `Je sliep rond de recente sessies gemiddeld ${(slVroeg - slLaat).toFixed(1)} uur korter (${slLaat.toFixed(1)} tegenover ${slVroeg.toFixed(1)} uur).`,
      zwaarte: 'groot',
    });
  }

  // Antwoorden die zij zelf gaf: ondergrond, weer, tijdstip.
  const telOp = (lijst, veld) => {
    const w = {};
    for (const c of lijst) {
      const v = c.answers?.[veld];
      if (v) w[v] = (w[v] || 0) + 1;
    }
    const top = Object.entries(w).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  };
  for (const [veld, label] of [['ondergrond', 'ondergrond'], ['weer', 'weer'],
    ['tijdstip', 'tijdstip van de dag'], ['gegeten', 'eten vooraf']]) {
    const v = telOp(vroeg, veld), l = telOp(laat, veld);
    if (v && l && v !== l) {
      uit.push({
        id: veld,
        tekst: `Ander ${label}: eerder meestal ${v}, recent meestal ${l}.`,
        zwaarte: veld === 'ondergrond' ? 'groot' : 'matig',
      });
    }
  }

  // Wat zij er zelf bij schreef, woordelijk.
  const notities = [...vroeg, ...laat].filter(c => c.note)
    .map(c => ({ date: c.date, note: c.note }));

  return { items: uit, notes: notities,
    groot: uit.filter(x => x.zwaarte === 'groot').length };
}

// ── De uitspraak ────────────────────────────────────────────────
export function economyReading({ logs = {}, currentDate = todayLocal(),
  continuityGrowing = false, continuityFrom = null, continuityTo = null } = {}) {
  const econ = runEconomyTrend({ currentDate });

  if (!econ.enough) {
    return { level: 'geen', available: false, note: econ.note, econ };
  }

  const punten = econ.points || [];
  const helft = Math.floor(punten.length / 2);
  const vroegD = punten.slice(0, helft).map(p => p.date);
  const laatD = punten.slice(helft).map(p => p.date);
  const stoor = confounders({ earlyDates: vroegD, lateDates: laatD, logs, currentDate });

  const trager = econ.gainSec < -5;
  const sneller = econ.gainSec > 5;
  const basis = `${Math.abs(econ.gainSec)} sec/km ${trager ? 'langzamer' : 'sneller'} bij hartslag ${econ.early.hr} → ${econ.late.hr}, over ${econ.count} vergelijkbare sessies`;

  // 1. Te weinig om iets te vinden.
  if (econ.count < MIN_SESSIONS_FOR_VERDICT) {
    return {
      level: 'waarneming', available: true, econ, confounders: stoor,
      label: 'Nog te weinig om een trend te noemen',
      detail: `${basis}. Dat is te weinig voor een uitspraak: onder ${MIN_SESSIONS_FOR_VERDICT} vergelijkbare sessies is dit een waarneming, geen trend.`,
      askQuestions: false,
    };
  }

  // 2. Stabiel of sneller: geen probleem om te verklaren.
  if (!trager) {
    return {
      level: sneller ? 'vooruit' : 'stabiel', available: true, econ, confounders: stoor,
      label: sneller ? 'Je wordt economischer' : 'Stabiel',
      detail: sneller
        ? `${basis}. Hetzelfde werk voor je hart levert meer snelheid op.`
        : `Looptempo en hartslag zijn stabiel over ${econ.count} sessies. In deze fase is consistentie de winst.`,
      askQuestions: false,
    };
  }

  // 3. Trager, maar de blokken groeien: de ruil die het plan vraagt.
  if (continuityGrowing) {
    return {
      level: 'ruil', available: true, econ, confounders: stoor,
      label: 'Trager, maar langer door',
      detail: `${basis}, terwijl je langste doorlopende blok groeide van ${continuityFrom} naar ${continuityTo} minuten. Dat is de ruil die het plan vraagt: langzamer lopen om de wandelpauzes eruit te krijgen. Uithoudingsvermogen dat toeneemt, geen economie die afneemt.`,
      askQuestions: false,
    };
  }

  // 4. Trager, en er zijn zware verstoringen: dat is de eerste verklaring.
  if (stoor.groot > 0) {
    return {
      level: 'onverklaard', available: true, econ, confounders: stoor,
      label: 'Trager — maar niet vergelijkbaar',
      detail: `${basis}. Voordat dit vormverlies heet: de twee reeksen zijn niet goed vergelijkbaar. ${stoor.items.filter(x => x.zwaarte === 'groot').map(x => x.tekst).join(' ')}`,
      vraag: 'Weet jij wat er anders was? Dan weegt dat mee.',
      askQuestions: true,
    };
  }

  // 5. Trager, geen zware verstoring gevonden — maar er is niet naar
  //    gevraagd. Dat is iets anders dan "er was niets".
  const genoegContext = [...vroegD, ...laatD]
    .map(d => sessionContextFor(d, { logs, asOf: currentDate }))
    .filter(c => c.hasAnswers).length;
  if (genoegContext < Math.ceil(econ.count / 3)) {
    return {
      level: 'onvoldoende_context', available: true, econ, confounders: stoor,
      label: 'Trager — maar ik weet te weinig van de omstandigheden',
      detail: `${basis}. Van ${genoegContext} van de ${econ.count} sessies weet ik waar en wanneer je liep. Zonder dat kan ik niet zeggen of dit je vorm is of de omstandigheden.`,
      vraag: 'Vul bij een paar recente runs in hoe laat je liep, hoe je sliep en waar je liep — dan kan ik dit scheiden.',
      askQuestions: true,
    };
  }

  // 6. Alles afgepeld en het blijft staan.
  return {
    level: 'achteruit', available: true, econ, confounders: stoor,
    label: 'Loopeconomie gaat achteruit',
    detail: `${basis}, zonder dat je doorlopende blokken langer werden en zonder dat cyclus, slaap, ondergrond of weer het verklaren. Dit is het signaal dat telt.`,
    vraag: 'Zie jij zelf nog iets wat dit verklaart?',
    askQuestions: true,
  };
}

// De context van één training, als leesbare regels voor het scherm en de
// coachprompt. Eén bron, twee afnemers.
export function sessionSummary(date, { logs = {}, currentDate = todayLocal() } = {}) {
  const ctx = sessionContextFor(date, { logs, asOf: currentDate });
  return {
    ...ctx,
    lines: contextLines(ctx),
    daysAgo: daysBetween(date, currentDate),
    cycleDayLabel: ctx.cycleDay != null ? `cyclusdag ${ctx.cycleDay}` : 'cyclusdag onbekend',
  };
}

export { cycleDayOf };

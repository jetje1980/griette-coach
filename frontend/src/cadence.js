// Pasfrequentie: hoeveel passen per minuut, en waar die heen mag.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT ERBIJ KOMT
//
// Zij wil sneller lopen bij een lágere hartslag. Er zijn maar drie manieren
// om dat voor elkaar te krijgen: een grotere motor (duurt maanden), sterkere
// benen (duurt weken), of minder energie verspillen per pas (kan binnen
// weken, soms binnen één training).
//
// Dat laatste heet loopeconomie, en de goedkoopste knop eraan is de
// pasfrequentie. Loop je met lange, lage passen, dan land je met je voet
// vóór je lichaam. Elke landing remt je dan een beetje af, en je moet elke
// keer opnieuw versnellen — energie die niet in vooruit gaat zit. Neem je
// kortere, snellere pasjes bij hetzelfde tempo, dan landt je voet onder je
// zwaartepunt, rem je minder af, en kost dezelfde kilometer minder zuurstof.
// Minder zuurstof bij hetzelfde tempo is letterlijk een lagere hartslag.
//
// Haar loopblokken staan rond de 155 passen per minuut. Dat is laag; bij
// recreatieve lopers die hardop zeggen "ik ben traag" is dat bijna altijd
// het beeld. De weg omhoog is niet "ga sneller lopen" maar "neem bij
// hetzelfde tempo kortere pasjes" — en die twee voelen volkomen anders.
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT BESTAND NIET DOET
//
// Het schrijft geen 180 voor. Dat getal komt uit een telling bij olympische
// hardlopers in 1984 en is nooit een norm voor iedereen geweest; de
// optimale frequentie hangt af van beenlengte, tempo en ondergrond. Wat
// wél uit onderzoek komt: een verhoging van ongeveer 5% ten opzichte van je
// eigen frequentie verlaagt de belasting per pas en verbetert meestal de
// economie, en meer dan dat wordt weer duurder.
//
// Dus: het doel is altijd háár gemeten getal plus een paar procent, en het
// staat erbij waar dat getal vandaan komt.
// ─────────────────────────────────────────────────────────────────

import { loadWorkouts } from './workouts';
import { todayLocal, daysBetween } from './datetime';

// Hoeveel procent erbij. Niet meer: boven ongeveer 10% kost een hogere
// frequentie juist weer energie.
export const STAP_PCT = 0.05;

// Boven deze waarde is er geen reden meer om te duwen.
export const BOVENGRENS = 175;

// Strava rapporteert hardloopcadans vaak per been. Een waarde onder deze
// grens is daarom bijna zeker één been en wordt verdubbeld — 78 is geen
// pasfrequentie, 156 wel.
const PER_BEEN_GRENS = 110;

const VENSTER_DAGEN = 42;

function perMinuut(waarde) {
  const n = Number(waarde);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < PER_BEEN_GRENS ? n * 2 : n;
}

// De laps waarin werkelijk gelopen is. Wandelen zit rond de 120 passen en
// zou het gemiddelde omlaag trekken tot een getal dat nergens over gaat.
function loopLaps(w) {
  const laps = Array.isArray(w?.laps) ? w.laps : [];
  return laps.filter(l => {
    if (l?.derivedKind === 'walk') return false;
    const c = perMinuut(l?.cadence);
    if (c == null) return false;
    // Een lap met een cadans onder 130 is wandelen, hoe hij ook heet.
    return c >= 130;
  });
}

export function cadenceTarget({ currentDate = todayLocal(), workouts = null } = {}) {
  const alle = (workouts || loadWorkouts())
    .filter(w => w?.date && w.date <= currentDate
      && daysBetween(w.date, currentDate) <= VENSTER_DAGEN)
    .sort((a, b) => b.date.localeCompare(a.date));

  const metingen = [];
  for (const w of alle) {
    const laps = loopLaps(w);
    if (!laps.length) continue;
    // Gewogen naar looptijd: een lap van acht minuten zegt meer dan een
    // van veertig seconden.
    let tijd = 0, som = 0;
    for (const l of laps) {
      const t = Number(l.movingTime) || 0;
      const c = perMinuut(l.cadence);
      if (!t || c == null) continue;
      tijd += t; som += c * t;
    }
    if (tijd > 0) metingen.push({ date: w.date, spm: som / tijd, seconds: tijd });
  }

  if (!metingen.length) {
    return {
      known: false,
      why: 'Nog geen loopblokken met pasfrequentie in de laatste zes weken. '
        + 'Zodra er één binnenkomt, staat hier je eigen getal met een doel erbij.',
    };
  }

  const huidig = Math.round(metingen.reduce((a, m) => a + m.spm, 0) / metingen.length);
  const doel = Math.min(BOVENGRENS, Math.round(huidig * (1 + STAP_PCT)));

  return {
    known: true,
    current: huidig,
    target: doel,
    delta: doel - huidig,
    sessions: metingen.length,
    lastDate: metingen[0].date,
    line: doel > huidig
      ? `Pasfrequentie: ~${huidig} nu → mik op ${doel} passen per minuut`
      : `Pasfrequentie: ~${huidig} passen per minuut — die zit goed`,
    how: doel > huidig
      ? 'Zelfde tempo, kortere pasjes. Tel tien seconden je rechtervoet en '
        + `vermenigvuldig met twaalf: dat moet richting ${doel}. Een metronoom of `
        + 'muziek op dat aantal slagen werkt beter dan erover nadenken.'
      : 'Houd dit vast; hier valt niets te winnen.',
    why: `Gemeten over ${metingen.length} loopsessie(s), laatste ${metingen[0].date}. `
      + 'Vijf procent erbij verlaagt de klap per pas en verbetert meestal de '
      + 'loopeconomie — bij gelijk tempo dus een lagere hartslag. Meer dan dat '
      + 'wordt weer duurder, en 180 is geen norm maar een telling uit 1984.',
  };
}

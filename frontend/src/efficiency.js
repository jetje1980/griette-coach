// Hoeveel meter loop je per hartslag? De maat voor "sneller bij een lagere
// hartslag".
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT HET GETAL IS DAT HAAR VRAAG BEANTWOORDT
//
// Zij wil twee dingen tegelijk: hartslag omlaag én tempo omhoog. Dat zijn
// op het eerste gezicht twee doelen, maar het is er één — en er bestaat een
// getal voor.
//
// Tempo alleen zegt niets: 9:00/km bij hartslag 150 is iets heel anders dan
// 9:00/km bij 132. Hartslag alleen zegt ook niets: 132 bij 11:00/km is geen
// vooruitgang ten opzichte van 132 bij 9:30. Wat je wilt weten is de
// verhouding: hoeveel meter leg je af per hartslag.
//
//   efficiëntie = meters per minuut ÷ gemiddelde hartslag
//
// Dit heet in de trainingsleer de efficiency factor. Loopt dat getal
// omhoog, dan loop je sneller bij dezelfde hartslag — of dezelfde snelheid
// bij een lagere. Het maakt niet uit welke van de twee; het is hetzelfde
// verschijnsel, en dit is de enige manier om het te zien zonder een
// laboratorium.
//
// Voor haar is dit ook de eerlijkste maat van vooruitgang, omdat tempo op
// zacht zand of in de duinen niets zegt en hartslag op een warme dag ook
// niet. De verhouding corrigeert zichzelf voor een deel van die ruis.
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT GETAL NIET IS
//
// Geen laboratoriummeting. De efficiëntie zakt bij hitte, wind, zacht zand,
// een heuvel, slaaptekort, en in de tweede helft van haar cyclus — in de
// luteale fase ligt de hartslag bij hetzelfde tempo structureel een paar
// slagen hoger. Eén lagere waarde is dus geen achteruitgang; een trend over
// meerdere weken wel.
//
// Daarom: alleen loopblokken van minstens twee minuten (korter en je meet
// vooral de vertraging waarmee je hartslag reageert), nooit één sessie als
// conclusie, en de omstandigheden worden erbij genoemd in plaats van
// weggerekend.
// ─────────────────────────────────────────────────────────────────

import { loadWorkouts } from './workouts';
import { todayLocal, daysBetween } from './datetime';

// Korter dan dit meet je de aanlooptijd van je hartslag, niet je
// efficiëntie: het hart heeft ongeveer een minuut nodig om op een nieuwe
// belasting uit te komen.
const MIN_BLOK_SECONDEN = 120;

// KALIBRATIE, GEEN NATUURWET.
//
// Onder deze snelheid is het wandelen, en wandelen heeft een heel andere
// verhouding tussen snelheid en hartslag: je legt er minder meters mee af
// per hartslag, en dat zou hier als "slechtere efficiëntie" binnenkomen
// terwijl er niets veranderd is.
//
// 95 meter per minuut is 10:30/km, en dat ligt in haar data precies tussen
// de twee: haar wandellaps komen uit op 86–90 m/min (11:08–11:36/km) en
// haar loopblokken op 100–117 (8:33–9:55/km). Gaat zij merkbaar sneller
// wandelen of langzamer lopen, dan hoort dit getal opnieuw bekeken te
// worden — het is afgeleid uit háár sessies en niet uit een handboek.
const MIN_METER_PER_MIN = 95;

const VENSTER_DAGEN = 90;

// Hoeveel loopminuten moet een sessie hebben om als meetpunt te tellen?
//
// Haar sessie van 1 november had één loopblok van bijna drie minuten in
// een uur wandelen. Dat leverde een efficiëntie van 0,828 op — het hoogste
// getal van de maand — en zou de trend omhoog getrokken hebben op grond
// van 170 seconden. Acht minuten lopen is het minimum waarbij een sessie
// iets zegt over hoe je loopt in plaats van over hoe je aan een blokje
// begint.
const MIN_SESSIE_SECONDEN = 480;

// Een meetpunt dat meer dan een kwart van de mediaan afwijkt, is eerder een
// meetfout dan een sprong in vorm — een borstband naast een polsmeting, een
// optische meter die aan je pasfrequentie blijft hangen, of een band die
// losliet. Zulke punten worden niet weggegooid maar apart gezet en gemeld,
// zodat zij zelf kan zeggen wat er die dag anders was.
const UITBIJTER_AFWIJKING = 0.25;

// Eén lap, twee schrijfwijzen.
//
// Deze app slaat laps op als movingTime/avgHr, maar laps die rechtstreeks
// uit Strava komen heten moving_time/average_heartrate, en allBreakdowns
// in pace.js leest allebei. Hier stond alleen de eerste, dus een sessie in
// de andere schrijfwijze leverde stilzwijgend geen enkel loopblok op — en
// dan zegt het scherm "nog geen sessies" terwijl de gegevens er zijn.
const lapSeconden = (l) => Number(l?.movingTime ?? l?.moving_time ?? l?.elapsed_time);
const lapMeters = (l) => Number(l?.distance);
const lapHartslag = (l) => Number(l?.avgHr ?? l?.average_heartrate ?? l?.hr);

function loopBlokken(w) {
  const laps = Array.isArray(w?.laps) ? w.laps : [];
  const uit = [];
  for (const l of laps) {
    if (l?.derivedKind === 'walk') continue;
    const sec = lapSeconden(l);
    const meter = lapMeters(l);
    const hr = lapHartslag(l);
    if (!sec || !meter || !hr) continue;
    if (sec < MIN_BLOK_SECONDEN) continue;
    const mpm = meter / (sec / 60);
    if (mpm < MIN_METER_PER_MIN) continue;
    uit.push({ seconds: sec, meters: meter, hr, mpm, ef: mpm / hr });
  }
  return uit;
}

export function efficiencyOf(workout) {
  const blokken = loopBlokken(workout);
  if (!blokken.length) return null;
  // Gewogen naar tijd: een blok van acht minuten weegt zwaarder dan een
  // van twee.
  const tijd = blokken.reduce((a, b) => a + b.seconds, 0);
  const ef = blokken.reduce((a, b) => a + b.ef * b.seconds, 0) / tijd;
  const hr = blokken.reduce((a, b) => a + b.hr * b.seconds, 0) / tijd;
  const mpm = blokken.reduce((a, b) => a + b.mpm * b.seconds, 0) / tijd;
  return {
    date: workout.date,
    ef: +ef.toFixed(3),
    avgHr: Math.round(hr),
    paceMin: +(1000 / mpm).toFixed(2),
    runSeconds: tijd,
    blocks: blokken.length,
  };
}

const mediaan = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const fmtPace = (min) => {
  if (min == null || !Number.isFinite(min)) return '—';
  const t = Math.round(min * 60);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// Wat zou je lopen bij een gegeven hartslag, met de efficiëntie van nu?
// Dit is een omrekening en geen voorspelling: het zegt wat je huidige
// verhouding oplevert, niet wat je volgende week kunt.
export function paceAtHr(ef, hr) {
  if (!ef || !hr) return null;
  const mpm = ef * hr;
  return +(1000 / mpm).toFixed(2);
}

export function efficiencyTrend({ currentDate = todayLocal(), workouts = null,
  targetHr = 132, window = VENSTER_DAGEN } = {}) {
  const alle = (workouts || loadWorkouts())
    .filter(w => w?.date && w.date <= currentDate && daysBetween(w.date, currentDate) <= window)
    .map(efficiencyOf)
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Te korte sessies zeggen niets over hoe je loopt.
  const telMee = alle.filter(s => s.runSeconds >= MIN_SESSIE_SECONDEN);
  const teKort = alle.filter(s => s.runSeconds < MIN_SESSIE_SECONDEN);

  // Uitbijters eruit voor de trend, maar wél zichtbaar.
  const ruweMediaan = mediaan(telMee.map(s => s.ef));
  const uitbijters = ruweMediaan
    ? telMee.filter(s => Math.abs(s.ef - ruweMediaan) / ruweMediaan > UITBIJTER_AFWIJKING)
    : [];
  const sessies = telMee.filter(s => !uitbijters.includes(s));

  if (!sessies.length) {
    return {
      known: false, sessions: [], tooShort: teKort, outliers: uitbijters,
      why: teKort.length
        ? `Wel ${teKort.length} sessie(s) met hartslag, maar met minder dan acht `
          + 'minuten echt lopen erin. Daar is geen loopeconomie uit te lezen.'
        : 'Nog geen loopblokken van twee minuten of langer mét hartslag in de '
          + 'laatste drie maanden. Zodra die binnenkomen staat hier of je sneller '
          + 'wordt bij dezelfde hartslag.',
    };
  }

  // Mediaan van de laatste drie tegen de drie daarvoor: één sessie is ruis,
  // en een gemiddelde laat zich door één slechte dag meeslepen.
  const laatste = sessies.slice(-3);
  const eerder = sessies.slice(-6, -3);
  const nu = mediaan(laatste.map(s => s.ef));
  const toen = eerder.length ? mediaan(eerder.map(s => s.ef)) : null;
  const deltaPct = toen ? +(((nu - toen) / toen) * 100).toFixed(1) : null;

  const tempoNu = paceAtHr(nu, targetHr);
  const tempoToen = toen ? paceAtHr(toen, targetHr) : null;

  // Hoeveel sessies zijn er nodig voordat een richting iets betekent? Met
  // minder dan zes blokken is elke "trend" een toevalstreffer.
  const genoeg = sessies.length >= 6;

  const richting = deltaPct == null ? 'onbekend'
    : deltaPct >= 2 ? 'beter'
      : deltaPct <= -2 ? 'slechter'
        : 'gelijk';

  const uitbijterTekst = uitbijters.length
    ? ` Buiten de trend gehouden: ${uitbijters.map(u => `${u.date} (${u.ef})`).join(', ')} — `
      + 'dat wijkt zover af dat een meetfout waarschijnlijker is dan een sprong in vorm. '
      + 'Droeg je die dag een andere hartslagmeter?'
    : '';

  return {
    known: true,
    sessions: sessies,
    tooShort: teKort,
    outliers: uitbijters,
    count: sessies.length,
    current: +nu.toFixed(3),
    previous: toen ? +toen.toFixed(3) : null,
    deltaPct,
    direction: richting,
    enough: genoeg,
    targetHr,
    paceAtTarget: tempoNu,
    paceAtTargetBefore: tempoToen,
    line: `Bij hartslag ${targetHr} loop je nu ongeveer ${fmtPace(tempoNu)}/km`,
    verdict: !genoeg
      ? `${sessies.length} van de 6 sessies die nodig zijn om hier een richting uit te lezen. `
        + 'Wat er staat klopt, maar het is nog geen trend.'
      : richting === 'beter'
        ? `Je efficiëntie ging ${deltaPct}% omhoog: bij hartslag ${targetHr} is dat `
          + `${fmtPace(tempoToen)} → ${fmtPace(tempoNu)}/km. Dit is precies wat "sneller `
          + 'bij een lagere hartslag" betekent, en het is gemeten, niet gevoeld.'
        : richting === 'slechter'
          ? `Je efficiëntie zakte ${Math.abs(deltaPct)}%: bij hartslag ${targetHr} van `
            + `${fmtPace(tempoToen)} naar ${fmtPace(tempoNu)}/km. Kijk eerst naar de `
            + 'omstandigheden — zacht zand, hitte, slecht geslapen of de tweede helft '
            + 'van je cyclus verklaren dit vaker dan vormverlies.'
          : `Je efficiëntie staat stil (${deltaPct > 0 ? '+' : ''}${deltaPct}%). Bij hartslag `
            + `${targetHr} is dat ${fmtPace(tempoNu)}/km.`,
    note: 'Meters per minuut gedeeld door je hartslag, over loopblokken van '
      + 'minstens twee minuten in sessies met minstens acht minuten lopen. Zacht '
      + 'zand, hitte, slaaptekort en de luteale fase van je cyclus drukken dit '
      + 'getal zonder dat je vorm verandert — lees de trend, niet één sessie.'
      + uitbijterTekst,
  };
}
